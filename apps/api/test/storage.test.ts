import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  CloudinaryService,
  uploadSignature,
} from '../src/infrastructure/storage/cloudinary.service';
import { validateEnvironment, type Environment } from '../src/common/config/environment';

function storage() {
  return new CloudinaryService(
    new ConfigService<Environment, true>(
      validateEnvironment({
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        REDIS_URL: 'redis://localhost:6379',
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'fake-key',
        CLOUDINARY_API_SECRET: 'fake-secret',
        CLOUDINARY_UPLOAD_PRESET: 'signed-test',
      }),
    ),
  );
}
test('signed upload locks the product path, preset, formats and overwrite policy without revealing the secret', () => {
  const productId = randomUUID();
  const signed = storage().sign(productId);
  assert.match(signed.fields.public_id, new RegExp(`^commercecore/products/${productId}/`));
  assert.equal(signed.fields.overwrite, 'false');
  assert.equal(signed.fields.allowed_formats, 'jpg,png,webp');
  assert.equal(signed.fields.upload_preset, 'signed-test');
  assert.equal(signed.fields.signature.length, 64);
  assert.equal(JSON.stringify(signed).includes('fake-secret'), false);
  assert.equal(
    uploadSignature({ timestamp: 123, public_id: 'example' }, 'fake'),
    uploadSignature({ public_id: 'example', timestamp: 123 }, 'fake'),
  );
});
test('asset verification checks provider metadata, ownership, size, format and delivery host', async (t) => {
  const productId = randomUUID();
  const storageKey = `commercecore/products/${productId}/${randomUUID()}`;
  const asset = {
    public_id: storageKey,
    resource_type: 'image',
    format: 'png',
    bytes: 1024,
    width: 100,
    height: 100,
    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${storageKey}.png`,
  };
  let result = { ...asset };
  t.mock.method(globalThis, 'fetch', async () => Response.json(result));
  assert.equal((await storage().verify(productId, storageKey)).url, asset.secure_url);
  await assert.rejects(storage().verify(randomUUID(), storageKey), /ownership/);
  for (const invalid of [
    { bytes: 6000000 },
    { format: 'svg' },
    { secure_url: 'https://untrusted.example/image.png' },
    { width: -1 },
  ]) {
    result = { ...asset, ...invalid };
    await assert.rejects(storage().verify(productId, storageKey), /Image must/);
  }
});
test('unconfigured uploads fail explicitly without making network calls', () => {
  const service = new CloudinaryService(
    new ConfigService<Environment, true>(
      validateEnvironment({
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ),
  );
  assert.throws(() => service.sign(randomUUID()), /not configured/);
});
