import { randomUUID } from 'node:crypto';
import type { LeadId } from '../lead/lead';

// OPEN: CE-1 — outcome affects lead state transition to Won/Lost/Unknown

/** Outcome ID — stable, immutable. */
export type OutcomeId = string & { readonly __brand: 'OutcomeId' };

/** Outcome value — Won/Lost/Unknown. UNKNOWN is valid, never null (I-08, R-15). */
export type OutcomeValue = 'Won' | 'Lost' | 'Unknown';

/** How the outcome was obtained (R-15, COMMERCIAL_EVENT_MODEL §7). */
export type OutcomeAcquisitionMode = 'user_confirmed' | 'inferred' | 'observed' | 'claimed';

/**
 * Minimal Outcome — R-15.
 * Each user claim unless corroborated. UNKNOWN is valid (I-08).
 * Corrections append new assertions (I-05) — no overwrite.
 */
export interface Outcome {
  readonly id: OutcomeId;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly value: OutcomeValue;
  readonly acquisitionMode: OutcomeAcquisitionMode;
  readonly assertionStatus: 'claimed' | 'corroborated';
  readonly actor: string;
  readonly timestamp: string;
  readonly reason?: string;
  /** If this outcome corrects a previous one (I-05 append, not overwrite). */
  readonly supersedesOutcomeId?: OutcomeId;
}

export interface CreateOutcomeInput {
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly value: OutcomeValue;
  readonly actor: string;
  readonly reason?: string;
  readonly acquisitionMode?: OutcomeAcquisitionMode;
}

export interface CorrectOutcomeInput {
  readonly newValue: OutcomeValue;
  readonly actor: string;
  readonly reason: string;
}

/**
 * Create an Outcome (R-15).
 * UNKNOWN is a valid state — never backfill with assumptions (I-08).
 */
export function createOutcome(input: CreateOutcomeInput): Outcome {
  if (!input.actor) throw new Error('actor is required');
  const now = new Date().toISOString();
  return {
    id: randomUUID() as OutcomeId,
    leadId: input.leadId,
    workspaceId: input.workspaceId,
    value: input.value,
    acquisitionMode: input.acquisitionMode ?? 'user_confirmed',
    assertionStatus: 'claimed',
    actor: input.actor,
    timestamp: now,
    ...(input.reason !== undefined && { reason: input.reason }),
  };
}

/**
 * Correct an outcome — append a new assertion (I-05).
 * The old outcome is NOT overwritten — both remain visible.
 */
export function correctOutcome(
  old: Outcome,
  input: CorrectOutcomeInput,
): Outcome {
  if (!input.actor) throw new Error('actor is required');
  if (!input.reason) throw new Error('reason is required');
  const now = new Date().toISOString();
  return {
    id: randomUUID() as OutcomeId,
    leadId: old.leadId,
    workspaceId: old.workspaceId,
    value: input.newValue,
    acquisitionMode: 'user_confirmed',
    assertionStatus: 'claimed',
    actor: input.actor,
    timestamp: now,
    reason: input.reason,
    supersedesOutcomeId: old.id,
  };
}
