import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from '../models/api-response.model';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;
  readonly unreadCount = signal(0);

  list(): Observable<AppNotification[]> {
    return this.http
      .get<ApiSuccessResponse<AppNotification[]>>(this.base)
      .pipe(map((r) => r.data));
  }

  refreshUnread(): void {
    this.http
      .get<ApiSuccessResponse<{ count: number }>>(`${this.base}/unread-count`)
      .subscribe({
        next: (r) => this.unreadCount.set(r.data.count),
      });
  }

  markRead(id: string) {
    return this.http.post(`${this.base}/${id}/read`, {}).pipe(
      tap(() => this.refreshUnread()),
    );
  }

  markAllRead() {
    return this.http.post(`${this.base}/read-all`, {}).pipe(
      tap(() => this.unreadCount.set(0)),
    );
  }
}
