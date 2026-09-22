import { randomUUID } from 'node:crypto';

/**
 * Customer ID — stable, immutable (I-01, I-07).
 * Customer ≠ Lead: Customer represents the business/account entity;
 * Lead represents an acquisition episode. They are separate entities.
 */
export type CustomerId = string & { readonly __brand: 'CustomerId' };

/**
 * Customer entity (I-01) — the business/account identity.
 *
 * NOTE (I-01): Customer and Lead are SEPARATE entities.
 * A Customer may have many Leads (acquisition episodes).
 * Lead references Customer via customerId; Customer does NOT own leadIds.
 * This boundary is frozen — collapse = forbidden (I-01).
 */
export interface Customer {
  /** Stable Customer ID — immutable, generated once. */
  readonly id: CustomerId;
  /** Workspace isolation (R-01, C-12). */
  readonly workspaceId: string;
  /** ISO 8601 creation timestamp. */
  readonly createdAt: string;
  /** Human-readable display name. */
  readonly displayName: string;
}

/** Options for createCustomer — public API boundary. */
export interface CreateCustomerInput {
  workspaceId: string;
  displayName: string;
}

/**
 * Create a Customer — stable ID (I-07), workspace-scoped (R-01).
 * Customer has NO leadId field (I-01: separate entities).
 */
export function createCustomer(input: CreateCustomerInput): Customer {
  return {
    id: randomUUID() as CustomerId,
    workspaceId: input.workspaceId,
    createdAt: new Date().toISOString(),
    displayName: input.displayName,
  };
}

/** Identity check (I-07): two Customer objects with same ID are the same entity. */
export function sameCustomer(a: Customer, b: Customer): boolean {
  return a.id === b.id;
}
