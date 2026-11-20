import { Module } from '@nestjs/common';
import { PilotLoopController } from '../api/pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { AUTH_CONTEXT_RESOLVER } from '../ports/auth';
import { LEAD_ACCESS_POLICY, type LeadAccessPolicy } from '../ports/rbac';
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
import { TELEMETRY_SERVICE, LEARNING_TELEMETRY_SERVICE } from '../ports/telemetry';
import { LearningController } from '../api/learning.controller';
import { PilotClosureController } from '../api/pilot-closure.controller';
import { PilotClosureService } from '../application/pilot/pilot-closure.service';
import { MEMBERSHIP_STORE, type MembershipStore } from '../ports/auth';
import { PILOT_ASSIGNEE_DIRECTORY, type PilotAssigneeDirectory } from '../ports/pilot-closure';
import { contentDigester } from '../ports/content-digester-runtime';
import { LeadExportController } from '../api/lead-export.controller';
import { LEAD_EXPORT_STORE, LeadExportError, type LeadExportStore } from '../ports/lead-export';
import { PgLeadExportStore } from '../infra/postgres/pg-lead-export.store';
import { PostgresService } from '../infra/postgres/postgres.service';
import { DURABILITY } from '../ports/durability';
import { DataLifecycleController } from '../api/data-lifecycle.controller';
import { DATA_LIFECYCLE_STORE, DataLifecycleError, type DataLifecycleStore } from '../ports/data-lifecycle';
import { PgDataLifecycleStore } from '../infra/data-lifecycle/pg-data-lifecycle.store';
import { ContactAttemptController } from '../api/contact-attempt.controller';
import { ContactAttemptService } from '../application/pilot/contact-attempt.service';
import { CONTACT_ATTEMPT_STORE, type ContactAttemptStore } from '../ports/contact-attempt';
import { PgContactAttemptStore } from '../infra/postgres/pg-contact-attempt.store';
import { InMemoryContactAttemptStore } from '../infra/pilot/in-memory-contact-attempt.store';
import { AssertionDeliveryController } from '../api/assertion-delivery.controller';
import { AssertionDeliveryOps } from '../infra/governed-action/assertion-delivery.ops';
import { ASSERTION_DELIVERY_OPS } from '../ports/assertion-delivery-ops';
import { ManagerExceptionsController } from '../api/manager-exceptions.controller';
import { ManagerExceptionsService } from '../application/pilot/manager-exceptions.service';
import { PgManagerExceptionsReader } from '../infra/postgres/pg-manager-exceptions';
import { ManagerExceptionsUnavailable } from '../ports/manager-exceptions';
import { SYNTHETIC_PILOT_MODE } from '../ports/pilot-mode';
import { syntheticPilotOnly } from '../infra/pilot/synthetic-pilot-mode';
import { SourceIntegrationService } from '../application/source-integration/source-integration.service';
import { PgSourceIntegrationStore } from '../infra/source-integration/pg-source-integration.store';
import { SourceIntegrationError, type SourceIntegrationStore } from '../ports/source-observation';
import { SOURCE_SYNTHETIC_MODE } from '../ports/source-fixture-decoder';
import { syntheticSourceMode } from '../infra/source-integration/synthetic-source-mode';
import { requirePilotLeadAccess } from '../application/pilot/lead-access';
import type { LeadId } from '../domain/lead/lead';

/**
 * P0 pilot loop module (PH3 T3-03/T3-04 wiring + education B2C candidate flow).
 *
 * Production/pilot store selection is fail-closed: those modes require PostgreSQL
 * and never silently fall back to in-memory storage. Local/demo/test preserve the
 * explicit in-memory path for unit tests and DB-less development.
 */
@Module({
  imports: [PostgresModule],
  controllers: [PilotLoopController, PilotClosureController, FeedbackTelemetryController, LearningController, LeadExportController, DataLifecycleController, ContactAttemptController, AssertionDeliveryController, ManagerExceptionsController],
  providers: [
    { provide: SOURCE_SYNTHETIC_MODE, useFactory: () => syntheticSourceMode() },
    { provide: SourceIntegrationService, inject: [PostgresService, PilotLoopService, LEAD_ACCESS_POLICY, SOURCE_SYNTHETIC_MODE],
      useFactory: (db: PostgresService, loop: PilotLoopService, policy: LeadAccessPolicy, enabled: boolean) => {
        const unavailable = async (): Promise<never> => { throw new SourceIntegrationError('DURABLE_STORAGE_REQUIRED', 503); };
        const store: SourceIntegrationStore = resolvePilotStoreMode() === 'postgres' ? new PgSourceIntegrationStore(db) : {
          createConnection: unavailable, revokeConnection: unavailable, listConnections: unavailable, intake: unavailable, evidence: unavailable,
        };
        return new SourceIntegrationService(store, async (ctx, id) => {
          requirePilotLeadAccess(ctx, await loop.get(id as LeadId), policy);
        }, enabled);
      } },
    { provide: SYNTHETIC_PILOT_MODE, useFactory: () => syntheticPilotOnly() },
    { provide: ManagerExceptionsService, inject: [PostgresService], useFactory: (db: PostgresService) =>
      new ManagerExceptionsService(resolvePilotStoreMode() === 'postgres' ? new PgManagerExceptionsReader(db) : {
        scan: async () => { throw new ManagerExceptionsUnavailable(); },
      }) },
    AssertionDeliveryOps,
    { provide: ASSERTION_DELIVERY_OPS, useExisting: AssertionDeliveryOps },
    { provide: CONTACT_ATTEMPT_STORE, inject: [PostgresService, PILOT_STORE],
      useFactory: (db: PostgresService, store: PilotLoopStore): ContactAttemptStore =>
        resolvePilotStoreMode() === 'postgres' ? new PgContactAttemptStore(db) : new InMemoryContactAttemptStore(store) },
    { provide: ContactAttemptService, inject: [PILOT_STORE, LEAD_ACCESS_POLICY, CONTACT_ATTEMPT_STORE],
      useFactory: (store: PilotLoopStore, policy: LeadAccessPolicy, attempts: ContactAttemptStore) =>
        new ContactAttemptService(store, policy, contentDigester(), attempts) },
    { provide: DATA_LIFECYCLE_STORE, inject: [PostgresService], useFactory: (db: PostgresService): DataLifecycleStore =>
      resolvePilotStoreMode() === 'postgres' ? new PgDataLifecycleStore(db) : {
        configure: async () => { throw new DataLifecycleError('DURABLE_STORAGE_REQUIRED', 503); },
        preview: async () => { throw new DataLifecycleError('DURABLE_STORAGE_REQUIRED', 503); },
      } },
    FeedbackService,
    TelemetryService,
    { provide: FEEDBACK_SERVICE, useExisting: FeedbackService },
    { provide: TELEMETRY_SERVICE, useExisting: TelemetryService },
    { provide: LEARNING_TELEMETRY_SERVICE, useExisting: TelemetryService },
    { provide: LEAD_EXPORT_STORE, inject: [PostgresService], useFactory: (db: PostgresService): LeadExportStore =>
      resolvePilotStoreMode() === 'postgres' ? new PgLeadExportStore(db) : {
        exportLead: async () => { throw new LeadExportError('DURABLE_STORAGE_REQUIRED', 503); },
      } },
    {
      provide: DURABILITY,
      useFactory: () => ({ durable: resolvePilotStoreMode() === 'postgres' }),
    },
    AuthService,
    RbacService,
    { provide: AUTH_CONTEXT_RESOLVER, useExisting: AuthService },
    { provide: LEAD_ACCESS_POLICY, useExisting: RbacService },
    { provide: PILOT_ASSIGNEE_DIRECTORY, inject: [MEMBERSHIP_STORE], useFactory: (memberships: MembershipStore): PilotAssigneeDirectory => ({
      list: async (workspaceId) => (await memberships.list(workspaceId, { status: 'active', limit: 500 }))
        .filter(member => member.status === 'active' && member.revokedAt === null && member.workspaceId === workspaceId)
        .map(member => ({ userId: member.userId, role: member.baseRole })),
    }) },
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
      inject: [PILOT_STORE, ManualAdapter, SYNTHETIC_PILOT_MODE],
      useFactory: (store: PilotLoopStore, adapter: ManualAdapter, syntheticOnly: boolean) => new PilotLoopService(store, adapter, syntheticOnly),
    },
    { provide: PilotClosureService, inject: [PILOT_STORE, LEAD_ACCESS_POLICY, PILOT_ASSIGNEE_DIRECTORY],
      useFactory: (store: PilotLoopStore, policy: LeadAccessPolicy, directory: PilotAssigneeDirectory) =>
        new PilotClosureService(store, policy, contentDigester(), directory) },
  ],
  // Shared with the integration controller so enrollment issuance uses the same resolver
  // (whatever AuthContextResolver this module binds, e.g. a future OIDC resolver).
  exports: [AUTH_CONTEXT_RESOLVER, SYNTHETIC_PILOT_MODE, SOURCE_SYNTHETIC_MODE, SourceIntegrationService],
})
export class PilotLoopModule {}
