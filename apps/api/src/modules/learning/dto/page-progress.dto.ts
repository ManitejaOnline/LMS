import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SavePageProgressDto {
  @ApiProperty({ description: 'Absolute PDF page number (1-based)' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageNumber!: number;

  @ApiProperty({
    description: 'Active reading seconds since last heartbeat (capped server-side)',
  })
  @IsInt()
  @Min(0)
  @Max(30)
  @Type(() => Number)
  deltaSeconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  pauseCountDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  pausedSecondsDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  focusLostDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tabSwitchDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  hiddenDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  idleDelta?: number;

  @ApiPropertyOptional({ description: 'Chapter total pages for resume context' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalPages?: number;
}

export class CompletePageDto {
  @ApiPropertyOptional({ description: 'Absolute PDF page number (1-based)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
