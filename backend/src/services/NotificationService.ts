import { AppDataSource } from "../config/typeorm.config";
import { Notification, NotificationType } from "../entities/Notification";
import { PushSubscription } from "../entities/PushSubscription";
import { User } from "../entities/User";
import { RoutineBlock, BlockType } from "../entities/RoutineBlock";

function notifRepo() {
  return AppDataSource.getRepository(Notification);
}
function subRepo() {
  return AppDataSource.getRepository(PushSubscription);
}
function userRepo() {
  return AppDataSource.getRepository(User);
}
function blockRepo() {
  return AppDataSource.getRepository(RoutineBlock);
}

const BLOCK_TYPE_TO_NOTIF: Partial<Record<BlockType, NotificationType>> = {
  [BlockType.MEAL]:       NotificationType.MEAL_REMINDER,
  [BlockType.WATER]:      NotificationType.WATER_REMINDER,
  [BlockType.EXERCISE]:   NotificationType.EXERCISE_REMINDER,
  [BlockType.MEDICATION]: NotificationType.MEDICATION_REMINDER,
};

export class NotificationService {
  /** List recent notifications for a user (paginated, newest first) */
  static async list(userId: string, limit = 30, offset = 0): Promise<Notification[]> {
    return notifRepo().find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  /** Count unread notifications */
  static async unreadCount(userId: string): Promise<number> {
    return notifRepo().count({ where: { userId, isRead: false } });
  }

  /** Mark a single notification as read */
  static async markRead(userId: string, notificationId: string): Promise<void> {
    await notifRepo().update({ id: notificationId, userId }, { isRead: true });
  }

  /** Mark all notifications as read */
  static async markAllRead(userId: string): Promise<void> {
    await notifRepo().update({ userId, isRead: false }, { isRead: true });
  }

  /** Create a notification for a routine block */
  static async createForBlock(userId: string, blockId: string, date: string): Promise<Notification> {
    const block = await blockRepo().findOne({ where: { id: blockId, userId } });
    if (!block) throw new Error("Block not found");

    const type = BLOCK_TYPE_TO_NOTIF[block.type] ?? NotificationType.BLOCK_REMINDER;
    const notif = notifRepo().create({
      userId,
      type,
      title: block.label,
      message: `Lembrete: ${block.label} as ${block.startTime}`,
      blockId: block.id,
      scheduledTime: block.startTime,
      notificationDate: date,
    });
    return notifRepo().save(notif);
  }

  /** Generate notifications for all blocks on a given date */
  static async generateForDate(userId: string, date: string): Promise<Notification[]> {
    const blocks = await blockRepo().find({ where: { userId } });
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    const todayBlocks = blocks.filter(
      (b) =>
        b.routineDate === date ||
        (b.isRecurring && b.daysOfWeek.includes(dayOfWeek))
    );

    // Remove old notifications for this date
    await notifRepo().delete({ userId, notificationDate: date });

    const notifications: Notification[] = [];
    for (const block of todayBlocks) {
      const type = BLOCK_TYPE_TO_NOTIF[block.type] ?? NotificationType.BLOCK_REMINDER;
      const notif = notifRepo().create({
        userId,
        type,
        title: block.label,
        message: `Lembrete: ${block.label} as ${block.startTime}`,
        blockId: block.id,
        scheduledTime: block.startTime,
        notificationDate: date,
      });
      notifications.push(notif);
    }

    if (notifications.length > 0) {
      return notifRepo().save(notifications);
    }
    return [];
  }

  // ── Push subscription management ────────────────────────────────────────────

  static async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { auth: string; p256dh: string } }
  ): Promise<PushSubscription> {
    // Upsert by endpoint
    const existing = await subRepo().findOne({ where: { endpoint: sub.endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.authKey = sub.keys.auth;
      existing.p256dhKey = sub.keys.p256dh;
      existing.isActive = true;
      return subRepo().save(existing);
    }

    const record = subRepo().create({
      userId,
      endpoint: sub.endpoint,
      authKey: sub.keys.auth,
      p256dhKey: sub.keys.p256dh,
    });
    return subRepo().save(record);
  }

  static async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await subRepo().update({ userId, endpoint }, { isActive: false });
  }

  static async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return subRepo().find({ where: { userId, isActive: true } });
  }

  // ── User notification preference ─────────────────────────────────────────────

  static async getPreference(userId: string): Promise<boolean> {
    const user = await userRepo().findOne({ where: { id: userId } });
    return user?.notificationsEnabled ?? true;
  }

  static async setPreference(userId: string, enabled: boolean): Promise<void> {
    await userRepo().update({ id: userId }, { notificationsEnabled: enabled });
    if (!enabled) {
      await subRepo().update({ userId }, { isActive: false });
    }
  }
}
