import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  liveness() {
    return { status: 'ok', service: 'commerce-core-api' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  readiness() {
    return this.health.readiness();
  }
}
