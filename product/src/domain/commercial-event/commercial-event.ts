import { randomUUID } from 'node:crypto';
import type { VersionedContentDigest } from '../content-digest/versioned-content-digest';
import type { LeadId } from '../lead/lead';

// ADR-005 (resolves CE-2) — Commercial Assertion umbrella: CommercialEvent = the `inferred`
// assertion; AssertionEnvelope = observed/claimed/imported/user_confirmed. Shared AssertionId + provenance.
// OPEN: CE-1 — see ADR-001 — event types are hypothesis, not frozen enum; no transition table here.

/** CommercialEvent ID — stable, immutable. */
export type CommercialEventId = string & { readonly __brand: 'CommercialEventId' };

/** Assertion ID — for both CE and non-inferred provenance envelope (R-16). */
export type AssertionId = string & { readonly __brand: 'AssertionId' };

/** Hypothesis event types (examples from COMMERCIAL_EVENT_MODEL.md §4 — NOT frozen). */
export type CommercialEventType =
  | 'PURCHASE_INTENT_INCREASED'
  | 'OBJECTION_PRICE'
  | 'BUYER_COMMITMENT'
  | 'SELLER_COMMITMENT'
  | 'FOLLOW_UP_DUE'
  | 'LEAD_QUALIFIED'
  | 'HANDOFF_CREATED'
  | 'SALES_CONTACTED'
  | 'OPPORTUNITY_AT_RISK'
  | 'WON'
  | 'LOST'
  /**
   * ADR-005 R2-P-02 — a provider readback observed the effect (or non-effect) of a verified
   * governed action. Evidence only: it never moves Commercial State (OPEN: CE-1).
   */
  | 'ACTION_OUTCOME_OBSERVED';

/** Confidence metadata — only for inferred (I-04, R-16). */
export interface ConfidenceMeta {
  readonly producer: string;
  readonly model: string;
  readonly version: string;
  readonly rationale: string;
  /** 0..1 calibrated score — optional decoration. */
  readonly score?: number;
}

/** Acquisition mode — how the assertion was obtained (R-16, COMMERCIAL_EVENT_MODEL §7). */
export type AcquisitionMode = 'inferred' | 'observed' | 'claimed' | 'imported' | 'user_confirmed';

/** Assertion status — lifecycle (R-15, R-16). */
export type AssertionStatus = 'draft' | 'claimed' | 'corroborated' | 'superseded';

/**
 * Provenance envelope — R-16 required fields.
 * Every commercial assertion carries this (I-04, I-05, I-12).
 */
export interface ProvenanceEnvelope {
  readonly assertionId: AssertionId;
  readonly workspaceId: string;
  readonly subjectType: 'lead' | 'customer' | 'handoff';
  readonly subjectId: string;
  readonly eventType: CommercialEventType;
  /** Stringified value — previous/new handled at CE level. */
  readonly value: string;
  readonly assertionStatus: AssertionStatus;
  readonly acquisitionMode: AcquisitionMode;
  readonly sourceSystem: string;
  readonly sourceRecordId?: string;
  readonly sourceActor: string;
  readonly capturedAt: string; // ISO 8601 — when event occurred
  readonly ingestedAt: string; // ISO 8601 — when platform captured
  readonly rawEvidencePointer?: string; // envelopeId or external ref (I-12)
  readonly rawPayloadHash?: string;
  readonly schemaVersion: 1;
  readonly createdBy: string;
  readonly supersedesAssertionId?: AssertionId;
  readonly createdAt: string;
}

/**
 * CommercialEvent — the `inferred` Commercial Assertion (ADR-005 §2; CE-2 resolved).
 * Pipeline: Interaction → AI → CE → Evidence → Policy → Action (I-03, I-04).
 */
export interface CommercialEvent {
  readonly id: CommercialEventId;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly eventType: CommercialEventType;
  readonly timestamp: string;
  /** Evidence pointer — raw immutable material (I-12) or explicit reason none. */
  readonly evidenceRef?: string;
  readonly evidenceReason?: string;
  /** Inferred commercial meaning — required for inferred CE. */
  readonly inferredMeaning: string;
  /** Confidence — required for inferred (I-04: producer/model/version/rationale). */
  readonly confidence: ConfidenceMeta;
  /** Suggested mutation/action — does NOT execute (I-03: Policy before Action). */
  readonly suggestedMutation?: string;
  readonly suggestedAction?: string;
  /** Policy check result — human confirmation / draft-by-default. */
  readonly policyCheck?: 'pending' | 'approved' | 'rejected';
  readonly provenance: ProvenanceEnvelope;
}

/**
 * Subject of a non-inferred assertion. `external_resource` (ADR-005 R2-P-02) is the provider
 * resource addressed by a governed action that is not linked to a lead; its id is an opaque
 * `provider/account/resourceType/resourceId` reference, never a display name.
 */
export type AssertionSubjectType = 'lead' | 'customer' | 'handoff' | 'external_resource';

/** Small, PII-free summary of the evidence behind an assertion (e.g. a readback result). */
export type AssertionEvidenceSummary = { readonly [key: string]: string | number | boolean | null };

/**
 * AssertionEnvelope — non-inferred path (ADR-005 §3, CE-2 scope boundary).
 * For observed/claimed/imported facts; does NOT carry inferredMeaning/confidence.
 * Shares provenance shape but acquisitionMode is observed/claimed/imported.
 */
export interface AssertionEnvelope {
  readonly assertionId: AssertionId;
  readonly workspaceId: string;
  readonly subjectType: AssertionSubjectType;
  readonly subjectId: string;
  readonly eventType: CommercialEventType;
  readonly value: string;
  readonly assertionStatus: AssertionStatus;
  readonly acquisitionMode: Exclude<AcquisitionMode, 'inferred'>;
  readonly sourceSystem: string;
  readonly sourceRecordId?: string;
  readonly sourceActor: string;
  readonly capturedAt: string;
  readonly ingestedAt: string;
  readonly rawEvidencePointer?: string;
  readonly rawPayloadHash?: string;
  /** ADR-009: algorithm/kid/value metadata when `rawPayloadHash` is derived from potentially content-bearing evidence. */
  readonly rawPayloadDigest?: VersionedContentDigest;
  readonly schemaVersion: 1;
  readonly createdBy: string;
  readonly supersedesAssertionId?: AssertionId;
  readonly createdAt: string;
  /** Optional evidence summary (ADR-005 R2-P-02: the readback behind an observed action outcome). */
  readonly evidenceSummary?: AssertionEvidenceSummary;
}

// ---- Factory inputs ----

export interface CreateCommercialEventInput {
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly eventType: CommercialEventType;
  readonly inferredMeaning: string;
  readonly confidence: ConfidenceMeta;
  readonly evidenceRef?: string;
  readonly evidenceReason?: string;
  readonly suggestedMutation?: string;
  readonly suggestedAction?: string;
  readonly sourceSystem?: string;
  readonly sourceActor: string;
  readonly createdBy: string;
}

export interface CreateAssertionInput {
  readonly workspaceId: string;
  readonly subjectType: AssertionEnvelope['subjectType'];
  readonly subjectId: string;
  readonly eventType: CommercialEventType;
  readonly value: string;
  readonly acquisitionMode: AssertionEnvelope['acquisitionMode'];
  readonly assertionStatus?: AssertionStatus;
  readonly sourceSystem?: string;
  readonly sourceRecordId?: string;
  readonly sourceActor: string;
  readonly createdBy: string;
  readonly rawEvidencePointer?: string;
  readonly supersedesAssertionId?: AssertionId;
  /** Deterministic id for idempotent producers; defaults to a random UUID. */
  readonly assertionId?: AssertionId;
  /** When the fact was observed at the source; defaults to now. */
  readonly capturedAt?: string;
  /** When the platform captured it; defaults to now. */
  readonly ingestedAt?: string;
  readonly rawPayloadHash?: string;
  readonly rawPayloadDigest?: VersionedContentDigest;
  readonly evidenceSummary?: AssertionEvidenceSummary;
}

/**
 * Create a CommercialEvent — the `inferred` Commercial Assertion (ADR-005 §2).
 * Throws if inferredMeaning or confidence missing (I-04).
 */
export function createCommercialEvent(input: CreateCommercialEventInput): CommercialEvent {
  if (!input.inferredMeaning) throw new Error('inferredMeaning is required (I-04)');
  if (!input.confidence?.producer || !input.confidence?.model || !input.confidence?.version) {
    throw new Error('confidence { producer, model, version } is required for inferred CE (I-04)');
  }
  if (!input.evidenceRef && !input.evidenceReason) {
    throw new Error('evidenceRef or evidenceReason is required (I-04 — explicit reason if no evidence)');
  }

  const now = new Date().toISOString();
  const assertionId = randomUUID() as AssertionId;

  const provenance: ProvenanceEnvelope = {
    assertionId,
    workspaceId: input.workspaceId,
    subjectType: 'lead',
    subjectId: input.leadId as string,
    eventType: input.eventType,
    value: input.inferredMeaning,
    assertionStatus: 'draft',
    acquisitionMode: 'inferred',
    sourceSystem: input.sourceSystem ?? 'ai-inference',
    sourceActor: input.sourceActor,
    capturedAt: now,
    ingestedAt: now,
    ...(input.evidenceRef !== undefined && { rawEvidencePointer: input.evidenceRef }),
    schemaVersion: 1,
    createdBy: input.createdBy,
    createdAt: now,
  };

  return {
    id: randomUUID() as CommercialEventId,
    leadId: input.leadId,
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    timestamp: now,
    ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef }),
    ...(input.evidenceReason !== undefined && { evidenceReason: input.evidenceReason }),
    inferredMeaning: input.inferredMeaning,
    confidence: { ...input.confidence },
    ...(input.suggestedMutation !== undefined && { suggestedMutation: input.suggestedMutation }),
    ...(input.suggestedAction !== undefined && { suggestedAction: input.suggestedAction }),
    policyCheck: 'pending',
    provenance,
  };
}

/**
 * Create an AssertionEnvelope — non-inferred path (ADR-005 §3).
 * No inferredMeaning/confidence; carries provenance for observed/claimed/imported.
 */
export function createAssertion(input: CreateAssertionInput): AssertionEnvelope {
  if (!input.value) throw new Error('value is required');
  if (input.acquisitionMode === 'inferred' as unknown as string) {
    throw new Error('AssertionEnvelope must not use inferred — use CommercialEvent (CE-2 boundary)');
  }
  const now = input.ingestedAt ?? new Date().toISOString();
  return {
    assertionId: input.assertionId ?? (randomUUID() as AssertionId),
    workspaceId: input.workspaceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    eventType: input.eventType,
    value: input.value,
    assertionStatus: input.assertionStatus ?? 'claimed',
    acquisitionMode: input.acquisitionMode,
    sourceSystem: input.sourceSystem ?? 'manual',
    ...(input.sourceRecordId !== undefined && { sourceRecordId: input.sourceRecordId }),
    sourceActor: input.sourceActor,
    capturedAt: input.capturedAt ?? now,
    ingestedAt: now,
    ...(input.rawEvidencePointer !== undefined && { rawEvidencePointer: input.rawEvidencePointer }),
    ...(input.rawPayloadHash !== undefined && { rawPayloadHash: input.rawPayloadHash }),
    ...(input.rawPayloadDigest !== undefined && {
      rawPayloadDigest: Object.freeze({ ...input.rawPayloadDigest }),
    }),
    schemaVersion: 1,
    createdBy: input.createdBy,
    ...(input.supersedesAssertionId !== undefined && {
      supersedesAssertionId: input.supersedesAssertionId,
    }),
    createdAt: now,
    ...(input.evidenceSummary !== undefined && { evidenceSummary: Object.freeze({ ...input.evidenceSummary }) }),
  };
}
