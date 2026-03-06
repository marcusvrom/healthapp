import {
  Component, inject, signal, computed, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GamificationService } from '../../core/services/gamification.service';
import { FriendshipService }   from '../../core/services/friendship.service';
import { UserService }         from '../../core/services/user.service';
import { ApiService }          from '../../core/services/api.service';
import { RankingEntry, RankingScope, FriendEntry, PendingRequest, UserSearchResult } from '../../core/models';

type Tab = 'global' | 'regional' | 'friends';

interface TabDef { id: Tab; label: string; icon: string; }

const TABS: TabDef[] = [
  { id: 'global',   label: 'Global',       icon: '🌎' },
  { id: 'regional', label: 'Minha Cidade',  icon: '📍' },
  { id: 'friends',  label: 'Meus Amigos',   icon: '👥' },
];

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#34d399',
  4: '#fb923c', 5: '#a78bfa', 6: '#f472b6', 7: '#fbbf24',
};

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }

    .page {
      max-width: 700px; margin: 0 auto; padding: 1.5rem 1rem;
      @media (max-width: 600px) { padding: 1rem .5rem; }
    }

    h1 { font-size: 1.4rem; font-weight: 800; margin: 0 0 .25rem;
         color: var(--color-text); display: flex; align-items: center; gap: .5rem; }
    .subtitle { font-size: .82rem; color: var(--color-text-muted); margin-bottom: 1.25rem; }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */
    .tabs {
      display: flex; gap: .5rem; margin-bottom: 1.5rem;
      overflow-x: auto; padding-bottom: 2px;
    }
    .tab-btn {
      display: flex; align-items: center; gap: .4rem;
      padding: .45rem 1rem; border-radius: 99px;
      border: 1.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted); font-size: .82rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: all .15s;
      &:hover { border-color: var(--color-primary); color: var(--color-primary-dark); }
      &.active {
        background: var(--color-primary); border-color: var(--color-primary);
        color: #fff;
      }
    }

    /* ── Friend search panel ─────────────────────────────────────────────── */
    .friend-panel {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius); padding: 1rem; margin-bottom: 1.25rem;

      .search-row {
        display: flex; gap: .5rem;
        input {
          flex: 1; padding: .5rem .75rem; border-radius: var(--radius-sm);
          border: 1.5px solid var(--color-border); background: var(--color-bg);
          color: var(--color-text); font-size: .875rem;
          &:focus { outline: none; border-color: var(--color-primary); }
        }
        button {
          padding: .5rem 1rem; border-radius: var(--radius-sm);
          background: var(--color-primary); color: #fff; border: none;
          font-weight: 600; cursor: pointer; font-size: .82rem;
          &:hover { opacity: .9; }
        }
      }

      .search-results { margin-top: .75rem; display: flex; flex-direction: column; gap: .5rem; }
      .result-item {
        display: flex; align-items: center; gap: .75rem;
        padding: .5rem; border-radius: var(--radius-sm); background: var(--color-bg);
        .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover;
          background: var(--color-primary-light); display: flex; align-items: center;
          justify-content: center; font-weight: 700; color: var(--color-primary-dark); flex-shrink: 0; }
        .name { flex: 1; font-size: .875rem; font-weight: 600; color: var(--color-text); }
        .city { font-size: .72rem; color: var(--color-text-muted); }
        .add-btn {
          padding: .3rem .7rem; font-size: .75rem; border-radius: 99px;
          background: var(--color-primary-light); color: var(--color-primary-dark);
          border: none; cursor: pointer; font-weight: 600;
          &:hover { background: var(--color-primary); color: #fff; }
        }
      }
    }

    /* ── Pending requests ────────────────────────────────────────────────── */
    .pending-card {
      background: #fffbeb; border: 1px solid #fcd34d;
      border-radius: var(--radius); padding: .875rem 1rem; margin-bottom: 1.25rem;
      .pending-title { font-size: .8rem; font-weight: 700; color: #92400e; margin-bottom: .5rem; }
      .pending-item {
        display: flex; align-items: center; gap: .6rem; margin-top: .4rem;
        .name { flex: 1; font-size: .82rem; font-weight: 600; }
        .btn { padding: .25rem .65rem; border-radius: 99px; border: none;
          font-size: .72rem; font-weight: 700; cursor: pointer; }
        .accept-btn { background: #d1fae5; color: #065f46;
          &:hover { background: #6ee7b7; } }
        .decline-btn { background: #fee2e2; color: #991b1b; margin-left: .25rem;
          &:hover { background: #fca5a5; } }
      }
    }

    /* ── Loading / empty ────────────────────────────────────────────────── */
    .empty-state {
      text-align: center; padding: 3rem 1rem;
      .icon { font-size: 3rem; }
      p { color: var(--color-text-muted); font-size: .9rem; margin-top: .5rem; }
    }

    /* ── Podium ──────────────────────────────────────────────────────────── */
    .podium {
      display: flex; align-items: flex-end; justify-content: center;
      gap: .75rem; margin-bottom: 2rem; padding: 0 1rem;
    }
    .podium-slot {
      display: flex; flex-direction: column; align-items: center; gap: .5rem; flex: 1;
      max-width: 160px;

      /* Container: fixed size so broken images don't collapse it.
         overflow: visible so the crown emoji sits above the circle. */
      .podium-avatar {
        position: relative; overflow: visible;
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;

        .avatar-img {
          width: 56px; height: 56px; border-radius: 50%;
          object-fit: cover; border: 3px solid #64748b;
          /* Hide browser's broken-image alt-text oval */
          display: block; background: var(--color-surface-2);
        }
        .avatar-placeholder {
          width: 56px; height: 56px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; font-weight: 800; color: #fff;
          border: 3px solid #64748b; flex-shrink: 0;
        }

        .crown {
          position: absolute; top: -18px; left: 50%;
          transform: translateX(-50%);
          font-size: 1.2rem; line-height: 1; pointer-events: none;
        }
      }

      /* First place: larger avatar + gold ring */
      &.rank-1 .podium-avatar {
        width: 68px; height: 68px;
        .avatar-img       { width: 68px; height: 68px; border-color: #f59e0b; border-width: 3px; }
        .avatar-placeholder { width: 68px; height: 68px; border-color: #f59e0b; border-width: 3px; }
      }

      .podium-info {
        text-align: center;
        .podium-name { font-size: .78rem; font-weight: 700; color: var(--color-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
        .podium-xp   { font-size: .7rem; color: var(--color-text-muted); font-weight: 600; }
        .level-badge {
          display: inline-block; padding: .1rem .45rem; border-radius: 99px;
          font-size: .62rem; font-weight: 800; color: #fff; margin-top: .15rem;
        }
      }

      .podium-bar {
        width: 100%; border-radius: 6px 6px 0 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem; font-weight: 900; color: #fff;
      }
      &.rank-1 .podium-bar { height: 100px; background: linear-gradient(160deg,#f59e0b,#d97706); }
      &.rank-2 .podium-bar { height: 72px;  background: linear-gradient(160deg,#94a3b8,#64748b); }
      &.rank-3 .podium-bar { height: 56px;  background: linear-gradient(160deg,#fb923c,#ea580c); }
    }

    /* ── List (rank 4+) ──────────────────────────────────────────────────── */
    .rank-list { display: flex; flex-direction: column; gap: .4rem; }
    .rank-row {
      display: flex; align-items: center; gap: .75rem;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .625rem .875rem;
      transition: background .1s;
      &:hover { background: var(--color-surface-2); }
      &.is-me { border-color: var(--color-primary); background: var(--color-primary-light); }

      .rank-num {
        width: 28px; text-align: center; font-size: .8rem; font-weight: 800;
        color: var(--color-text-muted); flex-shrink: 0;
      }
      .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
        background: var(--color-primary-light); display: flex; align-items: center;
        justify-content: center; font-weight: 700; color: var(--color-primary-dark); }
      .info { flex: 1; min-width: 0;
        .name { font-size: .875rem; font-weight: 600; color: var(--color-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .level { font-size: .7rem; color: var(--color-text-muted); }
      }
      .xp-col { text-align: right;
        .xp { font-size: .875rem; font-weight: 800; color: var(--color-primary-dark); }
        .xp-label { font-size: .65rem; color: var(--color-text-muted); }
      }
    }

    .loading-text { text-align: center; padding: 2rem; color: var(--color-text-muted); font-size: .9rem; }
  `],
  template: `
    <div class="page">
      <h1>🏆 Ranking</h1>
      <p class="subtitle">Semana atual — reseta toda segunda-feira</p>

      <!-- Tabs -->
      <div class="tabs">
        @for (tab of TABS; track tab.id) {
          <button class="tab-btn" [class.active]="activeTab() === tab.id"
                  (click)="switchTab(tab.id)">
            {{ tab.icon }} {{ tab.label }}
          </button>
        }
      </div>

      <!-- Friends tab: search + pending -->
      @if (activeTab() === 'friends') {
        <!-- Pending requests -->
        @if (pending().length > 0) {
          <div class="pending-card">
            <div class="pending-title">📬 Solicitações pendentes</div>
            @for (req of pending(); track req.friendshipId) {
              <div class="pending-item">
                <span class="name">{{ req.name }}</span>
                <button class="btn accept-btn"  (click)="acceptRequest(req.friendshipId)">Aceitar</button>
                <button class="btn decline-btn" (click)="declineRequest(req.friendshipId)">Recusar</button>
              </div>
            }
          </div>
        }

        <!-- Search panel -->
        <div class="friend-panel">
          <div class="search-row">
            <input type="text" placeholder="Buscar usuário pelo nome…"
                   [(ngModel)]="searchQuery" (keyup.enter)="runSearch()" />
            <button (click)="runSearch()">Buscar</button>
          </div>
          @if (searchResults().length > 0) {
            <div class="search-results">
              @for (u of searchResults(); track u.userId) {
                <div class="result-item">
                  @if (avatar(u.avatarUrl); as src) {
                    <img [src]="src" class="avatar" [alt]="u.name" />
                  } @else {
                    <div class="avatar">{{ u.name.charAt(0).toUpperCase() }}</div>
                  }
                  <div style="flex:1">
                    <div class="name">{{ u.name }}</div>
                    @if (u.city) { <div class="city">📍 {{ u.city }}</div> }
                  </div>
                  <button class="add-btn" (click)="addFriend(u.userId)">+ Adicionar</button>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Ranking content -->
      @if (loading()) {
        <div class="loading-text">Carregando ranking…</div>
      } @else if (rankingList().length === 0) {
        <div class="empty-state">
          <div class="icon">{{ emptyIcon() }}</div>
          <p>{{ emptyMsg() }}</p>
        </div>
      } @else {
        <!-- Podium: top 3 -->
        @if (podium().length > 0) {
          <div class="podium">
            @for (slot of podiumOrder(); track slot.userId) {
              <div class="podium-slot" [class]="'rank-' + slot.rank">
                <div class="podium-avatar" [class]="'rank-' + slot.rank">
                  @if (slot.rank === 1) { <span class="crown">👑</span> }
                  @if (avatar(slot.avatarUrl); as src) {
                    <img [src]="src" class="avatar-img" [alt]="slot.name" />
                  } @else {
                    <div class="avatar-placeholder"
                         [style.background]="levelColor(slot.level)">
                      {{ slot.name.charAt(0).toUpperCase() }}
                    </div>
                  }
                </div>
                <div class="podium-info">
                  <div class="podium-name">{{ slot.name }}</div>
                  <div class="podium-xp">{{ slot.weeklyXp | number }} XP</div>
                  <span class="level-badge" [style.background]="levelColor(slot.level)">
                    Nv {{ slot.level }}
                  </span>
                </div>
                <div class="podium-bar">{{ slot.rank }}</div>
              </div>
            }
          </div>
        }

        <!-- List: rank 4+ -->
        @if (rest().length > 0) {
          <div class="rank-list">
            @for (entry of rest(); track entry.userId) {
              <div class="rank-row" [class.is-me]="entry.userId === currentUserId()">
                <div class="rank-num">#{{ entry.rank }}</div>
                @if (avatar(entry.avatarUrl); as src) {
                  <img [src]="src" class="avatar" [alt]="entry.name" />
                } @else {
                  <div class="avatar" [style.background]="levelColor(entry.level)">
                    {{ entry.name.charAt(0).toUpperCase() }}
                  </div>
                }
                <div class="info">
                  <div class="name">{{ entry.name }}{{ entry.userId === currentUserId() ? ' (você)' : '' }}</div>
                  <div class="level">Nv {{ entry.level }} • {{ entry.levelTitle }}</div>
                </div>
                <div class="xp-col">
                  <div class="xp">{{ entry.weeklyXp | number }}</div>
                  <div class="xp-label">XP esta semana</div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  private gamification = inject(GamificationService);
  private friendSvc    = inject(FriendshipService);
  private userSvc      = inject(UserService);
  private api          = inject(ApiService);

  readonly TABS = TABS;

  /** Prepend the Express static-file base URL for relative avatar paths. */
  avatar(url: string | null | undefined): string | null {
    return this.api.storageUrl(url);
  }

  activeTab    = signal<Tab>('global');
  loading      = signal(true);
  ranking      = signal<RankingEntry[]>([]);
  pending      = signal<PendingRequest[]>([]);
  searchQuery  = '';
  searchResults = signal<UserSearchResult[]>([]);
  currentUserId = signal<string>('');

  rankingList = computed(() => this.ranking());

  podium = computed(() => this.rankingList().slice(0, 3).map((e, i) => ({ ...e, rank: i + 1 })));

  /** Visual order for podium: 2nd, 1st, 3rd */
  podiumOrder = computed(() => {
    const p = this.podium();
    if (p.length === 0) return [];
    const [first, second, third] = [p[0]!, p[1], p[2]];
    const order = [];
    if (second) order.push(second);
    order.push(first);
    if (third) order.push(third);
    return order;
  });

  rest = computed(() => this.rankingList().slice(3).map((e, i) => ({ ...e, rank: i + 4 })));

  emptyIcon = computed(() => ({
    global:   '🌎',
    regional: '📍',
    friends:  '👥',
  }[this.activeTab()]));

  emptyMsg = computed(() => ({
    global:   'Nenhum usuário no ranking global ainda.',
    regional: 'Nenhum usuário da sua cidade no ranking ainda.',
    friends:  'Adicione amigos para ver o ranking de amigos.',
  }[this.activeTab()]));

  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({ next: u => this.currentUserId.set(u.id), error: () => {} });
    this.loadRanking();
    this.loadPending();
  }

  switchTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.searchResults.set([]);
    this.searchQuery = '';
    this.loadRanking();
    if (tab === 'friends') this.loadPending();
  }

  private loadRanking(): void {
    this.loading.set(true);
    this.gamification.getRanking(this.activeTab() as RankingScope).subscribe({
      next:  rows => { this.ranking.set(rows.map((r, i) => ({ ...r, rank: i + 1 }))); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  private loadPending(): void {
    this.friendSvc.listPending().subscribe({
      next: list => this.pending.set(list),
      error: () => {},
    });
  }

  runSearch(): void {
    const q = this.searchQuery.trim();
    if (q.length < 2) return;
    this.friendSvc.searchUsers(q).subscribe({
      next: res => this.searchResults.set(res),
      error: () => {},
    });
  }

  addFriend(userId: string): void {
    this.friendSvc.sendRequest(userId).subscribe({
      next: () => {
        this.searchResults.update(list => list.filter(u => u.userId !== userId));
      },
      error: () => {},
    });
  }

  acceptRequest(id: string): void {
    this.friendSvc.accept(id).subscribe({
      next: () => {
        this.pending.update(list => list.filter(r => r.friendshipId !== id));
        this.loadRanking();
      },
      error: () => {},
    });
  }

  declineRequest(id: string): void {
    this.friendSvc.decline(id).subscribe({
      next: () => this.pending.update(list => list.filter(r => r.friendshipId !== id)),
      error: () => {},
    });
  }

  levelColor(level: number): string {
    return LEVEL_COLORS[level] ?? '#94a3b8';
  }
}
