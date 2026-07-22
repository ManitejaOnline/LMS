import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'zebl.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(this.readInitial());

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.darkMode.update((v) => !v);
  }

  private readInitial(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
