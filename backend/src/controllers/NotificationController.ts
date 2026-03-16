import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { NotificationService } from "../services/NotificationService";

export class NotificationController {
  /** GET /notifications */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const offset = Number(req.query.offset) || 0;
      const notifications = await NotificationService.list(req.userId, limit, offset);
      const unreadCount = await NotificationService.unreadCount(req.userId);
      res.json({ notifications, unreadCount });
    } catch (err) {
      next(err);
    }
  }

  /** GET /notifications/unread-count */
  static async unreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await NotificationService.unreadCount(req.userId);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /notifications/:id/read */
  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markRead(req.userId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /notifications/read-all */
  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await NotificationService.markAllRead(req.userId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /** POST /notifications/generate — generate notifications for today's blocks */
  static async generate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const notifications = await NotificationService.generateForDate(req.userId, date);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  }

  /** POST /notifications/subscribe — register push subscription */
  static async subscribe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.auth || !keys?.p256dh) {
        res.status(400).json({ error: "Invalid subscription data" });
        return;
      }
      const sub = await NotificationService.subscribe(req.userId, { endpoint, keys });
      res.json(sub);
    } catch (err) {
      next(err);
    }
  }

  /** POST /notifications/unsubscribe */
  static async unsubscribe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        res.status(400).json({ error: "Endpoint required" });
        return;
      }
      await NotificationService.unsubscribe(req.userId, endpoint);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /** GET /notifications/preference */
  static async getPreference(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const enabled = await NotificationService.getPreference(req.userId);
      res.json({ enabled });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /notifications/preference */
  static async setPreference(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled } = req.body;
      await NotificationService.setPreference(req.userId, !!enabled);
      res.json({ ok: true, enabled: !!enabled });
    } catch (err) {
      next(err);
    }
  }
}
