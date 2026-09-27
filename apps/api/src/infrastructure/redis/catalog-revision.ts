import type { Prisma } from '../../generated/prisma/client';
// Call last in catalog/inventory transactions: never acquire domain locks after this shared row.
export async function invalidateCatalog(tx: Prisma.TransactionClient) {
  await tx.catalogRevision.upsert({
    where: { id: 1 },
    create: { id: 1, version: 1 },
    update: { version: { increment: 1 } },
  });
}
