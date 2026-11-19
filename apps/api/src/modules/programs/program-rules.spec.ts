import {
  isFinalLevelComplete,
  isLevelUnlocked,
  levelGateCourseIds,
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

  it('falls back to all courses when none are marked required', () => {
    expect(
      levelGateCourseIds([
        { courseId: 'a', isRequired: false },
        { courseId: 'b', isRequired: false },
      ]),
    ).toEqual(['a', 'b']);
    expect(
      levelGateCourseIds([
        { courseId: 'a', isRequired: true },
        { courseId: 'b', isRequired: false },
      ]),
    ).toEqual(['a']);
  });

  it('unlocks the next level after previous courses complete', () => {
    const level1Done = requiredCoursesComplete(['c1'], ['c1']);
    expect(isLevelUnlocked(1, level1Done)).toBe(true);
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
