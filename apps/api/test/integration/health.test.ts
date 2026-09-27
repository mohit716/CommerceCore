import 'reflect-metadata';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';

test('readiness reaches real PostgreSQL and Redis', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  try {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok', checks: { postgres: 'up', redis: 'up' } });
  } finally {
    await app.close();
  }
});
