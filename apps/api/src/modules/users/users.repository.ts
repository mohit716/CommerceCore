import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { publicUserSelect } from '../auth/auth.repository';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  me(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: publicUserSelect });
  }
}
