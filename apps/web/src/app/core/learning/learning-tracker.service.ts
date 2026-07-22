import { Injectable, inject } from '@angular/core';
import { LearningApiService } from '../http/learning-api.service';
import type { LearningEventInput, LearningEventType } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class LearningTrackerService {
  private readonly api = inject(LearningApiService);
  private queue: LearningEventInput[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private assignmentId: string | null = null;

  bind(assignmentId: string): void {
    this.flush();
    this.assignmentId = assignmentId;
    this.queue = [];
  }

  track(
    eventType: LearningEventType,
    lessonId?: string,
    payload?: Record<string, unknown>,
  ): void {
    if (!this.assignmentId) return;
    this.queue.push({
      eventType,
      lessonId,
      payload,
      occurredAt: new Date().toISOString(),
      clientEventId: crypto.randomUUID(),
    });
    this.scheduleFlush();
  }

  flush(): void {
    if (!this.assignmentId || this.queue.length === 0) {
      return;
    }
    const events = [...this.queue];
    this.queue = [];
    this.api.ingestEvents(this.assignmentId, events).subscribe({
      error: () => {
        // re-queue on failure
        this.queue.unshift(...events);
      },
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 800);
  }
}
