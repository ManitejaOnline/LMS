import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppRole as DbRole, Prisma, UserStatus } from '@prisma/client';
import { AppRole, ROLE_RANK } from '@zebl/shared';
import {
  buildPaginatedResult,
  paginationSkip,
} from '../../common/utils/pagination.util';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PasswordService } from '../../infrastructure/security/password.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserPublicDto } from './mappers/user.mapper';

const userInclude = {
  department: { select: { id: true, name: true, code: true } },
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertCanAssignRole(actor, dto.role);
    await this.ensureEmailAvailable(dto.email);
    if (dto.employeeCode) {
      await this.ensureEmployeeCodeAvailable(dto.employeeCode);
    }
    await this.assertDepartmentExists(dto.departmentId);
    await this.assertManagerValid(dto.managerId);

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        employeeCode: dto.employeeCode?.trim() || null,
        phone: dto.phone?.trim() || null,
        role: dto.role,
        status: dto.status ?? UserStatus.ACTIVE,
        departmentId: dto.departmentId ?? null,
        managerId: dto.managerId ?? null,
        passwordChangedAt: new Date(),
      },
      include: userInclude,
    });

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.USER_CREATE,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return toUserPublicDto(user);
  }

  async findAll(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              {
                employeeCode: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [totalItems, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: paginationSkip(query.page, query.pageSize),
        take: query.pageSize,
      }),
    ]);

    return buildPaginatedResult(
      users.map(toUserPublicDto),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserPublicDto(user);
  }

  async getProfile(userId: string) {
    return this.findOne(userId);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.requireActiveUser(userId);

    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone:
          dto.phone === undefined
            ? undefined
            : dto.phone === null
              ? null
              : dto.phone.trim(),
      },
      include: userInclude,
    });

    await this.auditService.write({
      actorId: userId,
      action: AuditActions.USER_UPDATE,
      entityType: 'User',
      entityId: user.id,
      metadata: { scope: 'profile' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return toUserPublicDto(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.requireActiveUser(id);

    if (dto.role) {
      this.assertCanAssignRole(actor, dto.role);
    }
    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      await this.ensureEmailAvailable(dto.email, id);
    }
    if (dto.employeeCode) {
      await this.ensureEmployeeCodeAvailable(dto.employeeCode, id);
    }
    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.managerId !== undefined && dto.managerId !== null) {
      if (dto.managerId === id) {
        throw new BadRequestException('User cannot be their own manager');
      }
      await this.assertManagerValid(dto.managerId);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email?.toLowerCase().trim(),
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        employeeCode:
          dto.employeeCode === undefined
            ? undefined
            : dto.employeeCode?.trim() || null,
        phone:
          dto.phone === undefined
            ? undefined
            : dto.phone === null
              ? null
              : dto.phone.trim(),
        role: dto.role,
        status: dto.status,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
      },
      include: userInclude,
    });

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.USER_UPDATE,
      entityType: 'User',
      entityId: user.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return toUserPublicDto(user);
  }

  async softDelete(
    id: string,
    actor: AuthenticatedUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (id === actor.userId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.requireActiveUser(id);
    if (existing.role === DbRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin accounts cannot be deleted');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: UserStatus.INACTIVE,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.write({
      actorId: actor.userId,
      action: AuditActions.USER_SOFT_DELETE,
      entityType: 'User',
      entityId: id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { id, deleted: true };
  }

  async findByEmailForAuth(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  async findByIdForAuth(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  private assertCanAssignRole(actor: AuthenticatedUser, targetRole: DbRole) {
    const actorRank = Math.max(
      ...actor.roles.map((role) => ROLE_RANK[role] ?? 0),
      0,
    );
    const targetRank = ROLE_RANK[targetRole as AppRole] ?? 0;

    if (
      targetRole === DbRole.SUPER_ADMIN &&
      !actor.roles.includes(AppRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Only Super Admin can assign Super Admin role');
    }

    if (actorRank < targetRank) {
      throw new ForbiddenException('Cannot assign a role above your privilege level');
    }
  }

  private async ensureEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async ensureEmployeeCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        employeeCode: code.trim(),
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Employee code is already in use');
    }
  }

  private async assertDepartmentExists(departmentId?: string | null) {
    if (!departmentId) {
      return;
    }
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
    });
    if (!department) {
      throw new BadRequestException('Department not found');
    }
  }

  private async assertManagerValid(managerId?: string | null) {
    if (!managerId) {
      return;
    }
    const manager = await this.prisma.user.findFirst({
      where: {
        id: managerId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [DbRole.MANAGER, DbRole.ADMIN, DbRole.SUPER_ADMIN] },
      },
    });
    if (!manager) {
      throw new BadRequestException(
        'Manager must be an active Manager, Admin, or Super Admin',
      );
    }
  }

  private async requireActiveUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
