import { Injectable, signal, computed } from '@angular/core';

const ACCESS_TOKEN_KEY = 'zebl.accessToken';
const REFRESH_TOKEN_KEY = 'zebl.refreshToken';

/**
 * Token storage infrastructure only — no login/logout business flows.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accessTokenSignal = signal<string | null>(this.read(ACCESS_TOKEN_KEY));
  private readonly refreshTokenSignal = signal<string | null>(this.read(REFRESH_TOKEN_KEY));

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly refreshToken = this.refreshTokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessTokenSignal());

  setTokens(accessToken: string, refreshToken: string): void {
    this.write(ACCESS_TOKEN_KEY, accessToken);
    this.write(REFRESH_TOKEN_KEY, refreshToken);
    this.accessTokenSignal.set(accessToken);
    this.refreshTokenSignal.set(refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}
