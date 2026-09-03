import { MediaKind } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class PlanMediaUploadDto {
  @ApiProperty({ enum: MediaKind })
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CompleteMediaUploadDto extends PlanMediaUploadDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  pathname!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^https:\/\//i, { message: 'url must be an https URL' })
  url!: string;
}
