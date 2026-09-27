import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import type { Environment } from '../../common/config/environment';
import { AuthService } from './auth.service';
import { OriginGuard, SessionGuard } from './auth.guards';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { csrfToken, readSession, sessionCookie, type AuthRequest } from './session';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  private get production() {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('signup')
  @UseGuards(OriginGuard)
  @Header('Cache-Control', 'no-store')
  async signup(@Body() input: SignupDto, @Res({ passthrough: true }) response: ServerResponse) {
    const result = await this.auth.signup(input);
    response.setHeader('Set-Cookie', sessionCookie(result.token, this.production));
    return result.user;
  }
  @Post('login')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() input: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    const result = await this.auth.login(input);
    const previous = readSession(request.headers.cookie, this.production);
    if (previous) await this.auth.logout(previous);
    response.setHeader('Set-Cookie', sessionCookie(result.token, this.production));
    return result.user;
  }
  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthRequest) {
    return request.auth!.user;
  }

  @Get('csrf')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  csrf(@Req() request: AuthRequest) {
    return { csrfToken: csrfToken(request.auth!.token) };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: ServerResponse) {
    await this.auth.logout(request.auth!.token);
    response.setHeader('Set-Cookie', sessionCookie('', this.production, true));
  }
}
