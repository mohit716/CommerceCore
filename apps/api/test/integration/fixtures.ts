import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { csrfToken, hashToken, newToken } from '../../src/modules/auth/session';

export async function actor(db: PrismaService, role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
  const token = newToken();
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      name: 'Test customer',
      passwordHash: 'unused-fixture-hash',
      role,
      sessions: {
        create: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) },
      },
    },
  });
  return {
    user,
    token,
    headers: {
      Cookie: `cc_session=${token}`,
      Origin: 'http://localhost:3000',
      'X-CSRF-Token': csrfToken(token),
    },
  };
}
export async function product(db: PrismaService, stock = 5, priceMinor = 1000) {
  const category = await db.category.create({
    data: { slug: `test-${randomUUID()}`, name: 'Test category' },
  });
  return db.product.create({
    data: {
      name: 'Test product',
      slug: `test-${randomUUID()}`,
      sku: randomUUID(),
      description: 'Test description',
      status: 'ACTIVE',
      priceMinor,
      categoryId: category.id,
      inventory: { create: { onHand: stock } },
    },
  });
}
