import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AppRole } from '@zebl/shared';
import type { JwtAccessPayload } from '@zebl/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    const roles = (payload.roles ?? []).filter((role): role is AppRole =>
      Object.values(AppRole).includes(role as AppRole),
    );

    return {
      userId: payload.sub,
      email: payload.email,
      roles,
      permissions: payload.permissions ?? [],
    };
  }
}
