import { parseMoney, type CapabilityDefinition } from './capability-catalog';
import type { ActionConstraints, JsonValue, ObservedState, TargetResource } from './governed-action.types';

export type ConstraintStage = 'propose' | 'authorize' | 'execute';

export interface ConstraintInput {
  readonly capability: CapabilityDefinition;
  readonly target: TargetResource;
  readonly arguments: JsonValue;
  readonly constraints: ActionConstraints;
  /** Observed baseline from preview; required for budget checks after the propose stage. */
  readonly beforeState?: ObservedState;
  readonly stage: ConstraintStage;
}

/**
 * Evaluate policy constraints. Missing information fails closed: a budget change whose
 * baseline is UNKNOWN cannot be proven to respect the delta limit, so it is refused (I-08).
 */
export function evaluateConstraints(input: ConstraintInput): string[] {
  const violations: string[] = [];
  if (input.constraints.protectedAccountIds.includes(input.target.accountId)) {
    violations.push(`PROTECTED_ACCOUNT: ${input.target.accountId}`);
  }
  if (input.capability.constraintKind === 'budget') violations.push(...budgetViolations(input));
  return violations;
}

function budgetViolations(input: ConstraintInput): string[] {
  const limit = input.constraints.maxBudgetDeltaPercent;
  if (limit === undefined || !Number.isFinite(limit) || limit < 0) return ['BUDGET_LIMIT_UNDEFINED'];
  const next = parseMoney(field(input.arguments, 'dailyBudget'));
  if (!next) return ['BUDGET_ARGUMENT_INVALID'];
  if (input.stage === 'propose') return [];
  const before = input.beforeState;
  if (!before || before.status !== 'OBSERVED') return ['BUDGET_BASELINE_UNKNOWN'];
  const baseline = parseMoney(field(before.value, 'dailyBudget'));
  if (!baseline) return ['BUDGET_BASELINE_UNKNOWN'];
  if (baseline.currency !== next.currency) return ['BUDGET_CURRENCY_MISMATCH'];
  if (baseline.amountMinor === 0n) return next.amountMinor === 0n ? [] : ['BUDGET_BASELINE_ZERO'];
  const delta = next.amountMinor > baseline.amountMinor
    ? next.amountMinor - baseline.amountMinor
    : baseline.amountMinor - next.amountMinor;
  // delta / baseline * 100 > limit, computed exactly in basis points of a percent.
  const limitHundredths = BigInt(Math.floor(limit * 100));
  return delta * 10_000n > limitHundredths * baseline.amountMinor ? ['BUDGET_DELTA_EXCEEDED'] : [];
}

function field(value: JsonValue | undefined, key: string): JsonValue | undefined {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return (value as { readonly [k: string]: JsonValue })[key];
}
