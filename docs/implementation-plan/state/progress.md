# Progress Tracker

**Updated:** 2026-09-21
**Mode:** Planning (no code execution this session)

---

## PH0 — Spike & Research
- [ ] T0-01: Q-03 spike (Pancake API docs + auth + paging)
- [ ] T0-02: Q-04 spike (webhook semantics + payload)
- [ ] T0-03: Envelope schema v1 draft
- [ ] T0-04: RFC CE-1 + CE-2 draft
- [ ] T0-05: Synthetic/manual adapter spec
- [ ] T0-06: Human Gate #A

## PH1 — Walking Skeleton
- [ ] T1-01: package.json + tsconfig
- [ ] T1-02: NestJS shell + Fastify adapter
- [ ] T1-03: Health endpoint
- [ ] T1-04: Lead entity (stable ID)
- [ ] T1-05: Handoff entity
- [ ] T1-06: Manual adapter shell
- [ ] T1-07: Workspace isolation shell
- [ ] T1-08: npm ci/typecheck/test/build pass

## PH2 — Domain & Events
- [ ] T2-01: Lead entity + state
- [ ] T2-02: Customer ≠ Lead
- [ ] T2-03: Handoff entity
- [ ] T2-04: CommercialEvent envelope v1
- [ ] T2-05: UNKNOWN states
- [ ] T2-06: Outcome Won/Lost/Unknown
- [ ] T2-07: Lead state machine (BLOCKED-BY CE-1)
- [ ] T2-08: Audit/Provenance store
- [ ] T2-09: Invariant sweep tests

## PH3 — Persistence & Auth
- [ ] T3-01: PostgreSQL setup
- [ ] T3-02: Domain migration v1
- [ ] T3-03: Auth middleware
- [ ] T3-04: RBAC guard
- [ ] T3-05: Workspace isolation (DB)
- [ ] T3-06: Telemetry
- [ ] T3-07: Structured feedback
- [ ] T3-08: Migration rollback verified

## PH4 — Pancake Sync (P1 flagged)
- [ ] T4-01: Pancake adapter
- [ ] T4-02: Envelope mapping + raw preserve
- [ ] T4-03: Idempotency + duplicate audit
- [ ] T4-04: Checkpoint/cursor store
- [ ] T4-05: Redaction
- [ ] T4-06: Feature flag wiring

## PH5 — LVP Slice Hardening
- [ ] T5-01: Queues module
- [ ] T5-02: NextAction lifecycle
- [ ] T5-03: Contact attempt/outcome
- [ ] T5-04: Outcome Won/Lost/Unknown
- [ ] T5-05: Data Health view
- [ ] T5-06: Export/delete + retention
- [ ] T5-07: Structured feedback

## PH6 — Pilot & Learning
- [ ] T6-01: Pilot workspace isolation
- [ ] T6-02: Experiment exposure logging
- [ ] T6-03: Learning signal instrumentation
- [ ] T6-04: Gate review template
- [ ] T6-05: Direction decision document
