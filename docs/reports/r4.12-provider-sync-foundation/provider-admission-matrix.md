# R4.12 provider admission matrix

Observed 2026-11-20 on baseline `4503e80d54853b15da405f7c36df298aa0852eb0` / source `4fe69e396f1db665e41c3ec4b8ad324e9dd2f92b`. This is anonymous documentation research and offline-contract readiness. No provider account, token, webhook subscription, customer conversation or live data was accessed.

Admission levels are cumulative and intentionally cannot be represented by one `connected` flag:

1. `RESEARCHED` — first-party documentation or source was inspected and its retrieval evidence is recorded.
2. `CONTRACT_PREPARED` — a bounded schema/permission/error subset is written down; unsupported behavior is explicit.
3. `OFFLINE_VERIFIED` — fabricated fixtures and negative tests exercise the subset without network or provider identity.
4. `CREDENTIALS_CONFIGURED` — a secret reference exists in an approved custody system; this level is not present in R4.12.
5. `ACCOUNT_RIGHTS_VERIFIED` — provider account/page ownership, scopes and asset binding are independently evidenced; not present.
6. `AUTHORIZED_SANDBOX_READY` — owner-approved synthetic account, endpoint, ingress, retention and cleanup controls are accepted; not present.
7. `AUTHORIZED_SANDBOX_VERIFIED` — read-only fabricated sandbox run with captured request/response evidence and revoke drill; not present.
8. `LIVE_READ_ONLY_APPROVED` — explicit capability and data-governance approval; not present.
9. `PRODUCTION_APPROVED` — separate security/privacy/operations approval; not present.

| Provider/capability | Research | Contract | Offline | Credential | Rights/sandbox/live |
|---|---|---|---|---|---|
| Pancake Conversations REST read | RESEARCHED | CONTRACT_PREPARED | R4.10/R4.11 synthetic and offline transport tests | NOT CONFIGURED | BLOCKED — PROVIDER AUTHORIZATION |
| Pancake Conversations webhook | RESEARCHED; source spec has 2 validation diagnostics | CONTRACT_PREPARED only for bounded inventory | OFFLINE inventory only; no receiver | NOT CONFIGURED | BLOCKED — authenticity contract absent |
| Pancake native history/readback | RESEARCHED; opaque cursor and partial history documented | CONTRACT_PREPARED | Synthetic cursor/replay tests | NOT CONFIGURED | No completeness or sandbox evidence |
| Pancake POS | RESEARCHED in R4.10 docs | CONTRACT_PREPARED | No R4.12 live adapter | NOT CONFIGURED | Separate shop key and approval required |
| Meta Page/Messenger webhook | RESEARCHED; official docs retrieved 200 | CONTRACT_PREPARED | R4.11 batch/signature fixture tests | NOT CONFIGURED | App review, Page scopes and synthetic asset approval absent |
| Meta Page conversation readback | RESEARCHED | CONTRACT_PREPARED | No live readback | NOT CONFIGURED | BLOCKED — PROVIDER AUTHORIZATION |
| Meta personal/consumer inbox | Not admitted | NOT PREPARED | NONE | NONE | REJECTED for this release; official Page/Business APIs do not grant personal history |

No row is eligible for network activation. `SYNTHETIC_ONLY`, `OFFLINE_VERIFIED`, or a valid HMAC signature does not imply account rights, workspace authorization, message completeness, Customer identity, Lead ownership or commercial outcome.

## Evidence sources

| Source | Retrieval | Observed hash |
|---|---:|---|
| Pancake REST OpenAPI | HTTP 200, 180475 bytes, OAS 3.0.0/info 1.0.0 | `1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f` |
| Pancake webhook OpenAPI | HTTP 200, 38933 bytes, OAS 3.0.0/info 1.0.0 | `ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d` |
| Meta Graph webhook getting started | HTTP 200, 258924 bytes, HTML | `2ccd1d63357482c0b37820a034ebe9ca4ee5178c67aa75b43b93d9c118e7198b` |
| Meta Messenger platform | HTTP 200, 1184752 bytes, HTML | `59ca114570e456127c112c51c19844d7fd8fed3b88d54a03e9ba21d66a611390` |

HTML hashes pin retrieved bytes only; mutable documentation has no immutable API-version guarantee. Pancake source hashes are unchanged from the R4.11 checkpoint. Full diagnostics and unsupported capabilities are in the companion assessments.

## Go/no-go

`OFFLINE VERIFIED` is the highest status available without owner-controlled provider assets. Go for offline implementation and tests. No-go for provider network calls, credentials, webhook subscription, real or sandbox customer data, outbound messages, conversion writes or production ingestion.
