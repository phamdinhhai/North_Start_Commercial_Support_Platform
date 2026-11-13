import { describe, expect, it } from 'vitest';
import { mapSyntheticCrmExternalIds, type RawCrmMapping } from './crm-external-id-mapper';

const base: RawCrmMapping = {
  workspaceId: 'workspace-a', provider: 'hubspot', objectType: 'contact', externalId: 'contact-1', internalLeadId: 'lead-1',
  fieldName: 'lifecyclestage', providerValue: 'lead', fieldAuthority: 'provider', confidence: 'observed',
  observedAt: '2026-11-04T00:00:00Z', sourceEvidenceId: 'evidence-synthetic-1',
};

describe('synthetic CRM external-ID mapper', () => {
  it('retains external IDs, field authority, provenance and confidence', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [base]);
    expect(result.diagnostics).toEqual([]);
    expect(result.mappings[0]).toMatchObject({ provider: 'hubspot', externalId: 'contact-1', internalLeadId: 'lead-1', fieldAuthority: 'provider', confidence: 'observed', isSynthetic: true, provenance: 'synthetic-read-only' });
  });
  it('keeps UNKNOWN confidence and field authority explicit', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{ ...base, confidence: 'unknown', fieldAuthority: 'unknown' }]);
    expect(result.mappings[0]).toMatchObject({ confidence: 'unknown', fieldAuthority: 'unknown' });
  });
  it('diagnoses malformed mappings', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{ ...base, sourceEvidenceId: '' }]);
    expect(result.mappings).toHaveLength(0);
    expect(result.diagnostics).toContain('MALFORMED_INPUT');
  });
  it('diagnoses duplicate and conflicting mappings', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [base, base, { ...base, providerValue: 'customer' }]);
    expect(result.mappings).toHaveLength(1);
    expect(result.diagnostics).toEqual(['CONFLICTING_MAPPING', 'DUPLICATE_MAPPING']);
  });
  it('rejects mappings from another workspace', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{ ...base, workspaceId: 'workspace-b' }]);
    expect(result.mappings).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_MAPPING']);
  });
});
