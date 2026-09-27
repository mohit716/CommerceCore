import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded?: string) {
  const valid = encoded?.match(/^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{128})$/);
  // Missing accounts still perform the same expensive derivation.
  const key = await derive(password, valid?.[1] ?? '0'.repeat(32));
  const expected = Buffer.from(valid?.[2] ?? '0'.repeat(128), 'hex');
  return timingSafeEqual(key, expected) && Boolean(valid);
}
