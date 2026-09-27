import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { ProductsRepository, type CatalogRecord } from './products.repository';
import { CatalogQueryDto } from './dto/catalog-query.dto';

export function publicProduct(record: CatalogRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    priceMinor: record.priceMinor,
    currency: record.currency,
    category: record.category,
    images: record.images.map(({ id, url, alt, sortOrder }) => ({ id, url, alt, sortOrder })),
    available: (record.inventory?.onHand ?? 0) - (record.inventory?.reserved ?? 0) > 0,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async list(query: CatalogQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice.');
    }
    const load = async () => {
      const { records, total } = await this.repository.list(query);
      return {
        items: records.map(publicProduct),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    };
    return this.cache ? this.cache.catalog(`list:${JSON.stringify(query)}`, load) : load();
  }

  async detail(slug: string) {
    const load = async () => {
      const record = await this.repository.findBySlug(slug);
      if (!record) throw new NotFoundException('Product not found.');
      return publicProduct(record);
    };
    return this.cache ? this.cache.catalog(`detail:${slug}`, load) : load();
  }
}
