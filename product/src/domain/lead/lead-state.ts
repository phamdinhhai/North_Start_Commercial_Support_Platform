import type { Lead, LeadStatus } from './lead';

// OPEN: CE-1 — see ADR-001 — interim: New→Accepted→Contacting→Follow-up→Won/Lost+Unknown
// Hypothesis state machine — NOT frozen. Abort if transition exceeds frozen boundary.

/** Valid transitions for the LVP hypothesis state machine (CE-1 interim, ADR-001). */
export const VALID_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  New: ['Accepted', 'Unknown'],
  Accepted: ['Contacting', 'Unknown'],
  Contacting: ['Follow-up', 'Unknown'],
  'Follow-up': ['Won', 'Lost', 'Unknown'],
  Won: ['Unknown', 'Lost', 'Follow-up'], // reversible via correction (I-05)
  Lost: ['Unknown', 'Won', 'Follow-up'], // reversible via correction (I-05)
  Unknown: ['Unknown', 'New', 'Accepted', 'Contacting', 'Follow-up', 'Won', 'Lost'], // Unknown sticky (I-08)
} as const;

/** A recorded state transition — append-audited (I-05). */
export interface LeadTransition {
  readonly leadId: string;
  readonly workspaceId: string;
  readonly from: LeadStatus;
  readonly to: LeadStatus;
  readonly actor: string;
  readonly reason: string;
  readonly timestamp: string;
}

/** Input for transitionLead — typed public API boundary. */
export interface TransitionLeadInput {
  readonly actor: string;
  readonly reason: string;
  readonly to: LeadStatus;
}

/** Returns true if `to` is a valid next state from `from`. */
export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return (VALID_TRANSITIONS[from] as readonly string[]).includes(to);
}

/**
 * Transition a Lead to a new status.
 * Returns a new Lead (immutable) and an append-audited transition record (I-05).
 * Throws if the transition exceeds the frozen boundary (CE-1 interim).
 */
export function transitionLead(
  lead: Lead,
  input: TransitionLeadInput,
): { lead: Lead; transition: LeadTransition } {
  if (!canTransition(lead.status, input.to)) {
    throw new Error(
      `Invalid transition: ${lead.status} → ${input.to} — exceeds frozen boundary (OPEN: CE-1 — see ADR-001)`,
    );
  }
  if (!input.actor) throw new Error('actor is required');
  if (!input.reason) throw new Error('reason is required');

  const timestamp = new Date().toISOString();
  const nextLead: Lead = { ...lead, status: input.to };
  const transition: LeadTransition = {
    leadId: lead.id,
    workspaceId: lead.workspaceId,
    from: lead.status,
    to: input.to,
    actor: input.actor,
    reason: input.reason,
    timestamp,
  };
  return { lead: nextLead, transition };
}
