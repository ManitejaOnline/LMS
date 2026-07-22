import { AppRole, UserStatus } from '@prisma/client';

export interface UserPublicDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  phone: string | null;
  role: AppRole;
  status: UserStatus;
  departmentId: string | null;
  managerId: string | null;
  department?: { id: string; name: string; code: string } | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type UserEntity = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  phone: string | null;
  role: AppRole;
  status: UserStatus;
  departmentId: string | null;
  managerId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  department?: { id: string; name: string; code: string } | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export function toUserPublicDto(user: UserEntity): UserPublicDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    employeeCode: user.employeeCode,
    phone: user.phone,
    role: user.role,
    status: user.status,
    departmentId: user.departmentId,
    managerId: user.managerId,
    department: user.department ?? null,
    manager: user.manager ?? null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
