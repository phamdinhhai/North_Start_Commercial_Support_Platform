import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import { canonicalJson, deepFreeze } from '../../domain/governed-action/canonical-json';
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
 * Records observed assertions in memory, idempotent on `(workspaceId, assertionId)` and
 * rejecting conflicting payloads under the same key (`ENVELOPE_CONFLICT`). Tests and synthetic
 * runs only; durable delivery uses `PgAssertionDelivery` + `PgAssertionInbox`.
 */
export class InMemoryAssertionSink implements AssertionSink {
  private readonly byKey = new Map<string, { readonly canonical: string; readonly envelope: AssertionEnvelope }>();
  async emit(envelope: AssertionEnvelope): Promise<void> {
    if (envelope.acquisitionMode === ('inferred' as string)) throw new Error('an AssertionSink accepts non-inferred assertions only (ADR-005)');
    const k = `${envelope.workspaceId}\u0000${envelope.assertionId}`;
    const canonical = canonicalJson(envelope as unknown as Record<string, unknown>);
    const existing = this.byKey.get(k);
    if (existing) {
      if (existing.canonical !== canonical) throw new Error('ENVELOPE_CONFLICT');
      return;
    }
    this.byKey.set(k, { canonical, envelope: deepFreeze(structuredClone(envelope)) });
  }
  get envelopes(): AssertionEnvelope[] {
    return [...this.byKey.values()].map((entry) => entry.envelope);
  }
}
