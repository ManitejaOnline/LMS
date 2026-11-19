import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetLockDto {
  @ApiProperty({ description: 'Lock or unlock access for learners' })
  @IsBoolean()
  isLocked!: boolean;
}
