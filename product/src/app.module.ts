import { IntegrationController } from './api/integration.controller';
import { IntegrationIntake } from './application/integration/intake';
import { PgIntegrationStore } from './infra/integration/pg-integration.store';
import { PostgresService } from './infra/postgres/postgres.service';
import { Inject, Module, type NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import type { FastifyAdapter } from '@nestjs/platform-fastify';
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
import { ConnectorHealthController } from './api/connector-health.controller';
import { ConnectorHealthQuery } from './application/observability/connector-health';
import { JsonLogger } from './infra/observability/json-logger';
import { HttpMetrics } from './infra/observability/http-metrics';
import { MetricsReporter, RequestContextInterceptor, registerHttpObservability, type HookHost } from './infra/observability/http-observability';
import { PgConnectorHealthReader } from './infra/observability/pg-connector-health.reader';
import { AlsRequestAnnotator } from './infra/observability/request-context';
import { CONNECTOR_HEALTH_READER, type ConnectorHealthReader } from './ports/connector-health';
import { REQUEST_ANNOTATOR } from './ports/request-context';
import { OidcAuthModule } from './infra/auth/oidc-auth.module';
import { MembershipController } from './api/membership.controller';
import { BrowserSessionController } from './api/browser-session.controller';
import { AssertionDeliveryRunner } from './infra/governed-action/assertion-delivery.runner';
import { SourceIntegrationController } from './api/source-integration.controller';
import { SourceIntegrationService } from './application/source-integration/source-integration.service';
import { SourceFixtureIntake } from './application/source-integration/fixture-intake';
import { SOURCE_FIXTURE_DECODER, type SourceFixtureDecoder } from './ports/source-fixture-decoder';
import { decodePancakeSynthetic, PANCAKE_SYNTHETIC_FIXTURE } from './adapters/pancake-synthetic/pancake-synthetic';
import { decodeMetaSynthetic, META_SYNTHETIC_FIXTURE } from './adapters/meta-synthetic/meta-page-fixture';
import { SourceContinuityController } from './api/source-continuity.controller';
import { OperatorSyncHealthController } from './api/operator-sync-health.controller';
import { OperatorSyncHealthQuery } from './application/operator-sync-health';
import { PgOperatorSyncHealthReader } from './infra/observability/pg-operator-sync-health.reader';
import { PgSyncCheckpointStore } from './infra/sync/pg-sync-checkpoint.store';
import { admitSyncObservation } from './application/durable-sync/admission';
import { SOURCE_SYNTHETIC_MODE } from './ports/source-fixture-decoder';
import { SourceIntegrationError } from './ports/source-observation';

/** Composition root for the manual pilot loop and health delivery. */
@Module({
  imports: [HealthModule, PilotLoopModule, OidcAuthModule],
  controllers: [OperatorClientController, IntegrationController, ConnectorHealthController, MembershipController, BrowserSessionController, SourceIntegrationController, SourceContinuityController, OperatorSyncHealthController],
  providers: [
    {provide:OperatorSyncHealthQuery,inject:[PostgresService,SOURCE_SYNTHETIC_MODE],useFactory:(db:PostgresService,enabled:boolean)=>
      new OperatorSyncHealthQuery(new PgOperatorSyncHealthReader(db),new PgSyncCheckpointStore(db,admitSyncObservation,async()=>{throw new SourceIntegrationError('WORKER_NOT_CONFIGURED',403);}),enabled)},
    { provide: SOURCE_FIXTURE_DECODER, useValue: {
      decode: (provider, input) => provider === 'pancake' ? decodePancakeSynthetic(input) : decodeMetaSynthetic(input),
      example: provider => structuredClone(provider === 'pancake' ? PANCAKE_SYNTHETIC_FIXTURE : META_SYNTHETIC_FIXTURE),
    } satisfies SourceFixtureDecoder },
    { provide: SourceFixtureIntake, inject: [SourceIntegrationService, SOURCE_FIXTURE_DECODER],
      useFactory: (service: SourceIntegrationService, decoder: SourceFixtureDecoder) => new SourceFixtureIntake(service, decoder) },
    AssertionDeliveryRunner,
    { provide: IntegrationIntake, inject: [PostgresService], useFactory: (db: PostgresService) => new IntegrationIntake(new PgIntegrationStore(db)) },
    // Observability (operational telemetry only; never commercial evidence).
    { provide: JsonLogger, useFactory: () => new JsonLogger() },
    HttpMetrics,
    { provide: MetricsReporter, inject: [JsonLogger, HttpMetrics], useFactory: (logger: JsonLogger, metrics: HttpMetrics) => new MetricsReporter(logger, metrics) },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: REQUEST_ANNOTATOR, useClass: AlsRequestAnnotator },
    { provide: CONNECTOR_HEALTH_READER, inject: [PostgresService], useFactory: (db: PostgresService) => new PgConnectorHealthReader(db) },
    { provide: ConnectorHealthQuery, inject: [CONNECTOR_HEALTH_READER], useFactory: (reader: ConnectorHealthReader) => new ConnectorHealthQuery(reader) },
  ],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost<FastifyAdapter>,
    @Inject(JsonLogger) private readonly logger: JsonLogger,
    @Inject(HttpMetrics) private readonly metrics: HttpMetrics,
    @Inject(MetricsReporter) private readonly reporter: MetricsReporter,
  ) {}

  configure(): void {
    // Nest RouteConfig is custom metadata; Fastify only enforces its top-level
    // bodyLimit. Register before route discovery, including test applications.
    this.adapterHost.httpAdapter.getInstance().addHook('onRoute', (route) => {
      const config = route.config as { bodyLimit?: number } | undefined;
      if (config?.bodyLimit === 8192) route.bodyLimit = 8192;
    });
    // Correlation IDs, structured access log and bounded counters (infra/observability).
    registerHttpObservability(this.adapterHost.httpAdapter.getInstance() as unknown as HookHost, this.logger, this.metrics);
    this.reporter.start(MetricsReporter.intervalFrom(process.env.OBS_METRICS_LOG_INTERVAL_MS));
  }
}
