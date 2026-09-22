import { randomUUID } from 'node:crypto';

/**
 * Lead ID — stable, immutable, never reused (I-07).
 * Million-year uniqueness via UUID v4; lead-scoped access (I-09).
 */
export type LeadId = string & { readonly __brand: 'LeadId' };

export type LeadStatus =
  | 'New'
  | 'Accepted'
  | 'Contacting'
  | 'Follow-up'
  | 'Won'
  | 'Lost'
  | 'Unknown'; // I-08 — UNKNOWN là valid state, không null
// OPEN: CE-1 — see ADR-001 — interim: New→Accepted→Contacting→Follow-up→Won/Lost+Unknown. Code PHẢI abort nếu transition vượt frozen boundary.

/**
 * Lead ≠ Customer (I-01) — entity riêng biệt.
 * Lead = một acquisition episode với stable identity.
 */
export interface Lead {
  /** Stable Lead ID (I-07) — immutable, generated once on create. */
  readonly id: LeadId;
  /** Workspace isolation (I-09) — lead-scoped access. */
  readonly workspaceId: string;
  /** Origin workspace for chain-of-custody. */
  readonly createdAt: string;
  /** Immutable — set once on create (I-07). */
  readonly status: LeadStatus;
  /** Human-readable display name. */
  readonly displayName: string;
}

/** Options for createLead — public API boundary (typed). */
export interface CreateLeadInput {
  workspaceId: string;
  displayName: string;
  status?: LeadStatus;
}

/**
 * Create một Lead mới với stable ID (I-07).
 * Status mặc định = New; nếu cung cấp UNKNOWN → giữ nguyên (I-08).
 */
export function createLead(input: CreateLeadInput): Lead {
  const status = input.status ?? 'New';
  return {
    id: randomUUID() as LeadId,
    workspaceId: input.workspaceId,
    createdAt: new Date().toISOString(),
    status,
    displayName: input.displayName,
  };
}

/**
 * Immutability check (I-07): Lead ID không bao giờ đổi.
 * Trả về true nếu hai lead cùng ID (identity stable).
 */
export function sameLead(a: Lead, b: Lead): boolean {
  return a.id === b.id;
}
