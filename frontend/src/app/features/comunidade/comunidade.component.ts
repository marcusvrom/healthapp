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
  styleUrls: ['./comunidade.component.scss'],
  templateUrl: './comunidade.component.html',
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
