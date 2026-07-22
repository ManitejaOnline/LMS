import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'zebl.sidebar.collapsed';
const MQ_OVERLAY = '(max-width: 1024px)';

@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly collapsedPref = signal(this.readCollapsedPref());
  private readonly overlayOpen = signal(false);
  private readonly overlayMode = signal(
    typeof window !== 'undefined' ? window.matchMedia(MQ_OVERLAY).matches : false,
  );

  readonly isOverlayMode = this.overlayMode.asReadonly();
  readonly isOverlayOpen = this.overlayOpen.asReadonly();

  /** Desktop: collapsed rail. Overlay mode always shows labels when open. */
  readonly isCollapsed = computed(
    () => !this.overlayMode() && this.collapsedPref(),
  );

  readonly sidebarWidthPx = computed(() => {
    if (this.overlayMode()) return 240;
    return this.collapsedPref() ? 72 : 240;
  });

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MQ_OVERLAY);
    const onChange = () => {
      this.overlayMode.set(mq.matches);
      if (!mq.matches) this.overlayOpen.set(false);
      this.applyCssVars();
    };
    mq.addEventListener('change', onChange);
    this.applyCssVars();
  }

  toggle(): void {
    if (this.overlayMode()) {
      this.overlayOpen.update((v) => !v);
      return;
    }
    this.collapsedPref.update((v) => !v);
    this.persistCollapsed();
    this.applyCssVars();
  }

  openOverlay(): void {
    if (this.overlayMode()) this.overlayOpen.set(true);
  }

  closeOverlay(): void {
    this.overlayOpen.set(false);
  }

  expand(): void {
    if (this.overlayMode()) {
      this.overlayOpen.set(true);
      return;
    }
    this.collapsedPref.set(false);
    this.persistCollapsed();
    this.applyCssVars();
  }

  private readCollapsedPref(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistCollapsed(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.collapsedPref() ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private applyCssVars(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const w = this.overlayMode() ? '240px' : this.collapsedPref() ? '72px' : '240px';
    root.style.setProperty('--ctp-sidebar-w', w);
    root.style.setProperty('--ctp-sidebar-w-expanded', '240px');
    root.style.setProperty('--ctp-sidebar-w-collapsed', '72px');
  }
}
