import { randomUUID } from 'node:crypto';
import type { CustomerId } from '../customer/customer';
import { UNKNOWN_SENTINEL, type UnknownState } from '../unknown-states/unknown-states';

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
 * Lead có thể REFERENCE customer qua customerId, nhưng không embed customer data.
 */
export interface Lead {
  /** Stable Lead ID (I-07) — immutable, generated once on create. */
  readonly id: LeadId;
  /** Workspace isolation (I-09) — lead-scoped access. */
  readonly workspaceId: string;
  /** Optional reference to Customer — Lead ≠ Customer (I-01), không ownership. */
  readonly customerId?: CustomerId;
  /** Conversation Source — where (I-02, R-10). Không collapse với lineage/attribution. */
  readonly conversationSource?: string;
  /** Acquisition Lineage — origin (I-02, R-10). Không collapse với source/attribution. */
  readonly acquisitionLineage?: string;
  /** Revenue Attribution — UNKNOWN trong LVP (I-02, MM-1). Không backfill. */
  readonly attribution: UnknownState;
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
  customerId?: CustomerId;
  conversationSource?: string;
  acquisitionLineage?: string;
  attribution?: UnknownState;
}

/**
 * Create một Lead mới với stable ID (I-07).
 * Status mặc định = New; nếu cung cấp UNKNOWN → giữ nguyên (I-08).
 * Attribution mặc định = UNKNOWN (MM-1) — không fabricate.
 */
export function createLead(input: CreateLeadInput): Lead {
  const status = input.status ?? 'New';
  return {
    id: randomUUID() as LeadId,
    workspaceId: input.workspaceId,
    ...(input.customerId !== undefined && { customerId: input.customerId }),
    ...(input.conversationSource !== undefined && { conversationSource: input.conversationSource }),
    ...(input.acquisitionLineage !== undefined && { acquisitionLineage: input.acquisitionLineage }),
    attribution: input.attribution ?? UNKNOWN_SENTINEL,
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
