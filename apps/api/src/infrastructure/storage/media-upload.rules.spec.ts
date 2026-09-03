import { MediaKind } from '@prisma/client';
import {
  VERCEL_FUNCTION_SAFE_UPLOAD_BYTES,
  prefersDirectBlobUpload,
  resolveUploadMime,
} from './media-upload.rules';

describe('media upload rules', () => {
  it('rejects mismatched video mime vs extension', () => {
    expect(() =>
      resolveUploadMime(MediaKind.VIDEO, 'clip.mp4', 'application/pdf'),
    ).toThrow(/does not match/);
  });

  it('derives mime from extension when browser sends octet-stream', () => {
    expect(resolveUploadMime(MediaKind.VIDEO, 'clip.MP4', 'application/octet-stream')).toBe(
      'video/mp4',
    );
  });

  it('sends videos through Blob even when under the Vercel function cap', () => {
    expect(
      prefersDirectBlobUpload({
        usesBlob: true,
        kind: MediaKind.VIDEO,
        sizeBytes: 800_000,
      }),
    ).toBe(true);
  });

  it('keeps small PDFs on the Nest proxy path', () => {
    expect(
      prefersDirectBlobUpload({
        usesBlob: true,
        kind: MediaKind.DOCUMENT,
        sizeBytes: VERCEL_FUNCTION_SAFE_UPLOAD_BYTES - 1,
      }),
    ).toBe(false);
  });

  it('forces large PDFs off the Vercel function', () => {
    expect(
      prefersDirectBlobUpload({
        usesBlob: true,
        kind: MediaKind.DOCUMENT,
        sizeBytes: VERCEL_FUNCTION_SAFE_UPLOAD_BYTES + 1,
      }),
    ).toBe(true);
  });
});
