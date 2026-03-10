import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { Friendship, FriendshipStatus } from "../entities/Friendship";
import { toPublicProfile, toPublicProfileBatch, PublicProfileDto } from "../utils/publicProfile";

// ─── Friendship context appended to each public profile ──────────────────────

interface FriendshipContext {
  status:       FriendshipStatus | "NONE";
  friendshipId: string | null;
  iAmRequester: boolean;
}

interface PublicProfileWithFriendship extends PublicProfileDto {
  friendship: FriendshipContext;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFriendshipContext(
  friendship: Friendship | null,
  myId: string,
): FriendshipContext {
  if (!friendship) return { status: "NONE", friendshipId: null, iAmRequester: false };
  return {
    status:       friendship.status,
    friendshipId: friendship.id,
    iAmRequester: friendship.requesterId === myId,
  };
}

async function findFriendship(myId: string, otherId: string): Promise<Friendship | null> {
  return AppDataSource.getRepository(Friendship).findOne({
    where: [
      { requesterId: myId,    addresseeId: otherId },
      { requesterId: otherId, addresseeId: myId    },
    ],
  });
}

async function findFriendshipBatch(
  myId: string,
  otherIds: string[],
): Promise<Map<string, Friendship>> {
  if (!otherIds.length) return new Map();

  const rows = await AppDataSource.getRepository(Friendship)
    .createQueryBuilder("f")
    .where(
      "(f.requester_id = :me AND f.addressee_id IN (:...ids))" +
      " OR (f.addressee_id = :me AND f.requester_id IN (:...ids))",
      { me: myId, ids: otherIds },
    )
    .getMany();

  const map = new Map<string, Friendship>();
  for (const f of rows) {
    const otherId = f.requesterId === myId ? f.addresseeId : f.requesterId;
    map.set(otherId, f);
  }
  return map;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class CommunityController {
  private static get userRepo()       { return AppDataSource.getRepository(User); }

  /**
   * GET /community/search?q={nome}&limit={n}
   *
   * Full-text search by name. Returns public profiles + friendship status for
   * each result. Excludes the calling user from results.
   *
   * Query params:
   *   q     – search term (min 2 chars)
   *   limit – max results (1–50, default 20)
   */
  static async search(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const q     = String(req.query["q"] ?? "").trim();
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10) || 20));

      if (q.length < 2) { res.json([]); return; }

      const users = await CommunityController.userRepo
        .createQueryBuilder("u")
        .where("u.name ILIKE :q", { q: `%${q}%` })
        .andWhere("u.id != :me", { me: req.userId })
        .andWhere("u.is_active = true")
        .orderBy("u.xp", "DESC")
        .limit(limit)
        .getMany();

      if (!users.length) { res.json([]); return; }

      const [profiles, friendshipMap] = await Promise.all([
        toPublicProfileBatch(users),
        findFriendshipBatch(req.userId, users.map(u => u.id)),
      ]);

      const result: PublicProfileWithFriendship[] = profiles.map(p => ({
        ...p,
        friendship: buildFriendshipContext(friendshipMap.get(p.id) ?? null, req.userId),
      }));

      res.json(result);
    } catch (err) { next(err); }
  }

  /**
   * GET /community/profile/:id
   *
   * Returns the public profile of a specific user plus the calling user's
   * friendship status with them.
   */
  static async profile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const user = await CommunityController.userRepo.findOne({
        where: { id, isActive: true },
      });
      if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

      const [publicProfile, friendship] = await Promise.all([
        toPublicProfile(user),
        findFriendship(req.userId, id),
      ]);

      const result: PublicProfileWithFriendship = {
        ...publicProfile,
        friendship: buildFriendshipContext(friendship, req.userId),
      };

      res.json(result);
    } catch (err) { next(err); }
  }
}
