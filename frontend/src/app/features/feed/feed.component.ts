import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocialService } from '../../core/services/social.service';
import { ApiService } from '../../core/services/api.service';
import { FeedItem, FeedComment } from '../../core/models';

const BLOCK_EMOJI: Record<string, string> = {
  exercise:     '🏋️',
  sleep:        '😴',
  water:        '💧',
  meal:         '🍽️',
  sun_exposure: '☀️',
  work:         '💼',
  free:         '🎯',
  custom:       '⭐',
  medication:   '💊',
};

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [DatePipe, NgClass, FormsModule],
  styleUrls: ['./feed.component.scss'],
  templateUrl: './feed.component.html',
})
export class FeedComponent implements OnInit {
  private svc = inject(SocialService);

  private api    = inject(ApiService);
  img = (path: string | null | undefined) => this.api.storageUrl(path);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tab = signal<'community' | 'mine'>('community');

  // ── Community feed ────────────────────────────────────────────────────────
  feed           = signal<FeedItem[]>([]);
  loading        = signal(false);
  allLoaded      = signal(false);
  private page   = 1;

  // ── My posts ──────────────────────────────────────────────────────────────
  myPosts        = signal<FeedItem[]>([]);
  myLoading      = signal(false);
  myAllLoaded    = signal(false);
  deleting       = signal<Set<string>>(new Set());
  private myPage = 1;
  private myLoaded = false;

  // ── Comments ──────────────────────────────────────────────────────────────
  openComments    = signal<Set<string>>(new Set());
  commentsMap     = signal<Map<string, FeedComment[]>>(new Map());
  commentsLoading = signal<Set<string>>(new Set());
  sendingComment  = signal<Set<string>>(new Set());
  commentDraft: Record<string, string> = {};

  ngOnInit(): void { this.loadPage(); }

  setTab(t: 'community' | 'mine'): void {
    this.tab.set(t);
    if (t === 'mine' && !this.myLoaded) this.loadMyPage();
  }

  // ── Community ─────────────────────────────────────────────────────────────

  private loadPage(): void {
    this.loading.set(true);
    this.svc.getFeed(this.page).subscribe({
      next: items => {
        this.feed.update(f => [...f, ...items]);
        if (items.length < 20) this.allLoaded.set(true);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore(): void { this.page++; this.loadPage(); }

  toggleLike(post: FeedItem): void {
    const optimistic = !post.userLiked;
    this.feed.update(f => f.map(p => p.id === post.id
      ? { ...p, userLiked: optimistic, likeCount: p.likeCount + (optimistic ? 1 : -1) }
      : p
    ));
    this.svc.toggleLike(post.id).subscribe({
      error: () => {
        this.feed.update(f => f.map(p => p.id === post.id
          ? { ...p, userLiked: !optimistic, likeCount: p.likeCount + (optimistic ? -1 : 1) }
          : p
        ));
      },
    });
  }

  // ── My posts ──────────────────────────────────────────────────────────────

  private loadMyPage(): void {
    this.myLoading.set(true);
    this.svc.getMyPosts(this.myPage).subscribe({
      next: items => {
        this.myPosts.update(p => [...p, ...items]);
        if (items.length < 20) this.myAllLoaded.set(true);
        this.myLoading.set(false);
        this.myLoaded = true;
      },
      error: () => this.myLoading.set(false),
    });
  }

  loadMoreMine(): void { this.myPage++; this.loadMyPage(); }

  deletePost(post: FeedItem): void {
    if (!confirm('Excluir este post? Esta ação não pode ser desfeita.')) return;

    const s = new Set(this.deleting());
    s.add(post.id);
    this.deleting.set(s);

    this.svc.deletePost(post.id).subscribe({
      next: () => {
        this.myPosts.update(p => p.filter(x => x.id !== post.id));
        // Also remove from community feed if present
        this.feed.update(f => f.filter(x => x.id !== post.id));
        const s2 = new Set(this.deleting());
        s2.delete(post.id);
        this.deleting.set(s2);
      },
      error: () => {
        const s2 = new Set(this.deleting());
        s2.delete(post.id);
        this.deleting.set(s2);
      },
    });
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  toggleComments(postId: string): void {
    const set = new Set(this.openComments());
    if (set.has(postId)) {
      set.delete(postId);
      this.openComments.set(set);
    } else {
      set.add(postId);
      this.openComments.set(set);
      if (!this.commentsMap().has(postId)) this.fetchComments(postId);
    }
  }

  private fetchComments(postId: string): void {
    const loading = new Set(this.commentsLoading());
    loading.add(postId);
    this.commentsLoading.set(loading);

    this.svc.getComments(postId).subscribe({
      next: comments => {
        const map = new Map(this.commentsMap());
        map.set(postId, comments);
        this.commentsMap.set(map);
        const l = new Set(this.commentsLoading());
        l.delete(postId);
        this.commentsLoading.set(l);
      },
      error: () => {
        const l = new Set(this.commentsLoading());
        l.delete(postId);
        this.commentsLoading.set(l);
      },
    });
  }

  commentsFor(postId: string): FeedComment[] {
    return this.commentsMap().get(postId) ?? [];
  }

  submitComment(post: FeedItem): void {
    const body = this.commentDraft[post.id]?.trim();
    if (!body) return;

    const sending = new Set(this.sendingComment());
    sending.add(post.id);
    this.sendingComment.set(sending);

    this.svc.addComment(post.id, body).subscribe({
      next: comment => {
        this.commentDraft[post.id] = '';
        const map = new Map(this.commentsMap());
        map.set(post.id, [...(map.get(post.id) ?? []), comment]);
        this.commentsMap.set(map);
        this.feed.update(f => f.map(p =>
          p.id === post.id ? { ...p, commentCount: p.commentCount + 1 } : p
        ));
        const s = new Set(this.sendingComment());
        s.delete(post.id);
        this.sendingComment.set(s);
      },
      error: () => {
        const s = new Set(this.sendingComment());
        s.delete(post.id);
        this.sendingComment.set(s);
      },
    });
  }

  deleteComment(post: FeedItem, comment: FeedComment): void {
    this.svc.deleteComment(comment.id).subscribe({
      next: () => {
        const map = new Map(this.commentsMap());
        map.set(post.id, (map.get(post.id) ?? []).filter(c => c.id !== comment.id));
        this.commentsMap.set(map);
        this.feed.update(f => f.map(p =>
          p.id === post.id ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
        ));
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  blockEmoji(type: string): string { return BLOCK_EMOJI[type] ?? '⭐'; }

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
