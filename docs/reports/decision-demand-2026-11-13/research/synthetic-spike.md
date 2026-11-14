# Synthetic read-only integration spike

**Scope:** Streams B/C ads metrics normalization, CRM external-ID/field-authority mapping, and channel capability normalization (`P1-01`).

## Executable files

- `product/src/adapters/decision-demand/ads-metrics-normalizer.ts` (+ `.spec.ts`)
- `product/src/adapters/decision-demand/crm-external-id-mapper.ts` (+ `.spec.ts`)
- `product/src/adapters/channel-capability.normalizer.ts` (+ `.spec.ts`)

## Guarantees exercised

- **Ads normalization:** retains `google` / `meta` / `tiktok` account/object IDs, canonical and native metric names, value, currency, timezone, `dateGranularity`, `attributionWindow`, timestamps, and `sourceVersion` / `providerSurface` provenance. Uses injective JSON-tuple identity keys preventing delimiter collisions, rejects nonfinite/malformed/cross-workspace rows, preserves explicit `unknown`, and quarantines duplicate/conflicting records without overwriting the first observation.
- **CRM mapping:** retains all 7 CRM providers (`twenty`, `erxes`, `onechat`, `chatwoot`, `frappe`, `hubspot`, `salesforce`), composite `externalIdentity` with injective tuple keys, `fieldAuthority = 'unknown'` default (ID-2 OPEN), `contactLeadEquivalent: false` (I-01), `sourceEvidenceId` provenance, and external merge/reparenting diagnostics (`EXTERNAL_OBJECT_MERGED`, `EXTERNAL_OBJECT_REPARENTED`) with `canonicalMergeApplied: false` (I-06 / ID-1).
- **Channel capabilities:** distinguishes `official` / `partner` / `unofficial` transport (`productionEligibleTransport`), `inbound` vs `outbound`, `unsupported` vs `unknown`, webhook `schema`/`version`, and enforces the I-03 draft-only boundary (`agentBoundary` cannot exceed `humanBoundary`).

None of these adapters makes network calls, uses credentials, mutates canonical state, treats synthetic data as customer/revenue evidence, or resolves any open canonical decision.
