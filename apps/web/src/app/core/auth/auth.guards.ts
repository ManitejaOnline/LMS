import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '../auth/token-storage.service';

export const authGuard: CanActivateFn = () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);

  if (tokens.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/app']);
};
