import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repository: CategoriesRepository,
    @Optional() private readonly cache?: CacheService,
  ) {}
  list() {
    return this.cache
      ? this.cache.catalog('categories', () => this.repository.list())
      : this.repository.list();
  }
}
