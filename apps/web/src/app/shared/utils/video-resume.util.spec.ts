import { clampVideoStartAt, videoResumeSeconds, videoWatchPercentage } from './video-resume.util';

describe('videoResumeSeconds', () => {
  it('restarts completed videos from the beginning', () => {
    expect(
      videoResumeSeconds({
        resumePositionSec: 120,
        watchPercentage: 100,
        completed: true,
        durationSec: 120,
      }),
    ).toBe(0);
  });

  it('keeps a mid-video resume point', () => {
    expect(
      videoResumeSeconds({
        resumePositionSec: 42,
        watchPercentage: 35,
        completed: false,
        durationSec: 120,
      }),
    ).toBe(42);
  });

  it('restarts when resume is at the last second', () => {
    expect(
      videoResumeSeconds({
        resumePositionSec: 119.8,
        watchPercentage: 99,
        completed: false,
        durationSec: 120,
      }),
    ).toBe(0);
  });
});

describe('clampVideoStartAt', () => {
  it('does not seek past the end', () => {
    expect(clampVideoStartAt(500, 60)).toBe(0);
  });

  it('keeps a valid resume', () => {
    expect(clampVideoStartAt(12, 60)).toBe(12);
  });
});

describe('videoWatchPercentage', () => {
  it('reports 100 when the video has ended', () => {
    expect(videoWatchPercentage({ currentTime: 59.2, duration: 60, ended: true })).toBe(100);
  });

  it('reports 100 within a fraction of the end', () => {
    expect(videoWatchPercentage({ currentTime: 59.8, duration: 60 })).toBe(100);
  });

  it('rounds mid-playback progress', () => {
    expect(videoWatchPercentage({ currentTime: 30, duration: 60 })).toBe(50);
  });
});
