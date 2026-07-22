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
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { AppRole } from '@zebl/shared';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 500_000_000 },
    }),
  )
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
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('kind') kindRaw: string,
    @Req() request: Request,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }

    const kind = kindRaw as MediaKind;
    if (!kind || !Object.values(MediaKind).includes(kind)) {
      throw new BadRequestException(
        `kind is required and must be one of: ${Object.values(MediaKind).join(', ')}`,
      );
    }

    return this.mediaService.upload({
      kind,
      originalName: file.originalname || 'upload.bin',
      mimeType: file.mimetype || 'application/octet-stream',
      buffer: file.buffer,
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
    @Req() request: Request,
    @Res() reply: Response,
  ) {
    await this.requireAccessToken(request, accessToken);

    const media = await this.mediaService.requireMedia(mediaId);
    const absolutePath = join(this.storage.resolveRoot(), media.storagePath);

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Media file missing on disk');
    }

    const stat = statSync(absolutePath);
    const range = request.headers.range;
    reply.setHeader('Accept-Ranges', 'bytes');
    reply.setHeader('Content-Type', media.mimeType);
    reply.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(media.originalName)}"`,
    );

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        reply.status(416).end();
        return;
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        reply.status(416);
        reply.setHeader('Content-Range', `bytes */${stat.size}`);
        reply.end();
        return;
      }
      reply.status(206);
      reply.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.setHeader('Content-Length', end - start + 1);
      createReadStream(absolutePath, { start, end }).pipe(reply);
      return;
    }

    reply.setHeader('Content-Length', stat.size);
    createReadStream(absolutePath).pipe(reply);
  }

  private async requireAccessToken(
    request: Request,
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
