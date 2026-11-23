# Repository baseline for decision demand

**As of:** 2026-11-13
**Status:** working, non-canonical
**Source basis:** current repository documents and the 2026-11-12 rebuild baseline. No live process, external account, or hosted CI verification was performed for this artifact.

## What is established by existing records

- The product is a Revenue Continuity layer, not a replacement CRM, ERP, BI system or generic inbox.
- The current implementation is a manual/synthetic pilot-loop backend with PostgreSQL persistence and explicit domain/application/ports/adapters/infra/API boundaries.
- The architecture baseline records a technical development acceptance with limitations; commercial/release approval is not accepted.
- The operator workflow target is queue → context/evidence → accept handoff → execute action → complete/reschedule → outcome → audit.
- Customer and Lead, conversation source, acquisition lineage and attribution remain distinct concepts.
- UNKNOWN, raw immutability, append-only audit and lead-scoped access remain required guardrails.
- Pancake PH4 is planned but feature-flagged OFF; manual/synthetic fallback remains independent.

## Evidence boundary

| Area | State | Meaning |
|---|---|---|
| Source architecture | DOCUMENTED | Ownership and dependency guardrails are recorded in `rebuild-baseline-2026-11-12/architecture-map.md`. |
| Local technical checks | DOCUMENTED | Results in the rebuild reports are historical records of their stated environment and SHA. |
| Current hosted CI result | UNKNOWN | A workflow may exist in source; no hosted run is claimed here. |
| Production credentials and permissions | UNKNOWN | Development auth and role behavior do not prove production identity or PM-1 approval. |
| Real-user/commercial validation | UNKNOWN | Synthetic preparation and code tests are not demand or revenue evidence. |
| Pancake Public API contract | PARTIAL | Internal/dashboard reads were observed in a bounded research session; public credential, complete pagination and webhook semantics remain unresolved. |
| Backup/restore and lifecycle operations | PARTIAL | Disposable local runbook exists; production scheduler, retention, legal policy and independent semantic restore remain unverified. |

## Next safe actions

1. Keep the seven decision records open and route any scope/privilege/state change through the named human gate.
2. Complete Phase 0 Gate #A review for CE-1 and CE-2 before freezing domain transitions or generalized event scope.
3. Keep PH4 flag OFF until the public read-only contract and Q-04 webhook evidence are complete and reviewed.
4. Use synthetic/manual fixtures for engineering validation; record real-data authority and consent before any real-data operation.
5. Attach command output, commit SHA, environment and limitations to future verification records instead of upgrading this baseline by inference.
