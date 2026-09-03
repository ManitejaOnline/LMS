import { HttpErrorResponse } from '@angular/common/http';

export function mediaUploadErrorMessage(kind: string, err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const apiMessage = err.error?.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    if (err.status === 0 || err.status === 503 || err.status === 413) {
      return kind === 'VIDEO'
        ? 'Video upload failed. The file may be too large or the server is temporarily unavailable.'
        : 'Upload failed. The file may be too large or the server is temporarily unavailable.';
    }
    if (err.status === 401) {
      return 'Your session expired. Sign in again and retry the upload.';
    }
  }
  const message = err instanceof Error ? err.message : '';
  if (message && !/Http failure|Unknown Error/i.test(message)) {
    return message;
  }
  return kind === 'VIDEO'
    ? 'Video upload failed. The file may be too large or the server is temporarily unavailable.'
    : 'Upload failed. Try again.';
}
