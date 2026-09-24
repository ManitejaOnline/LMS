import { isLessonSequentiallyLocked, type SequenceLesson } from './sequential-lessons.util';

describe('isLessonSequentiallyLocked', () => {
  const lessons: SequenceLesson[] = [
    { id: 'a', hasAssessment: false },
    { id: 'b', hasAssessment: false },
    { id: 'c', hasAssessment: false },
  ];

  it('locks future lessons until the previous one is complete', () => {
    expect(isLessonSequentiallyLocked(lessons, 'a', [])).toBe(false);
    expect(isLessonSequentiallyLocked(lessons, 'b', [])).toBe(true);
    expect(isLessonSequentiallyLocked(lessons, 'b', ['a'])).toBe(false);
    expect(isLessonSequentiallyLocked(lessons, 'c', ['a'])).toBe(true);
    expect(isLessonSequentiallyLocked(lessons, 'c', ['a', 'b'])).toBe(false);
  });

  it('treats unknown lessons as locked', () => {
    expect(isLessonSequentiallyLocked(lessons, 'z', ['a'])).toBe(true);
  });

  it('requires a passed assessment before unlocking the next lesson', () => {
    const withAssessment: SequenceLesson[] = [
      { id: 'a', hasAssessment: true },
      { id: 'b', hasAssessment: false },
    ];
    expect(isLessonSequentiallyLocked(withAssessment, 'b', ['a'], [])).toBe(true);
    expect(isLessonSequentiallyLocked(withAssessment, 'b', ['a'], ['a'])).toBe(false);
  });

  it('keeps all video lessons unlocked in the outline', () => {
    const videos: SequenceLesson[] = [
      { id: 'a', hasAssessment: false, type: 'VIDEO' },
      { id: 'b', hasAssessment: false, type: 'VIDEO' },
      { id: 'c', hasAssessment: false, type: 'VIDEO' },
    ];
    expect(isLessonSequentiallyLocked(videos, 'a', [])).toBe(false);
    expect(isLessonSequentiallyLocked(videos, 'b', [])).toBe(false);
    expect(isLessonSequentiallyLocked(videos, 'c', [])).toBe(false);
  });
});
