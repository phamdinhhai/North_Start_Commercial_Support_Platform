# Evolution Architecture

**Owner:** Engineering / Product  
**Maturity:** Active architecture guardrails; stack not yet selected  
**Evidence status:** Engineering decision for reversible learning  
**Last updated:** 2026-09-10

## Goal

Ship the smallest changeable product. Preserve seams for evidence-driven updates without pre-building a general platform.

## Default shape

Start as a **modular monolith** with one deployable application and clear modules:

- Identity/access and workspace.
- Lead/handoff and evidence.
- Sales action/next action/outcome.
- Audit/provenance.
- Product telemetry/experiment exposure.
- Integration adapters and background jobs.
- Optional AI inference.

Microservices require demonstrated independent scaling, ownership or reliability needs.

## Change seams

1. Neutral internal domain; Pancake/vendor objects live behind anti-corruption adapters.
2. Manual, synthetic and Pancake adapters implement the same inbound contract.
3. Store raw external envelopes separately from versioned canonical projections.
4. External identifiers are immutable and ingestion is idempotent.
5. Database changes use forward migrations and tested rollback/data migration plans.
6. Internal/public APIs and schemas carry explicit versions.
7. AI, sync modes and experiment variants use server-controlled feature flags.
8. Important mutations are append-audited and reversible.
9. Connector work uses a queue/job abstraction with per-connection limits, bounded retry and dead-letter inspection.
10. Logs, metrics and traces expose failure while redacting credentials/PII.

## Avoid premature abstraction

Do not create a generic connector framework, workflow DSL, event platform or multi-tenant control plane before a second concrete need exists. Create a small interface and contract tests at the expected change boundary.

## Adapter contract

Inbound adapters produce a versioned envelope containing connection, external IDs, record type, source timestamps, captured timestamp, raw payload pointer and payload hash. Mapping errors preserve the raw envelope and do not fabricate canonical fields.

A fake/manual adapter is first-class for development, demos and fallback; it is not treated as customer evidence unless a real participant uses it in a registered experiment.

## Release/evolution controls

- Release ID and migration version are recorded with experiment exposure.
- Old feature variants remain available only for rollback/active comparison, then are removed deliberately.
- Every deferred capability has a revisit trigger.
- Architecture decisions are logged with alternatives and supersession rules.
