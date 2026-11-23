# R4.7 data governance architecture proposal

Status: proposal for owner review, not an approved retention schedule or erasure implementation. Baseline `08bdefa`; I-05/I-09/I-12 and ADR-006/009 govern. Real participant/organization admission remains pending. Operator self-confirmation permits only the agreed local synthetic exercise.

## Preserve commercial meaning while separating personal payload

Current accepted evidence and audit are append-only; lifecycle previews explicitly return `BLOCKED_IMMUTABLE_HISTORY`. Export is an admin-only single-lead snapshot, not deletion or comprehensive subject access. Do not weaken immutable triggers to satisfy an unapproved erasure request.

Proposed future model separates immutable business metadata (opaque evidence/lead/assertion IDs, workspace, source/provenance category, server timestamps, supersession/correction references and payload availability state) from encrypted personal payload objects. Metadata itself can identify a person through linkage: classification and minimization review must approve each retained field. Never declare pseudonymous IDs anonymous. Business metadata remains append-only; correction adds a new record. Payload availability transitions are appended as explicit `redacted`/unavailable facts, never invented raw content or silently substituted evidence. Stable Lead ID and UNKNOWN semantics survive. Whether this design satisfies I-12 for accepted evidence requires an approved invariant-compatible ADR before implementation.

Use envelope encryption with authenticated workspace/object/schema/version metadata and a random per-object data key. Wrap keys under independently managed workspace encryption keys; separate these from ADR-009 HMAC keys. Bind tenant and purpose in all cryptographic operations. Payload access rechecks current membership and lead scope, logs only opaque audit references, and fails closed when key or payload is unavailable. Never place decryption keys, content hashes or raw payload in browser storage, logs, metrics, URLs or recovery drafts persisted to disk.

## Key custody and legacy compatibility options

| Option | Benefit | Required decision/evidence |
|---|---|---|
| Managed KMS wrapping with separate decrypt and key-admin authorities | Durable custody, rotation/audit and recoverability | Provider/region, operator access, availability, incident recovery and cost approval |
| Self-managed vault/HSM | Explicit custody control | Staffing, dual control, audited rotation/restore and disaster recovery evidence |
| Existing environment-held keys | Compatible bounded synthetic harness | No claim of production custody; secret ACLs, distribution and backup remain operator duties |

Encryption rotation rewraps envelopes with append-audited key-version references; it must not rewrite accepted raw bytes or original HMACs. HMAC retirement retains verification keys only as approved. Missing keys yield UNKNOWN/unavailable; never recompute old digests under a new kid and call them equal. Legacy plaintext evidence needs inventory plus an approved migration: options are audited copy-to-encrypted storage with verified byte equivalence and controlled old-copy disposition, or continued restricted legacy retention until policy allows migration. Existing unkeyed legacy digests remain explicitly legacy, never misrepresented as keyed. No destructive migration is proposed here.

## Retention, erasure, holds and recovery

Classify accepted evidence, encrypted payload, commercial assertions, audit, membership audit, telemetry, exports, research captures and operational backups separately. Owners must provide purpose, authority, schedule, geographic obligations, holds and responsible operator for each class. No legal duration is inferred. ADR-009 alone already sets research capture maximum seven days with explicit authorization/encryption/automatic deletion/audit; research capture remains OFF.

An erasure workflow would authenticate the requester, resolve authorized subject scope without identity merge, compute a preview including dependencies and downstream copies, check holds, obtain approved execution authority, then append execution receipts. Access suppression is distinct from physical deletion and cryptographic erasure. Crypto-erasure is valid only after proving destruction of every wrapped/plain key copy and recoverable version, while approved nonpersonal metadata survives. Export copies are tracked as disclosure, not assumed recalled. Partial failures remain visible and retryable; audit records contain no erased personal payload.

Holds need explicit authorized issuer, class/object scope, reason reference, start/release audit and precedence over expiry; never invent a legal hold authority or silently erase held data. Backup policy must define immutable backup expiry, restore quarantine and reapplication of deletion tombstones before serving restored data. Restore tests must show erased content cannot reappear. Replicas, caches, search indexes, observability, temp files and exports belong in the inventory. Downstream adapters require per-provider deletion contracts/receipts and reconciliation; upstream copies cannot be claimed erased by this platform.

## Threat model and decision gates

| Threat | Control/design evidence required | Gate owner |
|---|---|---|
| Tenant/lead leakage, IdP role escalation, revoked identity | Membership authority each request, scoped SQL and negative HTTP/PG tests | Engineering/Security; ADR-006 |
| Offline guessing/linkability and lost keys | Workspace/purpose keyed digests, custody/rotation/restore drill; unavailable remains explicit | Security/Operations |
| Insider decrypt/export or history rewrite | Admin-only export, least privilege DB, append audit, separation of duties, payload minimization | Security/Data |
| Erasure violates raw immutability or legal hold | Approved invariant-compatible ADR, class schedule, hold authority and reviewed migration | Product/Data/authorized legal owner |
| Deleted content resurrects or leaks downstream | Backup quarantine/tombstone replay, adapter receipts and partial-failure reconciliation | Operations/Integration |
| Local synthetic environment mistaken for production | Loopback runtime, synthetic write guard, fixture identities visibly synthetic, no real participant onboarding | Product/organization pilot owner |

Before real data: approve class inventory and retention authority; choose key custody; approve metadata/payload/erasure semantics; review migration and least privilege; demonstrate expiry, hold conflict, audit failure, key loss, restore and downstream reconciliation using synthetic fixtures; then obtain organization pilot admission. These are independent gates, not satisfied by passing unit tests or an operator approval reference. No additional crypto prototype is added: the existing isolated synthetic research vault already demonstrates the bounded use case, and another fixture would not close durable custody or erasure gaps.
