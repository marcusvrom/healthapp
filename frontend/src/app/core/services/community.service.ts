import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PublicProfileWithFriendship } from '../models';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private api = inject(ApiService);

  search(q: string, limit = 20): Observable<PublicProfileWithFriendship[]> {
    return this.api.get<PublicProfileWithFriendship[]>('/community/search', {
      q,
      limit: String(limit),
    });
  }

  getProfile(id: string): Observable<PublicProfileWithFriendship> {
    return this.api.get<PublicProfileWithFriendship>(`/community/profile/${id}`);
  }
}
