export type LevelGate = {
  id: string;
  isFinal: boolean;
  requiredCourseIds: string[];
};

export function isLevelUnlocked(index: number, previousCompleted: boolean): boolean {
  return index === 0 || previousCompleted;
}

export function requiredCoursesComplete(
  requiredCourseIds: string[],
  completedCourseIds: Iterable<string>,
): boolean {
  if (requiredCourseIds.length === 0) return false;
  const completed = completedCourseIds instanceof Set
    ? completedCourseIds
    : new Set(completedCourseIds);
  return requiredCourseIds.every((id) => completed.has(id));
}

export function isFinalLevelComplete(input: {
  requiredCourseIds: string[];
  completedCourseIds: Iterable<string>;
  hasFinalAssessment: boolean;
  finalAssessmentPassed: boolean;
}): boolean {
  if (!requiredCoursesComplete(input.requiredCourseIds, input.completedCourseIds)) {
    return false;
  }
  if (input.hasFinalAssessment && !input.finalAssessmentPassed) return false;
  return true;
}

export function validateProgramPublish(input: {
  name?: string | null;
  levels: Array<{
    title: string;
    isFinal: boolean;
    requiredCourseCount: number;
    finalAssessmentValid: boolean;
  }>;
}): string | null {
  if (!input.name?.trim() || input.name.trim().length < 3) {
    return 'Program name is required (min 3 characters).';
  }
  if (input.levels.length === 0) {
    return 'Add at least one level before publishing.';
  }
  const finals = input.levels.filter((level) => level.isFinal);
  if (finals.length > 1) {
    return 'A program can have at most one final level.';
  }
  for (const [index, level] of input.levels.entries()) {
    if (!level.title.trim()) {
      return `Level ${index + 1} needs a title.`;
    }
    if (level.requiredCourseCount < 1) {
      return `Level ${index + 1} needs at least one required course.`;
    }
    if (level.isFinal && !level.finalAssessmentValid) {
      return 'Publish a valid final assessment before publishing the program.';
    }
  }
  return null;
}
