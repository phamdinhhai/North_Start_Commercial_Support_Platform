import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import { deepFreeze } from '../../domain/governed-action/canonical-json';
import type { CommercialEventFacts } from '../../domain/governed-action/governed-action.types';
import type { AssertionSink, CommercialEventLookup } from '../../ports/governed-action';

/**
 * ADR-005 adapters that need no database: a static CommercialEvent lookup (tests / synthetic
 * runs; the PostgreSQL one is PgCommercialEventLookup) and an in-memory assertion sink.
 */

/** Knows nothing: every AI proposal is refused with EVIDENCE_REQUIRED (fail closed). */
export class NoCommercialEventLookup implements CommercialEventLookup {
  async find(): Promise<CommercialEventFacts | undefined> { return undefined; }
}

/** Fixed set of CommercialEvent facts, workspace scoped (a foreign id is simply not found). */
export class StaticCommercialEventLookup implements CommercialEventLookup {
  private readonly facts = new Map<string, CommercialEventFacts>();
  constructor(events: readonly CommercialEventFacts[] = []) {
    for (const e of events) this.facts.set(`${e.workspaceId}\u0000${e.id.toLowerCase()}`, deepFreeze(structuredClone(e)));
  }
  async find(workspaceId: string, commercialEventId: string): Promise<CommercialEventFacts | undefined> {
    return this.facts.get(`${workspaceId}\u0000${String(commercialEventId).toLowerCase()}`);
  }
}

/**
 * Records observed assertions in memory, idempotent on `assertionId`. Tests and synthetic runs
 * only; a durable sink belongs to the assertion store (see report limitations).
 */
export class InMemoryAssertionSink implements AssertionSink {
  private readonly byId = new Map<string, AssertionEnvelope>();
  async emit(envelope: AssertionEnvelope): Promise<void> {
    if (envelope.acquisitionMode === ('inferred' as string)) throw new Error('an AssertionSink accepts non-inferred assertions only (ADR-005)');
    if (!this.byId.has(envelope.assertionId)) this.byId.set(envelope.assertionId, deepFreeze(structuredClone(envelope)));
  }
  get envelopes(): AssertionEnvelope[] {
    return [...this.byId.values()];
  }
}
