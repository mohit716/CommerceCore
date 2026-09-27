import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module';
import { PostgresService } from '../src/infrastructure/database/postgres.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

for (const failed of ['none', 'postgres', 'redis'] as const) {
  test(`health HTTP contract when ${failed} dependency fails`, async () => {
    const probe = (name: string) => ({
      ping: async () => {
        if (name === failed) throw new Error('connection containing private credentials');
      },
    });
    const module = await Test.createTestingModule({ imports: [HealthModule] })
      .overrideProvider(PostgresService)
      .useValue(probe('postgres'))
      .overrideProvider(RedisService)
      .useValue(probe('redis'))
      .compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    try {
      await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect('Cache-Control', 'no-store');
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(failed === 'none' ? 200 : 503);
      assert.deepEqual(response.body, {
        status: failed === 'none' ? 'ok' : 'unavailable',
        checks: {
          postgres: failed === 'postgres' ? 'down' : 'up',
          redis: failed === 'redis' ? 'down' : 'up',
        },
      });
    } finally {
      await app.close();
    }
  });
}
