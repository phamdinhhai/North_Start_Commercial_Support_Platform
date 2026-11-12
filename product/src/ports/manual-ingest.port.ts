import type { CommercialEnvelope, EvidenceAcquisitionMode, EvidenceAcquisitionSource } from '../domain/envelope/envelope';

export interface ManualIngestInput {
  readonly workspaceId: string;
  readonly connection: string;
  readonly externalRecordId: string;
  readonly externalEventType: string;
  readonly rawPayload: unknown;
  readonly sourceCapturedAt?: string;
  readonly isSynthetic?: boolean;
  readonly acquisitionMode?: EvidenceAcquisitionMode;
  readonly acquisitionSource?: EvidenceAcquisitionSource;
}

export interface ManualIngestPort {
  ingest(input: ManualIngestInput): CommercialEnvelope;
}
