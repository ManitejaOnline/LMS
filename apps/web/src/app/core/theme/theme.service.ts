import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'veb.theme';
const LEGACY_STORAGE_KEY = 'zebl.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(this.readInitial());
  /** Auth screens always render light regardless of preference. */
  private readonly forceLight = signal(false);

  constructor() {
    effect(() => {
      const dark = this.forceLight() ? false : this.darkMode();
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem(STORAGE_KEY, this.darkMode() ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.darkMode.update((v) => !v);
  }

  setForceLight(enabled: boolean): void {
    this.forceLight.set(enabled);
  }

  private readInitial(): boolean {
    const stored =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
