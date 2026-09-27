import 'reflect-metadata';
import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { validateEnvironment } from '../src/common/config/environment';
import { invalidateCatalog } from '../src/infrastructure/redis/catalog-revision';

config({ path: ['.env', '../../.env'], quiet: true });
const prisma = new PrismaService(new ConfigService(validateEnvironment(process.env)));
const categories = [
  { slug: 'workspace', name: 'Workspace', description: 'Tools for focused work.' },
  { slug: 'everyday', name: 'Everyday', description: 'Considered everyday essentials.' },
  { slug: 'home', name: 'Home', description: 'Small upgrades for your space.' },
];
const products = [
  [
    'mechanical-keyboard',
    'Mechanical Keyboard',
    'A compact mechanical keyboard with tactile switches and a durable aluminum frame.',
    12900,
    'workspace',
  ],
  [
    'desk-lamp',
    'Adjustable Desk Lamp',
    'Warm adjustable light for a calmer workspace. Three brightness settings.',
    6900,
    'workspace',
  ],
  [
    'desk-mat',
    'Felt Desk Mat',
    'A soft recycled felt mat that creates a comfortable foundation for your workspace.',
    2900,
    'workspace',
  ],
  [
    'laptop-stand',
    'Aluminum Laptop Stand',
    'An elevated aluminum stand that brings your screen closer to eye level.',
    4900,
    'workspace',
  ],
  [
    'notebook',
    'Everyday Notebook',
    'A lay-flat notebook with dotted pages and a textured cover.',
    1800,
    'everyday',
  ],
  [
    'water-bottle',
    'Insulated Water Bottle',
    'A reusable stainless steel water bottle with a leak-resistant lid.',
    3200,
    'everyday',
  ],
  [
    'canvas-tote',
    'Canvas Tote',
    'A sturdy cotton canvas bag with an interior pocket for daily essentials.',
    2400,
    'everyday',
  ],
  [
    'ceramic-mug',
    'Ceramic Mug',
    'A comfortably weighted ceramic mug with a matte finish.',
    2200,
    'home',
  ],
  [
    'planter',
    'Stoneware Planter',
    'A simple stoneware planter with drainage and a matching saucer.',
    3600,
    'home',
  ],
  [
    'reading-light',
    'Portable Reading Light',
    'A rechargeable reading light with a warm glow and compact design.',
    4500,
    'home',
  ],
  [
    'cable-organizer',
    'Cable Organizer',
    'Keep charging cables within reach with this weighted desk organizer.',
    1500,
    'workspace',
  ],
  [
    'storage-tray',
    'Wood Storage Tray',
    'A solid wood tray for the small objects that make a space yours.',
    3800,
    'home',
  ],
  [
    'travel-pouch',
    'Travel Pouch',
    'A compact fabric pouch for cables, pens, and the essentials you carry.',
    2600,
    'everyday',
  ],
] as const;

async function seed() {
  await prisma.$transaction(
    async (tx) => {
      for (const category of categories)
        await tx.category.upsert({ where: { slug: category.slug }, update: {}, create: category });
      for (const [slug, name, description, priceMinor, categorySlug] of products) {
        const category = await tx.category.findUniqueOrThrow({ where: { slug: categorySlug } });
        await tx.product.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            sku: `CC-${slug.toUpperCase()}`,
            name,
            description,
            priceMinor,
            categoryId: category.id,
            status: 'ACTIVE',
            inventory: { create: { onHand: 20 } },
            images: {
              create: {
                storageKey: `seed/${slug}`,
                url: '/images/product-placeholder.svg',
                alt: `Illustration for ${name}`,
              },
            },
          },
        });
      }
      await invalidateCatalog(tx);
    },
    { timeout: 30000 },
  );
  console.log('Demo seed complete. Existing records were preserved.');
}

void seed()
  .catch(() => {
    console.error('Seed failed; transaction rolled back.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
