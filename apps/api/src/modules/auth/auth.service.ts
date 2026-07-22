import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { AppRole } from '@zebl/shared';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { PinoLogger } from 'nestjs-pino';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { TokenService } from '../../infrastructure/auth/token.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PasswordService } from '../../infrastructure/security/password.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.auditService.write({
        action: AuditActions.AUTH_LOGIN_FAILURE,
        entityType: 'User',
        entityId: user?.id,
        metadata: { email: dto.email, reason: 'invalid_or_inactive' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      await this.auditService.write({
        actorId: user.id,
        action: AuditActions.AUTH_LOGIN_FAILURE,
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'bad_password' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueSession(user.id, user.email, user.role, meta);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.write({
      actorId: user.id,
      action: AuditActions.AUTH_LOGIN_SUCCESS,
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const profile = await this.usersService.findOne(user.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.configService.getOrThrow<string>('jwt.accessExpiresIn'),
      user: profile,
    };
  }

  async refresh(
    refreshToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    const tokenHash = this.passwordService.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is revoked or expired');
    }

    const user = await this.usersService.findByIdForAuth(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const tokens = await this.issueSession(
      user.id,
      user.email,
      user.role,
      meta,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: tokens.refreshTokenId,
      },
    });

    await this.auditService.write({
      actorId: user.id,
      action: AuditActions.AUTH_REFRESH,
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.configService.getOrThrow<string>('jwt.accessExpiresIn'),
    };
  }

  async logout(
    actor: AuthenticatedUser,
    refreshToken: string | undefined,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (refreshToken) {
      const tokenHash = this.passwordService.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: actor.userId,
          tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.AUTH_LOGOUT,
      entityType: 'User',
      entityId: actor.userId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const genericMessage =
      'If an account exists for that email, a password reset link has been sent.';

    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: genericMessage };
    }

    const rawToken = this.passwordService.generateRawToken();
    const tokenHash = this.passwordService.hashToken(rawToken);
    const minutes = this.configService.getOrThrow<number>(
      'auth.passwordResetExpiresMinutes',
    );
    const expiresAt = new Date(Date.now() + minutes * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.auditService.write({
      actorId: user.id,
      action: AuditActions.AUTH_FORGOT_PASSWORD,
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    // Email provider is out of scope for this phase — log token in non-production.
    if (this.configService.get<string>('app.nodeEnv') !== 'production') {
      this.logger.warn(
        { email: user.email, resetToken: rawToken },
        'Password reset token (development only)',
      );
    }

    return {
      message: genericMessage,
      ...(this.configService.get<string>('app.nodeEnv') !== 'production'
        ? { resetToken: rawToken }
        : {}),
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const tokenHash = this.passwordService.hashToken(dto.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.write({
      actorId: stored.userId,
      action: AuditActions.AUTH_RESET_PASSWORD,
      entityType: 'User',
      entityId: stored.userId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.usersService.findByIdForAuth(actor.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await this.passwordService.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.write({
      actorId: user.id,
      action: AuditActions.AUTH_CHANGE_PASSWORD,
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { message: 'Password changed successfully. Please sign in again.' };
  }

  private async issueSession(
    userId: string,
    email: string,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const refreshTokenId = randomUUID();
    const accessToken = await this.tokenService.signAccessToken({
      sub: userId,
      email,
      roles: [role as AppRole],
      permissions: [],
    });

    const refreshToken = await this.tokenService.signRefreshToken({
      sub: userId,
      jti: refreshTokenId,
    });

    const expiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    ) as StringValue;
    const expiresAt = this.parseExpiryDate(expiresIn);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        tokenHash: this.passwordService.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, refreshTokenId };
  }

  private parseExpiryDate(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/i.exec(expiresIn.trim());
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60_000);
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + amount * (multipliers[unit] ?? 86_400_000));
  }
}
