import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: '.env', quiet: true });
const { Client } = require('pg');
const source = new URL(process.env.DATABASE_URL);
const redis = new URL(process.env.REDIS_URL);
assert.ok(
  ['localhost', '127.0.0.1'].includes(source.hostname),
  'Container smoke requires local PostgreSQL.',
);
assert.ok(
  ['localhost', '127.0.0.1'].includes(redis.hostname),
  'Container smoke requires local Redis.',
);
const schema = `ccimage_${randomUUID().replaceAll('-', '')}`;
const database = new Client({ connectionString: source.toString() });
const docker =
  process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe')
    : 'docker';
const command = (args) =>
  execFileSync(docker, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const containers = [];
await database.connect();
await database.query(`CREATE SCHEMA "${schema}"`);
try {
  await database.query(`SET search_path TO "${schema}"`);
  for (const entry of readdirSync('apps/api/prisma/migrations', { withFileTypes: true })
    .filter((x) => x.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await database.query(
      readFileSync(`apps/api/prisma/migrations/${entry.name}/migration.sql`, 'utf8'),
    );
  source.hostname = 'postgres';
  source.port = '5432';
  source.searchParams.set('schema', schema);
  redis.hostname = 'redis';
  redis.port = '6379';
  const common = [
    '-e',
    'NODE_ENV=production',
    '-e',
    'WEB_ORIGIN=https://example.test',
    '-e',
    `DATABASE_URL=${source}`,
    '-e',
    `REDIS_URL=${redis}`,
    '-e',
    'SMTP_HOST=mailpit',
  ];
  function launch(suffix, image, port, env, entry = []) {
    const name = `${schema}-${suffix}`;
    command([
      'run',
      '--pull=never',
      '--rm',
      '--detach',
      '--name',
      name,
      '--network',
      'commercecore_default',
      ...(port ? ['-p', `127.0.0.1::${port}`] : []),
      ...env,
      image,
      ...entry,
    ]);
    containers.push(name);
    return {
      name,
      port: port
        ? command(['port', name, String(port)])
            .split(':')
            .at(-1)
        : undefined,
    };
  }
  async function ready(url) {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
      } catch {
        /* bounded retry */
      }
      await delay(250);
    }
    throw new Error('Container readiness timed out.');
  }
  const api = launch('api', 'commercecore-api:local', 3001, common);
  await ready(`http://127.0.0.1:${api.port}/api/v1/health/ready`);
  const web = launch('web', 'commercecore-web:local', 3000, [
    '-e',
    `API_INTERNAL_URL=http://${api.name}:3001`,
  ]);
  await ready(`http://127.0.0.1:${web.port}/api/health`);
  assert.equal((await fetch(`http://127.0.0.1:${web.port}`)).status, 200);
  const worker = launch('worker', 'commercecore-api:local', undefined, common, [
    'node',
    'dist/worker.js',
  ]);
  let started = false;
  for (let i = 0; i < 80; i++) {
    if (command(['logs', worker.name]).includes('CommerceCore worker started.')) {
      started = true;
      break;
    }
    await delay(250);
  }
  assert.ok(started, 'Worker must start from the production image.');
  for (const name of containers)
    assert.equal(command(['inspect', '--format', '{{.Config.User}}', name]), 'node');
  console.log(
    'Container smoke passed: non-root API readiness, standalone frontend, and worker startup.',
  );
} catch {
  process.stderr.write(
    'Container smoke failed. No environment values or credentials are printed.\n',
  );
  process.exitCode = 1;
} finally {
  for (const name of containers.reverse()) command(['stop', '--time', '10', name]);
  assert.match(schema, /^ccimage_[a-f0-9]{32}$/);
  await database.query(`DROP SCHEMA "${schema}" CASCADE`);
  await database.end();
}
