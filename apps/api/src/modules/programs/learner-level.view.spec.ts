import { toLearnerLevelDetail, toProgramSummary } from './learner-level.view';

const view = {
  enrollmentId: 'e1',
  programId: 'p1',
  programName: 'Corporate Training',
  programDescription: null,
  status: 'IN_PROGRESS',
  totalCourses: 5,
  completedCourses: 3,
  progressPercent: 60,
  certificate: null,
  programCompleted: false,
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
      requiredCount: 3,
      completedRequiredCount: 3,
      courses: [
        {
          id: 'lc1',
          courseId: 'c1',
          title: 'Company Basics',
          code: 'CB',
          description: 'Intro',
          isRequired: true,
          sortOrder: 0,
          assignmentId: 'a1',
          status: 'COMPLETED',
          progressPercent: 100,
          completed: true,
        },
      ],
      finalAssessment: null,
    },
    {
      id: 'l2',
      title: 'Intermediate',
      description: null,
      sortOrder: 1,
      number: 2,
      isFinal: false,
      locked: true,
      available: false,
      completed: false,
      requiredCount: 2,
      completedRequiredCount: 0,
      courses: [
        {
          id: 'lc2',
          courseId: 'c2',
          title: 'Billing Fundamentals',
          code: 'BF',
          description: null,
          isRequired: true,
          sortOrder: 0,
          assignmentId: 'a2',
          status: 'NOT_STARTED',
          progressPercent: 0,
          completed: false,
        },
        {
          id: 'lc3',
          courseId: 'c3',
          title: 'Claims Processing',
          code: 'CP',
          description: null,
          isRequired: true,
          sortOrder: 1,
          assignmentId: 'a3',
          status: 'NOT_STARTED',
          progressPercent: 0,
          completed: false,
        },
      ],
      finalAssessment: null,
    },
  ],
};

describe('learner level view', () => {
  it('omits courses from the program summary', () => {
    const summary = toProgramSummary(view);
    expect(summary.levels[0]).not.toHaveProperty('courses');
    expect(summary.levels[0].courseCount).toBe(1);
    expect(summary.levels[1].status).toBe('LOCKED');
    expect(summary.courseIds).toEqual(['c1', 'c2', 'c3']);
  });

  it('returns only the selected level courses and locks them server-side', () => {
    const detail = toLearnerLevelDetail(view, 'l2');
    expect(detail?.courses).toHaveLength(2);
    expect(detail?.courses.every((course) => course.isLocked)).toBe(true);
    expect(detail?.courses.every((course) => course.assignmentId === null)).toBe(true);
    expect(detail?.unlockHint).toBe('Complete Level 1 to unlock Level 2.');
  });

  it('keeps assignment ids when the level is unlocked', () => {
    const detail = toLearnerLevelDetail(view, 'l1');
    expect(detail?.courses).toHaveLength(1);
    expect(detail?.courses[0].isLocked).toBe(false);
    expect(detail?.courses[0].assignmentId).toBe('a1');
    expect(detail?.level.status).toBe('COMPLETED');
  });
});
