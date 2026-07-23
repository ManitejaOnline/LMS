import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AppRole })
  @IsOptional()
  @IsEnum(AppRole)
  role?: AppRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  managerId?: string;
}
