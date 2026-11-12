import { Module } from '@nestjs/common';
import { HealthController } from '../api/health.controller';
import { PostgresModule } from '../infra/postgres/postgres.module';
import { PostgresReadinessProbe } from '../infra/postgres/postgres-readiness.probe';
import { READINESS_PROBE } from '../ports/readiness';

@Module({
  imports: [PostgresModule],
  controllers: [HealthController],
  providers: [PostgresReadinessProbe, { provide: READINESS_PROBE, useExisting: PostgresReadinessProbe }],
})
export class HealthModule {}
