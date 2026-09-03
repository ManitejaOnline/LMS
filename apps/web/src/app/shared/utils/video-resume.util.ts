/** Seconds left at the end that should restart from the beginning on reopen. */
const NEAR_END_SECONDS = 1.5;
const NEAR_END_PERCENT = 98;
const END_EPSILON_SECONDS = 0.35;

/**
 * Resume position for a video lesson open.
 * Finished (or nearly finished) videos start at 0 so native play works again.
 */
export function videoResumeSeconds(params: {
  resumePositionSec?: number | null;
  watchPercentage?: number | null;
  completed?: boolean;
  durationSec?: number | null;
}): number {
  if (params.completed || (params.watchPercentage ?? 0) >= NEAR_END_PERCENT) {
    return 0;
  }
  const resume = Number(params.resumePositionSec ?? 0);
  if (!Number.isFinite(resume) || resume < 1) {
    return 0;
  }
  const duration = Number(params.durationSec ?? 0);
  if (duration > 0 && resume >= duration - NEAR_END_SECONDS) {
    return 0;
  }
  return resume;
}

export function clampVideoStartAt(startAt: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(startAt) || startAt < 1) return 0;
  if (startAt >= duration - NEAR_END_SECONDS) return 0;
  return Math.min(startAt, Math.max(0, duration - 0.25));
}

/** Watch % for learning progress. Ending the file always reports 100. */
export function videoWatchPercentage(params: {
  currentTime: number;
  duration: number;
  ended?: boolean;
}): number {
  if (params.ended) return 100;
  if (!Number.isFinite(params.duration) || params.duration <= 0) return 0;
  if (!Number.isFinite(params.currentTime) || params.currentTime <= 0) return 0;
  if (params.duration - params.currentTime <= END_EPSILON_SECONDS) return 100;
  return Math.min(100, Math.round((params.currentTime / params.duration) * 100));
}
