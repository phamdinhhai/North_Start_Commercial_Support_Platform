# Provider sandbox admission checklist

This checklist is a control gate, not an authorization. Current status: **BLOCKED — PROVIDER AUTHORIZATION**.

## Required owner evidence

- [ ] Named provider account/Page and business owner; written North Start workspace authorization.
- [ ] Provider-approved synthetic/test assets only; explicit assurance no real customer data enters the test.
- [ ] Exact endpoint/version and read-only capability scope; outbound/send/write scopes disabled.
- [ ] Provider app approval/reviewer/tester status and current terms/policy review.
- [ ] Credential custody approved: vault/KMS reference only, rotation, expiry, revocation and emergency stop owner.
- [ ] Server-side workspace/connection binding; payload IDs cannot select tenant or credentials.
- [ ] TLS/egress allowlist, callback URL, body-size/content-type limits and raw-byte signature verification where documented.
- [ ] Durable receipt/checkpoint transaction tested before acknowledging delivery; duplicate/replay and poison handling tested.
- [ ] Retention, export, deletion and downstream cleanup plan with dates and accountable operator.
- [ ] Restore/rollback/disable procedure rehearsed on fabricated data.
- [ ] Explicit owner approval for the exact network test window and stop conditions.

## Provider-specific blockers

**Pancake Conversations:** official REST/webhook source hashes are pinned, but source validation fails (21/2 diagnostics), messaging webhook authenticity/replay contract is not established, and no page token/account rights are available. Pancake POS keys and semantics are separate.

**Meta Page/Messenger:** official docs and HMAC helper are researched/offline verified, but App/Page ownership, exact scopes, app review, secret custody, webhook subscription, replay policy and synthetic Page are not provided. HMAC validity does not prove workspace binding.

## Admission decision

Until every required item is evidenced, the only allowed work is offline emulator, contract testing, fixture replay, schema review and synthetic/local recovery. Do not use an existing real inbox or local fixture IdP as a provider sandbox. When admitted, run read-only fabricated tests first, capture request/response metadata without raw personal content, immediately test revoke, then return to disabled state.
