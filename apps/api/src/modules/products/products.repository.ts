import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogQueryDto, CatalogSort } from './dto/catalog-query.dto';

const include = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  inventory: true,
} satisfies Prisma.ProductInclude;

export type CatalogRecord = Prisma.ProductGetPayload<{ include: typeof include }>;

export function catalogSql(query: CatalogQueryDto) {
  const clauses = [Prisma.sql`p."status" = 'ACTIVE'`];
  if (query.category) clauses.push(Prisma.sql`c."slug" = ${query.category}`);
  if (query.minPrice !== undefined) clauses.push(Prisma.sql`p."priceMinor" >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) clauses.push(Prisma.sql`p."priceMinor" <= ${query.maxPrice}`);
  if (query.search?.trim())
    clauses.push(
      Prisma.sql`to_tsvector('english', p."name" || ' ' || p."description") @@ websearch_to_tsquery('english', ${query.search.trim()})`,
    );
  const order = {
    [CatalogSort.NEWEST]: Prisma.sql`p."createdAt" DESC, p."id" ASC`,
    [CatalogSort.PRICE_ASC]: Prisma.sql`p."priceMinor" ASC, p."id" ASC`,
    [CatalogSort.PRICE_DESC]: Prisma.sql`p."priceMinor" DESC, p."id" ASC`,
    [CatalogSort.NAME_ASC]: Prisma.sql`p."name" ASC, p."id" ASC`,
  }[query.sort];
  return { where: Prisma.join(clauses, ' AND '), order };
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CatalogQueryDto) {
    const { where, order } = catalogSql(query);
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<
          { total: bigint }[]
        >`SELECT count(*) AS total FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" WHERE ${where}`;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT p."id" FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" WHERE ${where} ORDER BY ${order} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`;
        const records = await tx.product.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
          include,
        });
        const byId = new Map(records.map((record) => [record.id, record]));
        return { records: ids.map(({ id }) => byId.get(id)!), total: Number(count?.total ?? 0) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  findBySlug(slug: string) {
    return this.prisma.product.findFirst({ where: { slug, status: 'ACTIVE' }, include });
  }
}
