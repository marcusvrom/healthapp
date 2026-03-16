import { Injectable, inject, signal } from '@angular/core';
import { Observable, timer, switchMap, tap, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { AppNotification, NotificationListResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);

  /** All loaded notifications */
  readonly notifications = signal<AppNotification[]>([]);

  /** Badge count of unread notifications */
  readonly unreadCount = signal<number>(0);

  /** Whether push notifications are enabled for this user */
  readonly pushEnabled = signal<boolean>(false);

  /** Whether the browser supports push notifications */
  readonly pushSupported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;

  /** Current browser permission state */
  readonly permissionState = signal<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );

  // ── API methods ──────────────────────────────────────────────────────────────

  list(limit = 30, offset = 0): Observable<NotificationListResponse> {
    return this.api.get<NotificationListResponse>('/notifications', {
      limit: String(limit),
      offset: String(offset),
    }).pipe(
      tap(res => {
        this.notifications.set(res.notifications);
        this.unreadCount.set(res.unreadCount);
      })
    );
  }

  refreshUnreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('/notifications/unread-count').pipe(
      tap(res => this.unreadCount.set(res.count))
    );
  }

  markRead(id: string): Observable<unknown> {
    return this.api.patch(`/notifications/${id}/read`, {}).pipe(
      tap(() => {
        this.notifications.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        this.unreadCount.update(c => Math.max(0, c - 1));
      })
    );
  }

  markAllRead(): Observable<unknown> {
    return this.api.patch('/notifications/read-all', {}).pipe(
      tap(() => {
        this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
      })
    );
  }

  generate(date?: string): Observable<AppNotification[]> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.api.post<AppNotification[]>(
      `/notifications/generate${date ? '?date=' + date : ''}`,
      {}
    );
  }

  // ── Push subscription ────────────────────────────────────────────────────────

  getPreference(): Observable<{ enabled: boolean }> {
    return this.api.get<{ enabled: boolean }>('/notifications/preference').pipe(
      tap(res => this.pushEnabled.set(res.enabled))
    );
  }

  setPreference(enabled: boolean): Observable<unknown> {
    return this.api.patch('/notifications/preference', { enabled }).pipe(
      tap(() => this.pushEnabled.set(enabled))
    );
  }

  subscribe(sub: PushSubscription): Observable<unknown> {
    const json = sub.toJSON();
    return this.api.post('/notifications/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
    });
  }

  unsubscribe(endpoint: string): Observable<unknown> {
    return this.api.post('/notifications/unsubscribe', { endpoint });
  }

  // ── Browser push permission ──────────────────────────────────────────────────

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.pushSupported) return 'denied';
    const result = await Notification.requestPermission();
    this.permissionState.set(result);
    return result;
  }

  /** Start polling unread count every 60 seconds */
  startPolling(): void {
    timer(0, 60_000).pipe(
      switchMap(() => this.refreshUnreadCount().pipe(catchError(() => of({ count: 0 }))))
    ).subscribe();
  }

  // ── Local browser notification ─────────────────────────────────────────────

  showLocalNotification(title: string, body: string): void {
    if (!this.pushSupported || Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
    });
  }
}
