import { z } from 'zod';

const connectionUrl = (protocols: string[]) =>
  z.url().refine((value) => URL.canParse(value) && protocols.includes(new URL(value).protocol), {
    message: `Expected protocol ${protocols.join(' or ')}`,
  });

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_ORIGIN: connectionUrl(['http:', 'https:']).default('http://localhost:3000'),
    DATABASE_URL: connectionUrl(['postgres:', 'postgresql:']),
    REDIS_URL: connectionUrl(['redis:', 'rediss:']),
    CLOUDINARY_CLOUD_NAME: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-z0-9_-]+$/)
        .optional(),
    ),
    CLOUDINARY_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    CLOUDINARY_API_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    CLOUDINARY_UPLOAD_PRESET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
  })
  .superRefine((value, context) => {
    const keys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_UPLOAD_PRESET',
    ] as const;
    if (keys.some((key) => value[key])) {
      for (const key of keys)
        if (!value[key])
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Configure all image provider settings together.',
          });
    }
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
