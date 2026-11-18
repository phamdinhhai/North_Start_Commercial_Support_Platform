import type { CapabilityCatalog } from '../../domain/governed-action/capability-catalog';
import type { ActionActor, ActionPrincipal, CommercialEventFacts } from '../../domain/governed-action/governed-action.types';
import { SYNTHETIC_CAPABILITY_CATALOG } from '../../domain/governed-action/testing/synthetic-capabilities.fixture';
import type { ActionStore, ActorResolver } from '../../ports/governed-action';
import {
  StaticActionPolicy, StaticActorResolver, StaticCapabilityEnablement, StaticKillSwitch, type StaticActionPolicyConfig,
} from './defaults';
import { InMemoryAssertionSink, StaticCommercialEventLookup } from './commercial-evidence';
import { InMemoryActionStore } from './in-memory-action.store';
import { SyntheticExecutor, SyntheticProviderLedger, SyntheticVerifier } from './synthetic-executor';

export interface SyntheticRuntimeOptions {
  readonly enabled: readonly { workspaceId: string; capabilityId: string }[];
  readonly policy: StaticActionPolicyConfig;
  readonly clock: () => Date;
  readonly killSwitchEngaged?: boolean;
  readonly store?: ActionStore;
  /**
   * Server-side actor directory (A-m2). When omitted, every principal of an enabled workspace
   * resolves as `human` — a SYNTHETIC convenience only; tests that exercise actor kinds must
   * pass an explicit directory.
   */
  readonly actors?: readonly ActionActor[];
  /** Defaults to the synthetic TEST catalog (research examples). Never the production catalog. */
  readonly catalog?: CapabilityCatalog;
  /** CommercialEvent facts an AI proposal may cite (ADR-005 R2-P-01). Default: none. */
  readonly commercialEvents?: readonly CommercialEventFacts[];
}

/**
 * Wire the governed-action ports to SYNTHETIC doubles only (tests, local demos).
 * There is no live counterpart: provider writes are impossible from this composition, and
 * production code must not import this module (guarded by governed-action.infra.spec.ts).
 */
export function createSyntheticActionPorts(options: SyntheticRuntimeOptions) {
  const ledger = new SyntheticProviderLedger();
  return {
    ledger,
    store: options.store ?? new InMemoryActionStore(),
    executor: new SyntheticExecutor(ledger),
    verifier: new SyntheticVerifier(ledger, options.clock),
    killSwitch: new StaticKillSwitch({ globalEngaged: options.killSwitchEngaged ?? false }),
    enablement: new StaticCapabilityEnablement(options.enabled),
    policy: new StaticActionPolicy(options.policy),
    actors: options.actors ? new StaticActorResolver(options.actors) : syntheticHumans(options.enabled.map((e) => e.workspaceId)),
    catalog: options.catalog ?? SYNTHETIC_CAPABILITY_CATALOG,
    commercialEvents: new StaticCommercialEventLookup(options.commercialEvents ?? []),
    assertions: new InMemoryAssertionSink(),
  };
}

function syntheticHumans(workspaceIds: readonly string[]): ActorResolver {
  const workspaces = new Set(workspaceIds);
  return {
    resolve: async (p: ActionPrincipal) => workspaces.has(p.workspaceId) ? { kind: 'human', id: p.id, workspaceId: p.workspaceId } : undefined,
  };
}
