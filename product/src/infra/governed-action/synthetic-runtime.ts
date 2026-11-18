import type { ActionStore } from '../../ports/governed-action';
import { StaticActionPolicy, StaticCapabilityEnablement, StaticKillSwitch, type StaticActionPolicyConfig } from './defaults';
import { InMemoryActionStore } from './in-memory-action.store';
import { SyntheticExecutor, SyntheticProviderLedger, SyntheticVerifier } from './synthetic-executor';

export interface SyntheticRuntimeOptions {
  readonly enabled: readonly { workspaceId: string; capabilityId: string }[];
  readonly policy: StaticActionPolicyConfig;
  readonly clock: () => Date;
  readonly killSwitchEngaged?: boolean;
  readonly store?: ActionStore;
}

/**
 * Wire the governed-action ports to SYNTHETIC doubles only (tests, local demos).
 * There is no live counterpart: provider writes are impossible from this composition.
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
  };
}
