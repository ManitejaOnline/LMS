export type McqOptionInput = {
  label: string;
  isCorrect: boolean;
};

export function scorePercent(earned: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((earned / total) * 100);
}

export function isAssessmentPassing(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

export function remainingAttempts(maxAttempts: number, usedAttempts: number): number {
  return Math.max(0, maxAttempts - usedAttempts);
}

export function validateMcqQuestion(input: {
  prompt: string;
  options: McqOptionInput[];
}): string | null {
  if (!input.prompt?.trim()) {
    return 'Each question must have text.';
  }
  const options = input.options.filter((option) => option.label.trim());
  if (options.length < 2) {
    return 'Each question needs at least 2 options.';
  }
  if (options.length > 6) {
    return 'Each question can have at most 6 options.';
  }
  const correct = options.filter((option) => option.isCorrect).length;
  if (correct !== 1) {
    return 'Each question must have exactly one correct answer.';
  }
  return null;
}

export function validateAssessmentPublish(input: {
  title?: string | null;
  passingScore: number;
  maxAttempts: number;
  questions: Array<{ prompt: string; options: McqOptionInput[] }>;
}): string | null {
  if (!input.title?.trim()) {
    return 'Assessment title is required.';
  }
  if (!Number.isFinite(input.passingScore) || input.passingScore < 1 || input.passingScore > 100) {
    return 'Passing score must be between 1 and 100.';
  }
  if (!Number.isFinite(input.maxAttempts) || input.maxAttempts < 1) {
    return 'Maximum attempts must be at least 1.';
  }
  if (!input.questions.length) {
    return 'Add at least one question before publishing.';
  }
  for (const question of input.questions) {
    const error = validateMcqQuestion(question);
    if (error) return error;
  }
  return null;
}
