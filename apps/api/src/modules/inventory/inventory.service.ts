import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  adjust(
    productId: string,
    actorId: string,
    input: { delta: number; reason: string; operationId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { productId: string; onHand: number; reserved: number }[]
      >`SELECT * FROM "Inventory" WHERE "productId" = ${productId}::uuid FOR UPDATE`;
      const stock = rows[0];
      if (!stock) throw new NotFoundException('Inventory not found.');
      const previous = await tx.inventoryMovement.findUnique({
        where: { productId_operationId: { productId, operationId: input.operationId } },
      });
      if (previous) {
        if (
          previous.delta !== input.delta ||
          previous.reason !== input.reason ||
          previous.actorId !== actorId
        )
          throw new ConflictException('Operation ID already used for another adjustment.');
        return previous;
      }
      if (stock.onHand + input.delta < stock.reserved || stock.onHand + input.delta > 2147483647)
        throw new ConflictException('Adjustment would violate inventory availability.');
      await tx.inventory.update({
        where: { productId },
        data: { onHand: { increment: input.delta } },
      });
      return tx.inventoryMovement.create({ data: { productId, actorId, ...input } });
    });
  }
  movements(productId: string, page: number, limit: number) {
    return this.prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
