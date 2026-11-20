# R4.12 baseline audit

Observed 2026-11-20 before implementation. R4.11 baseline branch `feat/integration-trust-and-sync-readiness` is at `4503e80d54853b15da405f7c36df298aa0852eb0`; remote matches. Hosted CI #78 (`44675872672`) completed SUCCESS on exact SHA with product and browser jobs passing. R4.11 source revision was `4fe69e3`; its local final run was 23/23 lanes, 1,354 tests, 137 PostgreSQL tests included, zero skips, 92.40% lines. R4.12 worktree is isolated at `D:/AI-for-Enterprise/ns-r412-sync`, branch `feat/r412-provider-sync-foundation`.

No provider account, credential, token, customer conversation, production resource or Owner pilot resource was accessed. R4.11's historical verification files are immutable evidence of their earlier checkpoint; this R4.12 run records the later hosted acceptance in `hosted-acceptance-addendum.md` rather than rewriting chronology.

Existing architecture includes synthetic source connections and receipts, R4.11 trust projection, append-only episode links, evidence cursors, offline transport contracts, connector health over older enrollment tables, PostgreSQL transactional stores and audit/HMAC/RBAC. R4.11 migration history ends at021; R4.12 additive schema must start at022. Existing connection health `SYNTHETIC_ONLY` is not provider authorization. Live OAuth, vault, service principal, webhook receiver and durable provider checkpoint persistence are absent at baseline.

Open decisions remain CE-1, ID-1 and ID-2. R4.12 will not resolve customer/Lead merge or automated episode segmentation. Gate A is PASS on R4.11; Gate B CONDITIONAL; Gate C NOT READY FOR REAL CUSTOMER DATA; provider authorization NOT ESTABLISHED.

Confirmed baseline boundaries:

- Provider-origin labels in synthetic payloads are untrusted candidate metadata.
- Human OIDC authorization must remain separate from future provider service identity.
- A provider request must not be accepted by client-supplied workspace/connection fields.
- Existing evidence receipts and audit are append-only and workspace scoped.
- New synchronization must persist accepted page effects and checkpoint in one transaction, without holding a transaction during network fetch.
- `UNKNOWN` completeness is required where backfill or provider state is not established.

Potential R4.12 risks are classified as design/implementation hypotheses until reproduced: checkpoint crash windows, lease races, token lifecycle mistakes, replay idempotency, stale health status, and worker pool contention. No P0 is inferred from test-count or synthetic fixtures.
