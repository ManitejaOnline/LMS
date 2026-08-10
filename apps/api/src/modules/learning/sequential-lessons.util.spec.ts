import {
  firstUnlockedIncompleteLessonId,
  isLessonSequentiallyLocked,
  type SequenceLesson,
} from './sequential-lessons.util';

describe('sequential lesson unlock', () => {
  const lessons: SequenceLesson[] = [
    { id: 'l1', hasAssessment: false },
    { id: 'l2', hasAssessment: false },
    { id: 'l3', hasAssessment: false },
  ];

  it('unlocks only the first lesson when none are complete', () => {
    expect(isLessonSequentiallyLocked(lessons, 'l1', [])).toBe(false);
    expect(isLessonSequentiallyLocked(lessons, 'l2', [])).toBe(true);
    expect(isLessonSequentiallyLocked(lessons, 'l3', [])).toBe(true);
  });

  it('unlocks the next lesson after the previous is completed', () => {
    expect(isLessonSequentiallyLocked(lessons, 'l2', ['l1'])).toBe(false);
    expect(isLessonSequentiallyLocked(lessons, 'l3', ['l1'])).toBe(true);
    expect(isLessonSequentiallyLocked(lessons, 'l3', ['l1', 'l2'])).toBe(false);
  });

  it('treats unknown lesson ids as locked', () => {
    expect(isLessonSequentiallyLocked(lessons, 'missing', ['l1'])).toBe(true);
  });

  it('resumes at the first unlocked incomplete lesson', () => {
    expect(firstUnlockedIncompleteLessonId(lessons, [])).toBe('l1');
    expect(firstUnlockedIncompleteLessonId(lessons, ['l1'])).toBe('l2');
    expect(firstUnlockedIncompleteLessonId(lessons, ['l1', 'l2', 'l3'])).toBe('l3');
  });
});

describe('sequential unlock with assessments', () => {
  const lessons: SequenceLesson[] = [
    { id: 'l1', hasAssessment: true },
    { id: 'l2', hasAssessment: false },
    { id: 'l3', hasAssessment: true },
  ];

  it('keeps the next lesson locked until the assessment is passed', () => {
    expect(isLessonSequentiallyLocked(lessons, 'l2', ['l1'], [])).toBe(true);
    expect(isLessonSequentiallyLocked(lessons, 'l2', ['l1'], ['l1'])).toBe(false);
  });

  it('unlocks a lesson without an assessment after completion alone', () => {
    expect(isLessonSequentiallyLocked(lessons, 'l3', ['l1', 'l2'], ['l1'])).toBe(
      false,
    );
  });

  it('stays on a completed lesson until its assessment is passed', () => {
    expect(firstUnlockedIncompleteLessonId(lessons, ['l1'], [])).toBe('l1');
    expect(firstUnlockedIncompleteLessonId(lessons, ['l1'], ['l1'])).toBe('l2');
  });
});
