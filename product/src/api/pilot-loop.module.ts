import { Module } from '@nestjs/common';
import { PilotLoopController } from './pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../modules/pilot-loop/pilot-loop.service';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import { AuditStore } from '../infra/audit/audit-store';
import { PostgresModule } from '../infra/postgres/postgres.module';
import { PgPilotStore } from '../modules/pilot-loop/pg-pilot.store';
import { InMemoryPilotStore, PILOT_STORE, type PilotLoopStore } from '../modules/pilot-loop/pilot.store';

/**
 * P0 pilot loop module (PH3 T3-03/T3-04 wiring + education B2C candidate flow).
 *
 * Store selection is DURABILITY-BY-DEFAULT: when a Postgres connection is
 * configured (DATABASE_URL present) the PgPilotStore is used — lead, handoff,
 * work items, outcomes and audit persist atomically (QA-35) and survive process
 * restart (proven by scripts/pilot-smoke.sh restart step). Only with no DB
 * configured does it fall back to the in-memory store, which is explicitly NOT
 * durable and exists for unit tests / DB-less demo.
 */
@Module({
  imports: [PostgresModule],
  controllers: [PilotLoopController],
  providers: [
    AuthService,
    RbacService,
    AuditStore,
    ManualAdapter,
    {
      provide: PILOT_STORE,
      inject: [PgPilotStore, InMemoryPilotStore],
      useFactory: (pg: PgPilotStore, mem: InMemoryPilotStore): PilotLoopStore =>
        process.env.DATABASE_URL ? pg : mem,
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
