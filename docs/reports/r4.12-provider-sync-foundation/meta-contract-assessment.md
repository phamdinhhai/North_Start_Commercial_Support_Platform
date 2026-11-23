# Meta direct contract assessment

**Classification:** `RESEARCHED` + bounded `CONTRACT_PREPARED`; offline signature/batch inventory is `OFFLINE_VERIFIED`; live admission is `BLOCKED — PROVIDER AUTHORIZATION`.

## Current official source retrieval

Anonymous HTTP retrieval on 2026-11-20:

- Graph webhook getting started: HTTP 200, 258924 bytes, SHA-256 `2ccd1d63357482c0b37820a034ebe9ca4ee5178c67aa75b43b93d9c118e7198b`.
- Messenger platform: HTTP 200, 1184752 bytes, SHA-256 `59ca114570e456127c112c51c19844d7fd8fed3b88d54a03e9ba21d66a611390`.

These are mutable HTML snapshots, not immutable API contracts. Current docs describe raw-byte HMAC-SHA256 validation with `sha256=` in `X-Hub-Signature-256`, but signature validity alone does not authorize a workspace or prove Page ownership.

## Contract matrix

| Area | Bounded contract | Unknown/required before admission |
|---|---|---|
| Page/app binding | Webhook `object=page`, entries contain Page id and messaging events | App review, Page subscription, current Page ownership and exact scopes |
| Authentication | HMAC-SHA256 over untouched request bytes before JSON parsing | Secret custody/rotation, key version, replay policy, account binding and operational revocation |
| Batching | Iterate all entries/events; do not assume `messaging[0]` | Provider delivery order, retry window and maximum body contract |
| Message identity | `message.mid` is native message identity; sender/recipient are Page-scoped channel identities | Conversation readback completeness, edit/delete ordering and retention |
| Event classes | Text, echo, attachment and unsupported are distinct | Full field support, postback/standby/read/delivery behavior for selected capability |
| Echo | Outbound echo is provider observation, not inbound customer intent | Correlation to an authorized outbound action; no outbound action is enabled here |
| Attachments | Preserve bounded reference; never fetch attachment URL in offline parser | URL expiry, malware/PII handling, media retention and rights |
| Errors | Reject malformed/unsupported payload categorically | Provider retry semantics and whether invalid payloads are retried |

R4.11 `inventoryMetaOffline` walks up to 100 entries/1000 events, binds Page ids supplied by a server-owned set and labels unsupported events without normalizing them. `verifyMetaSignature` checks exact raw bytes, bounded body size and constant-time comparison. No HTTP receiver or App/Page token client is registered. The narrow synthetic decoder remains intentionally insufficient for live webhook parsing.

## Required Meta admission evidence

1. App and Page ownership, exact app mode and reviewer/tester status.
2. `pages_manage_metadata` and any messaging/read scopes granted to the selected Page/app; no assumption that a Page token is read-only.
3. Webhook callback URL/TLS and verify-token custody, raw-body preservation and HMAC key rotation.
4. Synthetic-only tester Page and fabricated messages; no production inbox.
5. Connection binding from verified provider principal to one workspace/page; payload Page id cannot select tenant.
6. Replay/duplicate handling, retry/backoff and revoke drill.
7. App Review/Business verification evidence where current capability requires it.
8. Cleanup of subscription, token, app tester and retained evidence after the test.

## Unsupported/deferred

Personal Facebook/Instagram accounts are not admitted by Page/Messenger contracts. Business/Creator Instagram, TikTok, Zalo, Ads and POS each need independent capability evidence. No Meta SDK or custom license code was copied. No Page, conversation, message, outbound operation or conversion endpoint was called.
