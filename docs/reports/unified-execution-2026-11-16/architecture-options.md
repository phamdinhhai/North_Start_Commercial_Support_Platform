# Architecture options — proposals, not accepted ADRs

Reviewed 2026-11-17. **All proposals OPEN / HUMAN APPROVAL PENDING.** These supplemental identifiers do not replace ADR-001/002/003/004, canonical decisions, or existing RFCs. See [baseline](architecture-baseline.md), [decision boundaries](decisions.md) and [reuse evidence](reusable-assets.md).

## Authority and current posture

Read authorities: canonical README, DOMAIN_INVARIANTS, ARCHITECTURE_CONSTITUTION, OPEN_DECISIONS; delivery ADR-002; existing [IAM RFC](../decision-demand-2026-11-13/rfcs/RFC-PM1-IAM-CAPABILITY-MATRIX.md), [RLS RFC](../decision-demand-2026-11-13/rfcs/RFC-TENANT-DEFENSE-IN-DEPTH-RLS.md), decision-register and this execution's decisions/baseline. These options refine review questions without approving the earlier proposal matrix. The current admin/manager implementation is not proof of a canonical entitlement.

Retain NestJS/Fastify modular monolith, framework-independent domain, PostgreSQL repositories and forward migrations. No microservices, generic connector platform, workflow DSL or external policy service is justified by current measured evidence. Observed auth stub, incomplete telemetry and connector credential lifecycle are actionable boundaries; local/test research enrollment is not production application identity.

Frozen constraints apply throughout: Customer != Lead; preserve source/lineage/attribution and UNKNOWN; no auto merge; stable Lead IDs; raw immutable; append audit/reversal; external integrations own no commercial semantics; AI draft-only. CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1 remain OPEN. Gate #A, PH3 persistence/migration review, PH4 Pancake verdict and L5 direction decision retain their human owners.

## U-ARCH-01: OIDC identity plus internal membership and resource policy

**Context:** `product/src/ports/auth.ts` provides a replaceable identity seam; `infra/auth/auth.service.ts` has sandbox demo, narrow bootstrap and opt-in unsigned development credentials. Neither is a production identity/session lifecycle. I-09 requires local lead scope independent of upstream scopes.

**Alternatives:** keep stub for synthetic-only use; implement passwords/session cryptography ourselves; use OIDC provider with server membership and in-process policy; add IdP plus external OpenFGA/Cerbos immediately.

**Recommendation:** prepare an OIDC adapter port and conformance contract for review. Keycloak is a representative candidate from the source shortlist; managed OIDC/Zitadel/Ory remain alternatives. **Actual production provider and credential/session design require human selection.** Avoid hand-built password/token infrastructure. Keep resource authorization local initially; external authorization engine only after measured complexity and approved PM-1 model justify it.

Proposed evaluation sequence (not new grants):

1. Verify access token issuer/audience/signature/allowed algorithm/expiry and bounded JWKS refresh; reject malformed, unknown or revoked identity/session according to approved revocation SLA.
2. Map `(issuer, subject)` to an internal principal; verify active workspace membership in server storage. Workspace request selects among approved memberships and never creates one. Provider roles, email/domain, connector scopes and caller body cannot grant membership/capability.
3. Evaluate approved capability and resource predicates against workspace, lead ownership, addressed/current work and action. Check every list, detail, mutation, feedback, export and raw-evidence path. Deny unknown/stale/unavailable policy; retain existing owner/item guards.
4. Preserve separate human/service/connector principals. Connector enrollment authorizes receipt transport only. Demo `demo:*`, bootstrap and unsigned credentials cannot migrate into production identities by reinterpretation.

**Tradeoffs:** IdP reduces custom identity security code but adds availability/key/upgrade/provisioning operations. Server membership enables fast local revocation but requires cache invalidation and actor-link migrations. External policy adds distribution/consistency risk before current query gaps are closed.

**Compatibility/migration:** inventory actor IDs and memberships; preserve audit actors and stable Lead IDs; introduce explicit reviewed principal links instead of email-based merges (ID-1 untouched). Synthetic conformance first, explicit production credential cutover and deny-only rollback; never re-enable unsigned tokens to restore availability. No role/capability widening and no new membership schema implemented by this report.

**Required evidence:** wrong issuer/audience/algorithm, expiry, JWKS rotation/outage, revoked identity/membership, cross-workspace selection, stale assignment, unauthorized feedback/list/resource access, sandbox rejection in production, bootstrap disablement, principal mapping/restart and append audit. Independent security review plus documented revocation and recovery procedure.

**Owner / approval:** Security + Product PM-1; Engineering identity adapter/migration; Legal/privacy provider residency/subprocessor terms. **OPEN; none approved.**

## U-ARCH-02: PostgreSQL tenant defense in depth

**Context:** existing application/store query checks are essential; baseline identifies feedback/queue scope gaps. RLS can reduce tenant-query mistakes but cannot express all lead/work policy by itself.

**Alternatives:** application checks only; scoped repository helpers plus contract tests; add PostgreSQL RLS behind those controls; separate database per tenant.

**Recommendation:** first close existing scope/parity gaps, then review the existing RLS RFC as defense in depth. **No RLS migration or policy is implemented here.** Test restricted application role (not owner/superuser/BYPASSRLS), FORCE RLS where appropriate, transaction-local tenant context, connection-pool reset, tenant-aware keys/FKs, joins, background jobs, migrations and restore. No arbitrary caller-set database tenant context. Missing tenant must deny. Resource checks remain independent above storage.

**Tradeoffs / migration:** stronger containment versus operational complexity, planner cost, administrative bypass and pool-context risks. Forward migrations, representative data/backfill, restricted-role PostgreSQL tests and rollback that maintains isolation are prerequisites. Keep PostgreSQL and repository ports; no new datastore.

**Owner / approval:** Engineering/DBA + Security, PH3 migration gate, Product for any changed access behavior. **OPEN; existing RFC not accepted by this report.**

## U-ARCH-03: Connector lifecycle and jobs without commercial authority

**Context:** research receipt/checkpoint enrollment is experimental, local/test and disabled by default. A signed scope receipt is not upstream consent or live completeness evidence. Credential encryption/rotation and provider delivery contracts remain unverified for production.

**Alternatives:** narrow adapter with existing store/job port; Nango-backed credential/connection service; ETL/automation platform; Temporal orchestration.

**Recommendation:** retain narrow adapter. Reuse Nango lifecycle patterns conditionally after exact license/provider evidence; consider BullMQ only when bounded backlog/retry needs justify Redis. Keep credentials encrypted server-side under a secret-store reference, never in domain events/jobs/telemetry. Revoke enrollment and upstream credential separately; record authoritative connection/workspace/page scope, expiry and purpose. Explicit lifecycle states and failure reasons must not invent commercial state.

**Compatibility / migration:** receipt + checkpoint + audit remain atomic; envelope uniqueness and database transaction provide replay protection. Queue retries do not authorize provider writes or guarantee exactly once. Test out-of-order recovery, partial failure, refresh races, credential revoke/reconnect, tenant/page mismatch, poison jobs, rate limits and duplicate-after-commit. Keep raw evidence/provenance and UNKNOWN, no automatic lead creation/merge/state/attribution from receipt progress. Production enablement requires a separate reviewed cutover, not flipping the research flag.

**Tradeoffs:** platform reuse can reduce auth plumbing but adds license, secret custody and operational dependencies. ELT and workflow engines solve different problems and do not establish canonical semantics. Require a second concrete connector need before generic framework adoption.

**Owner / approval:** Engineering + Security credential lifecycle; Product + Engineering PH4 verdict and exact provider permission/contracts; Legal license/terms. **OPEN; no dependency or production enablement approved.**

## U-ARCH-04: Operational telemetry and safe agent tooling

**Context:** baseline confirms telemetry API presence but incomplete action coverage. Commercial audit, product learning events and operational traces serve distinct evidence purposes.

**Alternatives:** existing allowlisted telemetry only; add OpenTelemetry adapter; broad automatic capture; external automation/MCP tools with broad write scope.

**Recommendation:** instrument intended commands and failures through existing ports before choosing backend. Evaluate OpenTelemetry JS behind infrastructure adapter with allowlisted attributes, explicit release/exposure and low-cardinality labels. Disable query/header/body capture; redact before enqueue/export. Trace loss cannot block audit persistence or become fabricated product evidence. Skills/MCP remain reviewed tooling references with narrow audience-bound permissions, local membership/resource checks and draft-only AI; no autonomous canonical mutation.

**Compatibility / migration:** no domain dependency on SDK, no external raw conversation/token export. Synthetic exporter failure/shutdown/redaction tests plus learning-event coverage assertions. Rollback disables exporter/new tooling without disabling audit or widening permissions. Choose retention, region, operational alert owner and collector budget explicitly.

**Owner / approval:** Engineering/Operations + Security; Product/Data event interpretation; Legal/privacy external telemetry processing. **OPEN; no exporter/backend/MCP server approved.**

## Review sequence and validation limits

Close baseline A1–A4/A8 and integrate exact security fixes first; gather real PostgreSQL restart/store-parity evidence. Review PM-1 and credential cutover before real commercial data. Review persistence, secret/retention/restore operations and provider permission evidence before any live connector. Instrument the bounded learning loop and use L5 evidence to decide expansion; avoid architecture adoption as a substitute for user validation.

This is a documentation-only supplement. Source metadata/path inspection and static report checks executed; no upstream/application runtime tests, deployment, dependency installation or canonical changes. All acceptance tests above are proposed evidence, not reported passing results.
