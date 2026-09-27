import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CartVersionDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) @Max(2147483646) version!: number;
}
export class SetCartItemDto extends CartVersionDto {
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) quantity!: number;
}
