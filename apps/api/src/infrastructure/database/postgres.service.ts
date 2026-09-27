import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Environment } from '../../common/config/environment';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService<Environment, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: 2,
      connectionTimeoutMillis: 1500,
      query_timeout: 1500,
      statement_timeout: 1500,
      idleTimeoutMillis: 10000,
    });
    // An idle connection failure must not crash liveness; readiness checks expose it.
    this.pool.on('error', () => undefined);
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
