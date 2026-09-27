import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PostgresService } from '../../infrastructure/database/postgres.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly postgres: PostgresService,
    private readonly redis: RedisService,
  ) {}

  async readiness() {
    const [postgres, redis] = await Promise.allSettled([this.postgres.ping(), this.redis.ping()]);
    const healthy = postgres.status === 'fulfilled' && redis.status === 'fulfilled';
    const result = {
      status: healthy ? 'ok' : 'unavailable',
      checks: {
        postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
        redis: redis.status === 'fulfilled' ? 'up' : 'down',
      },
    };
    if (!healthy) throw new ServiceUnavailableException(result);
    return result;
  }
}
