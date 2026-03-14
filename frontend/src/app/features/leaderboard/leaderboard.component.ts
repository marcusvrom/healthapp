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
  // { id: 'regional', label: 'Minha Cidade',  icon: '📍' },
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
  styleUrls: ['./leaderboard.component.scss'],
  templateUrl: './leaderboard.component.html',
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
