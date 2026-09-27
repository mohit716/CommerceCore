import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
}
export class ImageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() alt!: string;
  @ApiProperty() sortOrder!: number;
}
export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ minimum: 0, description: 'Integer minor currency units' }) priceMinor!: number;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: CategoryResponseDto }) category!: CategoryResponseDto;
  @ApiProperty({ type: [ImageResponseDto] }) images!: ImageResponseDto[];
}
export class CatalogResponseDto {
  @ApiProperty({ type: [ProductResponseDto] }) items!: ProductResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
