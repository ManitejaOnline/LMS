import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and issue JWT tokens' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, extractClientMeta(request));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      extractClientMeta(request),
    );
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.forgotPassword(dto, extractClientMeta(request));
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from forgot-password' })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.resetPassword(dto, extractClientMeta(request));
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token session(s)' })
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
    @Req() request: Request,
  ) {
    return this.authService.logout(
      user,
      dto.refreshToken,
      extractClientMeta(request),
    );
  }

  @ApiBearerAuth('access-token')
  @Post('change-password')
  @ApiOperation({ summary: 'Change password for authenticated user' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(
      user,
      dto,
      extractClientMeta(request),
    );
  }
}
