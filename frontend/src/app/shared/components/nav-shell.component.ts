import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ThemeService } from '../../core/services/theme.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    .shell { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 240px; flex-shrink: 0;
      background: var(--color-surface); border-right: 1px solid var(--color-border);
      display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh;

      @media (max-width: 768px) { display: none; }

      .brand {
        padding: 1.25rem 1.25rem .875rem;
        display: flex; align-items: center; gap: .625rem;
        border-bottom: 1px solid var(--color-border);
        .emoji { font-size: 1.5rem; }
        .name  { font-size: 1rem; font-weight: 800; color: var(--color-primary); flex: 1; }
        .beta  { font-size: .65rem; background: var(--color-primary-light); color: var(--color-primary-dark);
          padding: .1rem .4rem; border-radius: 99px; font-weight: 700; }

        .theme-btn {
          width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--color-border);
          background: var(--color-surface-2); cursor: pointer; display: flex;
          align-items: center; justify-content: center; font-size: .9rem;
          transition: all .2s; flex-shrink: 0;
          &:hover { background: var(--color-border); transform: rotate(20deg); }
        }
      }

      nav { flex: 1; padding: .75rem; display: flex; flex-direction: column; gap: .2rem; overflow-y: auto; }

      .nav-item {
        display: flex; align-items: center; gap: .75rem;
        padding: .575rem .875rem;
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: .875rem; font-weight: 500;
        text-decoration: none;
        transition: all .15s;

        .icon { font-size: 1.1rem; width: 1.5rem; text-align: center; }

        &:hover      { background: var(--color-surface-2); color: var(--color-text); }
        &.active-link{ background: var(--color-primary-light); color: var(--color-primary-dark); font-weight: 600; }
      }

      .nav-section { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
        color: var(--color-text-subtle); padding: .75rem .875rem .2rem; }

      .sidebar-footer {
        padding: .875rem .75rem; border-top: 1px solid var(--color-border);

        .user-row {
          display: flex; align-items: center; gap: .75rem;
          .avatar { width: 36px; height: 36px; border-radius: 50%;
            background: var(--color-primary-light); display: flex; align-items: center; justify-content: center;
            font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); flex-shrink: 0;
            object-fit: cover; }
          .info { flex: 1; min-width: 0;
            .name { font-size: .82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text); }
            .role { font-size: .7rem; color: var(--color-text-subtle); }
          }
        }

        .logout-btn {
          display: flex; align-items: center; gap: .5rem; width: 100%; margin-top: .625rem;
          padding: .5rem .875rem; border-radius: var(--radius-sm); border: none; background: none;
          color: var(--color-text-muted); font-size: .82rem; cursor: pointer; transition: .15s;
          &:hover { background: #fee2e2; color: var(--color-danger); }
        }
      }
    }

    /* Bottom nav for mobile */
    .bottom-nav {
      display: none;
      @media (max-width: 768px) {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
        background: var(--color-surface); border-top: 1px solid var(--color-border);
        padding-bottom: env(safe-area-inset-bottom);

        a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .2rem;
          padding: .625rem .5rem; color: var(--color-text-subtle); font-size: .65rem; font-weight: 600;
          text-decoration: none; transition: .15s;
          .bn-icon { font-size: 1.25rem; }
          &.active-link { color: var(--color-primary); }
        }
      }
    }

    /* Main area */
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column;
      @media (max-width: 768px) { padding-bottom: 60px; }
    }
  `],
  template: `
    <div class="shell">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="brand">
          <span class="emoji">🌿</span>
          <span class="name">HealthApp</span>
          <span class="beta">BETA</span>
          <button class="theme-btn" (click)="theme.toggle()"
            [title]="theme.isDark() ? 'Modo Claro' : 'Modo Escuro'">
            {{ theme.isDark() ? '☀️' : '🌙' }}
          </button>
        </div>

        <nav>
          <span class="nav-section">Principal</span>
          <a routerLink="/dashboard" routerLinkActive="active-link" class="nav-item">
            <span class="icon">📅</span> Dashboard
          </a>
          <a routerLink="/diet" routerLinkActive="active-link" class="nav-item">
            <span class="icon">🍽️</span> Dieta
          </a>
          <a routerLink="/nutrition" routerLinkActive="active-link" class="nav-item">
            <span class="icon">🥗</span> Nutrição
          </a>
          <a routerLink="/recipes" routerLinkActive="active-link" class="nav-item">
            <span class="icon">📖</span> Receitas
          </a>
          <a routerLink="/protocols" routerLinkActive="active-link" class="nav-item">
            <span class="icon">💊</span> Protocolos
          </a>
          <a routerLink="/hormones" routerLinkActive="active-link" class="nav-item">
            <span class="icon">💉</span> Hormônios
          </a>
          <a routerLink="/progress" routerLinkActive="active-link" class="nav-item">
            <span class="icon">📊</span> Progresso
          </a>
          <a routerLink="/clinical" routerLinkActive="active-link" class="nav-item">
            <span class="icon">🩺</span> Clínico
          </a>
          <a routerLink="/planning" routerLinkActive="active-link" class="nav-item">
            <span class="icon">📋</span> Planejamento
          </a>

          <span class="nav-section">Configurações</span>
          <a routerLink="/profile" routerLinkActive="active-link" class="nav-item">
            <span class="icon">👤</span> Perfil
          </a>
          <a routerLink="/glossary" routerLinkActive="active-link" class="nav-item">
            <span class="icon">❓</span> Glossário
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-row">
            @if (avatarUrl()) {
              <img [src]="avatarUrl()" class="avatar" alt="Avatar" style="object-fit: cover;">
            } @else {
              <div class="avatar">{{ getInitials(userName()) }}</div>
            }
            <div class="info">
              <div class="name">{{ userName() }}</div>
              <div class="role">Nível {{ userLevel() }}</div>
            </div>
          </div>
          <button class="logout-btn" (click)="logout()">🚪 Sair</button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="main">
        <router-outlet />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav class="bottom-nav">
      <a routerLink="/dashboard"   routerLinkActive="active-link"><span class="bn-icon">📅</span>Agenda</a>
      <a routerLink="/diet"        routerLinkActive="active-link"><span class="bn-icon">🍽️</span>Dieta</a>
      <a routerLink="/protocols"   routerLinkActive="active-link"><span class="bn-icon">💊</span>Protocolos</a>
      <a routerLink="/progress"    routerLinkActive="active-link"><span class="bn-icon">📊</span>Progresso</a>
      <a routerLink="/profile"     routerLinkActive="active-link"><span class="bn-icon">👤</span>Perfil</a>
    </nav>
  `,
})
export class NavShellComponent implements OnInit {
  private auth    = inject(AuthService);
  private userSvc = inject(UserService);
  readonly theme  = inject(ThemeService);

  readonly apiBase = environment.apiUrl.replace('/api/v1', '');

  userName  = signal<string>('Minha conta');
  userLevel = signal<number>(1);
  avatarUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({
      next: (u) => {
        if (u.name)      this.userName.set(u.name);
        if (u.xp)        this.userLevel.set(this.calculateLevel(u.xp));
        if (u.avatarUrl) this.avatarUrl.set(`${this.apiBase}${u.avatarUrl}`);
      },
      error: () => {},
    });
  }

  logout(): void { this.auth.logout(); }

  getInitials(name: string): string {
    return name && name !== 'Minha conta' ? name.charAt(0).toUpperCase() : '👤';
  }

  private calculateLevel(xp: number): number {
    return Math.floor(xp / 100) + 1;
  }
}
