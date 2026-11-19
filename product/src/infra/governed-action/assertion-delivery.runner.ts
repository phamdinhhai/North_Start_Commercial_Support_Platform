import { Inject, Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PostgresService, resolveDeploymentMode, resolvePilotStoreMode } from '../postgres/postgres.service';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';

export function deliveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.ASSERTION_DELIVERY_ENABLED ?? '';
  if (!['', 'false', 'true'].includes(raw)) throw new Error('INVALID_ASSERTION_DELIVERY_ENABLED');
  if (raw !== 'true') return false;
  if (env.NODE_ENV === 'production' || !['local', 'test'].includes(resolveDeploymentMode(env)) || resolvePilotStoreMode(env) !== 'postgres') {
    throw new Error('ASSERTION_DELIVERY_RESEARCH_ONLY');
  }
  return true;
}
/** Non-overlapping internal scheduler; disabled foundations remain disabled by default. */
@Injectable()
export class AssertionDeliveryRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  private readonly worker: PgAssertionDelivery;
  private readonly enabled: boolean;
  private readonly logger = new Logger(AssertionDeliveryRunner.name);
  constructor(@Inject(PostgresService) db: PostgresService) {
    this.enabled = deliveryEnabled();
    this.worker = new PgAssertionDelivery(db, new PgAssertionInbox(db));
  }
  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
  }
  private tick() {
    if (this.inFlight) return;
    this.inFlight = this.worker.runOnce().then(() => undefined).catch(() => {
      // Fixed categorical operational event only; the lease/outbox retains recovery state.
      this.logger.error('ASSERTION_DELIVERY_UNAVAILABLE');
    }).finally(() => { this.inFlight = undefined; });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
