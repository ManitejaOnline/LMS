import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ enum: AppRole })
  @IsEnum(AppRole)
  role!: AppRole;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsEntityId()
  departmentId?: string | null;

  @ApiPropertyOptional({ description: 'Manager user id' })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsEntityId()
  managerId?: string | null;
}
