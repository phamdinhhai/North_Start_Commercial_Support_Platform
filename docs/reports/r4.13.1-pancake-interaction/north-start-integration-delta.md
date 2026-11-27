# North Start integration delta

Implemented offline only:

- Positional overlap planning for safe bounded re-read hints.
- Single-send reservation that blocks duplicate/ambiguous retries.
- Security characterization tests documenting that the existing request policy is a trusted-executor seam, not authentication or provider idempotency.

Not implemented:

- Live Pancake transport or webhook receiver.
- Real provider observation admission into `SourceObservation`/`SyncStream`.
- Customer/Lead/contact merge or automatic episode linkage.
- Assignment, outcome, revenue, payment or attribution projection.

This preserves R4.12 synthetic-only authority. Provider Contract Validation, Provider Transport Acceptance, North Start Provider Ingestion and Commercial Outcome Validation remain separate proof levels.
