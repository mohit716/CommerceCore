import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { invalidateCatalog } from '../../infrastructure/redis/catalog-revision';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/admin.dto';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}
  private mutate<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      const result = await run(tx);
      await invalidateCatalog(tx);
      return result;
    });
  }
  async list(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { inventory: true, images: true, category: true },
      }),
      this.prisma.product.count(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  product(id: string) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { inventory: true, images: true, category: true },
    });
  }
  create(data: CreateProductDto) {
    return this.mutate((tx) => tx.product.create({ data: { ...data, inventory: { create: {} } } }));
  }
  update(id: string, data: UpdateProductDto) {
    return this.mutate((tx) => tx.product.update({ where: { id }, data }));
  }
  createCategory(data: CreateCategoryDto) {
    return this.mutate((tx) => tx.category.create({ data }));
  }
  updateCategory(id: string, data: UpdateCategoryDto) {
    return this.mutate((tx) => tx.category.update({ where: { id }, data }));
  }
  removeCategory(id: string) {
    return this.mutate((tx) => tx.category.delete({ where: { id } }));
  }
  addImage(
    productId: string,
    data: { storageKey: string; url: string; alt: string; sortOrder?: number },
  ) {
    return this.mutate((tx) => tx.productImage.create({ data: { productId, ...data } }));
  }
  removeImage(productId: string, imageId: string) {
    return this.mutate((tx) => tx.productImage.delete({ where: { id: imageId, productId } }));
  }
}
