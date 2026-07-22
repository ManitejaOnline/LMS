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
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: ListDepartmentsQueryDto) {
    return this.departmentsService.findAll(query);
  }

  @Get(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Get department by id' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Create department' })
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ) {
    return this.departmentsService.create(
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Update department' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ) {
    return this.departmentsService.update(
      id,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete(':id')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete department' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ) {
    return this.departmentsService.softDelete(
      id,
      actor,
      extractClientMeta(request),
    );
  }
}
