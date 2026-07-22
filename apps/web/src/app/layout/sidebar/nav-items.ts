export type AppRoleName = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  roles?: AppRoleName[];
}

/** Primary navigation shared by Admin and Employee portals (role-filtered). */
export const PRIMARY_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'pi pi-th-large',
    route: '/app',
    exact: true,
  },
  {
    id: 'my-learning',
    label: 'My Learning',
    icon: 'pi pi-bookmark',
    route: '/app/my-learning',
    roles: ['EMPLOYEE', 'MANAGER'],
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: 'pi pi-chart-line',
    route: '/app/progress',
    roles: ['EMPLOYEE'],
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: 'pi pi-folder',
    route: '/app/courses',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: 'pi pi-users',
    route: '/app/users',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: 'pi pi-building',
    route: '/app/departments',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'pi pi-chart-bar',
    route: '/app/reports',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
];

export const FOOTER_NAV: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: 'pi pi-user',
    route: '/app/profile',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'pi pi-cog',
    route: '/app/settings',
  },
];

export function filterNavForRole(
  items: NavItem[],
  role: AppRoleName | null | undefined,
): NavItem[] {
  if (!role) return items.filter((i) => !i.roles);
  return items.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.includes(role);
  });
}
