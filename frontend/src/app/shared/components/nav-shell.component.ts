import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
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
  private router  = inject(Router);
  readonly theme  = inject(ThemeService);
  readonly notifSvc = inject(NotificationService);

  readonly apiBase = environment.apiUrl.replace('/api/v1', '');

  userName  = signal<string>('Minha conta');
  userLevel = signal<number>(1);
  avatarUrl = signal<string | null>(null);
  isMobileMenuOpen = signal(false);
  notifDropdownOpen = signal(false);
  openGroups = signal<Record<string, boolean>>({
    journey: true,
    nutrition: false,
    community: false,
    professional: false,
    account: false,
  });

  readonly navGroups = [
    {
      id: 'journey',
      title: 'Minha Jornada',
      items: [
        { route: '/dashboard', icon: '📅', label: 'Dashboard' },
        { route: '/planning', icon: '📋', label: 'Planejamento' },
        { route: '/workouts', icon: '🏋️', label: 'Treinos' },
        { route: '/progression', icon: '📈', label: 'Progressão' },
        { route: '/progress', icon: '📊', label: 'Progresso' },
        { route: '/check-in', icon: '📸', label: 'Check-in' },
      ],
    },
    {
      id: 'nutrition',
      title: 'Nutrição e Saúde',
      items: [
        { route: '/diet', icon: '🍽️', label: 'Dieta' },
        { route: '/foods', icon: '📷', label: 'Alimentos' },
        { route: '/recipes', icon: '📖', label: 'Receitas' },
        { route: '/protocols', icon: '💊', label: 'Protocolos' },
        { route: '/hormones', icon: '💉', label: 'Hormônios' },
      ],
    },
    {
      id: 'community',
      title: 'Comunidade',
      items: [
        { route: '/feed', icon: '🌐', label: 'Feed Social' },
        { route: '/badges', icon: '🎖️', label: 'Conquistas' },
        { route: '/challenges', icon: '🏆', label: 'Desafios' },
        { route: '/leaderboard', icon: '🥇', label: 'Ranking' },
        { route: '/groups', icon: '👥', label: 'Grupos' },
        { route: '/comunidade', icon: '🌍', label: 'Comunidade' },
      ],
    },
    {
      id: 'professional',
      title: 'Área Profissional',
      items: [{ route: '/clinical', icon: '🩺', label: 'Clínico' }],
    },
    {
      id: 'account',
      title: 'Configurações',
      items: [
        { route: '/profile', icon: '👤', label: 'Perfil' },
        { route: '/glossary', icon: '❓', label: 'Glossário' },
      ],
    },
  ] as const;

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

    this.ensureActiveGroupOpen();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.ensureActiveGroupOpen();
      }
    });
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

  toggleGroup(groupId: string): void {
    this.openGroups.update(current => {
      const openingSelectedGroup = !current[groupId];
      const next = Object.keys(current).reduce((acc, id) => {
        acc[id] = false;
        return acc;
      }, {} as Record<string, boolean>);

      if (openingSelectedGroup) {
        next[groupId] = true;
      }

      return next;
    });
  }

  isGroupOpen(groupId: string): boolean {
    return !!this.openGroups()[groupId];
  }

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

  private ensureActiveGroupOpen(): void {
    const currentUrl = this.router.url;
    const activeGroupId = this.navGroups.find(group =>
      group.items.some(item => currentUrl.startsWith(item.route)),
    )?.id;

    if (!activeGroupId) return;

    this.openGroups.update(current =>
      Object.keys(current).reduce((acc, id) => {
        acc[id] = id === activeGroupId;
        return acc;
      }, {} as Record<string, boolean>),
    );
  }
}
