# R4 independent QA matrix and early architecture review

Date: 2026-11-19. Reviewer: r4_qa. Baseline: bcbbc095dd029c1aceac8b9e428bfadd05507fe4. QA worktree: ns-r4-qa. Integration: ns-r4-gaps, feat/r4-lvp-closure. Status: QA-01 COMPLETE (document review only); QA-02 NOT RUN, awaiting integrated implementation. No release or commercial readiness approval.

## Evidence and scope

Read AGENTS.md, canonical PRODUCT_CONSTITUTION and DOMAIN_INVARIANTS, accepted ADR-005 through ADR-009, same-day project-progress-vs-product-goals audit, and integration execution-plan/contracts. Applied code-review-excellence skill. Production code unchanged. Root reports fresh baseline 1,032 tests/no skips, 91.08% lines, 64 PG, 22 HTTP, four browser, MV3 and architecture/registry/audit passes; these are parent-reported baseline results, not independently executed R4 results.

Direct source inspection confirms product/e2e/browser/operator.browser.spec.ts creates leads and handoffs through API requests before UI, generates unsigned base64 credentials, and pastes them into #token. playwright.config.ts enables unsigned development tokens and memory storage. Existing browser tests cover delayed selection, declaration boundaries, rescheduling/stale work and isolation. They cannot prove browser OIDC login, UI intake/handoff, raw evidence viewing, correction or restart durability. Existing r3-viewer-authorization.e2e-spec.ts provides signed OIDC/PG viewer regression evidence, including next-request demotion and unchanged commercial audit; it is not the new UI acceptance journey.

No test proposed below is claimed implemented, passed or end-to-end verified. Actual result for every new matrix row is NOT RUN at this checkpoint.

## Early design findings

1. AUTH-01 recovery candidate: integration OIDC hook applies session preparation globally except login/callback. An expired process-local cookie returns 401 for operator HTML after restart. Ensure browser can reload an operator/login surface and recover without manually clearing cookies; verify login redirects remain reachable.
2. AUTH-01 ambiguity candidate: cookieValue returns undefined for duplicate/malformed north_session cookies, causing prepare to treat them as no session. Protected lead routes still require authentication, but logout currently has no independent auth/CSRF check. Explicitly reject ambiguous cookie credentials or document narrowly anonymous logout behavior, and test no mutation bypass. This is not evidence of lead authorization bypass.
3. Workflow gate: default real-only lists must not strand newly created synthetic leads. Successful intake should show the resulting detail and classification, with an explicit synthetic-list affordance.
4. Evidence gate: do not satisfy evidence acceptance with a count, HMAC or synthesized summary. Display authorized immutable accepted interaction content plus provenance; missing/deleted/redacted evidence must have explicit status.
5. Keep interim CE-1 transitions and ID-1/ID-2 unresolved. No new role grants, production providers, attribution calculations, autonomous AI, raw research retention or outbound enablement are acceptance shortcuts.

## Traceability and acceptance matrix

All rows require exact tested SHA, commands/log paths, test names, outcome and material limitations in the final execution report. UI evidence means real browser interactions against real backend responses, not route.fulfill mocks.

| Task / case | Requirement and boundary | Expected evidence | Actual |
|---|---|---|---|
| AUTH-01 / Q-A1 | R-02/03; ADR-006 | Actual IdP redirect, PKCE S256 and nonce/state, signed token verification, opaque HttpOnly cookie, session context from server membership, no token paste | NOT RUN |
| AUTH-01 / Q-A2 | Security protocol | Wrong/missing/replayed state, missing/duplicate binding cookie, wrong nonce/issuer/audience/azp/sub, expired token, exchange failure/timeout, unauthorized workspace and no membership all deny without provisioning | NOT RUN |
| AUTH-01 / Q-A3 | CSRF/ambiguity | Mutation and logout deny missing/wrong CSRF or Origin, cross-origin and mixed bearer/session; duplicate/malformed cookies tested; valid same-origin command succeeds once | NOT RUN |
| AUTH-01 / Q-A4 | Session lifecycle | Logout/expiry/revocation/demotion apply next request; restart invalidates login while operator can reload and sign in; no local/sessionStorage token or readable credential cookie | NOT RUN |
| UX-01/API-01 / Q-U1 | R-04/07/08/11; I-01/I-07 | Login owner, UI-create manual lead, discover before work exists, UI context revision and handoff to directory recipient; same lead ID throughout | NOT RUN |
| UX-01/API-01 / Q-U2 | R-09/10/16/17; I-02/I-08/I-12 | Recipient logs in separately, opens queue/detail and original evidence, sees capture/source/provenance, separate source/lineage/UNKNOWN attribution; context revision preserves original evidence | NOT RUN |
| UX-01/API-01 / Q-U3 | R-12/13/14; I-03/I-04 | Recipient accepts, creates next action, completes with explicit basis, reschedules and reopens through audited successor; no unsupported state transition or inferred execution | NOT RUN |
| UX-01/API-01 / Q-U4 | R-15/19; I-05 | UI declares Unknown/Won/Lost as claim, corrects specific outcome with reason, sees original plus superseding outcome and detailed actor/time/audit; does not equate Won claim to revenue | NOT RUN |
| API-01 / Q-N1 | R-01/03; I-09 | Viewer assigned/read scope can read but every new mutation denies; bystander same workspace denies; other workspace IDs deny detail/evidence/audit/correction/action/directory leaks; no commercial audit on rejection | NOT RUN |
| API-01 / Q-N2 | R-06/18/19 | Two tabs race expectedVersion; one append succeeds and stale tab sees reload guidance; repeat same idempotency key creates one effect; changed body/key conflict; PG restart preserves context/outcome/work/audit | NOT RUN |
| UX-01 / Q-N3 | Selection integrity | Delayed old lead/evidence response cannot overwrite new selection; pending command stays bound to displayed lead; logout/session change clears cached sensitive content | NOT RUN |
| SEC-02 / Q-S1 | R-01/28 | Same-workspace synthetic and non-synthetic-classified fixture records created via UI, immutable labels across lead/queue/evidence/outcome/export; default real filter excludes synthetic; explicit synthetic/all filters accurate in memory and PG | NOT RUN |
| SEC-01 / Q-P1 | R-05/27; ADR-009 | Same content differs across workspace keys; kid/rotation, legacy retry compatibility, correct same-key dedupe; no browser content digest; no raw/token/PII in logs, telemetry, errors or HTML injection | NOT RUN |
| LEARN-01 / Q-L1 | R-21/22/23 | Real UI emits bounded evidence/handoff/context/action/outcome/correction/exposure signals, feedback submitted via form; no content fields; synthetic excluded from business aggregate | NOT RUN |
| DATA-01 / Q-D1 | LVP privacy P0; ADR-006 | Admin-only scoped export and erasure/retention workflow; hold denies; audit survives and erased evidence explicitly unavailable; manager/sales/viewer deny; idempotent replay and restart persistence on disposable data only | NOT RUN |
| REL-01 / Q-R1 | R-16/18; ADR-005 | PG transaction rollback and sink failure injection, durable outbox retry/restart/dedup, failed delivery visible; observed assertion never mutates commercial state | NOT RUN |
| ARCH-01 / Q-G1 | I-01 through I-12; ADR-005..009 | Registry deny-all production outbound and synthetic/flag-off boundaries preserved; no canonical edits or silent CE-1/ID-1/ID-2 resolution; separate known limitations from release gates | NOT RUN |

## Concrete browser fixture proposal

Add a separate OIDC acceptance Playwright configuration; preserve the legacy regression lane. Start a test-only bootstrap that creates a Nest Fastify app from compiled AppModule with AUTH_MODE=oidc, unsigned-token mode disabled, browser OIDC enabled, loopback origin, DEMO_WORKSPACES=false and a fresh disposable PG database. Apply additive migrations. Bootstrap only workspace, platform/external identity and memberships through MEMBERSHIP_STORE (owner, recipient, viewer, bystander, admin, foreign-workspace actor). No lead, work, handoff, envelope, outcome, context or commercial audit records may be seeded.

Run a loopback-only fixture IdP with runtime-generated asymmetric signing keys, JWKS endpoint, authorize account chooser form and token endpoint. Authorization validates exact client/redirect, response_type=code, scope, S256 challenge, state and nonce. Store short-lived single-use code bound to chosen subject, client, redirect and challenge. Token endpoint verifies code_verifier then returns signed id/access tokens with correct issuer, audience, subject and nonce; do not return keys/tokens from the browser account chooser. Use distinct browser contexts for owner/recipient/viewer. Select fixture accounts through IdP UI and follow real redirects. IdP keys are ephemeral; fixtures contain no real credentials and contact no provider.

Full journey must create and handoff exclusively using visible UI forms. API calls are permitted for read-only verification and dedicated negative protocol tests, never as fallback business writes. Setup assertions should prove business tables initially empty. A post-login network recorder can reject test-originated business write helpers while allowing normal page fetches. Persistent restart test restarts only application against same disposable PG, preserves IdP fixture, expects sign-out, reauthenticates through UI and verifies the previously UI-created history.

Synthetic test text remains fabricated even when testing isSynthetic=false filtering; that flag is application classification, not permission to introduce customer data. Record that distinction explicitly.

## Completion criteria and limits

QA-02 requires integrated API/auth/UX, independent full browser journey and targeted negatives plus relevant PG/HTTP regressions. A red new test is a blocker or documented incomplete capability, never converted into a skip. Coverage must meet repository thresholds including 100% security-critical paths or explicitly remain an unmet release condition. Test retries may diagnose flakiness but cannot erase first-attempt evidence. Retained Playwright artifacts may contain fixture content and auth codes: keep local bounded artifacts and do not publish credential-bearing traces.

Loopback IdP validation proves protocol integration with a controlled issuer. It does not prove a real IdP deployment, customer usability, multi-day adoption, commercial value, restore RPO/RTO or production provider approval. External usability and owner gates remain distinct.
