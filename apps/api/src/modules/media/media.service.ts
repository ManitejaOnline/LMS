import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(params: {
    kind: MediaKind;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
    actor: AuthenticatedUser;
    meta?: { ipAddress?: string; userAgent?: string };
  }) {
    const allowed = this.storage.allowedMimeTypes(params.kind);
    if (!allowed.includes(params.mimeType)) {
      throw new BadRequestException(
        `Unsupported mime type for ${params.kind}. Allowed: ${allowed.join(', ')}`,
      );
    }

    const maxBytes = this.storage.maxBytesForKind(params.kind);
    if (params.buffer.byteLength > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds max size of ${maxBytes} bytes for ${params.kind}`,
      );
    }

    const saved = await this.storage.saveFile({
      kind: params.kind,
      originalName: params.originalName,
      buffer: params.buffer,
      mimeType: params.mimeType,
    });

    const media = await this.prisma.mediaAsset.create({
      data: {
        kind: params.kind,
        originalName: params.originalName,
        mimeType: params.mimeType,
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
