import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShippingAddressDto {
  @ApiProperty() @IsString() @Length(1, 100) name!: string;
  @ApiProperty() @IsString() @Length(1, 200) line1!: string;
  @ApiProperty() @IsString() @Length(1, 100) city!: string;
  @ApiProperty() @IsString() @Length(1, 100) region!: string;
  @ApiProperty() @IsString() @Length(1, 20) postalCode!: string;
  @ApiProperty({ enum: ['US'] }) @IsIn(['US']) country!: string;
}
export class CheckoutDto {
  @ApiProperty() @IsInt() @Min(0) @Max(2147483646) cartVersion!: number;
  @ApiProperty({ type: ShippingAddressDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}
