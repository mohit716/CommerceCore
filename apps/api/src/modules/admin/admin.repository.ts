import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/admin.dto';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}
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
    return this.prisma.product.create({ data: { ...data, inventory: { create: {} } } });
  }
  update(id: string, data: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data });
  }
  createCategory(data: CreateCategoryDto) {
    return this.prisma.category.create({ data });
  }
  updateCategory(id: string, data: UpdateCategoryDto) {
    return this.prisma.category.update({ where: { id }, data });
  }
  removeCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
  addImage(
    productId: string,
    data: { storageKey: string; url: string; alt: string; sortOrder?: number },
  ) {
    return this.prisma.productImage.create({ data: { productId, ...data } });
  }
  removeImage(productId: string, imageId: string) {
    return this.prisma.productImage.delete({ where: { id: imageId, productId } });
  }
}
