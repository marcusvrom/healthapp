import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { CurrentUser } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api    = inject(ApiService);
  private http   = inject(HttpClient);
  private base   = environment.apiUrl;

  currentUser = signal<CurrentUser | null>(null);

  loadMe(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/users/me').pipe(
      tap(u => this.currentUser.set(u))
    );
  }

  /**
   * Upload avatar via multipart/form-data.
   * Returns the new avatarUrl.
   */
  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.post<{ avatarUrl: string }>(`${this.base}/users/avatar`, form).pipe(
      tap(r => {
        this.currentUser.update(u => u ? { ...u, avatarUrl: r.avatarUrl } : u);
      })
    );
  }
}
