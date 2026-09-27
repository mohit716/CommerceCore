import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../../common/config/environment';
export function redisNamespace(databaseUrl: string) {
  return `cc-${createHash('sha256').update(databaseUrl).digest('hex').slice(0, 16)}`;
}
@Injectable()
export class CacheService implements OnModuleDestroy {
  readonly client: Redis;
  readonly prefix: string;
  constructor(
    private readonly db: PrismaService,
    config: ConfigService<Environment, true>,
  ) {
    this.prefix = redisNamespace(config.get('DATABASE_URL', { infer: true }));
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });
    this.client.on('error', () => undefined);
  }
  async catalog<T>(key: string, load: () => Promise<T>): Promise<T> {
    const revision = await this.db.catalogRevision.findUnique({ where: { id: 1 } });
    const cacheKey = `${this.prefix}:catalog:${revision?.version ?? 0}:${createHash('sha256').update(key).digest('hex')}`;
    try {
      const value = await this.client.get(cacheKey);
      if (value) return JSON.parse(value) as T;
    } catch {
      /* Cache reads fail open to PostgreSQL. */
    }
    const value = await load();
    try {
      await this.client.set(cacheKey, JSON.stringify(value), 'EX', 60);
    } catch {
      /* Durable revision prevents stale cache reuse after recovery. */
    }
    return value;
  }
  onModuleDestroy() {
    this.client.disconnect();
  }
}
