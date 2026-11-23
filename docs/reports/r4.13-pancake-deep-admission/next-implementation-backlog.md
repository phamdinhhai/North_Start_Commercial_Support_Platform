# Next implementation backlog

Ordered by prerequisites, based on source inspection at R4.12 `197d6ec` and the current R4.13 offline planner. This list does not assert completion of root-owned provider validation.

| Priority / owner | Next task | Evidence required before acceptance |
|---|---|---|
| P0 / Root provider executor + Security | Finish exact Page/conversation/contact and credential-account binding | Sanitized provider response checks; no derivation from URL prefix/suffix; stop on unexpected target or401/403. Consent already granted for the named test contact. |
| P0 / Provider + QA | Validate `current_count` direction, ordering, overlap and empty-page behavior on the one authorized conversation | Bounded sequential read journal and provider native message equality; preserve UNKNOWN for full history and edits/deletions unless documented/tested. No broad inbox enumeration. |
| P0 / Security + Domain + Owner | Define a separately gated actual-provider admission contract | Server-derived account/connection/principal; explicit non-synthetic source authority; permitted minimized data, isolated storage, retention/cleanup approval. Existing synthetic DTOs must reject rather than relabel provider data. |
| P0 / Sync + QA | Run exact-source PostgreSQL atomic/replay/lease/revocation and source continuity regression | `sync-checkpoint.integration.spec.ts`, source intake/context tests, isolated DB, no skip, preserved audit/RBAC/HMAC. Baseline passes do not substitute. |
| P1 / Provider + Sync | Reconcile polling with webhook/readback without stable snapshot assumptions | Authenticated provider mechanism established separately; late edits/deletion labels audited; opaque native event/revision identity only where actually provided. No fake revisions from message text/time. |
| P1 / Sync + Operator | Design bounded repeated readback and gap health for positional history | Local resume state clearly distinguished from provider completeness; overlap/replay policy, deadline/request ceiling and explicit recoverability limits. Persist only after live-admission and lifecycle approval. |
| P1 / QA + Owner | Verify crash/restart with authorized fabricated observations | Confirmed permitted isolated pipeline input, checkpoint/receipt consistency, no owner/outcome/customer merge effects, cleanup evidence. This is separate from successful provider API calls. |
| P2 / Owner + Product | Approve automated episode segmentation or wider sync only if needed | Explicit business decision; keep existing manual audited link/unlink/reject and GateC restrictions. No Page-wide auto-ingest or new connector expansion. |

No production worker, credential vault, webhook route or migration is introduced by the planner. Full provider sync remains disabled until these distinct authorities and data-lifecycle requirements are met.
