import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Base URL for static files served by Express. Strips /api/v1 from the API URL. */
  readonly storageBase = environment.apiUrl.replace('/api/v1', '');

  /** Returns the full URL for a stored file path (e.g. /uploads/avatars/x.jpg).
   *  Returns null if path is null/undefined/empty. */
  storageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return `${this.storageBase}${path}`;
  }

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => (p = p.set(k, v)));
    return this.http.get<T>(`${this.base}${path}`, { params: p });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }
}
