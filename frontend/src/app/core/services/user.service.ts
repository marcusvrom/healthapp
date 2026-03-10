import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { CurrentUser } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  currentUser = signal<CurrentUser | null>(null);

  loadMe(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/users/me').pipe(
      tap(u => this.currentUser.set(u))
    );
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    return new Observable(subscriber => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.api.post<{ avatarUrl: string }>('/users/avatar', { dataUrl }).pipe(
          tap(r => {
            this.currentUser.update(u => u ? { ...u, avatarUrl: r.avatarUrl } : u);
          })
        ).subscribe(subscriber);
      };
      reader.onerror = () => subscriber.error(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }
}
