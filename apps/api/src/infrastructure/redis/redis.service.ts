import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Environment } from '../../common/config/environment';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService<Environment, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    this.client.on('error', () => undefined);
  }

  async ping(): Promise<void> {
    if (this.client.status === 'end') {
      await this.client.connect();
    }
    if ((await this.client.ping()) !== 'PONG') {
      throw new Error('Redis ping failed');
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
