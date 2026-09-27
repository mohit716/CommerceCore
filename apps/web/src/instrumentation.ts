import * as Sentry from '@sentry/nextjs';
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
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
    tracesSampleRate: 0,
    defaultIntegrations: false,
    beforeSend: (event) => {
      delete event.request;
      delete event.user;
      delete event.extra;
      event.breadcrumbs = [];
      for (const value of event.exception?.values ?? [])
        value.value = 'Server render error (message redacted)';
      return event;
    },
  });
}
export const onRequestError = Sentry.captureRequestError;
