export type EvaluatedLearnerCourse = {
  id: string;
  courseId: string;
  title: string;
  code: string;
  description?: string | null;
  isRequired: boolean;
  sortOrder: number;
  assignmentId: string | null;
  status: string;
  progressPercent: number;
  completed: boolean;
};

export type EvaluatedLearnerLevel = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  number: number;
  isFinal: boolean;
  locked: boolean;
  available: boolean;
  completed: boolean;
  requiredCount: number;
  completedRequiredCount: number;
  courseCount?: number;
  completedCourseCount?: number;
  courses: EvaluatedLearnerCourse[];
  finalAssessment: {
    id: string;
    title: string | null;
    passingScore: number;
    maxAttempts: number;
    questionCount: number;
    passed: boolean;
    available: boolean;
    locked: boolean;
  } | null;
};

export type EvaluatedProgramView = {
  enrollmentId: string;
  programId: string;
  programName: string;
  programDescription: string | null;
  status: string;
  levels: EvaluatedLearnerLevel[];
  totalCourses: number;
  completedCourses: number;
  progressPercent: number;
  certificate: unknown;
  programCompleted: boolean;
};

export function levelStatus(
  level: Pick<EvaluatedLearnerLevel, 'locked' | 'completed' | 'available'>,
): 'LOCKED' | 'COMPLETED' | 'CURRENT' | 'AVAILABLE' {
  if (level.locked) return 'LOCKED';
  if (level.completed) return 'COMPLETED';
  if (level.available) return 'CURRENT';
  return 'AVAILABLE';
}

export function toProgramSummary(view: EvaluatedProgramView) {
  return {
    enrollmentId: view.enrollmentId,
    programId: view.programId,
    programName: view.programName,
    programDescription: view.programDescription,
    status: view.status,
    totalCourses: view.totalCourses,
    completedCourses: view.completedCourses,
    progressPercent: view.progressPercent,
    certificate: view.certificate,
    programCompleted: view.programCompleted,
    courseIds: [
      ...new Set(view.levels.flatMap((level) => level.courses.map((course) => course.courseId))),
    ],
    levels: view.levels.map((level) => {
      const courseCount = level.courseCount ?? level.courses.length;
      const completedCourseCount =
        level.completedCourseCount ?? level.courses.filter((course) => course.completed).length;
      return {
        id: level.id,
        title: level.title,
        description: level.description,
        sortOrder: level.sortOrder,
        number: level.number,
        isFinal: level.isFinal,
        locked: level.locked,
        available: level.available,
        completed: level.completed,
        status: levelStatus(level),
        requiredCount: level.requiredCount,
        completedRequiredCount: level.completedRequiredCount,
        courseCount,
        completedCourseCount,
        progress: {
          completedCourses: completedCourseCount,
          totalCourses: courseCount,
          completedRequired: level.completedRequiredCount,
          requiredCount: level.requiredCount,
        },
        finalAssessment: level.finalAssessment,
      };
    }),
  };
}

export function toLearnerLevelDetail(view: EvaluatedProgramView, levelId: string) {
  const index = view.levels.findIndex((level) => level.id === levelId);
  if (index < 0) return null;
  const level = view.levels[index];
  const previous = index > 0 ? view.levels[index - 1] : null;
  const locked = level.locked;
  const courseCount = level.courseCount ?? level.courses.length;
  const completedCourseCount =
    level.completedCourseCount ?? level.courses.filter((course) => course.completed).length;
  return {
    programId: view.programId,
    programName: view.programName,
    unlockHint: locked
      ? previous
        ? `Complete Level ${previous.number} to unlock Level ${level.number}.`
        : 'This level is locked.'
      : null,
    level: {
      id: level.id,
      title: level.title,
      description: level.description,
      sortOrder: level.sortOrder,
      number: level.number,
      isFinal: level.isFinal,
      locked,
      available: level.available,
      completed: level.completed,
      status: levelStatus(level),
      progress: {
        completedCourses: completedCourseCount,
        totalCourses: courseCount,
        completedRequired: level.completedRequiredCount,
        requiredCount: level.requiredCount,
      },
      finalAssessment: level.finalAssessment,
    },
    courses: level.courses.map((course) => ({
      id: course.courseId,
      levelCourseId: course.id,
      title: course.title,
      description: course.description ?? null,
      code: course.code,
      status: course.status,
      progress: course.progressPercent,
      isLocked: locked,
      isRequired: course.isRequired,
      assignmentId: locked ? null : course.assignmentId,
      completed: course.completed,
    })),
  };
}
