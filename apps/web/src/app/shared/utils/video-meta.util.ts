export function detectVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      video.src = '';
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read video duration'));
        return;
      }
      resolve(Math.round(duration));
    };
    video.onerror = () => reject(new Error('Could not load video metadata'));
    video.src = url;
  });
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds < 1) return '0 min';
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

export function formatBytes(size: number | null | undefined): string {
  if (!size || size < 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
