import {
  Component, OnInit, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { ApiService } from '../../core/services/api.service';
import { PublicProfileWithFriendship } from '../../core/models';

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#34d399',
  4: '#fb923c', 5: '#a78bfa', 6: '#f472b6', 7: '#fbbf24',
};

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .page { max-width: 600px; margin: 0 auto; padding: 1.5rem 1rem; }

    /* ── Back button ──────────────────────────────────────────────────────── */
    .back-btn {
      display: inline-flex; align-items: center; gap: .4rem;
      color: var(--color-text-muted); font-size: .875rem; font-weight: 500;
      cursor: pointer; background: none; border: none; padding: 0 0 1.25rem;
      transition: color .15s;
      &:hover { color: var(--color-text); }
    }

    /* ── Loading / error ──────────────────────────────────────────────────── */
    .loading-text { text-align: center; padding: 3rem; color: var(--color-text-muted); font-size: .9rem; }
    .error-state  { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);
      .icon { font-size: 2.5rem; margin-bottom: .75rem; }
      p { font-size: .9rem; }
    }

    /* ── Hero card ────────────────────────────────────────────────────────── */
    .hero-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 2rem 1.5rem;
      display: flex; flex-direction: column; align-items: center;
      gap: .875rem; text-align: center;
      margin-bottom: 1rem;

      .hero-avatar {
        width: 88px; height: 88px; border-radius: 50%; overflow: hidden;
        font-size: 2.2rem; font-weight: 800; color: #fff;
        border: 3px solid var(--color-border);
        box-shadow: var(--shadow-md);
        &:is(img) { display: block; object-fit: cover; }
        &:is(div) { display: flex; align-items: center; justify-content: center; }
      }
      .hero-name {
        font-size: 1.5rem; font-weight: 800; color: var(--color-text); line-height: 1.1;
      }
      .hero-location {
        display: flex; align-items: center; gap: .4rem;
        font-size: .85rem; color: var(--color-text-muted);
      }
      .level-badge {
        display: inline-flex; align-items: center; gap: .35rem;
        padding: .35rem .9rem; border-radius: 99px;
        font-size: .8rem; font-weight: 700; color: #fff;
      }
      .goal-chip {
        display: inline-flex; align-items: center; gap: .3rem;
        padding: .3rem .8rem; border-radius: 99px;
        background: var(--color-primary-light); color: var(--color-primary-dark);
        font-size: .78rem; font-weight: 600; border: 1px solid var(--color-primary);
      }
    }

    /* ── Stats grid ───────────────────────────────────────────────────────── */
    .stats-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: .75rem;
      margin-bottom: 1rem;
    }
    .stat-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem 1rem; text-align: center;
      .stat-value { font-size: 1.75rem; font-weight: 800; color: var(--color-primary); line-height: 1; }
      .stat-label { font-size: .75rem; font-weight: 600; color: var(--color-text-muted); margin-top: .375rem; }
    }

    /* ── Action button ────────────────────────────────────────────────────── */
    .action-area { padding: .5rem 0 1rem; }

    .btn-add {
      width: 100%; padding: .85rem; border-radius: var(--radius-sm);
      background: var(--color-primary); color: #fff; border: none;
      font-size: .95rem; font-weight: 700; cursor: pointer; transition: .15s;
      &:hover { background: var(--color-primary-dark); }
    }
    .btn-sent {
      width: 100%; padding: .85rem; border-radius: var(--radius-sm);
      background: var(--color-surface-2); color: var(--color-text-subtle);
      border: 1.5px solid var(--color-border);
      font-size: .95rem; font-weight: 600; cursor: default;
    }
    .btn-friends {
      width: 100%; padding: .85rem; border-radius: var(--radius-sm);
      background: #d1fae5; color: #065f46;
      border: 1.5px solid #6ee7b7;
      font-size: .95rem; font-weight: 700; cursor: default;
    }
    .btn-respond {
      width: 100%; padding: .85rem; border-radius: var(--radius-sm);
      background: #fef3c7; color: #92400e;
      border: 1.5px solid #fde68a;
      font-size: .95rem; font-weight: 700; cursor: pointer; transition: .15s;
      &:hover { background: #fde68a; }
    }
    .respond-row {
      display: flex; gap: .5rem;
      button { flex: 1; padding: .75rem; border-radius: var(--radius-sm); border: none;
        font-size: .875rem; font-weight: 700; cursor: pointer; transition: .15s; }
      .accept  { background: #d1fae5; color: #065f46; &:hover { background: #6ee7b7; } }
      .decline { background: #fee2e2; color: #991b1b; &:hover { background: #fca5a5; } }
    }

    @media (max-width: 480px) {
      .hero-card { padding: 1.5rem 1rem; }
      .hero-name  { font-size: 1.25rem; }
    }
  `],
  template: `
    <div class="page">
      <button class="back-btn" (click)="goBack()">← Voltar</button>

      @if (loading()) {
        <div class="loading-text">Carregando perfil…</div>
      } @else if (notFound()) {
        <div class="error-state">
          <div class="icon">😕</div>
          <p>Usuário não encontrado.</p>
        </div>
      } @else {
        @if (profile(); as p) {

        <!-- Hero card -->
        <div class="hero-card">
          @if (avatarSrc(p.avatarUrl); as src) {
            <img [src]="src" class="hero-avatar" [alt]="p.name" />
          } @else {
            <div class="hero-avatar" [style.background]="levelColor(p.level)">
              {{ p.name.charAt(0).toUpperCase() }}
            </div>
          }

          <div class="hero-name">{{ p.name }}</div>

          @if (p.city) {
            <div class="hero-location">
              📍 {{ p.city }}{{ p.state ? ', ' + p.state : '' }}
            </div>
          }

          <span class="level-badge" [style.background]="levelColor(p.level)">
            ⭐ Nível {{ p.level }} · {{ p.levelTitle }}
          </span>

          @if (p.primaryGoalLabel) {
            <span class="goal-chip">🎯 {{ p.primaryGoalLabel }}</span>
          }
        </div>

        <!-- Stats grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ p.totalMissionsCompleted | number }}</div>
            <div class="stat-label">Missões Concluídas</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ p.xp | number }}</div>
            <div class="stat-label">XP Total</div>
          </div>
        </div>

        <!-- Action area -->
        <div class="action-area">
          @switch (p.friendship.status) {
            @case ('NONE') {
              <button class="btn-add" (click)="sendRequest(p)">
                ➕ Adicionar como Amigo
              </button>
            }
            @case ('PENDING') {
              @if (p.friendship.iAmRequester) {
                <button class="btn-sent">⏳ Solicitação Enviada</button>
              } @else {
                <div class="respond-row">
                  <button class="accept"  (click)="accept(p)">✓ Aceitar</button>
                  <button class="decline" (click)="decline(p)">✕ Recusar</button>
                </div>
              }
            }
            @case ('ACCEPTED') {
              <button class="btn-friends">👥 Amigos ✓</button>
            }
          }
        </div>
        } <!-- end @if profile -->
      } <!-- end @else -->
    </div>
  `,
})
export class PublicProfileComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private community  = inject(CommunityService);
  private friendSvc  = inject(FriendshipService);
  private api        = inject(ApiService);

  loading   = signal(true);
  notFound  = signal(false);
  profile   = signal<PublicProfileWithFriendship | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.community.getProfile(id).subscribe({
      next: p  => { this.profile.set(p); this.loading.set(false); },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  goBack(): void {
    this.router.navigate(['/comunidade']);
  }

  sendRequest(p: PublicProfileWithFriendship): void {
    this.friendSvc.sendRequest(p.id).subscribe({
      next: () => {
        this.profile.update(cur => cur
          ? { ...cur, friendship: { status: 'PENDING', friendshipId: null, iAmRequester: true } }
          : cur,
        );
      },
      error: () => {},
    });
  }

  accept(p: PublicProfileWithFriendship): void {
    if (!p.friendship.friendshipId) return;
    this.friendSvc.accept(p.friendship.friendshipId).subscribe({
      next: () => {
        this.profile.update(cur => cur
          ? { ...cur, friendship: { ...cur.friendship, status: 'ACCEPTED' } }
          : cur,
        );
      },
      error: () => {},
    });
  }

  decline(p: PublicProfileWithFriendship): void {
    if (!p.friendship.friendshipId) return;
    this.friendSvc.decline(p.friendship.friendshipId).subscribe({
      next: () => {
        this.profile.update(cur => cur
          ? { ...cur, friendship: { ...cur.friendship, status: 'DECLINED' } }
          : cur,
        );
      },
      error: () => {},
    });
  }

  avatarSrc(url: string | null | undefined): string | null {
    return this.api.storageUrl(url);
  }

  levelColor(level: number): string {
    return LEVEL_COLORS[level] ?? '#94a3b8';
  }
}
