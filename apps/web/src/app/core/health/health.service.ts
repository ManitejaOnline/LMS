import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthLiveStatus {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly status = signal<'unknown' | 'ok' | 'down'>('unknown');
  readonly lastCheckedAt = signal<string | null>(null);

  checkLive() {
    return this.http.get<{ success: true; data: HealthLiveStatus } | HealthLiveStatus>(
      `${this.baseUrl}/health/live`,
    ).pipe(
      map((response) => {
        if ('success' in response && response.success) {
          return response.data;
        }
        return response as HealthLiveStatus;
      }),
      tap((data) => {
        this.status.set(data.status === 'ok' ? 'ok' : 'down');
        this.lastCheckedAt.set(new Date().toISOString());
      }),
      catchError(() => {
        this.status.set('down');
        this.lastCheckedAt.set(new Date().toISOString());
        return of({ status: 'down' });
      }),
    );
  }
}
