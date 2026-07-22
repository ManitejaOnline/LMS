import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password-page.component').then(
        (m) => m.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent,
      ),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell-layout.component').then((m) => m.ShellLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/overview-page.component').then(
            (m) => m.OverviewPageComponent,
          ),
      },
      {
        path: 'my-learning',
        loadComponent: () =>
          import('./features/learning/my-learning-page.component').then(
            (m) => m.MyLearningPageComponent,
          ),
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./features/learning/progress-page.component').then(
            (m) => m.ProgressPageComponent,
          ),
      },
      {
        path: 'learn/:assignmentId',
        loadComponent: () =>
          import('./features/learning/course-player-page.component').then(
            (m) => m.CoursePlayerPageComponent,
          ),
      },
      {
        path: 'courses',
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
        loadComponent: () =>
          import('./features/courses/courses-list-page.component').then(
            (m) => m.CoursesListPageComponent,
          ),
      },
      {
        path: 'courses/:id',
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN'])],
        loadComponent: () =>
          import('./features/courses/course-editor-page.component').then(
            (m) => m.CourseEditorPageComponent,
          ),
      },
      {
        path: 'users',
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])],
        loadComponent: () =>
          import('./features/users/users-page.component').then((m) => m.UsersPageComponent),
      },
      {
        path: 'departments',
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])],
        loadComponent: () =>
          import('./features/departments/departments-page.component').then(
            (m) => m.DepartmentsPageComponent,
          ),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])],
        loadComponent: () =>
          import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile-page.component').then(
            (m) => m.ProfilePageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/profile/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' },
];
