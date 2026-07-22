import { mkdir, writeFile } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaKind } from '@prisma/client';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  get rootDir(): string {
    return this.configService.getOrThrow<string>('storage.rootDir');
  }

  get publicBaseUrl(): string {
    return this.configService.getOrThrow<string>('storage.publicBaseUrl');
  }

  /** Prefer Vercel Blob whenever a RW token is present (required on Vercel). */
  usesBlob(): boolean {
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

  async saveFile(params: {
    kind: MediaKind;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<{ storagePath: string; publicUrl: string; absolutePath: string }> {
    const extension = extname(params.originalName) || this.fallbackExt(params.kind);
    const folder = params.kind.toLowerCase();
    const fileName = `${randomUUID()}${extension}`;
    const relativePath = `${folder}/${fileName}`;

    if (this.usesBlob()) {
      const blob = await put(relativePath, params.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
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
        'File storage is not configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) for production uploads.',
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

  isRemoteUrl(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }

  private fallbackExt(kind: MediaKind): string {
    if (kind === MediaKind.THUMBNAIL) return '.jpg';
    if (kind === MediaKind.DOCUMENT) return '.pdf';
    return '.mp4';
  }
}
