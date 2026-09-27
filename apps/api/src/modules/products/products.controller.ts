import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogResponseDto, ProductResponseDto } from './dto/catalog-response.dto';
import { CatalogQueryDto, ProductSlugDto } from './dto/catalog-query.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: CatalogResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid catalog filters' })
  @ApiOperation({ summary: 'Browse active products; price filters use integer USD cents' })
  list(@Query() query: CatalogQueryDto) {
    return this.products.list(query);
  }

  @Get(':slug')
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product is missing or not publicly available' })
  @ApiOperation({ summary: 'Get an active product by slug' })
  detail(@Param() params: ProductSlugDto) {
    return this.products.detail(params.slug);
  }
}
