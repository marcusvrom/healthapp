import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { Friendship, FriendshipStatus } from "../entities/Friendship";
import { User } from "../entities/User";
import { GamificationService } from "../services/GamificationService";

export class FriendshipController {
  private static get repo() { return AppDataSource.getRepository(Friendship); }
  private static get userRepo() { return AppDataSource.getRepository(User); }

  /**
   * POST /friends/request
   * Body: { addresseeId: string }
   */
  static async sendRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addresseeId } = req.body as { addresseeId: string };
      if (!addresseeId || addresseeId === req.userId) {
        res.status(400).json({ error: "addresseeId inválido" });
        return;
      }

      const addressee = await FriendshipController.userRepo.findOneBy({ id: addresseeId });
      if (!addressee) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

      const existing = await FriendshipController.repo.findOne({
        where: [
          { requesterId: req.userId, addresseeId },
          { requesterId: addresseeId, addresseeId: req.userId },
        ],
      });
      if (existing) { res.status(409).json({ error: "Solicitação já existe", status: existing.status }); return; }

      const friendship = FriendshipController.repo.create({
        requesterId: req.userId,
        addresseeId,
        status: FriendshipStatus.PENDING,
      });
      await FriendshipController.repo.save(friendship);
      res.status(201).json(friendship);
    } catch (err) { next(err); }
  }

  /**
   * PATCH /friends/:id/accept
   */
  static async accept(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const friendship = await FriendshipController.repo.findOneBy({ id, addresseeId: req.userId });
      if (!friendship) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
      if (friendship.status !== FriendshipStatus.PENDING) {
        res.status(409).json({ error: "Solicitação já foi processada" }); return;
      }
      friendship.status = FriendshipStatus.ACCEPTED;
      await FriendshipController.repo.save(friendship);
      res.json(friendship);
    } catch (err) { next(err); }
  }

  /**
   * PATCH /friends/:id/decline
   */
  static async decline(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const friendship = await FriendshipController.repo.findOneBy({ id, addresseeId: req.userId });
      if (!friendship) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
      friendship.status = FriendshipStatus.DECLINED;
      await FriendshipController.repo.save(friendship);
      res.json(friendship);
    } catch (err) { next(err); }
  }

  /**
   * DELETE /friends/:id
   * The requesting or addressee user can remove a friendship.
   */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const friendship = await FriendshipController.repo.findOne({
        where: [
          { id, requesterId: req.userId },
          { id, addresseeId: req.userId },
        ],
      });
      if (!friendship) { res.status(404).json({ error: "Amizade não encontrada" }); return; }
      await FriendshipController.repo.remove(friendship);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  /**
   * GET /friends
   * Lists accepted friends with their public profile (level, XP, city).
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const friendships = await FriendshipController.repo.find({
        where: [
          { requesterId: req.userId, status: FriendshipStatus.ACCEPTED },
          { addresseeId: req.userId, status: FriendshipStatus.ACCEPTED },
        ],
      });

      const friendIds = friendships.map(f =>
        f.requesterId === req.userId ? f.addresseeId : f.requesterId
      );

      if (!friendIds.length) { res.json([]); return; }

      const users = await FriendshipController.userRepo
        .createQueryBuilder("u")
        .whereInIds(friendIds)
        .getMany();

      const result = users.map(u => {
        const { level, title } = GamificationService.levelFromXp(u.xp);
        return {
          userId:     u.id,
          name:       u.name,
          avatarUrl:  u.avatarUrl ?? null,
          level,
          levelTitle: title,
          totalXp:    u.xp,
          city:       u.city ?? null,
          state:      u.state ?? null,
        };
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  /**
   * GET /friends/pending
   * Pending requests addressed to the current user.
   */
  static async pending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pendingList = await FriendshipController.repo.find({
        where: { addresseeId: req.userId, status: FriendshipStatus.PENDING },
        order: { createdAt: "DESC" },
      });

      const requesterIds = pendingList.map(f => f.requesterId);
      if (!requesterIds.length) { res.json([]); return; }

      const users = await FriendshipController.userRepo
        .createQueryBuilder("u")
        .whereInIds(requesterIds)
        .getMany();
      const userMap = new Map(users.map(u => [u.id, u]));

      const result = pendingList.map(f => {
        const u = userMap.get(f.requesterId);
        return {
          friendshipId: f.id,
          userId:       f.requesterId,
          name:         u?.name ?? "Usuário",
          avatarUrl:    u?.avatarUrl ?? null,
          createdAt:    f.createdAt,
        };
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  /**
   * GET /friends/search?q=nome
   * Searches public users by name to add as friend.
   */
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query["q"] ?? "").trim();
      if (q.length < 2) { res.json([]); return; }

      const users = await FriendshipController.userRepo
        .createQueryBuilder("u")
        .where("u.name ILIKE :q", { q: `%${q}%` })
        .andWhere("u.id != :uid", { uid: req.userId })
        .limit(20)
        .getMany();

      const result = users.map(u => ({
        userId:   u.id,
        name:     u.name,
        avatarUrl: u.avatarUrl ?? null,
        city:     u.city ?? null,
        state:    u.state ?? null,
      }));
      res.json(result);
    } catch (err) { next(err); }
  }
}
