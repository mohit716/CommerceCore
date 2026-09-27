import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Role } from '../../generated/prisma/client';

export type AuthRequest = IncomingMessage & {
  auth?: {
    userId: string;
    role: Role;
    token: string;
    sessionId: string;
    user: { id: string; email: string; name: string; role: Role };
  };
};
export const sessionCookieName = (production: boolean) =>
  production ? '__Host-cc_session' : 'cc_session';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const csrfToken = (token: string) =>
  createHmac('sha256', token).update('commercecore-csrf-v1').digest('hex');
export function validCsrf(value: unknown, token: string) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(csrfToken(token), 'hex'));
}
export function readSession(cookie: string | undefined, production: boolean) {
  const prefix = `${sessionCookieName(production)}=`;
  const values = (cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  if (values.length !== 1) return undefined;
  const value = values[0]!.slice(prefix.length);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export function sessionCookie(token: string, production: boolean, clear = false) {
  return `${sessionCookieName(production)}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${production ? '; Secure' : ''}`;
}
