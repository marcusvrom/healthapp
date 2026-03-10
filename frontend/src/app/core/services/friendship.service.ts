import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  FriendEntry, PendingRequest, UserSearchResult,
} from '../models';

@Injectable({ providedIn: 'root' })
export class FriendshipService {
  private api = inject(ApiService);

  listFriends(): Observable<FriendEntry[]> {
    return this.api.get<FriendEntry[]>('/friends');
  }

  listPending(): Observable<PendingRequest[]> {
    return this.api.get<PendingRequest[]>('/friends/pending');
  }

  searchUsers(q: string): Observable<UserSearchResult[]> {
    return this.api.get<UserSearchResult[]>('/friends/search', { q });
  }

  sendRequest(addresseeId: string): Observable<unknown> {
    return this.api.post('/friends/request', { addresseeId });
  }

  accept(friendshipId: string): Observable<unknown> {
    return this.api.patch(`/friends/${friendshipId}/accept`, {});
  }

  decline(friendshipId: string): Observable<unknown> {
    return this.api.patch(`/friends/${friendshipId}/decline`, {});
  }

  remove(friendshipId: string): Observable<unknown> {
    return this.api.delete(`/friends/${friendshipId}`);
  }
}
