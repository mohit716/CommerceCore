import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
@Module({
  imports: [AuthModule],
  providers: [UsersRepository, UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
