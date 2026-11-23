import { canonicalJson } from '../../domain/governed-action/canonical-json';
import type { JsonValue, ObservedState, Verification } from '../../domain/governed-action/governed-action.types';
import type { ActionExecutionResult, ActionExecutor, ActionRequest, ActionVerifier } from '../../ports/governed-action';

/**
 * SYNTHETIC provider double. It mutates only an in-process map; it performs no network
 * I/O, holds no credentials and has no provider SDK. Every observation is tagged
 * `synthetic: true` and must never be presented as customer/provider evidence (I-12).
 */
export class SyntheticProviderLedger {
  private readonly resources = new Map<string, { [key: string]: JsonValue }>();
  private readonly applied = new Map<string, string>();

  static resourceKey(r: Pick<ActionRequest, 'workspaceId' | 'target'>): string {
    return [r.workspaceId, r.target.provider, r.target.accountId, r.target.resourceType, r.target.resourceId].join('\u0000');
  }

  seed(r: Pick<ActionRequest, 'workspaceId' | 'target'>, state: { [key: string]: JsonValue }): void {
    this.resources.set(SyntheticProviderLedger.resourceKey(r), structuredClone(state));
  }

  state(r: Pick<ActionRequest, 'workspaceId' | 'target'>): { [key: string]: JsonValue } | undefined {
    const s = this.resources.get(SyntheticProviderLedger.resourceKey(r));
    return s ? structuredClone(s) : undefined;
  }

  /** Idempotent apply keyed by idempotencyKey: a repeated key never re-applies. */
  apply(r: ActionRequest): { reference: string; deduplicated: boolean } {
    const existing = this.applied.get(r.idempotencyKey);
    if (existing) return { reference: existing, deduplicated: true };
    const k = SyntheticProviderLedger.resourceKey(r);
    const args = (r.arguments && typeof r.arguments === 'object' && !Array.isArray(r.arguments)) ? r.arguments as { [key: string]: JsonValue } : {};
    this.resources.set(k, { ...(this.resources.get(k) ?? {}), ...structuredClone(args) });
    const reference = `synthetic-op-${this.applied.size + 1}`;
    this.applied.set(r.idempotencyKey, reference);
    return { reference, deduplicated: false };
  }

  wasApplied(idempotencyKey: string): string | undefined {
    return this.applied.get(idempotencyKey);
  }

  appliedCount(): number {
    return this.applied.size;
  }
}

export type SyntheticBehaviour =
  | 'apply'               // applies, reports APPLIED
  | 'reject'              // does not apply, reports NOT_APPLIED
  | 'hang'                // does not apply, never answers (runtime timeout ⇒ UNKNOWN)
  | 'apply-then-hang'     // applies, never answers (effect happened, outcome UNKNOWN)
  | 'throw';              // does not apply, throws

export class SyntheticExecutor implements ActionExecutor {
  readonly mode = 'synthetic' as const;
  readonly calls: ActionRequest[] = [];
  constructor(private readonly ledger: SyntheticProviderLedger, public behaviour: SyntheticBehaviour = 'apply') {}

  async execute(request: ActionRequest, signal: AbortSignal): Promise<ActionExecutionResult> {
    this.calls.push(request);
    switch (this.behaviour) {
      case 'apply': {
        const r = this.ledger.apply(request);
        return { status: 'APPLIED', providerReference: r.reference, reason: r.deduplicated ? 'SYNTHETIC_DEDUPLICATED' : 'SYNTHETIC_APPLIED' };
      }
      case 'reject':
        return { status: 'NOT_APPLIED', reason: 'SYNTHETIC_REJECTED' };
      case 'apply-then-hang':
        this.ledger.apply(request);
        return hang(signal);
      case 'hang':
        return hang(signal);
      case 'throw':
        throw new Error('synthetic transport failure');
    }
  }
}

function hang(signal: AbortSignal): Promise<never> {
  return new Promise((_, rejectPromise) => {
    signal.addEventListener('abort', () => rejectPromise(new Error('aborted')), { once: true });
  });
}

/** Readback against the synthetic ledger. `forceUnknown` simulates an unavailable provider read. */
export class SyntheticVerifier implements ActionVerifier {
  forceUnknown = false;
  readonly readbacks: ActionRequest[] = [];
  constructor(private readonly ledger: SyntheticProviderLedger, private readonly clock: () => Date = () => new Date()) {}

  async readCurrentState(request: Omit<ActionRequest, 'attempt'>): Promise<ObservedState> {
    if (this.forceUnknown) return { status: 'UNKNOWN', reason: 'SYNTHETIC_READ_UNAVAILABLE' };
    const s = this.ledger.state(request);
    return s ? { status: 'OBSERVED', value: s, synthetic: true } : { status: 'UNKNOWN', reason: 'SYNTHETIC_RESOURCE_NOT_SEEDED' };
  }

  async readback(request: ActionRequest): Promise<Verification> {
    this.readbacks.push(request);
    const observedAt = this.clock().toISOString();
    if (this.forceUnknown) return { observation: 'UNKNOWN', evidence: { synthetic: true }, observedAt, reason: 'SYNTHETIC_READ_UNAVAILABLE' };
    const reference = this.ledger.wasApplied(request.idempotencyKey);
    if (!reference) {
      return { observation: 'NOT_EXECUTED', evidence: { synthetic: true, idempotencyKey: request.idempotencyKey }, observedAt, reason: 'SYNTHETIC_NO_OPERATION_FOUND' };
    }
    const state = this.ledger.state(request) ?? {};
    const args = request.arguments as { [key: string]: JsonValue };
    const matches = Object.keys(args).every((k) => k in state && canonicalJson(state[k]) === canonicalJson(args[k]));
    return matches
      ? { observation: 'EXECUTED', evidence: { synthetic: true, reference }, observedAt, reason: 'SYNTHETIC_STATE_MATCHES' }
      : { observation: 'UNKNOWN', evidence: { synthetic: true, reference }, observedAt, reason: 'SYNTHETIC_STATE_DIVERGED' };
  }
}
