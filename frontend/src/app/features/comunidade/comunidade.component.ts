import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { UserService } from '../../core/services/user.service';
import { ApiService } from '../../core/services/api.service';
import {
  PublicProfileWithFriendship, PendingRequest, FriendEntry,
} from '../../core/models';

type Tab = 'explorar' | 'solicitacoes' | 'amigos';

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#34d399',
  4: '#fb923c', 5: '#a78bfa', 6: '#f472b6', 7: '#fbbf24',
};

@Component({
  selector: 'app-comunidade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .page { max-width: 700px; margin: 0 auto; padding: 1.5rem 1rem; }

    h1 { font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin: 0 0 .25rem; }
    .subtitle { color: var(--color-text-muted); font-size: .875rem; margin: 0 0 1.5rem; }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */
    .tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .tab-btn {
      display: flex; align-items: center; gap: .4rem;
      padding: .45rem 1rem; border-radius: 99px;
      border: 1.5px solid var(--color-border);
      background: var(--color-surface); color: var(--color-text-muted);
      font-size: .82rem; font-weight: 600; cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--color-primary); color: var(--color-primary); }
      &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    }
    .badge {
      background: var(--color-danger); color: #fff;
      font-size: .65rem; font-weight: 700; border-radius: 99px;
      padding: .05rem .35rem; min-width: 18px; text-align: center;
    }

    /* ── Search bar ───────────────────────────────────────────────────────── */
    .search-row {
      display: flex; gap: .5rem; margin-bottom: 1rem;
      input {
        flex: 1; padding: .65rem 1rem; border-radius: var(--radius-sm);
        border: 1.5px solid var(--color-border);
        background: var(--color-surface); color: var(--color-text);
        font-size: .9rem; outline: none; transition: border-color .15s;
        &:focus { border-color: var(--color-primary); }
        &::placeholder { color: var(--color-text-subtle); }
      }
      button {
        padding: .65rem 1.25rem; border-radius: var(--radius-sm);
        background: var(--color-primary); color: #fff; border: none;
        font-weight: 700; font-size: .875rem; cursor: pointer; transition: .15s;
        &:hover:not(:disabled) { background: var(--color-primary-dark); }
        &:disabled { opacity: .5; cursor: default; }
      }
    }

    /* ── Empty / loading states ───────────────────────────────────────────── */
    .loading-text { text-align: center; padding: 2rem; color: var(--color-text-muted); font-size: .9rem; }
    .empty-state  {
      text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);
      .icon { font-size: 2.5rem; margin-bottom: .75rem; }
      .msg  { font-size: .9rem; }
    }

    /* ── User card (search results) ───────────────────────────────────────── */
    .user-list { display: flex; flex-direction: column; gap: .5rem; }
    .user-card {
      display: flex; align-items: center; gap: .875rem;
      padding: .875rem 1rem;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }

      .avatar {
        width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
        font-size: 1.1rem; font-weight: 700; color: #fff;
        &:is(img) { display: block; object-fit: cover; }
        &:is(div) { display: flex; align-items: center; justify-content: center; }
      }
      .info { flex: 1; min-width: 0;
        .name  { font-weight: 600; font-size: .9rem; color: var(--color-text); }
        .meta  { font-size: .75rem; color: var(--color-text-muted); margin-top: .1rem; }
      }
      .actions { display: flex; gap: .4rem; flex-shrink: 0; }
    }

    /* ── Action buttons ───────────────────────────────────────────────────── */
    .btn-add {
      padding: .35rem .9rem; border-radius: 99px; border: 1.5px solid var(--color-primary);
      background: var(--color-primary-light); color: var(--color-primary-dark);
      font-size: .78rem; font-weight: 700; cursor: pointer; transition: .15s; white-space: nowrap;
      &:hover { background: var(--color-primary); color: #fff; }
    }
    .btn-sent {
      padding: .35rem .9rem; border-radius: 99px; border: 1.5px solid var(--color-border);
      background: transparent; color: var(--color-text-subtle);
      font-size: .78rem; font-weight: 600; cursor: default; white-space: nowrap;
    }
    .btn-friends {
      padding: .35rem .9rem; border-radius: 99px; border: 1.5px solid #34d399;
      background: #d1fae5; color: #065f46;
      font-size: .78rem; font-weight: 700; cursor: default; white-space: nowrap;
    }
    .btn-profile {
      padding: .35rem .9rem; border-radius: 99px; border: 1.5px solid var(--color-border);
      background: var(--color-surface-2); color: var(--color-text-muted);
      font-size: .78rem; font-weight: 600; cursor: pointer; transition: .15s; white-space: nowrap;
      &:hover { border-color: var(--color-text-muted); color: var(--color-text); }
    }

    /* ── Pending requests ─────────────────────────────────────────────────── */
    .pending-list { display: flex; flex-direction: column; gap: .625rem; }
    .pending-card {
      display: flex; align-items: center; gap: .875rem;
      padding: .875rem 1rem;
      background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md);

      .avatar {
        width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
        background: #fde68a; font-size: 1.1rem; font-weight: 700; color: #92400e;
        &:is(img) { display: block; object-fit: cover; }
        &:is(div) { display: flex; align-items: center; justify-content: center; }
      }
      .info { flex: 1; min-width: 0;
        .name { font-weight: 600; font-size: .9rem; color: #92400e; }
        .sub  { font-size: .75rem; color: #b45309; margin-top: .1rem; }
      }
      .pending-actions { display: flex; gap: .375rem; flex-shrink: 0; }
    }
    .btn-accept {
      padding: .35rem .8rem; border-radius: 99px; border: none;
      background: #d1fae5; color: #065f46; font-size: .78rem; font-weight: 700;
      cursor: pointer; transition: .15s;
      &:hover { background: #6ee7b7; }
    }
    .btn-decline {
      padding: .35rem .8rem; border-radius: 99px; border: none;
      background: #fee2e2; color: #991b1b; font-size: .78rem; font-weight: 700;
      cursor: pointer; transition: .15s;
      &:hover { background: #fca5a5; }
    }

    /* ── Friends list ─────────────────────────────────────────────────────── */
    .friend-list { display: flex; flex-direction: column; gap: .5rem; }
    .friend-card {
      display: flex; align-items: center; gap: .875rem;
      padding: .875rem 1rem;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }

      .avatar {
        width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
        font-size: 1.1rem; font-weight: 700; color: #fff;
        &:is(img) { display: block; object-fit: cover; }
        &:is(div) { display: flex; align-items: center; justify-content: center; }
      }
      .info { flex: 1; min-width: 0;
        .name  { font-weight: 600; font-size: .9rem; color: var(--color-text); }
        .meta  { font-size: .75rem; color: var(--color-text-muted); margin-top: .1rem; }
      }
      .level-pill {
        padding: .2rem .6rem; border-radius: 99px; font-size: .72rem; font-weight: 700;
        color: #fff; flex-shrink: 0;
      }
    }
  `],
  template: `
    <div class="page">
      <h1>👥 Comunidade</h1>
      <p class="subtitle">Conecte-se com outros usuários</p>

      <!-- Tabs -->
      <div class="tabs">
        @for (tab of TABS; track tab.id) {
          <button
            class="tab-btn"
            [class.active]="activeTab() === tab.id"
            (click)="switchTab(tab.id)">
            {{ tab.icon }} {{ tab.label }}
            @if (tab.id === 'solicitacoes' && pendingCount() > 0) {
              <span class="badge">{{ pendingCount() }}</span>
            }
          </button>
        }
      </div>

      <!-- ── ABA: Explorar ──────────────────────────────────────────────── -->
      @if (activeTab() === 'explorar') {
        <div class="search-row">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por nome..."
            (keyup.enter)="runSearch()"
            [disabled]="searching()" />
          <button (click)="runSearch()" [disabled]="searching() || searchQuery.trim().length < 2">
            {{ searching() ? '...' : '🔍 Buscar' }}
          </button>
        </div>

        @if (searching()) {
          <div class="loading-text">Buscando usuários…</div>
        } @else if (hasSearched() && searchResults().length === 0) {
          <div class="empty-state">
            <div class="icon">🔍</div>
            <div class="msg">Nenhum usuário encontrado para "{{ lastQuery() }}"</div>
          </div>
        } @else if (searchResults().length > 0) {
          <div class="user-list">
            @for (u of searchResults(); track u.id) {
              <div class="user-card" (click)="viewProfile(u.id)">
                @if (avatarSrc(u.avatarUrl); as src) {
                  <img [src]="src" class="avatar" [alt]="u.name" />
                } @else {
                  <div class="avatar" [style.background]="levelColor(u.level)">
                    {{ u.name.charAt(0).toUpperCase() }}
                  </div>
                }
                <div class="info">
                  <div class="name">{{ u.name }}</div>
                  <div class="meta">
                    Nv {{ u.level }} · {{ u.levelTitle }}
                    @if (u.city) { · {{ u.city }}{{ u.state ? ', ' + u.state : '' }} }
                  </div>
                </div>
                <div class="actions" (click)="$event.stopPropagation()">
                  @switch (u.friendship.status) {
                    @case ('NONE') {
                      <button class="btn-add" (click)="sendRequest(u)">➕ Adicionar</button>
                    }
                    @case ('PENDING') {
                      @if (u.friendship.iAmRequester) {
                        <span class="btn-sent">⏳ Aguardando</span>
                      } @else {
                        <button class="btn-add" (click)="viewProfile(u.id)">✉️ Responder</button>
                      }
                    }
                    @case ('ACCEPTED') {
                      <span class="btn-friends">👥 Amigos</span>
                    }
                  }
                  <button class="btn-profile" (click)="viewProfile(u.id)">Ver perfil</button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <div class="icon">🌍</div>
            <div class="msg">Digite um nome para buscar outros usuários</div>
          </div>
        }
      }

      <!-- ── ABA: Solicitações ──────────────────────────────────────────── -->
      @if (activeTab() === 'solicitacoes') {
        @if (loadingPending()) {
          <div class="loading-text">Carregando solicitações…</div>
        } @else if (pending().length === 0) {
          <div class="empty-state">
            <div class="icon">📬</div>
            <div class="msg">Nenhuma solicitação pendente</div>
          </div>
        } @else {
          <div class="pending-list">
            @for (req of pending(); track req.friendshipId) {
              <div class="pending-card">
                @if (avatarSrc(req.avatarUrl); as src) {
                  <img [src]="src" class="avatar" [alt]="req.name" style="object-fit:cover;" />
                } @else {
                  <div class="avatar">{{ req.name.charAt(0).toUpperCase() }}</div>
                }
                <div class="info">
                  <div class="name">{{ req.name }}</div>
                  <div class="sub">Quer ser seu amigo 🤝</div>
                </div>
                <div class="pending-actions">
                  <button class="btn-accept"  (click)="accept(req)">✓ Aceitar</button>
                  <button class="btn-decline" (click)="decline(req)">✕ Recusar</button>
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- ── ABA: Meus Amigos ───────────────────────────────────────────── -->
      @if (activeTab() === 'amigos') {
        @if (loadingFriends()) {
          <div class="loading-text">Carregando amigos…</div>
        } @else if (friends().length === 0) {
          <div class="empty-state">
            <div class="icon">👥</div>
            <div class="msg">Você ainda não tem amigos. Explore e conecte-se!</div>
          </div>
        } @else {
          <div class="friend-list">
            @for (f of friends(); track f.userId) {
              <div class="friend-card" (click)="viewProfile(f.userId)">
                @if (avatarSrc(f.avatarUrl); as src) {
                  <img [src]="src" class="avatar" [alt]="f.name" />
                } @else {
                  <div class="avatar" [style.background]="levelColor(f.level)">
                    {{ f.name.charAt(0).toUpperCase() }}
                  </div>
                }
                <div class="info">
                  <div class="name">{{ f.name }}</div>
                  <div class="meta">
                    {{ f.levelTitle }}
                    @if (f.city) { · {{ f.city }}{{ f.state ? ', ' + f.state : '' }} }
                  </div>
                </div>
                <span class="level-pill" [style.background]="levelColor(f.level)">
                  Nv {{ f.level }}
                </span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ComunidadeComponent implements OnInit {
  private community    = inject(CommunityService);
  private friendSvc    = inject(FriendshipService);
  private userSvc      = inject(UserService);
  private api          = inject(ApiService);
  private router       = inject(Router);

  readonly TABS = [
    { id: 'explorar'     as Tab, label: 'Explorar',       icon: '🔍' },
    { id: 'solicitacoes' as Tab, label: 'Solicitações',   icon: '📬' },
    { id: 'amigos'       as Tab, label: 'Meus Amigos',    icon: '👥' },
  ];

  activeTab      = signal<Tab>('explorar');
  searchQuery    = '';
  lastQuery      = signal('');
  searching      = signal(false);
  hasSearched    = signal(false);
  searchResults  = signal<PublicProfileWithFriendship[]>([]);

  loadingPending = signal(true);
  loadingFriends = signal(true);
  pending        = signal<PendingRequest[]>([]);
  friends        = signal<FriendEntry[]>([]);

  pendingCount   = computed(() => this.pending().length);

  ngOnInit(): void {
    this.loadPending();
    this.loadFriends();
  }

  switchTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'solicitacoes') this.loadPending();
    if (tab === 'amigos')       this.loadFriends();
  }

  runSearch(): void {
    const q = this.searchQuery.trim();
    if (q.length < 2) return;
    this.searching.set(true);
    this.lastQuery.set(q);
    this.community.search(q).subscribe({
      next: results => {
        this.searchResults.set(results);
        this.hasSearched.set(true);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  sendRequest(u: PublicProfileWithFriendship): void {
    this.friendSvc.sendRequest(u.id).subscribe({
      next: () => {
        // Optimistically update friendship status in the results list
        this.searchResults.update(list =>
          list.map(r => r.id === u.id
            ? { ...r, friendship: { status: 'PENDING', friendshipId: null, iAmRequester: true } }
            : r,
          ),
        );
        // Reload pending count
        this.loadPending();
      },
      error: () => {},
    });
  }

  accept(req: PendingRequest): void {
    this.friendSvc.accept(req.friendshipId).subscribe({
      next: () => {
        this.pending.update(list => list.filter(r => r.friendshipId !== req.friendshipId));
        this.loadFriends();
      },
      error: () => {},
    });
  }

  decline(req: PendingRequest): void {
    this.friendSvc.decline(req.friendshipId).subscribe({
      next: () => {
        this.pending.update(list => list.filter(r => r.friendshipId !== req.friendshipId));
      },
      error: () => {},
    });
  }

  viewProfile(userId: string): void {
    this.router.navigate(['/comunidade/perfil', userId]);
  }

  avatarSrc(url: string | null | undefined): string | null {
    return this.api.storageUrl(url);
  }

  levelColor(level: number): string {
    return LEVEL_COLORS[level] ?? '#94a3b8';
  }

  private loadPending(): void {
    this.loadingPending.set(true);
    this.friendSvc.listPending().subscribe({
      next: list => { this.pending.set(list); this.loadingPending.set(false); },
      error: ()   => this.loadingPending.set(false),
    });
  }

  private loadFriends(): void {
    this.loadingFriends.set(true);
    this.friendSvc.listFriends().subscribe({
      next: list => { this.friends.set(list); this.loadingFriends.set(false); },
      error: ()   => this.loadingFriends.set(false),
    });
  }
}
