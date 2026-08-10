import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus, LessonType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

export class CreateLessonDto {
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

  @ApiProperty({ enum: LessonType })
  @IsEnum(LessonType)
  type!: LessonType;

  @ApiPropertyOptional({ enum: LessonStatus, default: LessonStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiPropertyOptional({
    description: 'MediaAsset id (Prisma cuid) for PDF/VIDEO lessons',
  })
  @IsOptional()
  @IsString()
  @IsEntityId()
  contentMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({
    description: 'Placeholder for future quiz engine configuration',
  })
  @IsOptional()
  @IsObject()
  quizConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
