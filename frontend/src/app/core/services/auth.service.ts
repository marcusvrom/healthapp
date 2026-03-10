import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  readonly isLoggedIn = signal(!!this.token);

  get token(): string | null { return localStorage.getItem('ha_token'); }
  get userId(): string | null { return localStorage.getItem('ha_uid'); }

  register(email: string, name: string, password: string) {
    return this.api.post<AuthResponse>('/auth/register', { email, name, password }).pipe(
      tap(res => this.persist(res))
    );
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(
      tap(res => this.persist(res))
    );
  }

  logout(): void {
    localStorage.removeItem('ha_token');
    localStorage.removeItem('ha_uid');
    localStorage.removeItem('ha_onboarded');
    this.isLoggedIn.set(false);
    this.router.navigate(['/auth/login']);
  }

  get isOnboarded(): boolean {
    return localStorage.getItem('ha_onboarded') === '1';
  }

  markOnboarded(): void {
    localStorage.setItem('ha_onboarded', '1');
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem('ha_token', res.token);
    localStorage.setItem('ha_uid', res.userId);
    this.isLoggedIn.set(true);
  }
}
