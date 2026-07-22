import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRuleTargetType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAssignmentRuleDto {
  @ApiPropertyOptional({ enum: AssignmentRuleTargetType })
  @IsOptional()
  @IsEnum(AssignmentRuleTargetType)
  targetType?: AssignmentRuleTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  dueInDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
