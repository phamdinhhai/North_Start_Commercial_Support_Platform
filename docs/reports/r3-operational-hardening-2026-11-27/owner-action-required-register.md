# Owner Action Required register

**Decision:** these actions are required before real-data or production enablement. No action below changes default-disabled/synthetic-only behavior.

| ID | Owner decision/action | Why required | Evidence to provide | Status |
|---|---|---|---|---|
| OAR-01 | Select external KMS/HSM provider, region and service tier. | Current keyrings are process/configuration-backed and cannot establish production custody or recovery. | Architecture/security approval; provider contract; region/availability and cost record. | OPEN |
| OAR-02 | Approve separation of key-admin, decrypt/use and incident break-glass roles. | Prevents one operator from rotating, reading and destroying evidence keys. | IAM matrix; dual-control test; KMS audit log sample. | OPEN |
| OAR-03 | Set digest and encryption key retention/retirement policy. | Historical HMAC verification and A-04 decryption must remain possible; loss must remain honest `UNKNOWN`. | Approved grace period, hold exception, backup/WAL interaction, `kid` inventory. | OPEN |
| OAR-04 | Schedule and witness rotation/retirement/missing-key drills. | Unit tests do not prove external custody, restart, restore or alert behavior. | Synthetic run output showing new `kid`, old-key verify, missing-key `UNKNOWN`, no rewrite. | OPEN |
| OAR-05 | Approve research-capture retention and purge ownership (maximum remains 7 days). | A-04 storage is explicitly research-only; an operator deadline is not sufficient. | Named operator, schedule, alert route, purge backlog and failure-recovery evidence. | OPEN |
| OAR-06 | Define backup, replica, WAL/snapshot retention and restore quarantine. | Primary purge does not remove historical copies; restored expired ciphertext must not become readable. | Backup policy, immutable retention, RPO/RTO, quarantined restore + purge proof. | OPEN |
| OAR-07 | Name A-02/A-03/A-04 on-call and incident commander. | Current logs/counters have no external alert destination or accountable responder. | Pager routes, severity matrix, contact test and incident report template. | OPEN |
| OAR-08 | Choose monitoring backend and approve thresholds. | In-process counters reset at restart; there is no durable dashboard or alerting. | Dashboard queries, alert rules, synthetic firing test and retention/redaction review. | OPEN |
| OAR-09 | Approve production OIDC issuer, JWKS freshness bound, session topology and rollout/rollback. | OIDC code is tested, but no production IdP, multi-instance session store or emergency deny drill is verified. | Signed issuer acceptance, browser flow, revocation drill, stale-JWKS test, rollback record. | OPEN |
| OAR-10 | Provide distributed rate-limit/WAF design and budgets. | Existing controls are body caps, login caps and fixture-local budgets, not production abuse protection. | Per-IP/principal/workspace matrix, `429`/`Retry-After` contract, load test and bypass negatives. | OPEN |
| OAR-11 | Approve incident scenarios and run tabletop/drills. | Key loss, auth compromise, purge outage, backup restore and outbox poison paths need timed recovery. | Tabletop minutes, timestamps, preserved evidence, recovery result and follow-up actions. | OPEN |
| OAR-12 | Confirm real-data/provider admission remains blocked until ADR-007 gate evidence is accepted. | Production capability catalog is empty and A-02–A-04 are not production gates. | Explicit acceptance record referencing provider rights, readback, risk, kill switch and rollback. | OPEN |
| OAR-13 | Do not resolve CE-1, ID-1 or ID-2 in this operational workstream. | They remain canonical open decisions and could alter domain semantics. | No implementation/configuration that assumes a transition, merge threshold or CRM mapping. | GUARDRAIL |

## Owner sign-off conditions

Sign-off must identify each owner by role, environment, date and evidence artifact. “Unit tests pass”, “encrypted in transit”, an environment variable, or a successful synthetic rehearsal is not a production sign-off.
