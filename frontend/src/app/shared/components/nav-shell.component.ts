import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../environments/environment';
import { CommonModule, DatePipe } from '@angular/common';
import { AppNotification } from '../../core/models';

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  styleUrls: ['./nav-shell.component.scss'],
  templateUrl: './nav-shell.component.html',
})
export class NavShellComponent implements OnInit {
  private auth    = inject(AuthService);
  private userSvc = inject(UserService);
  readonly theme  = inject(ThemeService);
  readonly notifSvc = inject(NotificationService);

  readonly apiBase = environment.apiUrl.replace('/api/v1', '');

  userName  = signal<string>('Minha conta');
  userLevel = signal<number>(1);
  avatarUrl = signal<string | null>(null);
  isMobileMenuOpen = signal(false);
  notifDropdownOpen = signal(false);

  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({
      next: (u) => {
        if (u.name)      this.userName.set(u.name);
        if (u.xp)        this.userLevel.set(this.calculateLevel(u.xp));
        if (u.avatarUrl) this.avatarUrl.set(`${this.apiBase}${u.avatarUrl}`);
      },
      error: () => {},
    });

    // Load notification state
    this.notifSvc.refreshUnreadCount().subscribe({ error: () => {} });
    this.notifSvc.getPreference().subscribe({ error: () => {} });
    this.notifSvc.startPolling();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMenu() {
    this.isMobileMenuOpen.set(false);
  }

  /** Close mobile menu when a nav link is clicked */
  onNavClick(ev: Event): void {
    const target = (ev.target as HTMLElement).closest('a');
    if (target) this.closeMenu();
  }

  logout(): void { this.auth.logout(); }

  getInitials(name: string): string {
    return name && name !== 'Minha conta' ? name.charAt(0).toUpperCase() : '👤';
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  toggleNotifDropdown(ev: Event): void {
    ev.stopPropagation();
    const opening = !this.notifDropdownOpen();
    this.notifDropdownOpen.set(opening);
    if (opening) {
      this.notifSvc.list().subscribe({ error: () => {} });
    }
  }

  onNotifClick(n: AppNotification): void {
    if (!n.isRead) {
      this.notifSvc.markRead(n.id).subscribe({ error: () => {} });
    }
  }

  markAllRead(): void {
    this.notifSvc.markAllRead().subscribe({ error: () => {} });
  }

  async togglePushEnabled(): Promise<void> {
    const current = this.notifSvc.pushEnabled();
    if (!current) {
      // Enabling: request browser permission first
      if (this.notifSvc.pushSupported) {
        const perm = await this.notifSvc.requestPermission();
        if (perm !== 'granted') return;
      }
    }
    this.notifSvc.setPreference(!current).subscribe({ error: () => {} });
  }

  notifIcon(type: string): string {
    const icons: Record<string, string> = {
      meal_reminder: '🍽️',
      water_reminder: '💧',
      exercise_reminder: '💪',
      medication_reminder: '💊',
      block_reminder: '📅',
      system: '🔔',
    };
    return icons[type] ?? '🔔';
  }

  private calculateLevel(xp: number): number {
    return Math.floor(xp / 100) + 1;
  }
}
