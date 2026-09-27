import * as Sentry from '@sentry/nextjs';
if (process.env.NEXT_PUBLIC_SENTRY_DSN)
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: (event) => {
      delete event.request;
      delete event.user;
      delete event.extra;
      event.breadcrumbs = [];
      for (const value of event.exception?.values ?? [])
        value.value = 'Browser error (message redacted)';
      return event;
    },
  });
