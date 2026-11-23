import { describe, expect, it } from 'vitest';
import { mapSyntheticCrmExternalIds, type RawCrmMapping } from './crm-external-id-mapper';

const base: RawCrmMapping = {
  workspaceId: 'workspace-a',
  provider: 'hubspot',
  objectType: 'contact',
  externalId: 'contact-101',
  externalIdentity: ['portal-99', 'contact-101'],
  internalLeadId: 'lead-001',
  fieldName: 'lifecyclestage',
  providerValue: 'marketingqualifiedlead',
  confidence: 'observed',
  observedAt: '2026-11-04T00:00:00Z',
  sourceEvidenceId: 'env-crm-001',
};

const providerFixtures: readonly RawCrmMapping[] = (
  ['twenty', 'erxes', 'onechat', 'chatwoot', 'frappe', 'hubspot', 'salesforce'] as const
).map((provider) => ({
  ...base,
  provider,
  externalId: `${provider}-obj-1`,
  externalIdentity: [`${provider}-tenant`, `${provider}-obj-1`],
}));

describe('synthetic CRM external-ID mapper', () => {
  it.each(providerFixtures)('retains $provider composite identity, evidence ref, Contact!=Lead and UNKNOWN default authority', (fixture) => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [fixture]);
    expect(result.diagnostics).toEqual([]);
    expect(result.mappings[0]).toMatchObject({
      provider: fixture.provider,
      externalId: fixture.externalId,
      externalIdentity: fixture.externalIdentity,
      internalLeadId: 'lead-001',
      fieldAuthority: 'unknown',
      confidence: 'observed',
      sourceEvidenceId: 'env-crm-001',
      contactLeadEquivalent: false,
      canonicalMergeApplied: false,
      relationState: 'active',
      isSynthetic: true,
      provenance: 'synthetic-read-only',
    });
  });

  it('preserves non-equivalence when multiple leads link to the same external CRM contact across distinct lead records or objects', () => {
    const contactRow: RawCrmMapping = { ...base, objectType: 'contact', externalId: 'hs-contact-1', externalIdentity: ['portal-99', 'hs-contact-1'] };
    const dealRow: RawCrmMapping = {
      ...base,
      objectType: 'deal',
      externalId: 'hs-deal-55',
      externalIdentity: ['portal-99', 'hs-deal-55'],
      fieldName: 'dealstage',
      providerValue: 'appointmentscheduled',
    };
    const result = mapSyntheticCrmExternalIds('workspace-a', [contactRow, dealRow]);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings.every((m) => m.contactLeadEquivalent === false)).toBe(true);
  });

  it('surfaces external object merge without applying automatic canonical Lead merge (I-06 / ID-1)', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [{
      ...base,
      externalId: 'contact-duplicate-2',
      externalIdentity: ['portal-99', 'contact-duplicate-2'],
      mergedIntoExternalId: 'contact-101',
      sourceEvidenceId: 'env-crm-merge-1',
    }]);
    expect(result.diagnostics).toEqual(['EXTERNAL_OBJECT_MERGED']);
    expect(result.mappings[0]).toMatchObject({
      relationState: 'merged',
      mergedIntoExternalId: 'contact-101',
      canonicalMergeApplied: false,
      contactLeadEquivalent: false,
    });
  });

  it('detects external object reparenting across observations and explicit previousParentExternalId without mutating canonical Lead ID', () => {
    const initial: RawCrmMapping = {
      ...base,
      fieldName: 'company_association',
      providerValue: 'acct-1',
      parentExternalId: 'acct-1',
    };
    const moved: RawCrmMapping = {
      ...base,
      fieldName: 'deal_stage',
      providerValue: 'qualified',
      parentExternalId: 'acct-2',
      previousParentExternalId: 'acct-1',
      observedAt: '2026-11-05T00:00:00Z',
      sourceEvidenceId: 'env-crm-reparent-2',
    };
    const result = mapSyntheticCrmExternalIds('workspace-a', [initial, moved]);
    expect(result.diagnostics).toEqual(['EXTERNAL_OBJECT_REPARENTED']);
    expect(result.mappings[0].relationState).toBe('active');
    expect(result.mappings[1]).toMatchObject({
      relationState: 'reparented',
      parentExternalId: 'acct-2',
      internalLeadId: 'lead-001',
      canonicalMergeApplied: false,
    });
  });

  it('reports duplicate mappings, field value conflicts, and conflicting internalLeadId bindings', () => {
    const conflictingLeadRow: RawCrmMapping = {
      ...base,
      fieldName: 'email',
      providerValue: 'a@example.test',
      internalLeadId: 'lead-different',
    };
    const result = mapSyntheticCrmExternalIds('workspace-a', [
      base,
      { ...base },
      { ...base, providerValue: 'customer' },
      conflictingLeadRow,
    ]);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].providerValue).toBe('marketingqualifiedlead');
    expect(result.diagnostics).toEqual(['CONFLICTING_MAPPING', 'DUPLICATE_MAPPING']);
  });

  it('uses an injective tuple key for delimiter-containing composite IDs', () => {
    const first = { ...base, externalIdentity: ['org:one', 'contact'], externalId: 'org:one/contact' };
    const second = { ...base, externalIdentity: ['org', 'one:contact'], externalId: 'org/one:contact' };
    const result = mapSyntheticCrmExternalIds('workspace-a', [first, second]);
    expect(result.mappings).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects malformed records (missing evidence ref or self-merge) and cross-workspace records', () => {
    const result = mapSyntheticCrmExternalIds('workspace-a', [
      { ...base, sourceEvidenceId: '   ' },
      { ...base, mergedIntoExternalId: base.externalId },
      { ...base, workspaceId: 'workspace:b' },
    ]);
    expect(result.mappings).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_MAPPING', 'MALFORMED_INPUT']);
  });
});
