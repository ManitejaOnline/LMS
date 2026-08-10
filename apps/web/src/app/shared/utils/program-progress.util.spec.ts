import {
  currentProgramLevel,
  levelEyebrow,
  levelLabel,
  levelRoute,
  standaloneAssignments,
} from './program-progress.util';
import type { ProgramProgressView } from '../../core/models/program.models';

function view(partial: Partial<ProgramProgressView> = {}): ProgramProgressView {
  return {
    enrollmentId: 'e1',
    programId: 'p1',
    programName: 'Corporate Training',
    programDescription: null,
    status: 'IN_PROGRESS',
    totalCourses: 2,
    completedCourses: 1,
    progressPercent: 50,
    certificate: null,
    programCompleted: false,
    courseIds: ['c1', 'c2'],
    levels: [
      {
        id: 'l1',
        title: 'Foundation',
        description: null,
        sortOrder: 0,
        number: 1,
        isFinal: false,
        locked: false,
        available: false,
        completed: true,
        status: 'COMPLETED',
        requiredCount: 1,
        completedRequiredCount: 1,
        courseCount: 1,
        completedCourseCount: 1,
        progress: { completedCourses: 1, totalCourses: 1, completedRequired: 1, requiredCount: 1 },
        finalAssessment: null,
      },
      {
        id: 'l2',
        title: 'Intermediate',
        description: null,
        sortOrder: 1,
        number: 2,
        isFinal: false,
        locked: false,
        available: true,
        completed: false,
        status: 'CURRENT',
        requiredCount: 1,
        completedRequiredCount: 0,
        courseCount: 2,
        completedCourseCount: 0,
        progress: { completedCourses: 0, totalCourses: 2, completedRequired: 0, requiredCount: 1 },
        finalAssessment: null,
      },
    ],
    ...partial,
  };
}

describe('program progress helpers', () => {
  it('selects the first unlocked incomplete level', () => {
    const current = currentProgramLevel(view());
    expect(current?.title).toBe('Intermediate');
  });

  it('labels regular and final levels', () => {
    expect(levelLabel({ number: 1, isFinal: false, title: 'Foundation' })).toBe(
      'Level 1 — Foundation',
    );
    expect(levelLabel({ number: 4, isFinal: true, title: 'Certification' })).toBe(
      'Final Level — Certification',
    );
    expect(levelEyebrow({ number: 1, isFinal: false })).toBe('LEVEL 1');
  });

  it('builds the level screen route instead of opening a course', () => {
    expect(levelRoute('p1', 'l2')).toEqual(['/app/learning/programs', 'p1', 'levels', 'l2']);
  });

  it('hides program-owned course cards from standalone lists', () => {
    expect(
      standaloneAssignments(
        [
          { id: 'a', courseId: 'c1', programEnrollmentId: 'e1' },
          { id: 'b', courseId: 'c9', programEnrollmentId: null },
          { id: 'c', courseId: 'c2', programEnrollmentId: null },
        ],
        [{ courseIds: ['c1', 'c2'] }],
      ).map((row) => row.id),
    ).toEqual(['b']);
  });
});
