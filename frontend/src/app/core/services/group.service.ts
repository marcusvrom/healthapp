import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Group, GroupDetail } from '../models';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private api = inject(ApiService);

  myGroups(): Observable<Group[]> {
    return this.api.get<Group[]>('/groups');
  }

  create(payload: { name: string; description?: string; avatarEmoji?: string }): Observable<Group> {
    return this.api.post<Group>('/groups', payload);
  }

  joinByCode(code: string): Observable<{ group: Group; alreadyMember: boolean }> {
    return this.api.post<{ group: Group; alreadyMember: boolean }>(`/groups/join/${code}`, {});
  }

  detail(groupId: string): Observable<GroupDetail> {
    return this.api.get<GroupDetail>(`/groups/${groupId}`);
  }

  leave(groupId: string): Observable<void> {
    return this.api.delete<void>(`/groups/${groupId}/leave`);
  }
}
