import { formatBytes, formatDuration } from './video-meta.util';

describe('video-meta.util', () => {
  it('formats duration in whole minutes', () => {
    expect(formatDuration(null)).toBe('0 min');
    expect(formatDuration(12)).toBe('1 min');
    expect(formatDuration(720)).toBe('12 min');
  });

  it('formats file sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
