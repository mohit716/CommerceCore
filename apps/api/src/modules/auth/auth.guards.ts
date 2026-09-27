import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { readSession, validCsrf, type AuthRequest } from './session';
import type { Environment } from '../../common/config/environment';
import type { Role } from '../../generated/prisma/client';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.headers.origin !== this.config.get('WEB_ORIGIN', { infer: true }))
      throw new ForbiddenException('Untrusted request origin.');
    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = readSession(
      request.headers.cookie,
      this.config.get('NODE_ENV', { infer: true }) === 'production',
    );
    const session = token ? await this.auth.session(token) : null;
    if (!session || !token) throw new UnauthorizedException('Please sign in.');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '')) {
      if (
        request.headers.origin !== this.config.get('WEB_ORIGIN', { infer: true }) ||
        !validCsrf(request.headers['x-csrf-token'], token)
      )
        throw new ForbiddenException('Invalid CSRF token or request origin.');
    }
    request.auth = {
      userId: session.userId,
      role: session.user.role,
      token,
      sessionId: session.id,
      user: session.user,
    };
    return true;
  }
}

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const auth = context.switchToHttp().getRequest<AuthRequest>().auth;
    if (!auth || (roles && !roles.includes(auth.role)))
      throw new ForbiddenException('Insufficient permissions.');
    return true;
  }
}
