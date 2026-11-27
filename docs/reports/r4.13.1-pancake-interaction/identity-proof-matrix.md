# R4.13.1 identity proof matrix (ID-01)

| Edge / claim | Minimum proof | Status from R4.13 evidence | Allowed interpretation | Explicitly forbidden inference |
|---|---|---|---|---|
| Authenticated account exists | Redacted provider account identifier in authenticated account response | **Observed, bounded** (`/me` token accepted) | Credential was accepted by that private endpoint at that time | Owner equality, admin role, Page access, write rights |
| Account → native Page | Fresh target-scoped provider entitlement matching the authenticated principal and native Page; Page enumeration is outside this test scope | **Blocked** | None | Alias, URL segment, token success, or field presence proves Page binding |
| Page token → native Page | Provider-attested token issuance/scope for exact Page | **Blocked** | None | Reusing a token or successful history read proves ownership |
| Native Page → conversation | Exact requested Page/conversation echoed by response and each message | **Observed for one bounded read** | Target object scope matched | Complete history, chronology, lifecycle, commercial episode |
| Conversation → contact | Explicit stable provider contact ID in exact conversation context | **Context present; identity linkage blocked** | `PROVIDER_OBSERVED` contact reference only | Customer identity, merge, phone/name equivalence |
| Alias → native Page/conversation | Non-redirecting authenticated lookup with response IDs matching target | **Blocked** (302, not followed) | None | URL alias or `c_id` query is evidence |
| Provider contact → North Start Customer | Human evidence context plus reversible, audited linkage | **Blocked / deferred** | Keep external reference namespaced | Automatic Customer creation/merge |
| Conversation → Lead | Explicit human association with stable Lead ID | **Blocked** | May remain unlinked/UNKNOWN | Thread-wide automatic Lead attachment |
| Read target → mutation target | Fresh target snapshot, expected effect, readback, recovery, idempotency | **Blocked** | Read-only evidence only | Send/edit/delete/assignment/tags/notes/status |
| Mutation → commercial outcome | Separate Sales evidence and policy action | **Blocked** | No outcome claim | Won/Lost, payment, revenue, attribution |

## Proof-level vocabulary

- **P0 — absent:** no evidence; display UNKNOWN and quarantine where required.
- **P1 — observed:** provider returned a field or accepted a request; scoped to that response and time, never ownership or identity proof.
- **P2 — exact object scope:** requested native Page/conversation/message IDs match all checked objects; completeness remains UNKNOWN.
- **P3 — authenticated chain:** account, Page, credential, conversation, and contact edges each have independent provider-attested evidence; required before any mutation review.
- **P4 — mutation-ready:** P3 plus fresh precondition snapshot, expected effect, readback, cleanup/recovery, recipient permission (for outgoing), authorization, and idempotency. No current evidence reaches P3/P4.

## Quarantine triggers

Redirect/login; 401/403/429; unknown response shape; missing IDs; Page or conversation mismatch; contact ID missing/ambiguous; cross-workspace collision; stale snapshot; incomplete pagination presented as complete; or any attempt to treat URL/field presence as proof.

All unknowns remain visible. This matrix does not authorize provider calls, credential reuse, production admission, or resolution of open decisions.
