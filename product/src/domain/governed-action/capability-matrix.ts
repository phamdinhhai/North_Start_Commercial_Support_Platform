import { riskTierOf } from './capability-catalog';
import type { RiskClass } from './governed-action.types';

/**
 * ADR-006 (resolves PM-1) — governed-action rows of the capability matrix, as pure data.
 * Base roles only (no new roles); deny-by-default; I-09 lead scope is checked separately by the
 * lead-scope hook and is never widened here.
 *
 * | Capability                                | admin | manager | sales              | viewer             |
 * |-------------------------------------------|-------|---------|--------------------|--------------------|
 * | propose                                   | ✓     | ✓       | lead-linked only¹  | —                  |
 * | authorize / execute / verify — risk LOW   | ✓     | ✓       | —                  | —                  |
 * | authorize / execute / verify — risk HIGH² | ✓     | —       | —                  | —                  |
 * | read (get / history / refusals)           | ✓     | ✓       | lead-linked only¹  | lead-linked only¹  |
 * | housekeeping (expire / recover)           | ✓     | ✓       | —                  | —                  |
 * | kill switch                               | ✓     | —       | —                  | —                  |
 *
 * ¹ and only when the lead-scope hook (RBAC canAccessLead: assigned or active recipient) allows.
 * ² every class other than LOW (MEDIUM/HIGH/CRITICAL) is the high tier (fail closed).
 * AI principals may only draft (ADR-005: draft + CE ref); service principals get nothing here.
 * Separation of duties (approver ≠ proposer) and approval expiry are enforced by the lifecycle.
 */
export type BaseRole = 'admin' | 'manager' | 'sales' | 'viewer';
export type MatrixCommand = 'propose' | 'authorize' | 'execute' | 'read' | 'housekeep' | 'kill_switch';

const BASE_ROLES: readonly BaseRole[] = Object.freeze(['admin', 'manager', 'sales', 'viewer']);
export const isBaseRole = (value: unknown): value is BaseRole => BASE_ROLES.includes(value as BaseRole);

export interface MatrixQuery {
  readonly role: BaseRole;
  readonly command: MatrixCommand;
  /** Required for authorize/execute; ignored otherwise. */
  readonly riskClass?: RiskClass;
  /** Whether the proposal/command is linked to a lead (the hook then decides scope). */
  readonly leadLinked: boolean;
}

/** Result of the role row: `lead_scoped` means "allowed only if the lead-scope hook allows". */
export type MatrixVerdict = 'allow' | 'lead_scoped' | 'deny';

export function matrixVerdict(q: MatrixQuery): MatrixVerdict {
  if (!isBaseRole(q.role)) return 'deny';
  const privileged = q.role === 'admin' || q.role === 'manager';
  switch (q.command) {
    case 'propose':
      if (privileged) return 'allow';
      return q.role === 'sales' && q.leadLinked ? 'lead_scoped' : 'deny';
    case 'authorize':
    case 'execute':
      if (!q.riskClass) return 'deny';
      if (riskTierOf(q.riskClass) === 'low') return privileged ? 'allow' : 'deny';
      return q.role === 'admin' ? 'allow' : 'deny';
    case 'read':
      if (privileged) return 'allow';
      return q.leadLinked ? 'lead_scoped' : 'deny';
    case 'housekeep':
      return privileged ? 'allow' : 'deny';
    case 'kill_switch':
      return q.role === 'admin' ? 'allow' : 'deny';
    default:
      return 'deny';
  }
}
