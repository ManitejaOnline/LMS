export type SequenceLesson = {
  id: string;
  hasAssessment: boolean;
};

function asSet(ids: Iterable<string>): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

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
