import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Button } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme/theme.service';
import {
  NotificationsApiService,
  type AppNotification,
} from '../core/http/notifications-api.service';
import { SidebarComponent } from './sidebar/sidebar.component';
import { SidebarStateService } from './sidebar/sidebar-state.service';

/**
 * Enterprise application shell: collapsible sidebar + header + content.
 * Used by both Admin and Employee portals (role-based nav inside Sidebar).
 */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Button, Popover, SidebarComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>

    <div
      class="shell"
      [class.collapsed]="sidebar.isCollapsed()"
      [class.overlay-mode]="sidebar.isOverlayMode()"
      [class.overlay-open]="sidebar.isOverlayOpen()"
    >
      <div class="sidebar-slot">
        <app-sidebar [loggingOut]="loggingOut()" (logout)="logout()" />
      </div>

      @if (sidebar.isOverlayMode() && !sidebar.isOverlayOpen()) {
        <button
          type="button"
          class="overlay-rail-toggle"
          aria-label="Open navigation"
          [attr.aria-expanded]="false"
          (click)="sidebar.openOverlay()"
        >
          <i class="pi pi-bars" aria-hidden="true"></i>
        </button>
      }

      <div class="main">
        <header class="topbar">
          <div class="topbar-left">
            <h1 class="page-heading">{{ pageTitle() }}</h1>
          </div>

          <div class="topbar-actions">
            @if (canManageCourses() && (pageTitle() === 'Dashboard' || pageTitle() === 'Courses')) {
              <a routerLink="/app/courses/new" class="no-underline">
                <p-button label="Create Course" icon="pi pi-plus" size="small" />
              </a>
            }
            <button
              type="button"
              class="icon-btn"
              [attr.aria-label]="theme.darkMode() ? 'Light mode' : 'Dark mode'"
              (click)="theme.toggle()"
            >
              <i [class]="theme.darkMode() ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="icon-btn notif-btn"
              aria-label="Notifications"
              (click)="toggleNotifications($event)"
            >
              <i class="pi pi-bell" aria-hidden="true"></i>
              @if (notifications.unreadCount() > 0) {
                <span class="notif-dot">{{ notifications.unreadCount() }}</span>
              }
            </button>
            <p-popover #notifPanel>
              <div class="notif-panel">
                <div class="notif-head">
                  <strong>Notifications</strong>
                  <button type="button" class="text-btn" (click)="markAllRead()">Mark all read</button>
                </div>
                @for (n of notifItems(); track n.id) {
                  <button
                    type="button"
                    class="notif-item"
                    [class.unread]="!n.readAt"
                    (click)="openNotif(n)"
                  >
                    <div class="notif-title">{{ n.title }}</div>
                    <div class="notif-body">{{ n.body }}</div>
                  </button>
                } @empty {
                  <p class="ctp-muted">No notifications.</p>
                }
              </div>
            </p-popover>
            <div class="user-chip">
              <div class="avatar" aria-hidden="true">{{ initials() }}</div>
              <div class="user-meta">
                <div class="user-name">{{ auth.displayName() }}</div>
                <div class="user-role">{{ roleLabel() }}</div>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" class="content" tabindex="-1">
          <router-outlet />
        </main>
      </div>

      @if (sidebar.isOverlayMode() && sidebar.isOverlayOpen()) {
        <button
          type="button"
          class="backdrop"
          aria-label="Close navigation"
          (click)="sidebar.closeOverlay()"
        ></button>
      }
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        background: var(--ctp-bg);
      }
      .sidebar-slot {
        flex: 0 0 auto;
        width: var(--ctp-sidebar-w, 240px);
        height: 100vh;
        position: sticky;
        top: 0;
        z-index: 30;
        transition: width 220ms ease-in-out;
        will-change: width;
      }
      .shell.collapsed .sidebar-slot {
        width: var(--ctp-sidebar-w-collapsed, 72px);
      }
      .shell.overlay-mode .sidebar-slot {
        width: 0;
        overflow: visible;
        position: static;
        height: 0;
      }
      .main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        overflow-x: hidden;
        transition: none;
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        height: var(--ctp-header-h);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s3);
        padding: 0 var(--ctp-page-pad);
        background: var(--ctp-surface);
        border-bottom: 1px solid var(--ctp-border);
      }
      .topbar-left {
        display: flex;
        align-items: center;
        gap: var(--s2);
        min-width: 0;
      }
      .page-heading {
        margin: 0;
        font-size: var(--ctp-fs-card);
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .topbar-actions {
        display: flex;
        align-items: center;
        gap: var(--s2);
        flex-shrink: 0;
        margin-left: auto;
      }
      .icon-btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--ctp-border);
        background: var(--ctp-surface);
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        cursor: pointer;
        display: grid;
        place-items: center;
        position: relative;
        font-size: 13px;
      }
      .icon-btn:hover {
        color: var(--ctp-ink);
        background: var(--ctp-bg);
      }
      .icon-btn:focus-visible {
        outline: 2px solid var(--ctp-primary);
        outline-offset: 1px;
      }
      .overlay-rail-toggle {
        position: fixed;
        top: 12px;
        left: 8px;
        z-index: 36;
        width: 36px;
        height: 36px;
        border: 1px solid var(--ctp-border);
        background: var(--ctp-surface);
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 15px;
        box-shadow: var(--ctp-shadow);
      }
      .overlay-rail-toggle:hover {
        color: var(--ctp-ink);
        background: var(--ctp-bg);
      }
      .overlay-rail-toggle:focus-visible {
        outline: 2px solid var(--ctp-primary);
        outline-offset: 1px;
      }
      .notif-dot {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 14px;
        height: 14px;
        padding: 0 3px;
        border-radius: 999px;
        background: var(--ctp-danger);
        color: #fff;
        font-size: 10px;
        display: grid;
        place-items: center;
      }
      .user-chip {
        display: flex;
        align-items: center;
        gap: var(--s2);
        margin-left: var(--s1);
      }
      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 600;
      }
      .user-name {
        font-size: var(--ctp-fs-label);
        font-weight: 600;
        line-height: 1.2;
      }
      .user-role {
        font-size: 11px;
        color: var(--ctp-muted);
        line-height: 1.2;
      }
      .text-btn {
        border: none;
        background: none;
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        cursor: pointer;
        font-weight: 500;
      }
      .content {
        padding: var(--ctp-page-pad);
        flex: 1;
        min-width: 0;
      }
      .notif-panel {
        width: min(300px, 90vw);
        max-height: 320px;
        overflow: auto;
        font-size: var(--ctp-fs-body);
      }
      .notif-head {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--s2);
      }
      .notif-item {
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        border-radius: var(--ctp-radius);
        padding: var(--s2);
        cursor: pointer;
        color: var(--ctp-ink);
      }
      .notif-item.unread {
        background: var(--ctp-primary-soft);
      }
      .notif-title {
        font-weight: 600;
        font-size: var(--ctp-fs-body);
      }
      .notif-body {
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
        margin-top: 2px;
      }
      .backdrop {
        display: block;
        position: fixed;
        inset: 0;
        border: none;
        background: rgba(17, 24, 39, 0.35);
        z-index: 35;
        cursor: pointer;
      }
      @media (max-width: 720px) {
        .user-meta {
          display: none;
        }
        .content {
          padding: var(--s3);
        }
      }
    `,
  ],
})
export class ShellLayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly notifications = inject(NotificationsApiService);
  readonly sidebar = inject(SidebarStateService);
  private readonly router = inject(Router);
  private readonly notifPanel = viewChild.required<Popover>('notifPanel');

  readonly loggingOut = signal(false);
  readonly notifItems = signal<AppNotification[]>([]);
  readonly pageTitle = signal('Dashboard');

  ngOnInit(): void {
    if (!this.auth.currentUser()) {
      this.auth.loadProfile().subscribe({ error: () => this.auth.clearSession() });
    }
    this.notifications.refreshUnread();
    this.updateTitle(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.updateTitle(e.urlAfterRedirects);
        this.sidebar.closeOverlay();
      });
  }

  initials(): string {
    const name = this.auth.displayName() || 'U';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (!role) return '…';
    return role.replaceAll('_', ' ');
  }

  canManageCourses(): boolean {
    const role = this.auth.currentUser()?.role;
    return role === 'SUPER_ADMIN' || role === 'ADMIN';
  }

  toggleNotifications(event: Event): void {
    this.notifications.list().subscribe({ next: (items) => this.notifItems.set(items) });
    this.notifPanel().toggle(event);
  }

  openNotif(n: AppNotification): void {
    if (!n.readAt) {
      this.notifications.markRead(n.id).subscribe();
      this.notifItems.update((list) =>
        list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    }
  }

  markAllRead(): void {
    this.notifications.markAllRead().subscribe({
      next: () =>
        this.notifItems.update((list) =>
          list.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
        ),
    });
  }

  logout(): void {
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => this.loggingOut.set(false),
      error: () => {
        this.loggingOut.set(false);
        this.auth.clearSession();
      },
    });
  }

  private updateTitle(url: string): void {
    if (url.includes('/courses')) this.pageTitle.set('Courses');
    else if (url.includes('/my-learning') || url.includes('/learn/')) this.pageTitle.set('My Learning');
    else if (url.includes('/progress')) this.pageTitle.set('Progress');
    else if (url.includes('/users')) this.pageTitle.set('Employees');
    else if (url.includes('/departments')) this.pageTitle.set('Departments');
    else if (url.includes('/reports')) this.pageTitle.set('Reports');
    else if (url.includes('/settings')) this.pageTitle.set('Settings');
    else if (url.includes('/profile')) this.pageTitle.set('Profile');
    else this.pageTitle.set('Dashboard');
  }
}
