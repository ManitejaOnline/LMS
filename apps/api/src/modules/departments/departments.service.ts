import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPaginatedResult,
  paginationSkip,
} from '../../common/utils/pagination.util';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateDepartmentDto,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensureCodeAvailable(dto.code);

    const department = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim() || null,
      },
    });

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.DEPARTMENT_CREATE,
      entityType: 'Department',
      entityId: department.id,
      metadata: { code: department.code },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return department;
  }

  async findAll(query: ListDepartmentsQueryDto) {
    const where: Prisma.DepartmentWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: paginationSkip(query.page, query.pageSize),
        take: query.pageSize,
      }),
    ]);

    return buildPaginatedResult(items, totalItems, query.page, query.pageSize);
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.findOne(id);
    if (dto.code) {
      await this.ensureCodeAvailable(dto.code, id);
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim().toUpperCase(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description === null
              ? null
              : dto.description.trim(),
      },
    });

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.DEPARTMENT_UPDATE,
      entityType: 'Department',
      entityId: department.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return department;
  }

  async softDelete(
    id: string,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.findOne(id);

    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.DEPARTMENT_SOFT_DELETE,
      entityType: 'Department',
      entityId: id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { id, deleted: true };
  }

  private async ensureCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.department.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Department code is already in use');
    }
  }
}
