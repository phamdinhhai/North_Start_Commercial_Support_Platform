/** Experimental raw intake; deliberately outside the CommercialEvent pipeline. */
export interface ResearchReceipt {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-pos';
  readonly receiptId: string;
  readonly receivedAt: string;
  readonly payloadHash: string;
  readonly rawBodyBase64: string;
  readonly evidenceType: 'synthetic';
  readonly schemaStatus: 'uninterpreted';
}

export interface ResearchReceiptPort {
  /**
   * Atomically append before resolving. Scope the unique receipt key by workspace,
   * connection, account and surface. Same key + changed hash returns conflict.
   * A receipt ID identifies a local delivery, never an inferred provider event ID.
   */
  append(receipt: ResearchReceipt): Promise<'stored' | 'duplicate' | 'conflict'>;
}
