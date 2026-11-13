# Synthetic read-only integration spike

**Scope:** Streams B/C ads metrics normalization and CRM external-ID/field-authority mapping.

## Executable files

- `product/src/spikes/decision-demand/ads-metrics-normalizer.ts`
- `product/src/spikes/decision-demand/ads-metrics-normalizer.spec.ts`
- `product/src/spikes/decision-demand/crm-external-id-mapper.ts`
- `product/src/spikes/decision-demand/crm-external-id-mapper.spec.ts`

## Guarantees exercised

The ads normalizer retains provider/account/object IDs, native metric names, value, currency, timezone, attribution window, timestamps, synthetic/provenance markers and explicit `unknown`. It rejects malformed values and cross-workspace rows, and reports duplicate/conflicting keys without overwriting the first observation.

The CRM mapper retains provider/external/internal IDs, field authority, confidence, observation time and source evidence ID. It rejects malformed/cross-workspace records and reports duplicate/conflicting mappings without rewriting internal Lead identity.

Neither spike calls a provider, uses credentials, mutates product state, treats synthetic data as customer/revenue evidence, or resolves a canonical open decision.
