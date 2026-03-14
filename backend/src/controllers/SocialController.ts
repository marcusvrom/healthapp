import path from "path";
import fs from "fs";
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { BlockPost } from "../entities/BlockPost";
import { BlockLike } from "../entities/BlockLike";
import { BlockComment } from "../entities/BlockComment";
import { User } from "../entities/User";
import { Friendship, FriendshipStatus } from "../entities/Friendship";
import { extractExifDateTimeOriginal } from "../utils/exifParser";

const uploadsDir = path.join(process.cwd(), "uploads", "posts");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function postRepo()    { return AppDataSource.getRepository(BlockPost); }
function likeRepo()    { return AppDataSource.getRepository(BlockLike); }
function commentRepo() { return AppDataSource.getRepository(BlockComment); }
function userRepo()    { return AppDataSource.getRepository(User); }

/** Shape returned to the feed client */
interface FeedItem {
  id:            string;
  userId:        string;
  userName:      string;
  avatarUrl:     string | null;
  blockType:     string | null;
  photoUrl:      string | null;
  photoVerified: boolean;
  caption:       string | null;
  likeCount:     number;
  commentCount:  number;
  userLiked:     boolean;
  createdAt:     Date;
}

export class SocialController {
  /**
   * GET /social/feed?page=1&limit=20
   * Returns posts from the user's accepted friends + own posts,
   * ordered newest first with like/comment counts.
   */
  static async feed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page  = Math.max(1, Number(req.query["page"]  ?? 1));
      const limit = Math.min(50, Math.max(1, Number(req.query["limit"] ?? 20)));
      const skip  = (page - 1) * limit;

      // Resolve accepted friend IDs
      const friendships = await AppDataSource.getRepository(Friendship).find({
        where: [
          { requesterId: req.userId, status: FriendshipStatus.ACCEPTED },
          { addresseeId: req.userId, status: FriendshipStatus.ACCEPTED },
        ],
      });
      const friendIds = friendships.map(f =>
        f.requesterId === req.userId ? f.addresseeId : f.requesterId
      );

      // Include own user + friends
      const allowedUserIds = [req.userId, ...friendIds];

      const posts = await postRepo()
        .createQueryBuilder("p")
        .where("p.is_public = true")
        .andWhere("p.user_id IN (:...ids)", { ids: allowedUserIds })
        .orderBy("p.created_at", "DESC")
        .take(limit)
        .skip(skip)
        .getMany();

      if (!posts.length) { res.json([]); return; }

      const postIds  = posts.map(p => p.id);
      const userIds  = [...new Set(posts.map(p => p.userId))];

      // Fetch authors
      const users = await userRepo().findByIds(userIds);
      const userMap = new Map(users.map(u => [u.id, u]));

      // Like counts per post
      const likeCounts = await likeRepo()
        .createQueryBuilder("l")
        .select("l.post_id", "postId")
        .addSelect("COUNT(*)", "cnt")
        .where("l.post_id IN (:...ids)", { ids: postIds })
        .groupBy("l.post_id")
        .getRawMany<{ postId: string; cnt: string }>();
      const likeCountMap = new Map(likeCounts.map(r => [r.postId, Number(r.cnt)]));

      // Comment counts per post
      const commentCounts = await commentRepo()
        .createQueryBuilder("c")
        .select("c.post_id", "postId")
        .addSelect("COUNT(*)", "cnt")
        .where("c.post_id IN (:...ids)", { ids: postIds })
        .groupBy("c.post_id")
        .getRawMany<{ postId: string; cnt: string }>();
      const commentCountMap = new Map(commentCounts.map(r => [r.postId, Number(r.cnt)]));

      // Posts liked by current user
      const myLikes = await likeRepo().find({
        where: postIds.map(id => ({ userId: req.userId, postId: id })),
      });
      const myLikedSet = new Set(myLikes.map(l => l.postId));

      const feed: FeedItem[] = posts.map(p => {
        const author = userMap.get(p.userId);
        return {
          id:            p.id,
          userId:        p.userId,
          userName:      author?.name ?? "Usuário",
          avatarUrl:     author?.avatarUrl ?? null,
          blockType:     p.blockType ?? null,
          photoUrl:      p.photoUrl ?? null,
          photoVerified: p.photoVerified,
          caption:       p.caption ?? null,
          likeCount:     likeCountMap.get(p.id) ?? 0,
          commentCount:  commentCountMap.get(p.id) ?? 0,
          userLiked:     myLikedSet.has(p.id),
          createdAt:     p.createdAt,
        };
      });

      res.json(feed);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /social/posts/:id/like  — toggle like/unlike
   */
  static async toggleLike(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params["id"]!;
      const post = await postRepo().findOneBy({ id: postId, isPublic: true });
      if (!post) { res.status(404).json({ message: "Post não encontrado." }); return; }

      const existing = await likeRepo().findOneBy({ userId: req.userId, postId });
      if (existing) {
        await likeRepo().remove(existing);
        res.json({ liked: false });
      } else {
        await likeRepo().save(likeRepo().create({ userId: req.userId, postId }));
        res.json({ liked: true });
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /social/posts/:id/comments
   */
  static async listComments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params["id"]!;
      const comments = await commentRepo().find({
        where: { postId },
        order: { createdAt: "ASC" },
        relations: ["user"],
      });
      const result = comments.map(c => ({
        id:        c.id,
        userId:    c.userId,
        userName:  c.user?.name ?? "Usuário",
        avatarUrl: c.user?.avatarUrl ?? null,
        body:      c.body,
        createdAt: c.createdAt,
        isOwn:     c.userId === req.userId,
      }));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /social/posts/:id/comments  — { body: string }
   */
  static async addComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params["id"]!;
      const { body } = req.body as { body?: string };
      if (!body?.trim()) {
        res.status(400).json({ message: "Comentário não pode ser vazio." });
        return;
      }
      const post = await postRepo().findOneBy({ id: postId, isPublic: true });
      if (!post) { res.status(404).json({ message: "Post não encontrado." }); return; }

      const comment = commentRepo().create({ userId: req.userId, postId, body: body.trim() });
      await commentRepo().save(comment);

      const user = await userRepo().findOneBy({ id: req.userId });
      res.status(201).json({
        id:        comment.id,
        userId:    comment.userId,
        userName:  user?.name ?? "Usuário",
        avatarUrl: user?.avatarUrl ?? null,
        body:      comment.body,
        createdAt: comment.createdAt,
        isOwn:     true,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /social/comments/:id — delete own comment
   */
  static async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const comment = await commentRepo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!comment) { res.status(404).json({ message: "Comentário não encontrado." }); return; }
      await commentRepo().remove(comment);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /social/posts/mine?page=1&limit=20
   * Returns the authenticated user's own posts, newest first.
   */
  static async myPosts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page  = Math.max(1, Number(req.query["page"]  ?? 1));
      const limit = Math.min(50, Math.max(1, Number(req.query["limit"] ?? 20)));
      const skip  = (page - 1) * limit;

      const posts = await postRepo().find({
        where: { userId: req.userId },
        order: { createdAt: "DESC" },
        take: limit,
        skip,
      });

      if (!posts.length) { res.json([]); return; }

      const postIds = posts.map(p => p.id);

      const likeCounts = await likeRepo()
        .createQueryBuilder("l")
        .select("l.post_id", "postId")
        .addSelect("COUNT(*)", "cnt")
        .where("l.post_id IN (:...ids)", { ids: postIds })
        .groupBy("l.post_id")
        .getRawMany<{ postId: string; cnt: string }>();
      const likeCountMap = new Map(likeCounts.map(r => [r.postId, Number(r.cnt)]));

      const commentCounts = await commentRepo()
        .createQueryBuilder("c")
        .select("c.post_id", "postId")
        .addSelect("COUNT(*)", "cnt")
        .where("c.post_id IN (:...ids)", { ids: postIds })
        .groupBy("c.post_id")
        .getRawMany<{ postId: string; cnt: string }>();
      const commentCountMap = new Map(commentCounts.map(r => [r.postId, Number(r.cnt)]));

      const user = await userRepo().findOneBy({ id: req.userId });

      const result: FeedItem[] = posts.map(p => ({
        id:            p.id,
        userId:        p.userId,
        userName:      user?.name ?? "Você",
        avatarUrl:     user?.avatarUrl ?? null,
        blockType:     p.blockType ?? null,
        photoUrl:      p.photoUrl ?? null,
        photoVerified: p.photoVerified,
        caption:       p.caption ?? null,
        likeCount:     likeCountMap.get(p.id) ?? 0,
        commentCount:  commentCountMap.get(p.id) ?? 0,
        userLiked:     false,
        createdAt:     p.createdAt,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /social/posts/:id — delete own post (removes DB row + photo file)
   */
  static async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await postRepo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!post) { res.status(404).json({ message: "Post não encontrado." }); return; }

      // Remove photo file from disk if present
      if (post.photoUrl) {
        const filePath = path.join(process.cwd(), post.photoUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await postRepo().remove(post);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Helper used by RoutineController to create a post + optionally save photo.
 *
 * Performs light EXIF timestamp verification:
 *  - Extracts DateTimeOriginal from the JPEG EXIF data (pure Buffer, no deps)
 *  - Considers the photo "verified" if its EXIF timestamp is within ±2 hours
 *    of the block's scheduled time window
 *  - photoVerified is informational only — does NOT block the post
 *
 * Returns { post, photoVerified }.
 */
export async function createBlockPost(params: {
  userId: string;
  blockId: string;
  blockType: string;
  photoDataUrl?: string;
  caption?: string;
  isPublic: boolean;
  blockStartTime?: string;  // HH:MM — used for EXIF window check
  blockRoutineDate?: string; // YYYY-MM-DD — used for EXIF window check
}): Promise<{ post: BlockPost; photoVerified: boolean }> {
  let photoUrl:     string | undefined;
  let photoVerified = false;

  if (params.photoDataUrl?.startsWith("data:image/")) {
    const matches = params.photoDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      const ext      = matches[1]!.split("/")[1]!;
      const data     = matches[2]!;
      const imgBuf   = Buffer.from(data, "base64");
      const filename = `post-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, imgBuf);
      photoUrl = `/uploads/posts/${filename}`;

      // ── EXIF timestamp verification ───────────────────────────────────────
      if (params.blockRoutineDate && params.blockStartTime) {
        const exifDt = extractExifDateTimeOriginal(imgBuf);
        if (exifDt) {
          const [hh, mm]     = params.blockStartTime.split(":").map(Number);
          const blockExpected = new Date(`${params.blockRoutineDate}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`);
          const diffMs        = Math.abs(exifDt.getTime() - blockExpected.getTime());
          const twoHoursMs    = 2 * 60 * 60 * 1000;
          photoVerified       = diffMs <= twoHoursMs;
        }
      }
    }
  }

  const post = await postRepo().save(postRepo().create({
    userId:        params.userId,
    blockId:       params.blockId,
    blockType:     params.blockType,
    photoUrl,
    caption:       params.caption?.trim() || undefined,
    isPublic:      params.isPublic,
    photoVerified,
  }));

  return { post, photoVerified };
}
