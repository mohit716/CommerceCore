import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
const logger = new Logger('HTTP');
export function requestLogging(
  req: IncomingMessage & { requestId?: string; route?: { path?: string } },
  res: ServerResponse,
  next: () => void,
) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  if (req.headers.cookie || req.url?.startsWith('/api/v1/admin'))
    res.setHeader('Cache-Control', 'no-store');
  const started = performance.now();
  res.once('finish', () =>
    logger.log({
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path ?? 'unmatched',
      status: res.statusCode,
      durationMs: Math.round(performance.now() - started),
    }),
  );
  next();
}
