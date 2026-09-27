import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/session';
import { PaymentService } from './payment.service';
@ApiTags('Payments')
@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}
  @Post('orders/:id/payment')
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  start(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.start(req.auth!.userId, id);
  }
  @Post('payments/webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<IncomingMessage>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.webhook(req.rawBody, signature);
  }
}
