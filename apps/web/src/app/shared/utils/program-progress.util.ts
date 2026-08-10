import type { LearnerLevelSummary, ProgramProgressView } from '../../core/models/program.models';

export function currentProgramLevel(view: ProgramProgressView): LearnerLevelSummary | null {
  return view.levels.find((level) => !level.locked && !level.completed) ?? view.levels.at(-1) ?? null;
}

export function levelLabel(level: Pick<LearnerLevelSummary, 'number' | 'isFinal' | 'title'>): string {
  if (level.isFinal) return `Final Level — ${level.title}`;
  return `Level ${level.number} — ${level.title}`;
}

export function levelEyebrow(level: Pick<LearnerLevelSummary, 'number' | 'isFinal'>): string {
  return level.isFinal ? 'FINAL LEVEL' : `LEVEL ${level.number}`;
}

export function levelRoute(programId: string, levelId: string): string[] {
  return ['/app/learning/programs', programId, 'levels', levelId];
}

export function programRoute(programId: string): string[] {
  return ['/app/learning/programs', programId];
}

export function standaloneAssignments<
  T extends { courseId?: string; programEnrollmentId?: string | null },
>(items: T[], programs: Array<{ courseIds?: string[] }> = []): T[] {
  const inProgram = new Set(programs.flatMap((program) => program.courseIds ?? []));
  return items.filter(
    (item) => !item.programEnrollmentId && !(item.courseId && inProgram.has(item.courseId)),
  );
}
