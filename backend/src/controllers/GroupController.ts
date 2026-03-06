import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { Group } from "../entities/Group";
import { GroupMember } from "../entities/GroupMember";
import { User } from "../entities/User";
import { XpLog } from "../entities/XpLog";
import { ChallengeService } from "../services/ChallengeService";
import { GamificationService } from "../services/GamificationService";

function groupRepo()  { return AppDataSource.getRepository(Group); }
function memberRepo() { return AppDataSource.getRepository(GroupMember); }
function userRepo()   { return AppDataSource.getRepository(User); }
function xpLogRepo()  { return AppDataSource.getRepository(XpLog); }

/** Generates a random 8-character alphanumeric invite code. */
function genCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase() +
         Math.random().toString(36).slice(2, 6).toUpperCase();
}

interface MemberEntry {
  userId:     string;
  name:       string;
  avatarUrl:  string | null;
  weeklyXp:   number;
  totalXp:    number;
  level:      number;
  levelTitle: string;
  joinedAt:   Date;
}

export class GroupController {
  /**
   * GET /groups
   * Returns all groups the authenticated user belongs to.
   */
  static async myGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberships = await memberRepo().find({ where: { userId: req.userId } });
      if (!memberships.length) { res.json([]); return; }

      const groupIds = memberships.map(m => m.groupId);
      const groups   = await groupRepo().findByIds(groupIds);

      // Attach member counts
      const counts = await memberRepo()
        .createQueryBuilder("m")
        .select("m.group_id", "groupId")
        .addSelect("COUNT(*)", "cnt")
        .where("m.group_id IN (:...ids)", { ids: groupIds })
        .groupBy("m.group_id")
        .getRawMany<{ groupId: string; cnt: string }>();
      const countMap = new Map(counts.map(r => [r.groupId, Number(r.cnt)]));

      const result = groups.map(g => ({
        ...g,
        memberCount: countMap.get(g.id) ?? 0,
        isOwner: g.ownerId === req.userId,
      }));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /groups  — { name, description?, avatarEmoji? }
   * Creates a new group and makes the creator the owner + first member.
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, avatarEmoji } = req.body as {
        name?: string; description?: string; avatarEmoji?: string;
      };
      if (!name?.trim()) {
        res.status(400).json({ message: "Nome do grupo é obrigatório." });
        return;
      }

      // Ensure unique invite code
      let inviteCode = genCode();
      while (await groupRepo().findOneBy({ inviteCode })) {
        inviteCode = genCode();
      }

      const group = await groupRepo().save(groupRepo().create({
        name: name.trim(),
        description: description?.trim() || undefined,
        avatarEmoji: avatarEmoji ?? "👥",
        ownerId: req.userId,
        inviteCode,
      }));

      await memberRepo().save(memberRepo().create({ userId: req.userId, groupId: group.id }));
      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /groups/join/:code  — joins a group by invite code.
   */
  static async joinByCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = (req.params["code"] ?? "").toUpperCase();
      const group = await groupRepo().findOneBy({ inviteCode: code, isActive: true });
      if (!group) {
        res.status(404).json({ message: "Código de convite inválido." });
        return;
      }

      const existing = await memberRepo().findOneBy({ userId: req.userId, groupId: group.id });
      if (existing) {
        res.status(200).json({ group, alreadyMember: true });
        return;
      }

      await memberRepo().save(memberRepo().create({ userId: req.userId, groupId: group.id }));
      res.status(201).json({ group, alreadyMember: false });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /groups/:id/leave  — removes the caller from the group.
   * If caller is the owner and last member, deletes the group.
   */
  static async leave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const groupId = req.params["id"]!;
      const membership = await memberRepo().findOneBy({ userId: req.userId, groupId });
      if (!membership) {
        res.status(404).json({ message: "Você não faz parte deste grupo." });
        return;
      }

      await memberRepo().remove(membership);

      const remaining = await memberRepo().countBy({ groupId });
      if (remaining === 0) {
        await groupRepo().delete({ id: groupId });
      }

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /groups/:id
   * Returns group details, member leaderboard (weekly XP), and challenge progress.
   */
  static async detail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const groupId = req.params["id"]!;
      const group   = await groupRepo().findOneBy({ id: groupId });
      if (!group) { res.status(404).json({ message: "Grupo não encontrado." }); return; }

      // Verify caller is a member
      const myMembership = await memberRepo().findOneBy({ userId: req.userId, groupId });
      if (!myMembership) {
        res.status(403).json({ message: "Você não é membro deste grupo." });
        return;
      }

      const members  = await memberRepo().find({ where: { groupId } });
      const userIds  = members.map(m => m.userId);
      const users    = await userRepo().findByIds(userIds);
      const userMap  = new Map(users.map(u => [u.id, u]));
      const membershipDateMap = new Map(members.map(m => [m.userId, m.joinedAt]));

      // Weekly XP per member
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const xpRows = await xpLogRepo()
        .createQueryBuilder("l")
        .select("l.user_id", "userId")
        .addSelect("COALESCE(SUM(l.amount), 0)", "weeklyXp")
        .where("l.user_id IN (:...ids)", { ids: userIds })
        .andWhere("l.awarded_at >= :since", { since })
        .groupBy("l.user_id")
        .getRawMany<{ userId: string; weeklyXp: string }>();
      const xpMap = new Map(xpRows.map(r => [r.userId, Number(r.weeklyXp)]));

      const leaderboard: MemberEntry[] = userIds.map(uid => {
        const user    = userMap.get(uid);
        const weeklyXp = xpMap.get(uid) ?? 0;
        const totalXp  = user?.xp ?? 0;
        const { level, title } = GamificationService.levelFromXp(totalXp);
        return {
          userId:     uid,
          name:       user?.name ?? "Usuário",
          avatarUrl:  user?.avatarUrl ?? null,
          weeklyXp,
          totalXp,
          level,
          levelTitle: title,
          joinedAt:   membershipDateMap.get(uid)!,
        };
      }).sort((a, b) => b.weeklyXp - a.weeklyXp);

      // Collective challenge progress for each active challenge this week
      const activeChallenges = await ChallengeService.getActiveChallenges(req.userId);
      const collectiveProgress = await Promise.all(
        activeChallenges.map(async c => {
          // Sum completions for all members
          const { RoutineBlock } = await import("../entities/RoutineBlock");
          const count = await AppDataSource.getRepository(RoutineBlock)
            .createQueryBuilder("b")
            .where("b.user_id IN (:...uids)", { uids: userIds })
            .andWhere("b.completed_at IS NOT NULL")
            .andWhere("b.routine_date >= :start", { start: c.weekStart })
            .andWhere("b.routine_date <= :end",   { end:   c.weekEnd })
            .andWhere(
              c.category === "any" ? "1=1" : "b.type = :cat",
              c.category === "any" ? {} : { cat: c.category }
            )
            .getCount();

          const collectiveTarget = c.targetCount * members.length;
          return {
            challengeId:    c.id,
            title:          c.title,
            emoji:          c.emoji,
            category:       c.category,
            collectiveTarget,
            collectiveProgress: count,
            completed:      count >= collectiveTarget,
          };
        })
      );

      res.json({
        group,
        isOwner:            group.ownerId === req.userId,
        memberCount:        members.length,
        leaderboard,
        collectiveProgress,
      });
    } catch (err) {
      next(err);
    }
  }
}
