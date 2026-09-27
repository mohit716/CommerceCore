import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Environment } from './common/config/environment';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }) });
  app.enableShutdownHooks();
}
