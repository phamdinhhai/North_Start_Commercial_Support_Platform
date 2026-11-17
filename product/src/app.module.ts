import { IntegrationController } from './api/integration.controller';
import { IntegrationIntake } from './application/integration/intake';
import { PgIntegrationStore } from './infra/integration/pg-integration.store';
import { PostgresService } from './infra/postgres/postgres.service';
import { Module } from '@nestjs/common';
import { Controller, Get, Header } from '@nestjs/common';
import { OPERATOR_CLIENT_HTML } from './api/operator-client';

@Controller()
class OperatorClientController {
  @Get('operator')
  @Header('content-type', 'text/html; charset=utf-8')
  operator(): string { return OPERATOR_CLIENT_HTML; }
}
import { HealthModule } from './scripts/health.module';
import { PilotLoopModule } from './scripts/pilot-loop.module';

/** Composition root for the manual pilot loop and health delivery. */
@Module({
  imports: [HealthModule, PilotLoopModule],
  controllers: [OperatorClientController, IntegrationController],
  providers: [{ provide: IntegrationIntake, inject: [PostgresService], useFactory: (db: PostgresService) => new IntegrationIntake(new PgIntegrationStore(db)) }],
})
export class AppModule {}
