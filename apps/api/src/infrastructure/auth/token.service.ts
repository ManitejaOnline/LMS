import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessPayload, JwtRefreshPayload } from '@zebl/shared';
import type { StringValue } from 'ms';

/**
 * JWT token infrastructure helper.
 * Does not implement login/logout business flows — only sign/verify primitives.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: Omit<JwtAccessPayload, 'typ'>): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, typ: 'access' as const },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'jwt.accessExpiresIn',
        ) as StringValue,
      },
    );
  }

  signRefreshToken(payload: Omit<JwtRefreshPayload, 'typ'>): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, typ: 'refresh' as const },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'jwt.refreshExpiresIn',
        ) as StringValue,
      },
    );
  }

  verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    return this.jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    return this.jwtService.verifyAsync<JwtRefreshPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
    });
  }
}
