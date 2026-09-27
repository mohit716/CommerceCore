import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Environment } from './common/config/environment';
import { sessionCookieName } from './modules/auth/session';
import { requestLogging } from './common/monitoring/request-logging';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
  app.use(helmet());
  app.use(requestLogging);
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }) });
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CommerceCore API')
      .setDescription('Modular ecommerce REST API. All monetary amounts use integer minor units.')
      .setVersion('1.0')
      .addCookieAuth(sessionCookieName(config.get('NODE_ENV', { infer: true }) === 'production'))
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'openapi.json' });
}
