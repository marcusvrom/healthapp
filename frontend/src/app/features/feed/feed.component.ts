import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { SocialService } from '../../core/services/social.service';
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
  styles: [`
    .page { max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem; }

    .page-header {
      margin-bottom: 1.25rem;
      h2 { font-size: 1.5rem; font-weight: 800; }
      p  { color: var(--color-text-muted); font-size: .875rem; margin-top: .25rem; }
    }

    .tabs {
      display: flex; gap: .5rem; margin-bottom: 1.25rem;
      border-bottom: 2px solid var(--color-border);

      .tab-btn {
        padding: .5rem 1rem; border: none; background: none; cursor: pointer;
        font-size: .875rem; font-weight: 600; color: var(--color-text-muted);
        border-bottom: 2px solid transparent; margin-bottom: -2px; transition: .15s;

        &:hover { color: var(--color-text); }
        &.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
      }
    }

    .feed-empty {
      text-align: center; padding: 3rem 1rem;
      .emoji { font-size: 3rem; display: block; margin-bottom: 1rem; }
      p { color: var(--color-text-muted); }
    }

    .post-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); margin-bottom: 1rem; overflow: hidden;

      .post-header {
        display: flex; align-items: center; gap: .75rem;
        padding: .875rem 1rem .625rem;

        .avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: var(--color-primary-light); display: flex;
          align-items: center; justify-content: center;
          font-size: .9rem; font-weight: 700; color: var(--color-primary-dark);
          object-fit: cover;
        }
        .meta { flex: 1; min-width: 0;
          .name { font-weight: 700; font-size: .875rem; }
          .sub  { font-size: .72rem; color: var(--color-text-muted);
            display: flex; align-items: center; gap: .4rem; }
        }
        .block-badge {
          font-size: .72rem; background: var(--color-surface-2);
          border: 1px solid var(--color-border); border-radius: 99px;
          padding: .2rem .6rem; color: var(--color-text-muted); font-weight: 600;
        }
        .delete-post-btn {
          background: none; border: none; cursor: pointer;
          color: var(--color-text-subtle); font-size: 1rem; padding: .25rem;
          border-radius: var(--radius-sm); transition: .15s; line-height: 1;
          &:hover { background: #fee2e2; color: #dc2626; }
        }
      }

      .post-photo {
        width: 100%; max-height: 420px; object-fit: cover; display: block;
      }

      .post-caption {
        padding: .625rem 1rem .375rem;
        font-size: .875rem; line-height: 1.5;
      }

      .post-actions {
        display: flex; align-items: center; gap: .5rem;
        padding: .5rem 1rem .75rem;

        .action-btn {
          display: flex; align-items: center; gap: .375rem;
          background: none; border: none; cursor: pointer;
          font-size: .82rem; color: var(--color-text-muted);
          padding: .35rem .625rem; border-radius: var(--radius-sm); transition: .15s;

          &:hover { background: var(--color-surface-2); color: var(--color-text); }
          &.liked { color: #ef4444; }
          .icon   { font-size: 1rem; }
        }
      }

      .comments-section {
        border-top: 1px solid var(--color-border); padding: .75rem 1rem;

        .comment-row {
          display: flex; gap: .625rem; margin-bottom: .625rem;
          .c-avatar {
            width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
            background: var(--color-surface-2); display: flex; align-items: center;
            justify-content: center; font-size: .7rem; font-weight: 700;
            color: var(--color-text-muted); object-fit: cover;
          }
          .c-body {
            flex: 1; background: var(--color-surface-2); border-radius: var(--radius-sm);
            padding: .4rem .625rem; font-size: .8rem; line-height: 1.4;
            .c-name { font-weight: 700; margin-right: .3rem; font-size: .75rem; }
          }
          .c-delete {
            background: none; border: none; cursor: pointer; color: var(--color-text-subtle);
            font-size: .75rem; padding: .2rem; align-self: flex-start;
            &:hover { color: var(--color-danger); }
          }
        }

        .comment-form {
          display: flex; gap: .5rem; margin-top: .5rem;
          input {
            flex: 1; padding: .4rem .625rem; border: 1px solid var(--color-border);
            border-radius: var(--radius-sm); font-size: .8rem;
            background: var(--color-surface-2);
            &:focus { outline: none; border-color: var(--color-primary); }
          }
          button {
            padding: .4rem .75rem; border-radius: var(--radius-sm);
            border: none; background: var(--color-primary);
            color: #fff; font-size: .8rem; cursor: pointer; font-weight: 600;
            &:disabled { opacity: .5; cursor: not-allowed; }
          }
        }
      }
    }

    .load-more {
      display: block; width: 100%; padding: .75rem;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-md);
      background: none; cursor: pointer; font-weight: 600; font-size: .875rem;
      color: var(--color-text-muted); transition: .15s;
      &:hover { background: var(--color-surface-2); color: var(--color-text); }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🌐 Feed Social</h2>
        <p>Conquistas compartilhadas pela comunidade</p>
      </div>

      <div class="tabs">
        <button class="tab-btn" [class.active]="tab() === 'community'" (click)="setTab('community')">
          Comunidade
        </button>
        <button class="tab-btn" [class.active]="tab() === 'mine'" (click)="setTab('mine')">
          Meus Posts
        </button>
      </div>

      <!-- ── Comunidade ────────────────────────────────────────────────────── -->
      @if (tab() === 'community') {
        @if (loading() && feed().length === 0) {
          <div class="feed-empty"><span class="emoji">⏳</span><p>Carregando...</p></div>
        } @else if (feed().length === 0) {
          <div class="feed-empty">
            <span class="emoji">🏃</span>
            <p>Nenhuma publicação ainda.<br>Conclua um bloco e compartilhe sua conquista!</p>
          </div>
        } @else {
          @for (post of feed(); track post.id) {
            <div class="post-card">
              <div class="post-header">
                @if (post.avatarUrl) {
                  <img [src]="apiBase + post.avatarUrl" class="avatar" [alt]="post.userName">
                } @else {
                  <div class="avatar">{{ initials(post.userName) }}</div>
                }
                <div class="meta">
                  <div class="name">{{ post.userName }}</div>
                  <div class="sub"><span>{{ post.createdAt | date:'dd/MM · HH:mm' }}</span></div>
                </div>
                @if (post.blockType) {
                  <span class="block-badge">{{ blockEmoji(post.blockType) }} {{ post.blockType }}</span>
                }
              </div>

              @if (post.photoUrl) {
                <div style="position:relative">
                  <img [src]="apiBase + post.photoUrl" class="post-photo" [alt]="post.caption ?? 'foto'">
                  @if (post.photoVerified) {
                    <span style="position:absolute;bottom:.5rem;right:.5rem;background:rgba(0,0,0,.55);
                      color:#fff;font-size:.68rem;font-weight:700;padding:.2rem .5rem;
                      border-radius:99px;">✅ Verificado</span>
                  }
                </div>
              }

              @if (post.caption) {
                <p class="post-caption">{{ post.caption }}</p>
              }

              <div class="post-actions">
                <button class="action-btn" [class.liked]="post.userLiked" (click)="toggleLike(post)">
                  <span class="icon">{{ post.userLiked ? '❤️' : '🤍' }}</span>
                  {{ post.likeCount }}
                </button>
                <button class="action-btn" (click)="toggleComments(post.id)">
                  <span class="icon">💬</span>
                  {{ post.commentCount }}
                </button>
              </div>

              @if (openComments().has(post.id)) {
                <div class="comments-section">
                  @if (commentsLoading().has(post.id)) {
                    <p style="font-size:.8rem;color:var(--color-text-muted)">Carregando...</p>
                  }
                  @for (c of commentsFor(post.id); track c.id) {
                    <div class="comment-row">
                      @if (c.avatarUrl) {
                        <img [src]="apiBase + c.avatarUrl" class="c-avatar" [alt]="c.userName">
                      } @else {
                        <div class="c-avatar">{{ initials(c.userName) }}</div>
                      }
                      <div class="c-body">
                        <span class="c-name">{{ c.userName }}</span>{{ c.body }}
                      </div>
                      @if (c.isOwn) {
                        <button class="c-delete" (click)="deleteComment(post, c)">✕</button>
                      }
                    </div>
                  }
                  <div class="comment-form">
                    <input
                      type="text"
                      placeholder="Escreva um comentário..."
                      [(ngModel)]="commentDraft[post.id]"
                      (keyup.enter)="submitComment(post)"
                      maxlength="300" />
                    <button
                      (click)="submitComment(post)"
                      [disabled]="!commentDraft[post.id]?.trim() || sendingComment().has(post.id)">
                      Enviar
                    </button>
                  </div>
                </div>
              }
            </div>
          }
          @if (!allLoaded()) {
            <button class="load-more" (click)="loadMore()" [disabled]="loading()">
              {{ loading() ? 'Carregando...' : 'Carregar mais' }}
            </button>
          }
        }
      }

      <!-- ── Meus Posts ────────────────────────────────────────────────────── -->
      @if (tab() === 'mine') {
        @if (myLoading() && myPosts().length === 0) {
          <div class="feed-empty"><span class="emoji">⏳</span><p>Carregando...</p></div>
        } @else if (myPosts().length === 0) {
          <div class="feed-empty">
            <span class="emoji">📸</span>
            <p>Você ainda não compartilhou nenhum post.<br>Complete um bloco e registre sua conquista!</p>
          </div>
        } @else {
          @for (post of myPosts(); track post.id) {
            <div class="post-card">
              <div class="post-header">
                @if (post.avatarUrl) {
                  <img [src]="apiBase + post.avatarUrl" class="avatar" [alt]="post.userName">
                } @else {
                  <div class="avatar">{{ initials(post.userName) }}</div>
                }
                <div class="meta">
                  <div class="name">{{ post.userName }}</div>
                  <div class="sub"><span>{{ post.createdAt | date:'dd/MM/yy · HH:mm' }}</span></div>
                </div>
                @if (post.blockType) {
                  <span class="block-badge">{{ blockEmoji(post.blockType) }} {{ post.blockType }}</span>
                }
                <button
                  class="delete-post-btn"
                  title="Excluir post"
                  [disabled]="deleting().has(post.id)"
                  (click)="deletePost(post)">
                  🗑️
                </button>
              </div>

              @if (post.photoUrl) {
                <div style="position:relative">
                  <img [src]="apiBase + post.photoUrl" class="post-photo" [alt]="post.caption ?? 'foto'">
                  @if (post.photoVerified) {
                    <span style="position:absolute;bottom:.5rem;right:.5rem;background:rgba(0,0,0,.55);
                      color:#fff;font-size:.68rem;font-weight:700;padding:.2rem .5rem;
                      border-radius:99px;">✅ Verificado</span>
                  }
                </div>
              }

              @if (post.caption) {
                <p class="post-caption">{{ post.caption }}</p>
              }

              <div class="post-actions">
                <span class="action-btn" style="cursor:default">
                  <span class="icon">❤️</span> {{ post.likeCount }}
                </span>
                <span class="action-btn" style="cursor:default">
                  <span class="icon">💬</span> {{ post.commentCount }}
                </span>
              </div>
            </div>
          }

          @if (!myAllLoaded()) {
            <button class="load-more" (click)="loadMoreMine()" [disabled]="myLoading()">
              {{ myLoading() ? 'Carregando...' : 'Carregar mais' }}
            </button>
          }
        }
      }
    </div>
  `,
})
export class FeedComponent implements OnInit {
  private svc = inject(SocialService);

  readonly apiBase = environment.apiUrl.replace('/api', '');

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
