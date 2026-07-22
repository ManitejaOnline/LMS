export enum AppRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export const APP_ROLES = Object.values(AppRole);

/** Role hierarchy weight — higher can manage lower (used for assignment guards). */
export const ROLE_RANK: Record<AppRole, number> = {
  [AppRole.SUPER_ADMIN]: 100,
  [AppRole.ADMIN]: 80,
  [AppRole.MANAGER]: 50,
  [AppRole.EMPLOYEE]: 10,
};
