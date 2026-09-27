import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { hashPassword, verifyPassword } from './password';
import { hashToken, newToken } from './session';

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository) {}
  async signup(input: SignupDto) {
    const token = newToken();
    const user = await this.repository.signup(
      { email: input.email, name: input.name, passwordHash: await hashPassword(input.password) },
      hashToken(token),
      new Date(Date.now() + 604800000),
    );
    return { user, token };
  }
  async login(input: LoginDto) {
    const user = await this.repository.findUser(input.email);
    if (!(await verifyPassword(input.password, user?.passwordHash)) || !user)
      throw new UnauthorizedException('Invalid email or password.');
    const token = newToken();
    await this.repository.createSession(
      user.id,
      hashToken(token),
      new Date(Date.now() + 604800000),
    );
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, token };
  }
  session(token: string) {
    return this.repository.findSession(hashToken(token));
  }
  logout(token: string) {
    return this.repository.revoke(hashToken(token));
  }
}
