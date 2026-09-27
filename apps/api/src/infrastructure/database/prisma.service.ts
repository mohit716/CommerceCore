import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { Environment } from '../../common/config/environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Environment, true>) {
    const connectionString = config.get('DATABASE_URL', { infer: true });
    const schema = new URL(connectionString).searchParams.get('schema') ?? 'public';
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema name.');
    super({
      adapter: new PrismaPg(
        {
          connectionString,
          options: `-c search_path=${schema}`,
          max: 5,
          connectionTimeoutMillis: 3000,
          statement_timeout: 10000,
        },
        { schema },
      ),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
