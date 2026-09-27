import { createRequire } from 'node:module';

const [email, confirmation] = process.argv.slice(2);
if (!email || confirmation !== '--confirm' || !email.includes('@')) {
  throw new Error(
    'Usage: pnpm admin:promote user@example.com --confirm. This changes that existing user to ADMIN.',
  );
}
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: '.env', quiet: true });
const { Client } = require('pg');
const url = new URL(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema') ?? 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid schema name.');
const client = new Client({
  connectionString: url.toString(),
  options: `-c search_path=${schema}`,
});
try {
  await client.connect();
  const result = await client.query(
    'UPDATE "User" SET role=\'ADMIN\', "updatedAt"=now() WHERE email=$1 RETURNING id',
    [email.trim().toLowerCase()],
  );
  if (result.rowCount !== 1) throw new Error('No matching existing user. Sign up first.');
  console.log('The specified existing user is now an administrator.');
} finally {
  await client.end();
}
