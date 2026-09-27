import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'npm run db:seed' },
  datasource: { url: env('DATABASE_URL') },
});
