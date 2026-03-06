import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FeedItem, FeedComment } from '../models';

@Injectable({ providedIn: 'root' })
export class SocialService {
  private api = inject(ApiService);

  getFeed(page = 1, limit = 20): Observable<FeedItem[]> {
    return this.api.get<FeedItem[]>('/social/feed', { page: String(page), limit: String(limit) });
  }

  toggleLike(postId: string): Observable<{ liked: boolean }> {
    return this.api.post<{ liked: boolean }>(`/social/posts/${postId}/like`, {});
  }

  getComments(postId: string): Observable<FeedComment[]> {
    return this.api.get<FeedComment[]>(`/social/posts/${postId}/comments`);
  }

  addComment(postId: string, body: string): Observable<FeedComment> {
    return this.api.post<FeedComment>(`/social/posts/${postId}/comments`, { body });
  }

  deleteComment(commentId: string): Observable<void> {
    return this.api.delete<void>(`/social/comments/${commentId}`);
  }
}
