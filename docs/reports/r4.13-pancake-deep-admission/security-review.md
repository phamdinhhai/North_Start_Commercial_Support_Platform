# R4.13 bounded provider research security review

Agent 3 reviewed baseline `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3` in an isolated worktree. This agent performed no provider requests, read no credential/cookie/raw capture files, and made no provider mutations. The orchestrator exclusively owns live execution and its sanitized journal.

## Implemented offline control

`product/src/application/pancake-admission/pancake-request-policy.ts`, `PancakeRequestPolicy`, is a pure server-owned request admission helper, not credential authentication or production transport activation. Its exact routes must be supplied by a trusted, reviewed harness after provider-derived account/Page/conversation/contact verification. A reference string is not proof of verification; caller-controlled registries or targets are prohibited. No route is enabled by default and no Page discovery/inbox-list route is bundled.

The gate requires HTTPS on a bounded host allowlist, exact reviewed method/path/capability, no URL query/fragment/user-info, and exact verified target. Private observed routes remain labeled `PRIVATE_OBSERVED`; tests use fabricated paths and assert no real endpoint contract. Default request ceiling is 25, maximum 25, with at least 1,000ms between admissions. HTTP 401/403/429, redirects and scope mismatch terminally stop subsequent requests once reported through `observe`. The sequential harness must call `observe` for every response, disable automatic redirects/retries, validate returned scope, and stop on unknown outcomes. It must not treat this helper as a network interceptor.

Mutations require precondition snapshot reference, expected effect, readback and cleanup/recovery plan. Outgoing messages additionally require recipient-permission evidence. Actual payload target construction, response scope validation, irreversible-effect avoidance and recipient consent remain harness responsibilities. Exact route admission alone cannot prove a body targets the approved contact. Only agent-created content may be edited/deleted; pre-existing provider history remains protected.

Errors and admission receipts are categorical and contain no submitted URL, identifiers, headers or body. The helper accepts no credentials or raw body and performs no logging. The trusted process must not serialize the policy instance, which contains private target/route configuration. Credential loading, HTTP clients, artifacts and traces still require independent redaction controls. Secrets must stay outside worktrees; hashes of secret/cookie files must not enter public reports.

## Findings and limitations

| Classification | Severity | Finding / control |
| --- | --- | --- |
| SECURITY RISK BEFORE LIVE | High | Arbitrary client JSON must never become authenticated provider identity. The helper accepts trusted server-owned configuration only; it does not establish provider trust. |
| DESIGN LIMITATION | Medium | Query-string authentication is deliberately unsupported by this generic helper. A documented provider requirement needs a separately reviewed secret-aware harness; never log authenticated URLs. |
| SECURITY RISK BEFORE LIVE | High | Provider success must not imply North Start real-data admission. Gate C remains closed; production credential custody and broad sync remain disabled. |
| NOT VERIFIED | Unknown | Credential validity, actual provider account/contact authorization and live mutation outcomes are outside this agent's execution. Use orchestrator evidence, not these offline tests, for claims. |
| DESIGN LIMITATION | Medium | Exact route/target metadata validation cannot independently authenticate the response, enforce payload contents or prove cleanup. Those are mandatory executor checks. |

Pancake webhook authenticity remains capability-specific and unverified here. Meta signatures must not be applied to Pancake by analogy. No global token rotation, Page settings, finance, advertisements, account permissions or bulk export is authorized by this implementation.

## Offline verification

On Node runtime supplied by the local environment, from `product/`:

- `npx vitest run src/application/pancake-admission/pancake-request-policy.spec.ts`: 23 passed, zero skipped.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run architecture:check:strict`: PASS, zero findings.

Tests cover unsafe host/protocol/query/fragment/user-info, unknown capability/method/path, cross-account/Page/conversation/contact mismatch, empty route registry, verification absence, mutation recovery and recipient permission, pacing/ceiling, terminal authorization/rate-limit/scope/redirect stops and configuration copying. No full regression, live connectivity, human Sales validation, coverage percentage or production approval is claimed by this specialist report. Independent QA and exact integrated-source verification remain required.
