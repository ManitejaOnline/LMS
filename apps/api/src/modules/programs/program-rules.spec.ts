import {
  isFinalLevelComplete,
  isLevelUnlocked,
  requiredCoursesComplete,
  validateProgramPublish,
} from './program-rules';

describe('program level unlock', () => {
  it('unlocks only the first level initially', () => {
    expect(isLevelUnlocked(0, false)).toBe(true);
    expect(isLevelUnlocked(1, false)).toBe(false);
    expect(isLevelUnlocked(1, true)).toBe(true);
  });

  it('requires every required course', () => {
    expect(requiredCoursesComplete(['a', 'b'], ['a'])).toBe(false);
    expect(requiredCoursesComplete(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(requiredCoursesComplete([], ['a'])).toBe(false);
  });

  it('requires final assessment pass when configured', () => {
    expect(
      isFinalLevelComplete({
        requiredCourseIds: ['a'],
        completedCourseIds: ['a'],
        hasFinalAssessment: true,
        finalAssessmentPassed: false,
      }),
    ).toBe(false);
    expect(
      isFinalLevelComplete({
        requiredCourseIds: ['a'],
        completedCourseIds: ['a'],
        hasFinalAssessment: true,
        finalAssessmentPassed: true,
      }),
    ).toBe(true);
  });
});

describe('program publish validation', () => {
  it('blocks empty programs and missing required courses', () => {
    expect(validateProgramPublish({ name: 'AB', levels: [] })).toMatch(/name/i);
    expect(
      validateProgramPublish({
        name: 'Onboarding',
        levels: [{ title: 'Foundation', isFinal: false, requiredCourseCount: 0, finalAssessmentValid: true }],
      }),
    ).toMatch(/required course/i);
  });

  it('allows a valid two-level program', () => {
    expect(
      validateProgramPublish({
        name: 'Corporate Training',
        levels: [
          { title: 'Foundation', isFinal: false, requiredCourseCount: 2, finalAssessmentValid: true },
          { title: 'Certification', isFinal: true, requiredCourseCount: 1, finalAssessmentValid: true },
        ],
      }),
    ).toBeNull();
  });
});
