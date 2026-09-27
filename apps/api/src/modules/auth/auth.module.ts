import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OriginGuard, RolesGuard, SessionGuard } from './auth.guards';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, OriginGuard, SessionGuard, RolesGuard],
  exports: [AuthService, SessionGuard, RolesGuard, OriginGuard],
})
export class AuthModule {}
