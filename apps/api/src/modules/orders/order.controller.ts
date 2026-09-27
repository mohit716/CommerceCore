import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Roles, RolesGuard, SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/session';
import { AdminPageDto } from '../admin/dto/admin.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderService } from './order.service';

@ApiTags('Orders')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}
  @Get('admin/orders') @Roles('ADMIN') @UseGuards(RolesGuard) adminList(
    @Query() query: AdminPageDto,
  ) {
    return this.orders.adminList(query.page, query.limit);
  }
  @Post('checkout')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID reused for retries of the same checkout request.',
  })
  checkout(
    @Req() req: AuthRequest,
    @Headers('idempotency-key') key: string,
    @Body() input: CheckoutDto,
  ) {
    if (!isUUID(key, '4')) throw new BadRequestException('Idempotency-Key must be a UUID v4.');
    return this.orders.checkout(req.auth!.userId, key, input);
  }
  @Get('orders') @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthRequest,
    @Query() query: AdminPageDto,
  ) {
    return this.orders.list(req.auth!.userId, query.page, query.limit);
  }
  @Get('orders/:id') @Header('Cache-Control', 'no-store') detail(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.detail(req.auth!.userId, id);
  }
  @Post('admin/orders/:id/fulfill') @Roles('ADMIN') @UseGuards(RolesGuard) fulfill(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.fulfill(id);
  }
}
