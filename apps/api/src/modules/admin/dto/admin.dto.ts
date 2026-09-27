import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  ValidateIf,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  NotEquals,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiProperty() @IsString() @Length(1, 120) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 2000)
  description?: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto, {
  skipNullProperties: false,
}) {}
export class CreateProductDto {
  @ApiProperty() @IsString() @Length(1, 160) name!: string;
  @ApiProperty() @IsString() @Length(1, 160) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @ApiProperty() @IsString() @Length(1, 80) sku!: string;
  @ApiProperty() @IsString() @Length(1, 10000) description!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) @Max(2147483647) priceMinor!: number;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' })
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}
export class UpdateProductDto extends PartialType(CreateProductDto, {
  skipNullProperties: false,
}) {}
export class AdminPageDto {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @ApiPropertyOptional({ default: 24 }) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
}
export class AdjustmentDto {
  @ApiProperty() @IsInt() @Min(-1000000) @Max(1000000) @NotEquals(0) delta!: number;
  @ApiProperty() @IsString() @Length(1, 240) reason!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() operationId!: string;
}
export class SignUploadDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId!: string;
}
export class AttachImageDto {
  @ApiProperty() @IsString() @Length(1, 240) storageKey!: string;
  @ApiProperty() @IsString() @Length(1, 240) alt!: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}
