import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';
import { AssignCourseDto } from '../../learning/dto/assign-course.dto';

export class CreateProgramDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  thumbnailMediaId?: string;
}

export class UpdateProgramDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  thumbnailMediaId?: string | null;
}

export class UpdateProgramStatusDto {
  @ApiProperty({ enum: ProgramStatus })
  @IsEnum(ProgramStatus)
  status!: ProgramStatus;
}

export class CreateLevelDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class UpdateLevelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class AddLevelCoursesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEntityId({ each: true })
  courseIds!: string[];
}

export class UpdateLevelCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class AssignProgramDto extends AssignCourseDto {}

export class ReorderItemsDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderedId)
  items!: OrderedId[];
}

class OrderedId {
  @IsEntityId()
  id!: string;
}
