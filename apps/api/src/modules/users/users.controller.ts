import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/session';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthRequest) {
    return this.users.me(request.auth!.userId);
  }
}
