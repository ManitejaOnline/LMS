import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { LearnerLevelSummary, ProgramProgressView } from '../../core/models/program.models';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import {
  currentProgramLevel,
  levelEyebrow,
  levelLabel,
  levelRoute,
} from '../../shared/utils/program-progress.util';

@Component({
  selector: 'app-program-overview-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
    RouterLink,
    Button,
    Message,
  ],
  template: `
    <a routerLink="/app/my-learning" class="back">← Back to My Learning</a>
    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }
    @if (loading()) {
      <app-loading-state message="Loading program…" />
    } @else if (program(); as prog) {
      <app-page-header [title]="prog.programName" />
      <section class="ctp-card panel">
        <div class="head">
          <div>
            <p class="progress-label">Overall Progress</p>
            <p class="progress-copy">{{ prog.completedCourses }} / {{ prog.totalCourses }} Courses Completed</p>
            @if (currentLevel(prog); as current) {
              <p class="muted">Current: {{ levelLabel(current) }}</p>
            }
          </div>
          <app-status-badge [status]="prog.status" />
        </div>
        <div class="bar"><span [style.width.%]="prog.progressPercent"></span></div>
        @if (prog.programCompleted && prog.certificate) {
          <a [routerLink]="['/app/programs', prog.programId, 'certificate']" class="no-underline">
            <p-button label="View Certificate" size="small" />
          </a>
        }
      </section>
      <div class="levels">
        @for (level of prog.levels; track level.id) {
          <a [routerLink]="levelRoute(prog.programId, level.id)" class="level-card" [class.locked]="level.locked">
            <div>
              <p class="eyebrow">{{ levelEyebrow(level) }}</p>
              <h3>{{ level.title }}</h3>
              <p class="muted">{{ levelMeta(level) }}</p>
              <p class="muted">{{ levelCounts(level) }}</p>
              <p class="state" [class.ok]="level.completed" [class.current]="level.status === 'CURRENT'" [class.lock]="level.locked">
                {{ levelState(level) }}
              </p>
            </div>
            <span class="open">View Level →</span>
          </a>
        }
      </div>
    }
  `,
  styles: [
    `
      .back { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--s3); color: var(--ctp-primary); text-decoration: none; }
      .panel { padding: 18px; margin-bottom: var(--ctp-section-gap); display: grid; gap: 12px; }
      .head { display: flex; justify-content: space-between; gap: 12px; }
      .levels { display: grid; gap: 12px; }
      .level-card {
        display: flex; justify-content: space-between; align-items: center; gap: 12px;
        border: 1px solid var(--ctp-border); border-radius: var(--ctp-radius); padding: 16px;
        min-height: 88px; text-decoration: none; color: inherit;
      }
      .level-card.locked { opacity: 0.9; background: #fafafa; }
      .eyebrow { margin: 0; font-size: 14px; letter-spacing: 0.06em; color: var(--ctp-muted); font-weight: 600; }
      h3 { margin: 2px 0 0; font-size: 16px; }
      .progress-label { margin: 0; font-size: 13px; color: var(--ctp-muted); }
      .progress-copy { margin: 2px 0 0; font-size: 13px; font-weight: 600; }
      .muted { color: var(--ctp-muted); font-size: 13px; margin: 2px 0 0; }
      .state { font-size: 13px; font-weight: 600; margin: 6px 0 0; }
      .ok { color: #157347; }
      .current { color: var(--ctp-primary); }
      .lock { color: var(--ctp-muted); }
      .bar { height: 4px; border-radius: 999px; background: var(--ctp-border); overflow: hidden; }
      .bar span { display: block; height: 100%; background: var(--ctp-primary); }
      .open {
        display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 112px;
        border: 1px solid var(--ctp-border); border-radius: var(--ctp-radius); font-weight: 600; font-size: 13px;
        padding: 0 12px; white-space: nowrap;
      }
      @media (max-width: 720px) {
        .head, .level-card { flex-direction: column; align-items: stretch; }
        .open { width: 100%; }
        .levels { display: flex; flex-direction: column; }
      }
    `,
  ],
})
export class ProgramOverviewPageComponent implements OnInit {
  private readonly api = inject(ProgramsApiService);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly program = signal<ProgramProgressView | null>(null);

  currentLevel = currentProgramLevel;
  levelLabel = levelLabel;
  levelEyebrow = levelEyebrow;
  levelRoute = levelRoute;

  ngOnInit(): void {
    const programId = this.route.snapshot.paramMap.get('programId') ?? '';
    this.api.myProgram(programId).subscribe({
      next: (program) => {
        this.program.set(program);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Program not found');
      },
    });
  }

  levelMeta(level: LearnerLevelSummary): string {
    if (level.isFinal && level.finalAssessment) return 'Final Assessment';
    return `${level.courseCount} ${level.courseCount === 1 ? 'Course' : 'Courses'}`;
  }

  levelCounts(level: LearnerLevelSummary): string {
    if (level.isFinal && !level.courseCount) return '';
    return `${level.completedCourseCount} / ${level.courseCount} Completed`;
  }

  levelState(level: LearnerLevelSummary): string {
    if (level.locked) return '🔒 Locked';
    if (level.completed) return '✓ Completed';
    return '● Current';
  }
}
