import { describe, expect, it } from 'vitest';
import { mapSyntheticCrmExternalIds, type RawCrmMapping } from './crm-external-id-mapper';

const base: RawCrmMapping = {
  workspaceId: 'workspace-a', provider: 'hubspot', objectType: 'contact', externalId: 'contact-1',
  externalIdentity: ['portal-1'], internalLeadId: 'lead-1', fieldName: 'lifecyclestage',
  providerValue: 'lead', fieldAuthority: 'provider', confidence: 'observed',
  observedAt: '2026-11-04T00:00:00Z', sourceEvidenceId: 'evidence-synthetic-1',
};

const providerFixtures: readonly RawCrmMapping[] = (['twenty', 'erxes', 'onechat', 'chatwoot', 'frappe', 'hubspot', 'salesforce'] as const)
  .map((provider) => ({ ...base, provider, externalId: `${provider}-contact` }));

describe('synthetic CRM external-ID mapper', () => {
  it.each(providerFixtures)('retains $provider external identity and evidence provenance', (fixture) => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [fixture]);
    expect(result.diagnostics).toEqual([]);
    expect(result.mappings[0]).toMatchObject({
      provider: fixture.provider, externalId: fixture.externalId, externalIdentity: ['portal-1'],

      internalLeadId: 'lead-1', fieldAuthority: 'provider', confidence: 'observed',
      isSynthetic: true, provenance: 'synthetic-read-only',
    });
  });

  it('keeps UNKNOWN field authority and confidence explicit', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{ ...base, confidence: 'unknown', fieldAuthority: 'unknown' }]);
    expect(result.mappings[0]).toMatchObject({ confidence: 'unknown', fieldAuthority: 'unknown' });
  });

  it('supports composite external identity and never rewrites internal Lead identity', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{
      ...base, provider: 'salesforce', externalIdentity: ['org:1', 'contact:2'], internalLeadId: 'lead-stable',
    }]);
    expect(result.mappings[0].externalIdentity).toEqual(['org:1', 'contact:2']);
    expect(result.mappings[0].internalLeadId).toBe('lead-stable');
  });

  it('reports duplicate and conflicting mappings without overwriting the first', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [base, base, { ...base, providerValue: 'customer' }]);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].providerValue).toBe('lead');
    expect(result.diagnostics).toEqual(['CONFLICTING_MAPPING', 'DUPLICATE_MAPPING']);
  });

  it('uses an injective tuple key for delimiter-containing composite IDs', () => {
    const first = { ...base, externalIdentity: ['org:one', 'contact'], externalId: 'org:one/contact' };
    const second = { ...base, externalIdentity: ['org', 'one:contact'], externalId: 'org/one:contact' };
    const result = mapSyntheticCrmExternalIds('workspace-a', [first, second]);
    expect(result.mappings).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects malformed and cross-workspace records', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [
      { ...base, sourceEvidenceId: '' },
      { ...base, workspaceId: 'workspace:b' },
    ]);
    expect(result.mappings).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_MAPPING', 'MALFORMED_INPUT']);
  });
});
