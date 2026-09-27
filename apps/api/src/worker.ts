import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// Set before importing AppModule's environment configuration.
process.env.PROCESS_ROLE = 'worker';
async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.enableShutdownHooks();
  // A worker is long-running even while queues are idle.
  process.stdout.write('CommerceCore worker started.\n');
}
void bootstrap().catch(() => {
  process.stderr.write('Worker startup failed. Check configuration.\n');
  process.exitCode = 1;
});
