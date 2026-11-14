import { Module } from '@nestjs/common';
import { PilotLoopController } from '../api/pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { AUTH_CONTEXT_RESOLVER } from '../ports/auth';
import { LEAD_ACCESS_POLICY } from '../ports/rbac';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import { AuditStore } from '../infra/audit/audit-store';
import { PostgresModule } from '../infra/postgres/postgres.module';
import { PgPilotStore } from '../infra/postgres/pg-pilot.store';
import { InMemoryPilotStore } from '../infra/pilot/in-memory-pilot.store';
import { PILOT_STORE, type PilotLoopStore } from '../ports/pilot-loop.store';
import { resolvePilotStoreMode } from '../infra/postgres/postgres.service';
import { FeedbackTelemetryController } from '../api/feedback-telemetry.controller';
import { FeedbackService } from '../infra/feedback/feedback.service';
import { TelemetryService } from '../infra/telemetry/telemetry.service';
import { FEEDBACK_SERVICE } from '../ports/feedback';
import { TELEMETRY_SERVICE } from '../ports/telemetry';
import { DURABILITY } from '../ports/durability';

/**
 * P0 pilot loop module (PH3 T3-03/T3-04 wiring + education B2C candidate flow).
 *
 * Production/pilot store selection is fail-closed: those modes require PostgreSQL
 * and never silently fall back to in-memory storage. Local/demo/test preserve the
 * explicit in-memory path for unit tests and DB-less development.
 */
@Module({
  imports: [PostgresModule],
  controllers: [PilotLoopController, FeedbackTelemetryController],
  providers: [
    FeedbackService,
    TelemetryService,
    { provide: FEEDBACK_SERVICE, useExisting: FeedbackService },
    { provide: TELEMETRY_SERVICE, useExisting: TelemetryService },
    {
      provide: DURABILITY,
      useFactory: () => ({ durable: resolvePilotStoreMode() === 'postgres' }),
    },
    AuthService,
    RbacService,
    { provide: AUTH_CONTEXT_RESOLVER, useExisting: AuthService },
    { provide: LEAD_ACCESS_POLICY, useExisting: RbacService },
    AuditStore,
    ManualAdapter,
    {
      provide: PILOT_STORE,
      inject: [PgPilotStore, InMemoryPilotStore],
      useFactory: (pg: PgPilotStore, mem: InMemoryPilotStore): PilotLoopStore =>
        resolvePilotStoreMode() === 'postgres' ? pg : mem,
    },
    PgPilotStore,
    InMemoryPilotStore,
    {
      provide: PilotLoopService,
      inject: [PILOT_STORE, ManualAdapter],
      useFactory: (store: PilotLoopStore, adapter: ManualAdapter) => new PilotLoopService(store, adapter),
    },
  ],
})
export class PilotLoopModule {}
