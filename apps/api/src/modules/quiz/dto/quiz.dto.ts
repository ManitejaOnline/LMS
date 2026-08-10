import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

export class QuizOptionInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;
}

export class QuizQuestionInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @ApiProperty({ type: [QuizOptionInputDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionInputDto)
  options!: QuizOptionInputDto[];
}

export class CreateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @ApiPropertyOptional({ enum: QuizStatus })
  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}

export class UpsertQuizDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  questionCount?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @ApiPropertyOptional({ enum: QuizStatus })
  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;

  @ApiProperty({ type: [QuizQuestionInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInputDto)
  questions!: QuizQuestionInputDto[];
}

export class SubmitQuizAnswerDto {
  @ApiProperty()
  @IsEntityId()
  questionId!: string;

  @ApiProperty()
  @IsEntityId()
  optionId!: string;
}

export class SubmitQuizDto {
  @ApiProperty({ type: [SubmitQuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers!: SubmitQuizAnswerDto[];
}
