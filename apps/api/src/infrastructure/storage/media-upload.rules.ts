import { MediaKind } from '@prisma/client';

/** Stay under Vercel Function 4.5 MB request/response payload limit. */
export const VERCEL_FUNCTION_SAFE_UPLOAD_BYTES = 4_000_000;

const KIND_RULES: Record<
  MediaKind,
  { mimes: string[]; extensions: string[] }
> = {
  THUMBNAIL: {
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
  DOCUMENT: {
    mimes: ['application/pdf'],
    extensions: ['.pdf'],
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
  },
};

export function extensionOf(originalName: string): string {
  const match = /\.[a-z0-9]+$/i.exec(originalName.trim());
  return match ? match[0].toLowerCase() : '';
}

export function mimeFromExtension(ext: string): string | null {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    default:
      return null;
  }
}

export function resolveUploadMime(kind: MediaKind, originalName: string, claimedMime: string): string {
  const ext = extensionOf(originalName);
  const fromExt = mimeFromExtension(ext);
  const claimed = (claimedMime || '').trim().toLowerCase();
  const allowed = KIND_RULES[kind];
  if (!allowed.extensions.includes(ext)) {
    throw new Error(`File extension ${ext || '(none)'} is not allowed for ${kind}`);
  }
  if (claimed && claimed !== 'application/octet-stream' && !allowed.mimes.includes(claimed)) {
    throw new Error(`MIME type ${claimed} does not match file extension ${ext}`);
  }
  if (claimed && claimed !== 'application/octet-stream' && allowed.mimes.includes(claimed)) {
    if (fromExt && claimed !== fromExt && !(claimed === 'image/jpeg' && (ext === '.jpg' || ext === '.jpeg'))) {
      throw new Error(`MIME type ${claimed} does not match file extension ${ext}`);
    }
    return claimed;
  }
  if (fromExt && allowed.mimes.includes(fromExt)) {
    return fromExt;
  }
  throw new Error(`Unsupported type for ${kind}`);
}

export function assertSizeWithinLimit(sizeBytes: number, maxBytes: number): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1) {
    throw new Error('File size is required');
  }
  if (sizeBytes > maxBytes) {
    throw new Error(`File exceeds max size of ${maxBytes} bytes`);
  }
}

export function folderForKind(kind: MediaKind): string {
  return kind.toLowerCase();
}

export function isVercelBlobUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.blob.vercel-storage.com') || host === 'blob.vercel-storage.com';
  } catch {
    return false;
  }
}

export function prefersDirectBlobUpload(params: {
  usesBlob: boolean;
  kind: MediaKind;
  sizeBytes: number;
}): boolean {
  if (!params.usesBlob) return false;
  if (params.kind === MediaKind.VIDEO) return true;
  return params.sizeBytes > VERCEL_FUNCTION_SAFE_UPLOAD_BYTES;
}
