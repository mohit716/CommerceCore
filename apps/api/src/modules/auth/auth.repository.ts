import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export const publicUserSelect = { id: true, email: true, name: true, role: true } as const;
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}
  findUser(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
  signup(
    data: { email: string; name: string; passwordHash: string },
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.user.create({
      data: { ...data, role: 'CUSTOMER', sessions: { create: { tokenHash, expiresAt } } },
      select: publicUserSelect,
    });
  }
  createSession(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  }
  findSession(tokenHash: string) {
    return this.prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: publicUserSelect } },
    });
  }
  revoke(tokenHash: string) {
    return this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
