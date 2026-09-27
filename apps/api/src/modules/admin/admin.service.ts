import { Injectable } from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import { CloudinaryService } from '../../infrastructure/storage/cloudinary.service';
import {
  AttachImageDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly storage: CloudinaryService,
  ) {}
  list(page: number, limit: number) {
    return this.repository.list(page, limit);
  }
  detail(id: string) {
    return this.repository.product(id);
  }
  create(data: CreateProductDto) {
    return this.repository.create(data);
  }
  update(id: string, data: UpdateProductDto) {
    return this.repository.update(id, data);
  }
  archive(id: string) {
    return this.repository.update(id, { status: 'ARCHIVED' });
  }
  createCategory(data: CreateCategoryDto) {
    return this.repository.createCategory(data);
  }
  updateCategory(id: string, data: UpdateCategoryDto) {
    return this.repository.updateCategory(id, data);
  }
  removeCategory(id: string) {
    return this.repository.removeCategory(id);
  }
  async signUpload(productId: string) {
    await this.repository.product(productId);
    return this.storage.sign(productId);
  }
  async attachImage(productId: string, data: AttachImageDto) {
    await this.repository.product(productId);
    const asset = await this.storage.verify(productId, data.storageKey);
    return this.repository.addImage(productId, {
      ...asset,
      alt: data.alt,
      sortOrder: data.sortOrder,
    });
  }
  removeImage(productId: string, imageId: string) {
    return this.repository.removeImage(productId, imageId);
  }
}
