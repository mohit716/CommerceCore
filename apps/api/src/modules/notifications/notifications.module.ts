import { Controller, Get, Module, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { Roles, RolesGuard, SessionGuard } from '../auth/auth.guards';
import { PaymentsModule } from '../payments/payments.module';
import { JobsService } from './jobs.service';
import { EmailService } from './email.service';
@ApiTags('Operations')
@ApiCookieAuth()
@Controller('admin/jobs')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Get() status() {
    return this.jobs.status();
  }
  @Post(':id/retry') retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.retry(id);
  }
}
@Module({
  imports: [AuthModule, PaymentsModule],
  providers: [JobsService, EmailService],
  controllers: [JobsController],
})
export class NotificationsModule {}
