# Pancake identity binding evidence

## Current evidence

| Edge | Evidence | Status |
|---|---|---|
| Account principal | Fresh private `/api/v1/me` with Owner account token returned HTTP 200 and provider success; account/session objects were present | AUTHORIZED PROVIDER TESTED, endpoint acceptance only |
| Account → Page | Fresh page-scoped permission request for candidate native Page returned HTTP 200 with `success=false`; no account-user match or permission grant | BLOCKED |
| Page token → Page | Existing Owner capture contains a successful exact-page token-generation response; token was reused memory-only. This is historical private evidence, not fresh independent entitlement proof | UNKNOWN |
| Page → conversation | Two fresh official message reads echoed the exact requested conversation and every returned message matched candidate Page/conversation IDs | AUTHORIZED PROVIDER TESTED, bounded object scope |
| Conversation → contact | Both pages returned a contact object, customer references and profiles; contact reference remained stable across offsets | PROVIDER_OBSERVED, not Customer identity |
| Alias → Page | Cookie-authenticated alias HTML returned 200 and contained the alias, but no candidate Page/conversation bootstrap IDs; earlier unauthenticated request returned 302 | BLOCKED / UNKNOWN |

The native contact ID and message IDs were compared only in process memory. Sanitized journals contain booleans/counts; no raw identifiers, names, messages, token or cookie values are committed. The successful object read does not prove account ownership of the Page, mutation authority, or North Start identity merge.

## Proof decision

P1 authenticated chain: **FAIL / BLOCKED**. P2 bounded history scope: **PASS**. P3 mutation-ready identity: **BLOCKED**. The permission response failure and missing alias bootstrap prevent a send. URL components, JWT shape, `success=true`, contact field presence and stable conversation reads are insufficient substitutes for Account→Page authority.

Required next proof is a fresh provider-attested Account→Page response that matches the account principal and grants the required capability, or an equivalent target-scoped official binding. Do not enumerate Pages or generate/rotate tokens to obtain it.
