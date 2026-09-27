import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
@Module({
  imports: [AuthModule],
  providers: [OrderRepository, OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrdersModule {}
