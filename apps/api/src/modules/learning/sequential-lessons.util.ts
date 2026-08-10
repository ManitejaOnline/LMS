export type SequenceLesson = {
  id: string;
  hasAssessment: boolean;
};

function asSet(ids: Iterable<string>): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

export function toSequenceLessons(
  lessons: Array<{ id: string; hasAssessment?: boolean }>,
): SequenceLesson[] {
  return lessons.map((lesson) => ({
    id: lesson.id,
    hasAssessment: !!lesson.hasAssessment,
  }));
}

/**
 * Previous lesson is cleared when it is completed AND, if it has a
 * published assessment, that assessment has been passed.
 */
export function isPreviousGateCleared(
  lessons: SequenceLesson[],
  index: number,
  completedLessonIds: Iterable<string>,
  passedAssessmentLessonIds: Iterable<string> = [],
): boolean {
  if (index <= 0) return true;
  const previous = lessons[index - 1];
  if (!previous) return false;
  const completed = asSet(completedLessonIds);
  if (!completed.has(previous.id)) return false;
  if (previous.hasAssessment && !asSet(passedAssessmentLessonIds).has(previous.id)) {
    return false;
  }
  return true;
}

export function isLessonSequentiallyLocked(
  lessons: SequenceLesson[],
  lessonId: string,
  completedLessonIds: Iterable<string>,
  passedAssessmentLessonIds: Iterable<string> = [],
): boolean {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return true;
  return !isPreviousGateCleared(
    lessons,
    index,
    completedLessonIds,
    passedAssessmentLessonIds,
  );
}

export function firstUnlockedIncompleteLessonId(
  lessons: SequenceLesson[],
  completedLessonIds: Iterable<string>,
  passedAssessmentLessonIds: Iterable<string> = [],
): string | null {
  const completed = asSet(completedLessonIds);
  const passed = asSet(passedAssessmentLessonIds);
  for (const lesson of lessons) {
    if (isLessonSequentiallyLocked(lessons, lesson.id, completed, passed)) {
      continue;
    }
    if (!completed.has(lesson.id)) return lesson.id;
    if (lesson.hasAssessment && !passed.has(lesson.id)) return lesson.id;
  }
  return lessons[lessons.length - 1]?.id ?? null;
}
