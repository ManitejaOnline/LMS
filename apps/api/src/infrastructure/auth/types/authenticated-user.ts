import type { AppRole } from '@zebl/shared';

/** Principal attached to request after JWT validation (infra payload shape). */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: AppRole[];
  permissions: string[];
}
