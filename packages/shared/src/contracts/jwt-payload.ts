/**
 * JWT access-token payload contract (infra only — no user module).
 */
export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions?: string[];
  typ: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}
