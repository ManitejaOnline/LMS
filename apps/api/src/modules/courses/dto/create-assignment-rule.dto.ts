import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRuleTargetType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAssignmentRuleDto {
  @ApiProperty({ enum: AssignmentRuleTargetType })
  @IsEnum(AssignmentRuleTargetType)
  targetType!: AssignmentRuleTargetType;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateAssignmentRuleDto) => o.targetType === 'DEPARTMENT')
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateAssignmentRuleDto) => o.targetType === 'EMPLOYEE')
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  dueInDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
