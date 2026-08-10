import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LearningEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

export class LearningEventDto {
  @ApiProperty({ enum: LearningEventType })
  @IsEnum(LearningEventType)
  eventType!: LearningEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEntityId()
  lessonId?: string;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Client-generated id for idempotent ingest',
  })
  @IsOptional()
  @IsString()
  clientEventId?: string;
}

export class IngestLearningEventsDto {
  @ApiProperty({ type: [LearningEventDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LearningEventDto)
  events!: LearningEventDto[];
}
