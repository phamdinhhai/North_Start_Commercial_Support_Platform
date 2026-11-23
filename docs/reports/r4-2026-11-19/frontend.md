# Frontend / Sales UX R4

Implemented embedded operator UI, split into HTML, CSS and browser script assets; no framework or provider dependency.

- Session-first sign-in and sign-out using HttpOnly cookie authentication, same-origin requests and CSRF header. Development token input is visible only when session endpoint explicitly reports devTokensAllowed; no endpoint-failure fallback or browser persistence.
- Accessible native dialog forms cover lead intake (immutable synthetic checkbox), context revisions, assignee-directory handoff, acceptance, stage advance, independent action creation, declared/observed completion, reschedule, reopen successor, outcome claim and correction. New workflow commands carry selected expectedVersion and per-dialog idempotencyKey. Legacy endpoints remain server-compatible, but UI uses versioned commands wrappers.
- Accessible lead list makes pre-handoff leads discoverable, with queue view, bounded pagination and real/default, synthetic and all classification filters. Synthetic labels visible in list/detail. Stable lead ID displayed.
- Evidence viewer shows actual whitelisted raw speaker/utterance plus provenance metadata, truncation, acquisition and mapping state. Missing/erased evidence is explicitly unavailable/redacted. No raw HTML rendering. Detailed append-only timeline shows actor/time/reason/previous and successor data supplied by API. Attribution/business truth stay UNKNOWN; Won remains a claim.
- Feedback is a real API request; unavailable service is shown honestly. Categorical learning hooks run after successful operations; telemetry failures never change business success and contain no conversation/context text.
- Pending writes disable buttons, forms retain server errors, 401 clears sensitive lead state, 403 shows permission refusal, 409 disables blind retry and offers explicit reload. Selection/list epochs suppress late responses. Credentials remain memory-only.

## Verification

- npm ci completed from lockfile; five existing moderate advisories reported, no dependency mutations.
- npm run typecheck and npm run build pass.
- `npx playwright test --config playwright.operator-component.config.ts`: 3 Chromium component tests pass with HTTP fixtures: production session/CSRF + escaped raw evidence + expectedVersion/idempotency submission; fail-closed session discovery; double-submit suppression + stale version reload.
- `npx vitest run src/api/operator-assets.spec.ts`: browser-script syntax and embedded packaging check.

These component checks do not prove integrated persistence, OIDC or full commercial journey; integrated QA lane must exercise those. Prior browser regressions need session fixture, explicit synthetic filter, lead-list/queue selection and dialog-selector updates (old prompt workflow removed).

## Integration contracts / selectors

Versioned existing commands: `/leads/:id/commands/handoff|accept|advance|outcome`; other routes follow backend-api-contract.md. Session contract supplied by root. Feedback `/v1/pilot/feedback`; telemetry `/v1/pilot/learning`.

Main selectors: #new-lead, #classification, #view, #load, #refresh, .queue-item, #edit-context, #handoff, #create-action, #evidence, #audit, #outcome, #feedback. Work buttons #accept-ID/#complete-ID/#reschedule-ID/#reopen-ID; outcome #correct-ID. Dialog #command-form/#submit-command/#cancel-command. Dynamic labelled fields available by accessible label.

## Limits

No provider enablement or real-data exercise. Directory currently displays internal user ID + role because contract supplies no personal display label. Evidence and detailed history use readable structured JSON for metadata; original utterance is separately displayed as text. Backend remains authority for owner/recipient permissions; UI presents command controls and surfaces explicit authorization refusals. No CSV import, identity merge, AI execution or attribution engine introduced. Full OIDC login cannot be exercised on this isolated frontend branch until root integrates auth.
