import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

export enum AssignScope {
  ALL_EMPLOYEES = 'ALL_EMPLOYEES',
  DEPARTMENT = 'DEPARTMENT',
  ROLE = 'ROLE',
  EMPLOYEES = 'EMPLOYEES',
}

export class AssignCourseDto {
  @ApiProperty({
    enum: AssignScope,
    default: AssignScope.ALL_EMPLOYEES,
    description: 'Who should receive this published course',
  })
  @IsEnum(AssignScope)
  scope: AssignScope = AssignScope.ALL_EMPLOYEES;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((o: AssignCourseDto) => o.scope === AssignScope.DEPARTMENT)
  @IsArray()
  @ArrayMinSize(1)
  @IsEntityId({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ enum: AppRole, isArray: true })
  @ValidateIf((o: AssignCourseDto) => o.scope === AssignScope.ROLE)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppRole, { each: true })
  roles?: AppRole[];

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((o: AssignCourseDto) => o.scope === AssignScope.EMPLOYEES)
  @IsArray()
  @ArrayMinSize(1)
  @IsEntityId({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Due in N days from assignment' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dueInDays?: number;

  @ApiPropertyOptional({
    description: 'Absolute due date (ISO 8601). Takes precedence over dueInDays.',
  })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ description: 'Mark the course mandatory or optional' })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ description: 'Notify assigned learners immediately' })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean;

  @ApiPropertyOptional({
    description:
      'Keep an active assignment rule so new matching employees can be enrolled later (All Employees / Department)',
  })
  @IsOptional()
  @IsBoolean()
  notifyNewEmployees?: boolean;
}
