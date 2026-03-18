import cron from "node-cron";
import webpush from "web-push";
import { AppDataSource } from "../config/typeorm.config";
import { RoutineBlock, BlockType } from "../entities/RoutineBlock";
import { BlockCompletion } from "../entities/BlockCompletion";
import { PushSubscription } from "../entities/PushSubscription";
import { Notification, NotificationType } from "../entities/Notification";
import { User } from "../entities/User";
import { env } from "../config/env";

// ── VAPID setup ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     ?? "mailto:dev@airafit.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log("[PUSH] VAPID configurado.");
} else {
  console.warn("[PUSH] VAPID keys não configuradas — push notifications desabilitadas.");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

const BLOCK_ICONS: Partial<Record<BlockType, string>> = {
  [BlockType.MEAL]:       "🍽️",
  [BlockType.WATER]:      "💧",
  [BlockType.EXERCISE]:   "💪",
  [BlockType.MEDICATION]: "💊",
  [BlockType.SLEEP]:      "😴",
  [BlockType.SUN_EXPOSURE]: "☀️",
};

const BLOCK_NOTIF_TYPE: Partial<Record<BlockType, NotificationType>> = {
  [BlockType.MEAL]:       NotificationType.MEAL_REMINDER,
  [BlockType.WATER]:      NotificationType.WATER_REMINDER,
  [BlockType.EXERCISE]:   NotificationType.EXERCISE_REMINDER,
  [BlockType.MEDICATION]: NotificationType.MEDICATION_REMINDER,
};

// ── Core scheduler logic ─────────────────────────────────────────────────────

async function checkAndSendReminders(): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Find blocks starting in the next 5 minutes
  const windowStart = nowMin;
  const windowEnd = nowMin + 5;
  const startTimeFrom = `${pad2(Math.floor(windowStart / 60))}:${pad2(windowStart % 60)}`;
  const startTimeTo = `${pad2(Math.floor(windowEnd / 60) % 24)}:${pad2(windowEnd % 60)}`;

  try {
    // Get all blocks that start within the window
    const blocks = await AppDataSource.getRepository(RoutineBlock)
      .createQueryBuilder("b")
      .innerJoin(User, "u", "u.id = b.user_id AND u.notifications_enabled = true AND u.is_active = true")
      .where(
        `(
          (b.is_recurring = false AND b.routine_date = :today)
          OR
          (b.is_recurring = true AND b.days_of_week @> :dow::jsonb)
        )`,
        { today, dow: JSON.stringify([dayOfWeek]) }
      )
      .andWhere("b.start_time >= :from AND b.start_time < :to", {
        from: startTimeFrom,
        to: startTimeTo,
      })
      .andWhere("b.type IN (:...types)", {
        types: [BlockType.MEAL, BlockType.WATER, BlockType.EXERCISE, BlockType.MEDICATION, BlockType.SLEEP, BlockType.SUN_EXPOSURE],
      })
      .getMany();

    if (blocks.length === 0) return;

    // Filter out blocks already completed today
    const blockIds = blocks.map(b => b.id);
    const completions = await AppDataSource.getRepository(BlockCompletion)
      .createQueryBuilder("c")
      .where("c.block_id IN (:...blockIds)", { blockIds })
      .andWhere("c.completion_date = :today", { today })
      .getMany();

    const completedBlockIds = new Set(completions.map(c => c.blockId));
    const pendingBlocks = blocks.filter(b => !completedBlockIds.has(b.id));

    if (pendingBlocks.length === 0) return;

    // Group blocks by user
    const blocksByUser = new Map<string, RoutineBlock[]>();
    for (const b of pendingBlocks) {
      const list = blocksByUser.get(b.userId) ?? [];
      list.push(b);
      blocksByUser.set(b.userId, list);
    }

    // Send notifications per user
    const notifRepo = AppDataSource.getRepository(Notification);
    const subRepo = AppDataSource.getRepository(PushSubscription);

    for (const [userId, userBlocks] of blocksByUser) {
      const subs = await subRepo.find({ where: { userId, isActive: true } });
      if (subs.length === 0) continue;

      for (const block of userBlocks) {
        const icon = BLOCK_ICONS[block.type] ?? "📋";
        const title = `${icon} ${block.label}`;
        const body = `Hora de ${block.label.toLowerCase()} — ${block.startTime}`;

        // Save in-app notification
        const notif = notifRepo.create({
          userId,
          type: BLOCK_NOTIF_TYPE[block.type] ?? NotificationType.BLOCK_REMINDER,
          title,
          message: body,
          blockId: block.id,
          scheduledTime: block.startTime,
          notificationDate: today,
        });
        await notifRepo.save(notif);

        // Send push to all user's subscriptions
        const payload = JSON.stringify({
          title,
          body,
          icon: "/assets/brand/airafit-icon-192.png",
          badge: "/assets/brand/airafit-badge-72.png",
          data: { blockId: block.id, blockType: block.type, url: "/dashboard" },
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { auth: sub.authKey, p256dh: sub.p256dhKey },
              },
              payload
            );
          } catch (err: any) {
            // 410 Gone or 404 = subscription expired, deactivate it
            if (err.statusCode === 410 || err.statusCode === 404) {
              await subRepo.update({ id: sub.id }, { isActive: false });
            }
          }
        }
      }
    }

    console.log(`[SCHEDULER] Enviou ${pendingBlocks.length} lembretes para ${blocksByUser.size} usuário(s).`);
  } catch (err) {
    console.error("[SCHEDULER] Erro ao enviar lembretes:", err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export class NotificationScheduler {
  private static task: ReturnType<typeof cron.schedule> | null = null;

  /** Start the cron job — runs every minute */
  static start(): void {
    if (NotificationScheduler.task) return;

    NotificationScheduler.task = cron.schedule("* * * * *", () => {
      checkAndSendReminders().catch(err =>
        console.error("[SCHEDULER] Falha não tratada:", err)
      );
    });

    console.log("[SCHEDULER] Iniciado — verificando lembretes a cada minuto.");
  }

  /** Stop the cron job (for graceful shutdown) */
  static stop(): void {
    if (NotificationScheduler.task) {
      NotificationScheduler.task.stop();
      NotificationScheduler.task = null;
      console.log("[SCHEDULER] Parado.");
    }
  }
}
