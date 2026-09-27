import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StripeGateway } from './stripe.gateway';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
@Module({
  imports: [AuthModule],
  providers: [StripeGateway, PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentsModule {}
