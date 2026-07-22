import { SetMetadata } from '@nestjs/common';
import { AppRole } from '@zebl/shared';
import { ROLES_KEY } from '../constants/metadata.keys';

/** Restricts a route to one or more roles (RBAC). */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
