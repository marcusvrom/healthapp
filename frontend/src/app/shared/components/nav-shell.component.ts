import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    .shell { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 240px; flex-shrink: 0;
      background: #fff; border-right: 1px solid var(--color-border);
      display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh;

      @media (max-width: 768px) { display: none; }

      .brand {
        padding: 1.5rem 1.25rem 1rem;
        display: flex; align-items: center; gap: .625rem;
        border-bottom: 1px solid var(--color-border);
        .emoji { font-size: 1.5rem; }
        .name  { font-size: 1rem; font-weight: 800; color: var(--color-primary); }
        .beta  { font-size: .65rem; background: var(--color-primary-light); color: var(--color-primary-dark);
          padding: .1rem .4rem; border-radius: 99px; font-weight: 700; }
      }

      nav { flex: 1; padding: .75rem .75rem; display: flex; flex-direction: column; gap: .25rem; }

      .nav-item {
        display: flex; align-items: center; gap: .75rem;
        padding: .625rem .875rem;
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: .9rem; font-weight: 500;
        text-decoration: none;
        transition: all .15s;

        .icon { font-size: 1.1rem; width: 1.5rem; text-align: center; }

        &:hover      { background: var(--color-surface-2); color: var(--color-text); }
        &.active-link{ background: var(--color-primary-light); color: var(--color-primary-dark); font-weight: 600; }
      }

      .nav-section { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
        color: var(--color-text-subtle); padding: .875rem .875rem .25rem; }

      .sidebar-footer {
        padding: .875rem .75rem; border-top: 1px solid var(--color-border);

        .user-row {
          display: flex; align-items: center; gap: .75rem;
          .avatar { width: 36px; height: 36px; border-radius: 50%;
            background: var(--color-primary-light); display: flex; align-items: center; justify-content: center;
            font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); flex-shrink: 0; }
          .info { flex: 1; min-width: 0;
            .name { font-size: .82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
        background: #fff; border-top: 1px solid var(--color-border); padding-bottom: env(safe-area-inset-bottom);

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
          <span class="beta">MVP</span>
        </div>

        <nav>
          <span class="nav-section">Principal</span>
          <a routerLink="/dashboard" routerLinkActive="active-link" class="nav-item">
            <span class="icon">📅</span> Dashboard
          </a>
          <a routerLink="/nutrition" routerLinkActive="active-link" class="nav-item">
            <span class="icon">🥗</span> Nutrição
          </a>

          <span class="nav-section">Configurações</span>
          <a routerLink="/profile" routerLinkActive="active-link" class="nav-item">
            <span class="icon">👤</span> Perfil
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-row">
            <div class="avatar">👤</div>
            <div class="info">
              <div class="name">Minha conta</div>
              <div class="role">Usuário</div>
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
      <a routerLink="/dashboard" routerLinkActive="active-link"><span class="bn-icon">📅</span>Agenda</a>
      <a routerLink="/nutrition" routerLinkActive="active-link"><span class="bn-icon">🥗</span>Nutrição</a>
      <a routerLink="/profile"   routerLinkActive="active-link"><span class="bn-icon">👤</span>Perfil</a>
    </nav>
  `,
})
export class NavShellComponent {
  private auth = inject(AuthService);
  logout(): void { this.auth.logout(); }
}
