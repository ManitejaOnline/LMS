import { mkdir, writeFile } from 'fs/promises';
import { join, extname, isAbsolute } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaKind } from '@prisma/client';
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
  }): Promise<{ storagePath: string; publicUrl: string; absolutePath: string }> {
    const extension = extname(params.originalName) || this.fallbackExt(params.kind);
    const folder = params.kind.toLowerCase();
    const fileName = `${randomUUID()}${extension}`;
    const relativePath = join(folder, fileName);
    const absoluteDir = join(this.resolveRoot(), folder);
    const absolutePath = join(absoluteDir, fileName);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absolutePath, params.buffer);

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/${folder}/${fileName}`.replace(
      /\\/g,
      '/',
    );

    return {
      storagePath: relativePath.replace(/\\/g, '/'),
      publicUrl,
      absolutePath,
    };
  }

  private fallbackExt(kind: MediaKind): string {
    if (kind === MediaKind.THUMBNAIL) return '.jpg';
    if (kind === MediaKind.DOCUMENT) return '.pdf';
    return '.mp4';
  }
}
