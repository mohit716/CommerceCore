import { z } from 'zod';

const connectionUrl = (protocols: string[]) =>
  z.url().refine((value) => URL.canParse(value) && protocols.includes(new URL(value).protocol), {
    message: `Expected protocol ${protocols.join(' or ')}`,
  });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: connectionUrl(['http:', 'https:']).default('http://localhost:3000'),
  DATABASE_URL: connectionUrl(['postgres:', 'postgresql:']),
  REDIS_URL: connectionUrl(['redis:', 'rediss:']),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Only field names are reported: URLs can contain credentials.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
