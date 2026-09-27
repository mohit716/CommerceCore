import { Module } from '@nestjs/common';
import { PostgresService } from '../../infrastructure/database/postgres.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, PostgresService, RedisService],
})
export class HealthModule {}
