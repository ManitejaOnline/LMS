import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { AppRole } from '../models/domain.models';
import { AuthService } from './auth.service';
import { map, of, switchMap } from 'rxjs';

export const roleGuard = (allowed: AppRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const ensureUser = auth.currentUser()
      ? of(auth.currentUser()!)
      : auth.loadProfile();

    return ensureUser.pipe(
      map((user) => {
        if (allowed.includes(user.role)) {
          return true;
        }
        return router.createUrlTree(['/app']);
      }),
      switchMap((result) => of(result)),
    );
  };
};
