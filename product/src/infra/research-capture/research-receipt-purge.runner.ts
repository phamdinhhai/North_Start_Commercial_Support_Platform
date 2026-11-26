import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { EncryptedResearchReceiptStore, ResearchPurgeSummary } from '../../ports/research-receipt.port';
import { researchCaptureStorageEnabled } from './pg-research-receipt.store';

export const RESEARCH_RECEIPT_STORE = Symbol('RESEARCH_RECEIPT_STORE');

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 100;
const MAX_INTERVAL_MS = 86_400_000;

export function resolvePurgeIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.RESEARCH_CAPTURE_PURGE_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_INTERVAL_MS || parsed > MAX_INTERVAL_MS) {
    throw new Error('INVALID_RESEARCH_CAPTURE_PURGE_INTERVAL');
  }
  return parsed;
}

/**
 * Automatic bounded purge runner for R3 A-04 research-capture receipts.
 * Disabled by default (`RESEARCH_CAPTURE_STORAGE_ENABLED=true` required in local/test only).
 * Uses non-overlapping ticks (`inFlight` guard) and bounded batch draining so restarts and
 * concurrent runner instances safely reclaim expired ciphertexts without duplicate audits.
 */
@Injectable()
export class ResearchReceiptPurgeRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<ResearchPurgeSummary>;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly logger = new Logger(ResearchReceiptPurgeRunner.name);

  constructor(
    @Optional() @Inject(RESEARCH_RECEIPT_STORE) private readonly store?: EncryptedResearchReceiptStore,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.enabled = researchCaptureStorageEnabled(env) && Boolean(store);
    this.intervalMs = resolvePurgeIntervalMs(env);
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.timer.unref();
  }

  /** Run a bounded automatic purge pass immediately (also callable in tests or recovery). */
  runOnce(batchLimit = 50): Promise<ResearchPurgeSummary> {
    if (!this.enabled || !this.store) {
      return Promise.resolve({ purgedCount: 0, remainingExpiredCount: 0 });
    }
    if (this.inFlight) return this.inFlight;
    const pass = this.store.purgeExpired('system:research-purge-runner', batchLimit)
      .catch((err) => {
        this.logger.error('RESEARCH_CAPTURE_PURGE_FAILED');
        throw err;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    this.inFlight = pass;
    return pass;
  }

  private tick(): void {
    void this.runOnce().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.inFlight) {
      await this.inFlight.catch(() => undefined);
    }
  }
}
