import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoryResponseDto } from '../products/dto/catalog-response.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}
  @Get()
  @ApiOkResponse({ type: [CategoryResponseDto] })
  @ApiOperation({ summary: 'List catalog categories' })
  list() {
    return this.categories.list();
  }
}
