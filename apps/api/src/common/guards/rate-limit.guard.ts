import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CacheService } from '../../infrastructure/redis/cache.service';
const increment = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n`;
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly cache: CacheService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ method: string; path: string; ip: string }>();
    if (req.path.includes('/health/') || req.path === '/api/v1/payments/webhook') return true;
    const authentication = /\/auth\/(login|signup)$/.test(req.path);
    const sensitive = req.method !== 'GET' && req.method !== 'HEAD';
    // Do not trust arbitrary X-Forwarded-For. A deployment may configure a trusted proxy separately.
    const identity = createHash('sha256')
      .update(req.ip ?? 'unknown')
      .digest('hex');
    const limit = authentication ? 10 : sensitive ? 120 : 600;
    let count: number;
    try {
      count = Number(
        await this.cache.client.eval(
          increment,
          1,
          `${this.cache.prefix}:rate:${authentication ? 'auth' : sensitive ? 'write' : 'read'}:${identity}`,
          60,
        ),
      );
    } catch {
      if (sensitive) throw new ServiceUnavailableException('Please try again shortly.');
      return true;
    }
    if (count > limit) throw new HttpException('Too many requests. Please retry in a minute.', 429);
    return true;
  }
}
