import { canonicalizePayload } from '../../domain/envelope/envelope';

export type CrmProvider = 'twenty' | 'erxes' | 'onechat' | 'chatwoot' | 'frappe' | 'hubspot' | 'salesforce';
export type MappingConfidence = 'observed' | 'inferred' | 'unknown' | 'conflicted';
export type FieldAuthority = 'provider' | 'north-star' | 'unknown';
export type ExternalRelationState = 'active' | 'merged' | 'reparented';
export type MappingDiagnostic =
  | 'MALFORMED_INPUT'
  | 'DUPLICATE_MAPPING'
  | 'CONFLICTING_MAPPING'
  | 'CROSS_WORKSPACE_MAPPING'
  | 'EXTERNAL_OBJECT_MERGED'
  | 'EXTERNAL_OBJECT_REPARENTED';

export interface RawCrmMapping {
  readonly workspaceId: string;
  readonly provider: CrmProvider;
  readonly objectType: string;
  readonly externalId: string;
  /** Composite IDs preserve all provider identity components (e.g. portalId/orgId + objectId) in order. */
  readonly externalIdentity?: readonly string[];
  readonly internalLeadId: string;
  readonly fieldName: string;
  readonly providerValue: string;
  /** OPEN: ID-2 — defaults to 'unknown' when field authority has not been approved. */
  readonly fieldAuthority?: FieldAuthority;
  readonly confidence: MappingConfidence;
  readonly observedAt: string;
  readonly sourceEvidenceId: string;
  /** Optional external survivor ID when the CRM merges two contacts/deals externally. */
  readonly mergedIntoExternalId?: string;
  /** Optional parent account/company/deal external ID for reparenting detection. */
  readonly parentExternalId?: string;
  readonly previousParentExternalId?: string;
}

export interface CrmMapping extends RawCrmMapping {
  readonly externalIdentity: readonly string[];
  readonly fieldAuthority: FieldAuthority;
  /** I-01 & ID-2: external CRM Contact/Opportunity is never assumed equivalent to canonical Customer/Lead. */
  readonly contactLeadEquivalent: false;
  /** I-06 & ID-1: external CRM merge/reparenting never triggers automatic canonical Lead/Customer merge. */
  readonly canonicalMergeApplied: false;
  readonly relationState: ExternalRelationState;
  readonly provenance: 'synthetic-read-only';
  readonly isSynthetic: true;
}

export interface CrmMappingResult {
  readonly mappings: readonly CrmMapping[];
  readonly diagnostics: readonly MappingDiagnostic[];
}

const providers: readonly CrmProvider[] = ['twenty', 'erxes', 'onechat', 'chatwoot', 'frappe', 'hubspot', 'salesforce'];
const confidences: readonly MappingConfidence[] = ['observed', 'inferred', 'unknown', 'conflicted'];
const authorities: readonly FieldAuthority[] = ['provider', 'north-star', 'unknown'];

export function mapSyntheticCrmExternalIds(expectedWorkspaceId: string, rows: readonly RawCrmMapping[]): CrmMappingResult {
  const mappings: CrmMapping[] = [];
  const diagnostics = new Set<MappingDiagnostic>();
  const seen = new Map<string, string>();
  const objectLeadBindings = new Map<string, string>();
  const objectParentBindings = new Map<string, string>();

  for (const row of rows) {
    if (!isValid(row)) {
      diagnostics.add('MALFORMED_INPUT');
      continue;
    }
    if (row.workspaceId !== expectedWorkspaceId) {
      diagnostics.add('CROSS_WORKSPACE_MAPPING');
      continue;
    }

    const externalIdentity = row.externalIdentity ?? [row.externalId];
    const fieldAuthority: FieldAuthority = row.fieldAuthority ?? 'unknown';
    const objectKey = JSON.stringify([row.workspaceId, row.provider, row.objectType, externalIdentity]);
    const key = JSON.stringify([row.workspaceId, row.provider, row.objectType, externalIdentity, row.fieldName]);
    const fingerprint = canonicalizePayload({ ...row, externalIdentity, fieldAuthority });

    const prior = seen.get(key);
    if (prior !== undefined) {
      diagnostics.add(prior === fingerprint ? 'DUPLICATE_MAPPING' : 'CONFLICTING_MAPPING');
      continue;
    }

    const existingLead = objectLeadBindings.get(objectKey);
    if (existingLead !== undefined && existingLead !== row.internalLeadId) {
      diagnostics.add('CONFLICTING_MAPPING');
      continue;
    }
    objectLeadBindings.set(objectKey, row.internalLeadId);

    let relationState: ExternalRelationState = 'active';
    const priorParent = objectParentBindings.get(objectKey);
    if (row.parentExternalId !== undefined) {
      if ((priorParent !== undefined && priorParent !== row.parentExternalId)
        || (row.previousParentExternalId !== undefined && row.previousParentExternalId !== row.parentExternalId)) {
        relationState = 'reparented';
        diagnostics.add('EXTERNAL_OBJECT_REPARENTED');
      }
      objectParentBindings.set(objectKey, row.parentExternalId);
    }
    if (row.mergedIntoExternalId !== undefined) {
      relationState = 'merged';
      diagnostics.add('EXTERNAL_OBJECT_MERGED');
    }

    seen.set(key, fingerprint);
    mappings.push({
      ...row,
      externalIdentity,
      fieldAuthority,
      contactLeadEquivalent: false,
      canonicalMergeApplied: false,
      relationState,
      provenance: 'synthetic-read-only',
      isSynthetic: true,
    });
  }
  return { mappings, diagnostics: [...diagnostics].sort() };
}

function isValid(row: RawCrmMapping): boolean {
  if (!row || typeof row !== 'object' || !providers.includes(row.provider)) return false;
  for (const field of ['workspaceId', 'objectType', 'externalId', 'internalLeadId', 'fieldName', 'providerValue', 'observedAt', 'sourceEvidenceId'] as const) {
    if (typeof row[field] !== 'string' || row[field].trim().length === 0) return false;
  }
  if (row.externalIdentity !== undefined && (!Array.isArray(row.externalIdentity)
    || row.externalIdentity.length === 0
    || row.externalIdentity.some((part) => typeof part !== 'string' || part.trim().length === 0))) return false;
  for (const optionalField of ['mergedIntoExternalId', 'parentExternalId', 'previousParentExternalId'] as const) {
    const val = row[optionalField];
    if (val !== undefined && (typeof val !== 'string' || val.trim().length === 0)) return false;
  }
  if (row.mergedIntoExternalId !== undefined && row.mergedIntoExternalId === row.externalId) return false;
  return (row.fieldAuthority === undefined || authorities.includes(row.fieldAuthority))
    && confidences.includes(row.confidence);
}
