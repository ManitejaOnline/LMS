import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { AppRole } from '@zebl/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { TokenService } from '../../infrastructure/auth/token.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
    private readonly tokens: TokenService,
  ) {}

  @Post('upload')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Upload thumbnail, PDF document, or video' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: Object.values(MediaKind) },
      },
      required: ['file', 'kind'],
    },
  })
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    let kind: MediaKind | undefined;
    let fileBuffer: Buffer | undefined;
    let originalName = 'upload.bin';
    let mimeType = 'application/octet-stream';

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        originalName = part.filename || originalName;
        mimeType = part.mimetype || mimeType;
      } else if (part.type === 'field' && part.fieldname === 'kind') {
        kind = String(part.value) as MediaKind;
      }
    }

    if (!fileBuffer) {
      throw new BadRequestException('file is required');
    }

    if (!kind || !Object.values(MediaKind).includes(kind)) {
      throw new BadRequestException(
        `kind is required and must be one of: ${Object.values(MediaKind).join(', ')}`,
      );
    }

    return this.mediaService.upload({
      kind,
      originalName,
      mimeType,
      buffer: fileBuffer,
      actor,
      meta: extractClientMeta(request),
    });
  }

  /**
   * Authenticated media stream for the learning player.
   * Accepts Bearer header or access_token query (needed for <video>/<img> tags).
   * Public static /uploads remains available for admin previews but players should use this.
   */
  @Public()
  @Get(':mediaId/stream')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Stream media for authenticated learners (no anonymous download)',
  })
  async stream(
    @Param('mediaId') mediaId: string,
    @Query('access_token') accessToken: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.requireAccessToken(request, accessToken);

    const media = await this.mediaService.requireMedia(mediaId);
    const absolutePath = join(
      process.cwd(),
      this.storage.rootDir,
      media.storagePath,
    );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Media file missing on disk');
    }

    const stat = statSync(absolutePath);
    const range = request.headers.range;
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Type', media.mimeType);
    reply.header(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(media.originalName)}"`,
    );

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        reply.code(416);
        return reply.send();
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        reply.code(416);
        reply.header('Content-Range', `bytes */${stat.size}`);
        return reply.send();
      }
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.header('Content-Length', end - start + 1);
      return reply.send(createReadStream(absolutePath, { start, end }));
    }

    reply.header('Content-Length', stat.size);
    return reply.send(createReadStream(absolutePath));
  }

  private async requireAccessToken(
    request: FastifyRequest,
    queryToken?: string,
  ): Promise<void> {
    const header = request.headers.authorization;
    const bearer =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : null;
    const token = bearer || queryToken;
    if (!token) {
      throw new UnauthorizedException('Authentication required to stream media');
    }
    try {
      const payload = await this.tokens.verifyAccessToken(token);
      if (payload.typ !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
