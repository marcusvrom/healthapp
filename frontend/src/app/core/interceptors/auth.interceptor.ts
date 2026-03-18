import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // HttpOnly cookie is sent automatically via withCredentials.
  // No need to manually set Authorization header.

  const authSvc = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError(err => {
      // Auto-logout on 401 (expired/invalid token)
      if (err.status === 401 && authSvc.isLoggedIn()) {
        authSvc.logout();
      }
      return throwError(() => err);
    })
  );
};
