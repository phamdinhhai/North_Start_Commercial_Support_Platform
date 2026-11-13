export type MappingConfidence = 'observed' | 'inferred' | 'unknown' | 'conflicted';
export type MappingDiagnostic = 'MALFORMED_INPUT' | 'DUPLICATE_MAPPING' | 'CONFLICTING_MAPPING' | 'CROSS_WORKSPACE_MAPPING';

export interface RawCrmMapping {
  readonly workspaceId: string;
  readonly provider: 'twenty' | 'erxes' | 'onechat' | 'chatwoot' | 'frappe' | 'hubspot' | 'salesforce';
  readonly objectType: string;
  readonly externalId: string;
  readonly internalLeadId: string;
  readonly fieldName: string;
  readonly providerValue: string;
  readonly fieldAuthority: 'provider' | 'north-star' | 'unknown';
  readonly confidence: MappingConfidence;
  readonly observedAt: string;
  readonly sourceEvidenceId: string;
}

export interface CrmMapping extends RawCrmMapping {
  readonly provenance: 'synthetic-read-only';
  readonly isSynthetic: true;
}

export interface CrmMappingResult {
  readonly mappings: readonly CrmMapping[];
  readonly diagnostics: readonly MappingDiagnostic[];
}

export function mapSyntheticCrmExternalIds(expectedWorkspaceId: string, rows: readonly RawCrmMapping[]): CrmMappingResult {
  const mappings: CrmMapping[] = [];
  const diagnostics = new Set<MappingDiagnostic>();
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!isValid(row)) { diagnostics.add('MALFORMED_INPUT'); continue; }
    if (row.workspaceId !== expectedWorkspaceId) { diagnostics.add('CROSS_WORKSPACE_MAPPING'); continue; }
    const key = `${row.provider}:${row.objectType}:${row.externalId}:${row.fieldName}`;
    const fingerprint = JSON.stringify(row);
    const prior = seen.get(key);
    if (prior !== undefined) { diagnostics.add(prior === fingerprint ? 'DUPLICATE_MAPPING' : 'CONFLICTING_MAPPING'); continue; }
    seen.set(key, fingerprint);
    mappings.push({ ...row, provenance: 'synthetic-read-only', isSynthetic: true });
  }
  return { mappings, diagnostics: [...diagnostics].sort() };
}

function isValid(row: RawCrmMapping): boolean {
  if (!row || typeof row !== 'object') return false;
  if (!['twenty', 'erxes', 'onechat', 'chatwoot', 'frappe', 'hubspot', 'salesforce'].includes(row.provider)) return false;
  for (const field of ['workspaceId', 'objectType', 'externalId', 'internalLeadId', 'fieldName', 'providerValue', 'observedAt', 'sourceEvidenceId'] as const) {
    if (typeof row[field] !== 'string' || row[field].length === 0) return false;
  }
  return ['provider', 'north-star', 'unknown'].includes(row.fieldAuthority)
    && ['observed', 'inferred', 'unknown', 'conflicted'].includes(row.confidence);
}
