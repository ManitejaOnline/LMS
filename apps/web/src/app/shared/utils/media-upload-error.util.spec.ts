import { HttpErrorResponse } from '@angular/common/http';
import { mediaUploadErrorMessage } from './media-upload-error.util';

describe('mediaUploadErrorMessage', () => {
  it('explains infrastructure failures for video', () => {
    const err = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    expect(mediaUploadErrorMessage('VIDEO', err)).toMatch(/too large or the server/);
  });

  it('prefers API messages when present', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { error: { message: 'Unsupported type for VIDEO' } },
    });
    expect(mediaUploadErrorMessage('VIDEO', err)).toBe('Unsupported type for VIDEO');
  });
});
