import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import type { Environment } from './common/config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({ json: true }),
  });
  configureApp(app);
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(
    config.get('PORT', { infer: true }) ?? config.get('API_PORT', { infer: true }),
    '0.0.0.0',
  );
}

void bootstrap().catch(() => {
  // Do not print connection strings or environment values on startup failure.
  process.stderr.write('API startup failed. Check configuration and application logs.\n');
  process.exitCode = 1;
});
