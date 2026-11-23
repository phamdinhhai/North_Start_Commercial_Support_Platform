# R4 contracts and implementation boundaries

Status: initial design for specialist review. API workflow details require Backend owner sign-off before UX implementation.

## Browser authentication

Root owns ports/browser-session.ts, infra/auth/browser-session*.ts, api/browser-session.controller.ts, OIDC request-hook integration and composition. No role grant changes.

- GET /v1/auth/login: redirect to configured OIDC authorization endpoint using code flow, PKCE S256, state and nonce. Bind login transaction to HttpOnly SameSite=Lax cookie; fixed configured redirect URI; no arbitrary returnTo.
- GET /v1/auth/callback: consume state once, verify cookie binding, exchange code server-side with verifier; verify ID token nonce/issuer/client audience and access-token subject/issuer via existing asymmetric verifier; no auto-provision. Store opaque session ID server-side, bounded by access-token expiry and 15 minutes; no refresh token retention.
- GET /v1/auth/session: no token returned; authenticated context (userId, workspaceId, role), csrfToken and expiry. Membership rechecked each request. Anonymous response includes login availability; no automatic privileges.
- POST /v1/auth/logout: requires same-origin and CSRF for cookie session, deletes server session and clears cookie.
- Cookie-mode mutations require matching configured Origin plus X-CSRF-Token; bearer clients retain existing contract. Ambiguous bearer+session rejected. Cookie authentication attaches bearer only inside server request hook before existing OIDC authentication.
- Secure HttpOnly SameSite=Lax cookie in pilot/production; loopback HTTP allowed only local/test. Sessions process-local: restart signs users out, never loses business data. Horizontal sessions/refresh are deferred, documented limits.
- OIDC_BROWSER_ENABLED opt-in; AUTH_MODE=oidc required. Deployment configuration supplies public origin/client ID/authorize/token endpoints. No production token-paste fallback. Existing development token field may remain only as explicit legacy/test option.
- Tests use generated signing keys and a loopback fake IdP; no real provider credentials.

## Workflow API direction

Backend owns new closure use cases/API controllers and existing pilot controller/store changes. Root owns app.module/pilot-loop.module composition edits; backend supplies wiring instructions. Avoid adding code to the already nearly-500-line pilot service; use focused application services/ports.

- Preserve existing /v1/pilot/scenarios and handoff/accept/complete/reschedule/outcome/audit contracts.
- Add lead list query so newly created/unassigned leads remain discoverable before a work item exists.
- New commands use authenticated server workspace/actor, capability checks plus owner/work policy, input validation and expectedVersion. Idempotent command key where repeat submission could append effects.
- Context changes append revisions; evidence immutable. Lead detail reports current context/version, history/provenance/source and immutable synthetic classification.
- Evidence read is bounded to the requested authorized lead's accepted evidence; response has source/capture times, acquisition mode/status, digest metadata and permitted raw content. Record access without exposing payload into logs/telemetry.
- Independent next action is lead-scoped; reopen creates audited successor rather than rewriting completed record. CE-1 transitions remain unchanged.
- Outcome correction cites outcome ID + reason and appends supersedes history; existing generic outcome creation must not masquerade as correction.
- Sales handoff selector needs a minimal authorized same-workspace assignee directory; no cross-workspace identity list or implicit membership creation.

## Synthetic policy proposal

Allow same-workspace coexistence only as labelled fixture/data provenance. Classification is immutable at intake and visible at lead/work/evidence/outcome projection. Lists default to real (non-synthetic), with explicit synthetic/all filters; demo remains isolated. No synthetic events in business KPI/attribution/learning aggregates. Technical synthetic QA events may be retained under an explicitly separate classification, never relabelled real. Security + Backend review this policy before implementation.

## Schema reservation

| Migration | Owner | Purpose |
|---|---|---|
| 012 | Security | versioned digest metadata, additive and legacy-compatible |
| 013 | Backend | context/workflow closure additive schema |
| 014 | Reliability | durable assertion outbox |
| 015 | Reliability | data lifecycle overlay/policy, only if needed |

Each owner sends design, rollback implications and tests before another module depends on the migration. Root reviews, then workers implement in separate worktrees. Existing SQL migrations 001–011 remain unchanged.

## Safety review rules

- No production/shared database mutation or data deletion. Test cluster created fresh for each lane.
- No CE-1/ID-1/ID-2 resolution, attribution, AI execution or Pancake enablement.
- Authorization improvements implement the existing matrix; any proposed new grant is separated as an unimplemented approval item.
- Export/delete requires admin role and retention/hold audit. Content erasure must keep immutable audit and clearly show evidence unavailable; no disguised raw overwrite.
- Delivery recovery is internal to PostgreSQL; no new streaming/microservice framework.
