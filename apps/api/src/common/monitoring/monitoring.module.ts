import { Global, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import type { Environment } from '../config/environment';
@Injectable()
class MonitoringService implements OnModuleInit {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  onModuleInit() {
    const dsn = this.config.get('SENTRY_DSN', { infer: true });
    if (!dsn) return;
    Sentry.init({
      dsn,
      environment: this.config.get('NODE_ENV', { infer: true }),
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      },
      defaultIntegrations: false,
      tracesSampleRate: 0,
      beforeSend: (event) => {
        delete event.request;
        delete event.user;
        delete event.extra;
        event.breadcrumbs = [];
        for (const value of event.exception?.values ?? [])
          value.value = 'Server exception (message redacted)';
        return event;
      },
    });
  }
}
@Global()
@Module({ providers: [MonitoringService] })
export class MonitoringModule {}
