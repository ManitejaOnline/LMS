import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { IsEntityId } from '../../../common/decorators/is-entity-id.decorator';

class OrderedIdDto {
  @ApiProperty()
  @IsEntityId()
  id!: string;
}

export class ReorderDto {
  @ApiProperty({ type: [OrderedIdDto] })
  @IsArray()
  @ArrayMinSize(1, {
    message:
      'Cannot reorder lessons: items is empty. Create at least one lesson before reordering.',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderedIdDto)
  items!: OrderedIdDto[];
}
