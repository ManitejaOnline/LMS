import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from '@zebl/shared';
import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from '../types/authenticated-user';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const createContext = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows when user has a required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AppRole.SUPER_ADMIN,
    ]);

    const user: AuthenticatedUser = {
      userId: 'u1',
      email: 'admin@example.com',
      roles: [AppRole.SUPER_ADMIN],
      permissions: [],
    };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('denies when user lacks required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AppRole.SUPER_ADMIN,
    ]);

    const user: AuthenticatedUser = {
      userId: 'u2',
      email: 'employee@example.com',
      roles: [AppRole.EMPLOYEE],
      permissions: [],
    };

    expect(() => guard.canActivate(createContext(user))).toThrow(
      ForbiddenException,
    );
  });
});
