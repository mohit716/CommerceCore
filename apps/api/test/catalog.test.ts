import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CatalogQueryDto } from '../src/modules/products/dto/catalog-query.dto';
import { catalogSql, ProductsRepository } from '../src/modules/products/products.repository';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductsController } from '../src/modules/products/products.controller';
import { configureApp } from '../src/configure-app';

test('repository query binds search input and uses stable sort ties', () => {
  const query = Object.assign(new CatalogQueryDto(), {
    search: "lamp'; DROP TABLE products; --",
    minPrice: 0,
  });
  const sql = catalogSql(query);
  assert.ok(sql.where.values.includes(query.search));
  assert.ok(!sql.where.text.includes('DROP TABLE'));
  assert.match(sql.order.text, /"id" ASC/);
  assert.ok(sql.where.values.includes(0));
});

test('service rejects inverted prices before accessing the repository', async () => {
  const service = new ProductsService({
    list: async () => {
      throw new Error('must not query');
    },
  } as unknown as ProductsRepository);
  await assert.rejects(
    service.list(Object.assign(new CatalogQueryDto(), { minPrice: 200, maxPrice: 100 })),
    /minPrice/,
  );
});

test('service returns 404 for missing or non-public products', async () => {
  const service = new ProductsService({
    findBySlug: async () => null,
  } as unknown as ProductsRepository);
  await assert.rejects(service.detail('hidden-product'), /Product not found/);
});

test('HTTP DTO validation rejects malformed and unsupported filters', async () => {
  let calls = 0;
  const module = await Test.createTestingModule({
    controllers: [ProductsController],
    providers: [
      {
        provide: ProductsService,
        useValue: {
          list: async (query: CatalogQueryDto) => {
            calls++;
            return query;
          },
        },
      },
      {
        provide: ConfigService,
        useValue: new ConfigService({ WEB_ORIGIN: 'http://localhost:3000' }),
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  try {
    for (const query of [
      'limit=101',
      'page=0',
      'sort=invalid',
      'minPrice=-1',
      'minPrice=1.5',
      'admin=true',
      'search=a&search=b',
    ]) {
      const result = await request(app.getHttpServer())
        .get(`/api/v1/products?${query}`)
        .expect(400);
      assert.equal(result.body.code, 'VALIDATION_ERROR');
      assert.equal(typeof result.body.requestId, 'string');
    }
    assert.equal(calls, 0);
    const response = await request(app.getHttpServer())
      .get('/api/v1/products?limit=2&page=3')
      .expect(200);
    assert.equal(response.body.limit, 2);
    assert.equal(response.body.page, 3);
    await request(app.getHttpServer()).get('/openapi.json').expect(200);
  } finally {
    await app.close();
  }
});
