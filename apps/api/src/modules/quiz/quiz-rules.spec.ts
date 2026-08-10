import { AppRole } from '@zebl/shared';
import {
  isAssessmentPassing,
  remainingAttempts,
  scorePercent,
  validateAssessmentPublish,
  validateMcqQuestion,
} from './assessment-rules';

export function canAccessReports(role: AppRole): boolean {
  return (
    role === AppRole.SUPER_ADMIN ||
    role === AppRole.ADMIN ||
    role === AppRole.MANAGER
  );
}

describe('assessment pass rule', () => {
  it('passes at exact threshold', () => {
    expect(isAssessmentPassing(80, 80)).toBe(true);
  });

  it('fails below threshold', () => {
    expect(isAssessmentPassing(79, 80)).toBe(false);
  });

  it('scores by percent rounded', () => {
    expect(scorePercent(8, 10)).toBe(80);
    expect(scorePercent(0, 0)).toBe(0);
  });

  it('tracks remaining attempts', () => {
    expect(remainingAttempts(3, 3)).toBe(0);
    expect(remainingAttempts(3, 1)).toBe(2);
  });
});

describe('assessment question validation', () => {
  it('requires exactly one correct option', () => {
    expect(
      validateMcqQuestion({
        prompt: 'Why verify eligibility?',
        options: [
          { label: 'Submit claim', isCorrect: false },
          { label: 'Verify coverage', isCorrect: true },
        ],
      }),
    ).toBeNull();
    expect(
      validateMcqQuestion({
        prompt: 'Why verify eligibility?',
        options: [
          { label: 'A', isCorrect: true },
          { label: 'B', isCorrect: true },
        ],
      }),
    ).toMatch(/exactly one correct/i);
  });

  it('rejects fewer than two options', () => {
    expect(
      validateMcqQuestion({
        prompt: 'Question',
        options: [{ label: 'Only', isCorrect: true }],
      }),
    ).toMatch(/at least 2/i);
  });

  it('blocks publish without title or questions', () => {
    expect(
      validateAssessmentPublish({
        title: '',
        passingScore: 80,
        maxAttempts: 3,
        questions: [],
      }),
    ).toMatch(/title/i);
    expect(
      validateAssessmentPublish({
        title: 'Eligibility',
        passingScore: 80,
        maxAttempts: 3,
        questions: [],
      }),
    ).toMatch(/question/i);
  });
});

describe('reports RBAC helper', () => {
  it('allows managers', () => {
    expect(canAccessReports(AppRole.MANAGER)).toBe(true);
  });

  it('denies employees', () => {
    expect(canAccessReports(AppRole.EMPLOYEE)).toBe(false);
  });
});
