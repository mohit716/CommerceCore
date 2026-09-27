import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/session';
import { CartService } from './cart.service';
import { CartVersionDto, SetCartItemDto } from './dto/cart.dto';

@ApiTags('Cart')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() @Header('Cache-Control', 'no-store') read(@Req() request: AuthRequest) {
    return this.cart.read(request.auth!.userId);
  }
  @Put('items/:productId') change(
    @Req() request: AuthRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: SetCartItemDto,
  ) {
    return this.cart.change(request.auth!.userId, productId, input.version, input.quantity);
  }
  @Delete('items/:productId') remove(
    @Req() request: AuthRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: CartVersionDto,
  ) {
    return this.cart.change(request.auth!.userId, productId, input.version);
  }
}
