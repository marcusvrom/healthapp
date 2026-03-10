import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.token) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};

export const publicGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.token) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
