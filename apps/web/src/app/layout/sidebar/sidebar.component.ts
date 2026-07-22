import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  FOOTER_NAV,
  PRIMARY_NAV,
  filterNavForRole,
  type AppRoleName,
} from './nav-items';
import { SidebarStateService } from './sidebar-state.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside
      class="sidebar"
      [class.collapsed]="collapsed()"
      [class.overlay]="overlay()"
      [class.open]="overlayOpen()"
      [attr.aria-expanded]="!collapsed()"
      aria-label="Primary navigation"
    >
      <div class="brand">
        <button
          type="button"
          class="brand-toggle"
          [attr.aria-label]="toggleLabel()"
          [attr.aria-expanded]="toggleExpanded()"
          (click)="onToggle()"
        >
          <i class="pi pi-bars" aria-hidden="true"></i>
        </button>
        <div class="brand-mark" aria-hidden="true">
          <img src="brand/logo.png" alt="" class="brand-logo" />
        </div>
        <div class="brand-text" [attr.aria-hidden]="collapsed() ? true : null">
          <div class="brand-title">Zebl Training Portal</div>
          <div class="brand-sub">Learning</div>
        </div>
      </div>

      <nav class="nav" aria-label="Main">
        @for (item of primaryItems(); track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="item.exact ? { exact: true } : { exact: false }"
            [attr.title]="collapsed() ? item.label : null"
            [attr.aria-label]="item.label"
            (click)="onNavigate()"
          >
            <i [class]="item.icon" aria-hidden="true"></i>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        @for (item of footerItems(); track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            [attr.title]="collapsed() ? item.label : null"
            [attr.aria-label]="item.label"
            (click)="onNavigate()"
          >
            <i [class]="item.icon" aria-hidden="true"></i>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
        <button
          type="button"
          class="logout-btn"
          [attr.title]="collapsed() ? 'Logout' : null"
          aria-label="Logout"
          [disabled]="loggingOut()"
          (click)="logout.emit()"
        >
          <i class="pi pi-sign-out" aria-hidden="true"></i>
          <span class="nav-label">Logout</span>
        </button>
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .sidebar {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--ctp-surface);
        border-right: 1px solid var(--ctp-border);
        padding: 8px 8px 12px;
        box-sizing: border-box;
        overflow: hidden;
      }
      .sidebar.collapsed {
        /* width driven by parent .sidebar-slot */
      }
      .brand {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-start;
        padding: 8px 6px 12px;
        min-height: 48px;
        flex-shrink: 0;
        transition:
          min-height 200ms ease-in-out,
          padding 200ms ease-in-out,
          gap 200ms ease-in-out;
      }
      .collapsed .brand {
        justify-content: center;
        align-items: center;
        gap: 0;
        min-height: 40px;
        padding: 6px 4px 8px;
      }
      .brand-toggle {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 15px;
        flex-shrink: 0;
        padding: 0;
        z-index: 1;
        transition:
          background-color 200ms ease-in-out,
          color 200ms ease-in-out;
      }
      .brand-toggle:hover {
        background: var(--ctp-bg);
        color: var(--ctp-ink);
      }
      .brand-toggle:focus-visible {
        outline: 2px solid var(--ctp-primary);
        outline-offset: 1px;
      }
      .brand-mark {
        width: 28px;
        height: 28px;
        border-radius: var(--ctp-radius);
        background: #000;
        color: var(--ctp-primary);
        display: grid;
        place-items: center;
        font-size: 13px;
        flex-shrink: 0;
        opacity: 1;
        transform: scale(1);
        max-width: 28px;
        overflow: hidden;
        transition:
          opacity 200ms ease-in-out,
          transform 200ms ease-in-out,
          max-width 200ms ease-in-out,
          margin 200ms ease-in-out;
      }
      .brand-logo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: left center;
        display: block;
      }
      .brand-text {
        min-width: 0;
        flex: 1 1 auto;
        opacity: 1;
        transform: translateX(0);
        max-width: 160px;
        overflow: hidden;
        transition:
          opacity 200ms ease-in-out,
          transform 200ms ease-in-out,
          max-width 200ms ease-in-out;
      }
      .collapsed .brand-mark,
      .collapsed .brand-text {
        opacity: 0;
        transform: scale(0.85);
        max-width: 0;
        width: 0;
        margin: 0;
        padding: 0;
        flex: 0 0 0;
        overflow: hidden;
        pointer-events: none;
      }
      .collapsed .brand-text {
        transform: translateX(-6px);
      }
      .brand-title {
        font-weight: 600;
        font-size: 13px;
        line-height: 1.2;
        white-space: nowrap;
      }
      .brand-sub {
        font-size: 11px;
        color: var(--ctp-muted);
        line-height: 1.2;
        white-space: nowrap;
      }
      .nav {
        display: grid;
        gap: 2px;
        flex: 1;
        overflow-x: hidden;
        overflow-y: auto;
        align-content: start;
      }
      .nav a,
      .sidebar-footer a,
      .logout-btn {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 12px;
        border-radius: var(--ctp-radius);
        color: var(--ctp-muted);
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        box-sizing: border-box;
        border: none;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        width: 100%;
        text-align: left;
        transition:
          background-color 160ms ease-in-out,
          color 160ms ease-in-out;
      }
      .collapsed .nav a,
      .collapsed .sidebar-footer a,
      .collapsed .logout-btn {
        justify-content: center;
        padding: 0;
        gap: 0;
      }
      .nav a i,
      .sidebar-footer a i,
      .logout-btn i {
        width: 20px;
        text-align: center;
        font-size: 18px;
        line-height: 1;
        flex-shrink: 0;
      }
      .nav-label {
        white-space: nowrap;
        overflow: hidden;
        opacity: 1;
        transition: opacity 160ms ease-in-out;
      }
      .collapsed .nav-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
        opacity: 0;
      }
      .nav a:hover,
      .sidebar-footer a:hover {
        background: var(--ctp-bg);
        color: var(--ctp-ink);
      }
      .nav a:focus-visible,
      .sidebar-footer a:focus-visible,
      .logout-btn:focus-visible {
        outline: 2px solid var(--ctp-primary);
        outline-offset: 1px;
      }
      .nav a.active,
      .sidebar-footer a.active {
        background: var(--ctp-primary-soft);
        color: var(--ctp-primary);
        font-weight: 600;
      }
      .nav a.active::before,
      .sidebar-footer a.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 0 2px 2px 0;
        background: var(--ctp-primary);
        transition: opacity 160ms ease-in-out;
      }

      /* Collapsed icon tooltips */
      .collapsed .nav a,
      .collapsed .sidebar-footer a,
      .collapsed .logout-btn {
        position: relative;
      }
      .collapsed .nav a::after,
      .collapsed .sidebar-footer a::after,
      .collapsed .logout-btn::after {
        content: attr(aria-label);
        position: absolute;
        left: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
        background: var(--ctp-ink);
        color: #fff;
        font-size: 11px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease-in-out;
        z-index: 50;
      }
      .collapsed .nav a:hover::after,
      .collapsed .nav a:focus-visible::after,
      .collapsed .sidebar-footer a:hover::after,
      .collapsed .sidebar-footer a:focus-visible::after,
      .collapsed .logout-btn:hover::after,
      .collapsed .logout-btn:focus-visible::after {
        opacity: 1;
      }
      .sidebar-footer {
        border-top: 1px solid var(--ctp-border);
        padding-top: 8px;
        display: grid;
        gap: 2px;
        flex-shrink: 0;
      }
      .logout-btn:hover {
        background: var(--ctp-danger-soft);
        color: var(--ctp-danger);
      }
      .logout-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      /* Overlay (tablet / mobile) */
      .sidebar.overlay {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 40;
        height: 100vh;
        width: var(--ctp-sidebar-w-expanded, 240px);
        transform: translateX(-105%);
        transition: transform 220ms ease-in-out;
        box-shadow: none;
      }
      .sidebar.overlay.open {
        transform: translateX(0);
        box-shadow: 8px 0 24px rgba(17, 24, 39, 0.12);
      }
      .sidebar.overlay .brand-mark,
      .sidebar.overlay .brand-text,
      .sidebar.overlay .nav-label {
        opacity: 1;
        transform: none;
        max-width: none;
        width: auto;
        flex: initial;
        overflow: visible;
        pointer-events: auto;
      }
      .sidebar.overlay .brand-mark {
        max-width: 28px;
        flex: 0 0 auto;
      }
      .sidebar.overlay .brand-text {
        max-width: 160px;
        flex: 1 1 auto;
      }
      .sidebar.overlay .nav a,
      .sidebar.overlay .sidebar-footer a,
      .sidebar.overlay .logout-btn {
        justify-content: flex-start;
        padding: 0 12px;
        gap: 10px;
      }
    `,
  ],
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly sidebarState = inject(SidebarStateService);

  readonly loggingOut = input(false);
  readonly logout = output<void>();
  readonly navigated = output<void>();

  readonly collapsed = computed(() => this.sidebarState.isCollapsed());
  readonly overlay = computed(() => this.sidebarState.isOverlayMode());
  readonly overlayOpen = computed(() => this.sidebarState.isOverlayOpen());

  readonly primaryItems = computed(() => {
    const role = this.auth.currentUser()?.role as AppRoleName | undefined;
    return filterNavForRole(PRIMARY_NAV, role);
  });

  readonly footerItems = computed(() => FOOTER_NAV);

  onToggle(): void {
    this.sidebarState.toggle();
  }

  toggleLabel(): string {
    if (this.overlay()) {
      return this.overlayOpen() ? 'Close navigation' : 'Open navigation';
    }
    return this.collapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  }

  toggleExpanded(): boolean {
    if (this.overlay()) return this.overlayOpen();
    return !this.collapsed();
  }

  onNavigate(): void {
    this.navigated.emit();
    this.sidebarState.closeOverlay();
  }
}
