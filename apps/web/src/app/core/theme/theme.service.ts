import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'veb.theme';
const LEGACY_STORAGE_KEY = 'zebl.theme';

/** App is light-only — dark mode is disabled everywhere. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(false);

  constructor() {
    effect(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(STORAGE_KEY, 'light');
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      void this.darkMode();
    });
  }

  toggle(): void {
    /* dark mode removed */
  }

  setForceLight(_enabled: boolean): void {
    document.documentElement.classList.remove('dark');
    this.darkMode.set(false);
  }
}
