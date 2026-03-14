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
  styleUrls: ['./public-profile.component.scss'],
  templateUrl: './public-profile.component.html',
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
