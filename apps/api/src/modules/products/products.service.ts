import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly repository: ProductsRepository) {}

  async list(query: CatalogQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice.');
    }
    const { records, total } = await this.repository.list(query);
    return {
      items: records.map(publicProduct),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async detail(slug: string) {
    const record = await this.repository.findBySlug(slug);
    if (!record) throw new NotFoundException('Product not found.');
    return publicProduct(record);
  }
}
