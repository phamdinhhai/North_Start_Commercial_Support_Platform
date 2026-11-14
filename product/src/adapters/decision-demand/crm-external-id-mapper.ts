import { canonicalizePayload } from '../../domain/envelope/envelope';

export type CrmProvider = 'twenty' | 'erxes' | 'onechat' | 'chatwoot' | 'frappe' | 'hubspot' | 'salesforce';
export type MappingConfidence = 'observed' | 'inferred' | 'unknown' | 'conflicted';
export type FieldAuthority = 'provider' | 'north-star' | 'unknown';
export type MappingDiagnostic = 'MALFORMED_INPUT' | 'DUPLICATE_MAPPING' | 'CONFLICTING_MAPPING' | 'CROSS_WORKSPACE_MAPPING';

export interface RawCrmMapping {
  readonly workspaceId: string;
  readonly provider: CrmProvider;
  readonly objectType: string;
  readonly externalId: string;
  /** Composite IDs preserve all provider identity components in order. */
  readonly externalIdentity?: readonly string[];
  readonly internalLeadId: string;
  readonly fieldName: string;
  readonly providerValue: string;
  readonly fieldAuthority: FieldAuthority;
  readonly confidence: MappingConfidence;
  readonly observedAt: string;
  readonly sourceEvidenceId: string;
}

export interface CrmMapping extends RawCrmMapping {
  readonly externalIdentity: readonly string[];
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
  for (const row of rows) {
    if (!isValid(row)) { diagnostics.add('MALFORMED_INPUT'); continue; }
    if (row.workspaceId !== expectedWorkspaceId) { diagnostics.add('CROSS_WORKSPACE_MAPPING'); continue; }
    const externalIdentity = row.externalIdentity ?? [row.externalId];
    const key = JSON.stringify([row.workspaceId, row.provider, row.objectType, externalIdentity, row.fieldName]);
    const fingerprint = canonicalizePayload({ ...row, externalIdentity });
    const prior = seen.get(key);
    if (prior !== undefined) {
      diagnostics.add(prior === fingerprint ? 'DUPLICATE_MAPPING' : 'CONFLICTING_MAPPING');
      continue;
    }
    seen.set(key, fingerprint);
    mappings.push({ ...row, externalIdentity, provenance: 'synthetic-read-only', isSynthetic: true });
  }
  return { mappings, diagnostics: [...diagnostics].sort() };
}

function isValid(row: RawCrmMapping): boolean {
  if (!row || typeof row !== 'object' || !providers.includes(row.provider)) return false;
  for (const field of ['workspaceId', 'objectType', 'externalId', 'internalLeadId', 'fieldName', 'providerValue', 'observedAt', 'sourceEvidenceId'] as const) {
    if (typeof row[field] !== 'string' || row[field].length === 0) return false;
  }
  if (row.objectType.toLowerCase() === 'lead' && row.internalLeadId.length === 0) return false;
  if (row.externalIdentity !== undefined && (!Array.isArray(row.externalIdentity)
    || row.externalIdentity.length === 0
    || row.externalIdentity.some((part) => typeof part !== 'string' || part.length === 0))) return false;
  return authorities.includes(row.fieldAuthority) && confidences.includes(row.confidence);
}
