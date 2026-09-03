import { mkdir, writeFile } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaKind } from '@prisma/client';
import { head, put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import {
  folderForKind,
  isVercelBlobUrl,
} from './media-upload.rules';

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  get rootDir(): string {
    return this.configService.getOrThrow<string>('storage.rootDir');
  }

  get publicBaseUrl(): string {
    return this.configService.getOrThrow<string>('storage.publicBaseUrl');
  }

  /** Prefer Vercel Blob when a RW token or connected store id is present. */
  usesBlob(): boolean {
    return Boolean(
      process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
    );
  }

  canIssueClientToken(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  resolveRoot(): string {
    return isAbsolute(this.rootDir)
      ? this.rootDir
      : join(process.cwd(), this.rootDir);
  }

  maxBytesForKind(kind: MediaKind): number {
    if (kind === MediaKind.THUMBNAIL) {
      return this.configService.getOrThrow<number>('storage.maxThumbnailBytes');
    }
    if (kind === MediaKind.DOCUMENT) {
      return this.configService.getOrThrow<number>('storage.maxDocumentBytes');
    }
    return this.configService.getOrThrow<number>('storage.maxVideoBytes');
  }

  allowedMimeTypes(kind: MediaKind): string[] {
    if (kind === MediaKind.THUMBNAIL) {
      return ['image/jpeg', 'image/png', 'image/webp'];
    }
    if (kind === MediaKind.DOCUMENT) {
      return ['application/pdf'];
    }
    return ['video/mp4', 'video/webm', 'video/quicktime'];
  }

  buildRelativePath(kind: MediaKind, originalName: string): string {
    const extension = extname(originalName) || this.fallbackExt(kind);
    return `${folderForKind(kind)}/${randomUUID()}${extension.toLowerCase()}`;
  }

  async saveFile(params: {
    kind: MediaKind;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<{ storagePath: string; publicUrl: string; absolutePath: string }> {
    const relativePath = this.buildRelativePath(params.kind, params.originalName);
    const folder = folderForKind(params.kind);
    const fileName = relativePath.split('/')[1]!;

    if (this.usesBlob()) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const blob = await put(relativePath, params.buffer, {
        access: 'public',
        ...(token ? { token } : {}),
        contentType: params.mimeType,
        addRandomSuffix: false,
      });
      return {
        storagePath: relativePath,
        publicUrl: blob.url,
        absolutePath: blob.url,
      };
    }

    const onVercel =
      process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
    if (onVercel) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Connect a Vercel Blob store to this project (Storage → Blob → Connect Project), or set BLOB_READ_WRITE_TOKEN.',
      );
    }

    const absoluteDir = join(this.resolveRoot(), folder);
    const absolutePath = join(absoluteDir, fileName);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absolutePath, params.buffer);

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/${folder}/${fileName}`.replace(
      /\\/g,
      '/',
    );

    return {
      storagePath: relativePath,
      publicUrl,
      absolutePath,
    };
  }

  async requireOwnedBlob(params: {
    url: string;
    pathname: string;
    expectedMime: string;
    expectedSize: number;
  }) {
    if (!isVercelBlobUrl(params.url)) {
      throw new BadRequestException('Upload URL is not a Vercel Blob object.');
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const meta = await head(params.url, token ? { token } : {});
    if (meta.pathname !== params.pathname && !meta.pathname.endsWith(params.pathname)) {
      throw new BadRequestException('Uploaded object path does not match this session.');
    }
    if (meta.size !== params.expectedSize) {
      throw new BadRequestException('Uploaded object size does not match the declared file size.');
    }
    const blobMime = (meta.contentType || '').split(';')[0]!.trim().toLowerCase();
    if (blobMime && blobMime !== params.expectedMime) {
      throw new BadRequestException('Uploaded object type does not match the declared MIME type.');
    }
    return meta;
  }

  isRemoteUrl(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }

  private fallbackExt(kind: MediaKind): string {
    if (kind === MediaKind.THUMBNAIL) return '.jpg';
    if (kind === MediaKind.DOCUMENT) return '.pdf';
    return '.mp4';
  }
}
