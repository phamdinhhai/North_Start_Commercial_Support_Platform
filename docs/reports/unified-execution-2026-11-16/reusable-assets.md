# Reusable assets: bounded source assessment

Reviewed 2026-11-17. **REFERENCE / ADAPT proposals only; no new dependency, provider, policy or production enablement approved.** This supplements [architecture-baseline](architecture-baseline.md) and [architecture-options](architecture-options.md). Retain the modular monolith, PostgreSQL, manual fallback and neutral domain core.

## Evidence method

GitHub repository metadata, recursive path inventories and selected raw source were fetched read-only on this date. Pins below are exact inspected default-branch commits, **not release recommendations**. All five repositories reported `archived=false` and commits dated November 16–17, 2026: an activity signal, not a support/SLA/security guarantee. No package was installed, upstream test suite executed, full source/dependency audit conducted, or live integration attempted. Test paths establish inspectable verification surfaces, not passing results. Production version selection needs release/support, advisory, transitive-license and deployment review.

Baseline gaps: app authentication remains a bootstrap/development stub (`product/src/infra/auth/auth.service.ts`); real membership/credential lifecycle is absent; telemetry action coverage is incomplete; connector experiment is disabled by default and local/test only. Fix known lead-scope, persistence and store-parity gaps before adding frameworks. Reuse transport/security plumbing; do not import another product's commercial or role semantics.

## Five serious candidates

### 1. Keycloak — REFERENCE; OIDC adapter candidate, provider choice OPEN

Pin: [`7698e043192bd69c7125c8a6bff11ac14f60e92f`](https://github.com/keycloak/keycloak/tree/7698e043192bd69c7125c8a6bff11ac14f60e92f). [Apache-2.0 license](https://github.com/keycloak/keycloak/blob/7698e043192bd69c7125c8a6bff11ac14f60e92f/LICENSE.txt).

Inspected `services/src/main/java/org/keycloak/protocol/oidc/TokenManager.java` (`TokenManager`, access/refresh-token management); inventory includes `services/src/test/java/org/keycloak/protocol/oidc/utils/OAuth2CodeTest.java` and OAuth/JWKS test-framework helpers. [OIDC documentation](https://www.keycloak.org/securing-apps/oidc-layers) describes code flow, token introspection and signed-token verification. Reuse standards and maintained verifier libraries behind `AuthContextResolver`; do not port Java token internals into TypeScript. Independently verify issuer, audience, signature/algorithm, expiry and key rotation; no ID token accepted as API access token.

Fit: external identity and MFA/federation lifecycle without teaching the domain passwords. Cost: service upgrades, database/backup, key custody, availability and provisioning operations. Provider roles/groups must not grant local workspace membership, lead access or manager privileges by default. Candidate deserves a small synthetic OIDC conformance spike after PM-1 review, not immediate server adoption.

### 2. OpenFGA — REFERENCE; defer service adoption

Pin: [`798149843737e264e64b8660baadb946528c02f0`](https://github.com/openfga/openfga/tree/798149843737e264e64b8660baadb946528c02f0). [Apache-2.0 license](https://github.com/openfga/openfga/blob/798149843737e264e64b8660baadb946528c02f0/LICENSE).

Selected source: `pkg/server/commands/check.go`, including `WithCheckQueryV2Model`, datastore/cache configuration; tests inventoried at `pkg/server/commands/check_test.go`, `pkg/server/check_test.go`, `internal/check/check_test.go`. [Official project](https://openfga.dev/) describes relationship authorization. Useful reference for assigned-lead relationships and versioned models; it cannot decide PM-1 or replace authentication.

Fit only after policy complexity justifies a separate decision service. Relationship replication, stale grants, model migrations, cache consistency, list filtering and outage handling add risk. First keep existing authorization in-process behind a policy port and test deny cases. If adopted later, canonical ownership/membership remains in platform storage; reconcile tuple updates through durable delivery and fail closed on unavailable/unknown decisions. No broad `workspace member -> all leads` rule.

### 3. Nango — REFERENCE; conditional evaluation, not dependency approval

Pin: [`961a8c79139f75ef5ff530482a65425a8aaf37e3`](https://github.com/NangoHQ/nango/tree/961a8c79139f75ef5ff530482a65425a8aaf37e3). Root [LICENSE](https://github.com/NangoHQ/nango/blob/961a8c79139f75ef5ff530482a65425a8aaf37e3/LICENSE) is **Elastic License 2.0**, while GitHub SPDX metadata returned `NOASSERTION`. Do not describe the repository as uniformly permissive; evaluate exact package/file terms and hosted-service restrictions with Legal.

Selected source: `packages/server/lib/clients/oauth1.client.ts`: `OAuth1Client.getOAuthRequestToken`, `getOAuthAccessToken`, `extractQueryParams`; corresponding `oauth1.client.unit.test.ts` inventoried. Also inventoried OAuth server crypto/config/provider unit tests and adapter integration test. This demonstrates reusable connection/OAuth plumbing surfaces, **not verified Pancake support, token encryption, rotation correctness or contractual permission**.

Potential fit: connection lifecycle and provider-auth adapter patterns. Adoption requires verifying supported provider/auth modes, encrypted secret custody, revocation/refresh races, webhook authenticity, tenant ownership and deployment license. Our envelope, raw-evidence, checkpoint, idempotency and permission contracts remain authoritative. Prefer a narrow port and second concrete provider need before adding a connector platform.

### 4. BullMQ — ADAPT queue patterns; dependency decision deferred

Pin: [`ba63962a39388be8f061f6335a750330a4ab9a1c`](https://github.com/taskforcesh/bullmq/tree/ba63962a39388be8f061f6335a750330a4ab9a1c). [MIT license](https://github.com/taskforcesh/bullmq/blob/ba63962a39388be8f061f6335a750330a4ab9a1c/LICENSE).

Selected source `src/classes/worker.ts`: `Worker`, `RateLimitError`, worker run/error paths; `src/classes/queue.ts` inventoried. Node test inventory includes `tests/worker.test.ts`, `tests/worker.redis.test.ts` and `tests/worker.ioredis.test.ts`; none executed. [Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs), [deduplication](https://docs.bullmq.io/guide/jobs/deduplication) and [telemetry](https://docs.bullmq.io/guide/telemetry/) are primary design references.

Fit: bounded background retries and inspectable failure behind a job port. Redis adds another durable operational dependency. Deduplication/job IDs are not exactly-once commercial ingestion; retention/removal affects duplicate suppression. PostgreSQL transaction/envelope uniqueness remains the ingestion authority. Keep credentials/PII out of job payloads; enqueue opaque connection/envelope references, enforce per-connection budgets and test retry-after-commit/replay. Confirm current Node release APIs before selecting a version.

### 5. OpenTelemetry JS — ADAPT instrumentation boundary

Pin: [`9e6be84d945e2c03f67e92d009b817033bd3be28`](https://github.com/open-telemetry/opentelemetry-js/tree/9e6be84d945e2c03f67e92d009b817033bd3be28). [Apache-2.0 license](https://github.com/open-telemetry/opentelemetry-js/blob/9e6be84d945e2c03f67e92d009b817033bd3be28/LICENSE).

Selected source `experimental/packages/opentelemetry-sdk-node/src/sdk.ts` exposes `NodeSDK.start()` and `shutdown()`; paired `test/sdk.test.ts` inventoried, not executed. Inspection was limited to these lifecycle entry points, not a complete SDK audit. [Official JS documentation](https://opentelemetry.io/docs/languages/js/) is the operational starting point; evaluate signal/package stability separately instead of inferring stability from repository membership.

Fit: instrument API/adapter/job failures through existing telemetry port, correlate release/exposure and observe backlog. Does not supply missing product experiment events or append-only commercial audit. Use allowlisted attributes, strip URL queries/auth headers, prohibit message text/raw payloads, bound cardinality and export queues. Test redaction before exporter, propagation, exporter outage and process shutdown. Backend/collector/data-residency selection remains OPEN.

## Alternatives: deliberately shallow triage

These are category comparisons from primary project entry points, not pinned code/license audits and not serious-shortlist approval. Revisit only when the stated need materializes.

| Alternative / primary source | Bounded assessment / trigger |
|---|---|
| [Zitadel](https://zitadel.com/docs), [Ory](https://www.ory.sh/docs) | Identity alternatives to Keycloak; compare managed/self-host custody, tenancy, revocation, operations and actual licensing at version selection. No product membership semantics inherited. |
| [Cerbos](https://docs.cerbos.dev/), [Casbin](https://casbin.org/docs/overview) | Attribute/policy or embedded authorization alternatives; compare model explainability and query filtering to relationship needs after PM-1 approval. No engine makes an unapproved matrix valid. |
| [Airbyte](https://docs.airbyte.com/), [Meltano](https://docs.meltano.com/) | Data movement/ELT candidates if analytical replication becomes a validated need; not evidence of interactive CRM handoff semantics or exact provider permission. |
| [n8n](https://docs.n8n.io/), [Activepieces](https://www.activepieces.com/docs) | Automation references when operator integrations are needed; workflow execution must call guarded application commands, never mutate canonical tables directly. Deployment and license review outstanding. |
| [Temporal](https://docs.temporal.io/) | Durable workflow candidate if long-running cross-system compensations demonstrably exceed simple jobs; premature for current monolith/pilot and adds workflow determinism/operations burden. |

## Agent Skills and MCP: safe reuse boundary

[Agent Skills specification](https://agentskills.io/specification) packages instructions/resources and optional scripts; its experimental `allowed-tools` metadata is not platform authorization. Pin/review origin, license, scripts and outbound endpoints before use. Imported skills cannot override canonical constraints or approve deployment. No skill/server was installed or executed in this assessment.

[MCP authorization specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) specifies HTTP transport authorization; it does not settle our resource policy. A future MCP server should expose narrow read/propose operations first, authenticate audience-bound callers, resolve workspace membership server-side and enforce the same lead policy per tool/resource. Reject token passthrough and arbitrary URL/SQL/filesystem tools; separate read from write scopes, bound inputs/outputs and audit invocation metadata without secrets. Draft-only AI remains I-03: no implicit tool approval, autonomous outbound message, merge, revenue/attribution write or commercial transition. Existing user-authorized human commands still traverse normal application checks.

## Acceptance before any adoption

Owner-approved PM-1/provider choice; exact released package/license/advisory review; synthetic negative authorization and lifecycle tests; connector permission/contract evidence; secrets rotation/revocation runbook; migration/rollback; operational cost/restore evidence. No new dependencies or code changes were made here. Pin/link inspection and report consistency are the only executed checks; all proposed runtime tests remain future evidence.
