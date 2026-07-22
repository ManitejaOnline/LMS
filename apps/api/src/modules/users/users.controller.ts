import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ) {
    return this.usersService.updateProfile(
      user.userId,
      dto,
      extractClientMeta(request),
    );
  }

  @Get()
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'List users with search, filters, pagination' })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Get user by id' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usersService.create(dto, actor, extractClientMeta(request));
  }

  @Patch(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usersService.update(id, dto, actor, extractClientMeta(request));
  }

  @Delete(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete user' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usersService.softDelete(
      id,
      actor,
      extractClientMeta(request),
    );
  }
}
