import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  assertSizeWithinLimit,
  folderForKind,
  prefersDirectBlobUpload,
  resolveUploadMime,
} from '../../infrastructure/storage/media-upload.rules';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  prepareUploadMeta(kind: MediaKind, originalName: string, mimeType: string, sizeBytes: number) {
    let mime: string;
    try {
      mime = resolveUploadMime(kind, originalName, mimeType);
      assertSizeWithinLimit(sizeBytes, this.storage.maxBytesForKind(kind));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid upload';
      if (message.includes('exceeds max size')) {
        throw new PayloadTooLargeException(message);
      }
      throw new BadRequestException(message);
    }
    return { mime };
  }

  async plan(params: {
    kind: MediaKind;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    const { mime } = this.prepareUploadMeta(
      params.kind,
      params.originalName,
      params.mimeType,
      params.sizeBytes,
    );
    const direct = prefersDirectBlobUpload({
      usesBlob: this.storage.usesBlob(),
      kind: params.kind,
      sizeBytes: params.sizeBytes,
    });
    if (!direct) {
      return { strategy: 'proxy' as const, mimeType: mime };
    }
    if (!this.storage.canIssueClientToken()) {
      throw new ServiceUnavailableException(
        'Direct video upload requires BLOB_READ_WRITE_TOKEN on the API project.',
      );
    }
    const pathname = this.storage.buildRelativePath(params.kind, params.originalName);
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      maximumSizeInBytes: params.sizeBytes,
      allowedContentTypes: [mime],
      addRandomSuffix: false,
      allowOverwrite: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      strategy: 'direct' as const,
      mimeType: mime,
      pathname,
      clientToken,
    };
  }

  async completeDirect(params: {
    kind: MediaKind;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    pathname: string;
    url: string;
    actor: AuthenticatedUser;
    meta?: { ipAddress?: string; userAgent?: string };
  }) {
    const { mime } = this.prepareUploadMeta(
      params.kind,
      params.originalName,
      params.mimeType,
      params.sizeBytes,
    );
    const expectedPrefix = `${folderForKind(params.kind)}/`;
    if (!params.pathname.startsWith(expectedPrefix) || params.pathname.includes('..')) {
      throw new BadRequestException('Invalid storage path for this media kind.');
    }
    await this.storage.requireOwnedBlob({
      url: params.url,
      pathname: params.pathname,
      expectedMime: mime,
      expectedSize: params.sizeBytes,
    });

    const media = await this.prisma.mediaAsset.create({
      data: {
        kind: params.kind,
        originalName: params.originalName,
        mimeType: mime,
        sizeBytes: params.sizeBytes,
        storagePath: params.pathname,
        publicUrl: params.url,
        uploadedById: params.actor.userId,
      },
    });

    await this.audit.write({
      actorId: params.actor.userId,
      action: AuditActions.MEDIA_UPLOAD,
      entityType: 'MediaAsset',
      entityId: media.id,
      metadata: {
        kind: media.kind,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        strategy: 'direct',
      },
      ipAddress: params.meta?.ipAddress,
      userAgent: params.meta?.userAgent,
    });

    return media;
  }

  async upload(params: {
    kind: MediaKind;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
    actor: AuthenticatedUser;
    meta?: { ipAddress?: string; userAgent?: string };
  }) {
    const { mime } = this.prepareUploadMeta(
      params.kind,
      params.originalName,
      params.mimeType,
      params.buffer.byteLength,
    );

    if (
      prefersDirectBlobUpload({
        usesBlob: this.storage.usesBlob(),
        kind: params.kind,
        sizeBytes: params.buffer.byteLength,
      })
    ) {
      throw new BadRequestException(
        'This file must be uploaded directly to storage. Refresh the page and try again.',
      );
    }

    const saved = await this.storage.saveFile({
      kind: params.kind,
      originalName: params.originalName,
      buffer: params.buffer,
      mimeType: mime,
    });

    const media = await this.prisma.mediaAsset.create({
      data: {
        kind: params.kind,
        originalName: params.originalName,
        mimeType: mime,
        sizeBytes: params.buffer.byteLength,
        storagePath: saved.storagePath,
        publicUrl: saved.publicUrl,
        uploadedById: params.actor.userId,
      },
    });

    await this.audit.write({
      actorId: params.actor.userId,
      action: AuditActions.MEDIA_UPLOAD,
      entityType: 'MediaAsset',
      entityId: media.id,
      metadata: { kind: media.kind, mimeType: media.mimeType, sizeBytes: media.sizeBytes },
      ipAddress: params.meta?.ipAddress,
      userAgent: params.meta?.userAgent,
    });

    return media;
  }

  async requireMedia(id: string, expectedKinds?: MediaKind[]) {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!media) {
      throw new BadRequestException('Media asset not found');
    }
    if (expectedKinds && !expectedKinds.includes(media.kind)) {
      throw new BadRequestException(
        `Media kind must be one of: ${expectedKinds.join(', ')}`,
      );
    }
    return media;
  }
}
