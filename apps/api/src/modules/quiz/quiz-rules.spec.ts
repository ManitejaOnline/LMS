import { AppRole } from '@zebl/shared';

/** Pure scoring helper extracted for unit tests (mirrors quiz pass rule). */
export function isQuizPassing(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

export function canAccessReports(role: AppRole): boolean {
  return (
    role === AppRole.SUPER_ADMIN ||
    role === AppRole.ADMIN ||
    role === AppRole.MANAGER
  );
}

describe('quiz pass rule', () => {
  it('passes at exact threshold', () => {
    expect(isQuizPassing(70, 70)).toBe(true);
  });

  it('fails below threshold', () => {
    expect(isQuizPassing(69, 70)).toBe(false);
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
