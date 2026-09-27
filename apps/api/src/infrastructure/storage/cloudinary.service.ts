import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Environment } from '../../common/config/environment';

export function uploadSignature(fields: Record<string, string | number>, secret: string) {
  const values = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');
  return createHash('sha256')
    .update(values + secret)
    .digest('hex');
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  private credentials() {
    const cloud = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const key = this.config.get('CLOUDINARY_API_KEY', { infer: true });
    const secret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });
    const preset = this.config.get('CLOUDINARY_UPLOAD_PRESET', { infer: true });
    if (!cloud || !key || !secret || !preset)
      throw new ServiceUnavailableException('Image uploads are not configured.');
    return { cloud, key, secret, preset };
  }
  sign(productId: string) {
    const { cloud, key, secret, preset } = this.credentials();
    const fields = {
      public_id: `commercecore/products/${productId}/${randomUUID()}`,
      timestamp: Math.floor(Date.now() / 1000),
      overwrite: 'false',
      allowed_formats: 'jpg,png,webp',
      upload_preset: preset,
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      fields: { ...fields, api_key: key, signature: uploadSignature(fields, secret) },
    };
  }
  async verify(productId: string, storageKey: string) {
    const { cloud, key, secret } = this.credentials();
    if (
      !storageKey.startsWith(`commercecore/products/${productId}/`) ||
      !/^commercecore\/products\/[a-f0-9-]+\/[a-f0-9-]+$/.test(storageKey)
    )
      throw new BadRequestException('Invalid image ownership.');
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${encodeURIComponent(storageKey)}`,
        {
          headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ServiceUnavailableException('Image verification is temporarily unavailable.');
    }
    if (response.status === 404) throw new BadRequestException('Uploaded image was not found.');
    if (!response.ok)
      throw new ServiceUnavailableException('Image verification is temporarily unavailable.');
    const asset = (await response.json()) as {
      public_id: string;
      resource_type: string;
      format: string;
      bytes: number;
      secure_url: string;
      width: number;
      height: number;
    };
    if (
      asset.public_id !== storageKey ||
      asset.resource_type !== 'image' ||
      !['jpg', 'png', 'webp'].includes(asset.format) ||
      !Number.isInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      asset.bytes > 5 * 1024 * 1024 ||
      !Number.isInteger(asset.width) ||
      !Number.isInteger(asset.height) ||
      asset.width <= 0 ||
      asset.height <= 0 ||
      asset.width * asset.height > 40000000 ||
      !asset.secure_url?.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)
    )
      throw new BadRequestException(
        'Image must be a valid JPG, PNG or WebP under 5 MB and 40 megapixels.',
      );
    return { storageKey, url: asset.secure_url };
  }
}
