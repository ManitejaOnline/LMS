/** Server-enforced PDF page reading requirements (compliance). */
export const PDF_PAGE_REQUIRED_SECONDS = 60;

/** Max active seconds accepted per heartbeat (anti-spoof). */
export const PDF_PAGE_HEARTBEAT_MAX_SECONDS = 8;

/** Minimum ms between heartbeats that credit time. */
export const PDF_PAGE_HEARTBEAT_MIN_INTERVAL_MS = 800;
