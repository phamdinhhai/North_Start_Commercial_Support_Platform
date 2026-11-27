# R3 operational hardening gate matrix

**Baseline reviewed:** candidate `6e98238` (A-02/A-03/A-04), with existing reports and source composition. **Scope:** operational hardening only; no product or canonical changes. **Default:** all research capture, assertion delivery, provider integrations, outbound capabilities and real-data paths remain disabled; synthetic/local/test only.

## Gate legend

- **I — implementation:** code/schema contract exists and is unit-tested.
- **X — integration:** composed against PostgreSQL/auth/key source and failure paths are exercised.
- **O — operational:** an operator can monitor, rotate, purge, restore and recover with evidence.
- **P — production:** approved custody, access, incident ownership and live-environment proof; not implied by local/CI passes.

| Gate / capability | I | X | O | P | Required evidence / blocking condition |
|---|---:|---:|---:|---:|---|
| A-02 keyed readback evidence | PASS | CONDITIONAL | OPEN | BLOCKED | HMAC-SHA256 with workspace/purpose/kid and `UNKNOWN` on missing historical key are implemented. Composition currently uses configured process keyring; external custody, rotation/retirement drill and durable historical-key availability are absent. |
| A-03 observed-assertion delivery | PASS | CONDITIONAL | OPEN | BLOCKED | Transactional action/outbox, leased at-least-once worker, idempotent inbox and failure/replay controls exist. Scheduler is research-only; no production alert/SLO, operator ownership or durable deployment rehearsal. |
| A-04 encrypted research receipts | PASS (synthetic) | PASS (synthetic PostgreSQL) | OPEN | BLOCKED | AES-256-GCM + AAD, 1–7 day immutable expiry, same-transaction `PURGED` audit, `SKIP LOCKED` purge and failure ledger are tested. `configuredResearchCipher` is environment/in-memory keyring, and store explicitly refuses pilot/production. |
| External KMS/HSM custody | NOT STARTED | NOT STARTED | NOT STARTED | BLOCKED | Select managed KMS or HSM, separate key-admin/decrypt roles, region/availability, audit export and break-glass process. No environment JSON keyring may be promoted. |
| Key rotation / retirement / historical availability | PARTIAL | OPEN | OPEN | BLOCKED | Tests cover active/retired key lookup and `UNKNOWN`; no scheduled rotation, dual-control approval, restore of retired keys, retirement grace calculation or missing-key alert. Never recompute old digests under a new `kid`. |
| Purge scheduling / failure recovery | PASS (code) | PASS (synthetic) | OPEN | BLOCKED | Runner is non-overlapping and restart-safe; failure ledger is inspectable. Need deployed scheduler ownership, alert thresholds, backlog drain procedure, and proof of recovery after DB/audit failure. |
| Backup / restore / retention limits | PASS (synthetic rehearsal) | PASS (synthetic disposable DB) | OPEN | BLOCKED | `backup-verify.mjs` and `restore-rehearsal.mjs` are guarded against non-loopback targets and prove synthetic logical restore/replay only. No PITR, production RPO/RTO, replica lag policy, backup expiry, encrypted backup custody or purge/tombstone behavior after restore. |
| Monitoring / alerting | PARTIAL | OPEN | OPEN | BLOCKED | Redacted JSON logs and bounded in-process counters exist. Counters reset on restart, no exporter/alert destination exists, and A-02/A-03/A-04 metrics are not yet operationally owned. |
| Authentication rollout | PASS (implementation) | CONDITIONAL | OPEN | BLOCKED | OIDC verifies asymmetric JWT/JWKS, membership is server-side and token TTL is bounded. Production issuer, browser/session topology, multi-instance session store, IdP rollout/rollback and emergency revocation drill remain unverified. |
| Rate limiting / abuse controls | PARTIAL | OPEN | OPEN | BLOCKED | Body limits, login caps, JWKS refetch cooldown and fixture relay limits exist. No general inbound per-principal/workspace/IP rate limit, distributed limiter, `Retry-After` contract or load/abuse evidence. |
| Incident response | NOT STARTED | NOT STARTED | OPEN | BLOCKED | Existing runbooks cover experimental intake/delivery. Need severity model, on-call/escalation, evidence preservation, KMS/key-loss, auth compromise, purge failure and restore decision trees with timed drills. |
| Real-data / provider enablement | DENY | DENY | DENY | BLOCKED | ADR-007 requires per-capability decision, provider rights, readback contract, risk class, kill switch and rollback after gates. Production catalog is empty; research capture is explicitly synthetic-only. |

## Exit rule

No production or real-data enablement is approved until every row has named owner, environment-specific evidence, rollback path and an explicit production acceptance record. A passing unit/integration suite closes implementation evidence only; it does not close custody, operations or production gates.

## Residual unknowns

1. KMS/HSM provider, region, availability target, cost and dual-control operator set.
2. Approved key retention/grace period after rotation and how backups retain retired keys.
3. Backup provider/replica topology, immutable retention, PITR window, RPO/RTO and restore isolation.
4. Legal/data-owner retention schedule and whether research receipts require holds or downstream purge.
5. Production IdP, browser session store, ingress/WAF and distributed rate-limit service.
6. On-call owner, alert destination, severity definitions and incident notification obligations.
7. CE-1, ID-1 and ID-2 remain canonical open decisions; this workstream does not resolve them.
