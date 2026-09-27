import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { config } from 'dotenv';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { configureApp } from '../../src/configure-app';

export async function withTestApp(run: (app: INestApplication) => Promise<void>) {
  config({ path: ['.env', '../../.env'], quiet: true });
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl);
  const schema = `cctest_${randomUUID().replaceAll('-', '')}`;
  const client = new Client({ connectionString: originalUrl });
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  let app: INestApplication | undefined;
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const directory of readdirSync('prisma/migrations', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await client.query(readFileSync(`prisma/migrations/${directory.name}/migration.sql`, 'utf8'));
    }
    const url = new URL(originalUrl);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    await run(app);
  } catch (error) {
    console.error(
      'Integration test failed before cleanup:',
      error instanceof Error ? error.message : 'Unknown failure',
    );
    throw error;
  } finally {
    await app?.close();
    process.env.DATABASE_URL = originalUrl;
    assert.match(schema, /^cctest_[a-f0-9]{32}$/);
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}
