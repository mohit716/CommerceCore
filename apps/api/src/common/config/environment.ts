import { z } from 'zod';

const connectionUrl = (protocols: string[]) =>
  z.url().refine((value) => URL.canParse(value) && protocols.includes(new URL(value).protocol), {
    message: `Expected protocol ${protocols.join(' or ')}`,
  });

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    PORT: z.coerce.number().int().min(1).max(65535).optional(),
    WEB_ORIGIN: connectionUrl(['http:', 'https:']).default('http://localhost:3000'),
    DATABASE_URL: connectionUrl(['postgres:', 'postgresql:']),
    REDIS_URL: connectionUrl(['redis:', 'rediss:']),
    PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
    SENTRY_DSN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      connectionUrl(['https:']).optional(),
    ),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
    SMTP_PASSWORD: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    MAIL_FROM: z.string().default('CommerceCore <no-reply@example.test>'),
    STRIPE_SECRET_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().startsWith('sk_test_').optional(),
    ),
    STRIPE_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().startsWith('whsec_').optional(),
    ),
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
    if (value.NODE_ENV === 'production' && !value.WEB_ORIGIN.startsWith('https://'))
      context.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'Production requires HTTPS.',
      });
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD))
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'Configure SMTP authentication together.',
      });
    if (Boolean(value.STRIPE_SECRET_KEY) !== Boolean(value.STRIPE_WEBHOOK_SECRET))
      context.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'Configure both Stripe test settings together.',
      });
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
