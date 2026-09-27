import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

if (!process.argv.includes('--confirm-upload')) {
  throw new Error(
    'This creates one small image in your Cloudinary account. Run with --confirm-upload only after approving that external action.',
  );
}
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: '.env', quiet: true });
const { ConfigService } = require('@nestjs/config');
const { validateEnvironment } = require('./dist/common/config/environment.js');
const { CloudinaryService } = require('./dist/infrastructure/storage/cloudinary.service.js');
const storage = new CloudinaryService(new ConfigService(validateEnvironment(process.env)));
const productId = randomUUID();
const signed = storage.sign(productId);
const body = new FormData();
for (const [key, value] of Object.entries(signed.fields)) body.set(key, String(value));
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQ2bHsPwAEyAJyKnolIgAAAABJRU5ErkJggg==',
  'base64',
);
body.set('file', new Blob([png], { type: 'image/png' }), 'commercecore-smoke.png');
const response = await fetch(signed.uploadUrl, {
  method: 'POST',
  body,
  signal: AbortSignal.timeout(20000),
});
if (!response.ok)
  throw new Error(
    `Cloudinary upload failed (HTTP ${response.status}). Check the configured signed preset and credentials.`,
  );
const verified = await storage.verify(productId, signed.fields.public_id);
console.log('Live Cloudinary upload and server-side verification passed.');
console.log(`Test asset retained at: ${verified.url}`);
