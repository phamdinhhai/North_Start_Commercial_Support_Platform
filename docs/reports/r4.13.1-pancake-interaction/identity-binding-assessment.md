# R4.13.1 identity-binding assessment (ID-01)

**Scope.** This is a documentation-only assessment of the authenticated Pancake account → Page → conversation → contact chain. It uses the official local `docs/external-apis/pancake/pancake-api-knowledge-base.yaml`, the R4.13 provider-validation journal, and the implemented offline scope/policy helpers. No provider call, credential, cookie, raw response, URL target, or customer payload was used here.

## Chain and proof rule

The chain is ordered and must be proven at each edge:

`authenticated account principal → native Page ID → native conversation ID → provider contact ID`

A User Access Token is documented as account-level; listing Pages is the account-to-Page admission step. A Page Access Token is documented as scoped to one Page; a message-history response must then echo the requested Page and conversation IDs. A contact object (for example `conv_from.id`) is only a provider-observed contact reference inside that exact conversation. It is not a North Start Customer, Lead, or merge decision. URL aliases, query parameters, field presence, names, phone numbers, or a successful HTTP response do not prove an edge.

The provider journal records: account token acceptance on a private `/me` read; one exact Page/conversation message-history read with matching native IDs and contact context; and an alias request that redirected and was not followed. Therefore account-token acceptance and one bounded object-scope read are observed, while account↔Page ownership, alias↔Page binding, contact authorization, and mutation authority remain unverified.

## Required admission evidence

1. **Account principal:** authenticated response with a stable provider account identifier, captured only as redacted evidence metadata. HTTP 200 or `success: true` alone is insufficient.
2. **Account → Page:** account-level Page listing (or equivalent provider-attested response) must contain the exact native Page ID. Never select a workspace or Page from caller JSON.
3. **Page credential → Page:** a Page token must be issued for, or independently attested to, that exact Page. Token acceptance on a data route is not ownership proof.
4. **Page → conversation:** history response must match requested Page and conversation IDs on every returned message; mismatches quarantine the response. Pagination/completeness remains UNKNOWN unless separately proven.
5. **Conversation → contact:** contact ID must be explicitly returned in the conversation context and be stable within the response. Presence is `PROVIDER_OBSERVED`, not identity merge proof; absence is `UNKNOWN`.
6. **North Start identity:** retain provider IDs as scoped external references. Customer and Lead remain separate; no automatic creation, merge, attribution, owner assignment, or revenue claim.

## Mutation preconditions

No mutation is admitted until all five edges have independently verified evidence, the target snapshot is current, expected effect, readback, cleanup/recovery, and idempotency plan are recorded, and Lead-scoped authorization is checked. Outgoing messages additionally require recipient-permission evidence. A readback that matches IDs does not authorize send, assignment, tags, notes, edit, delete, or status changes. Existing history must never be edited or deleted by cleanup. Redirects, 401/403/429, scope mismatch, unknown response shape, or conflicting IDs terminally stop the run.

## Negative cases and blocked claims

- Alias or composite URL resolves/redirects: alias binding is **UNKNOWN**; do not infer Page or conversation.
- Account token accepted by `/me`: proves only endpoint acceptance for that credential at that time; not Owner equality, Page admin, contact access, or write permission.
- `success: true` with matching top-level conversation but a message from another Page/conversation: reject and quarantine.
- `conv_from` present with a name/phone but no stable provider contact ID: contact identity **UNKNOWN**.
- Same contact ID across Pages/workspaces: retain provider namespace; never merge.
- Empty history or partial pagination: object target may be matched, completeness and lifecycle coverage stay **UNKNOWN**.
- Provider Page/contact response without North Start evidence context: do not create Customer/Lead or attach a commercial episode.

The current Gate C remains closed. What is blocked is live proof of alias/native Page/account equivalence, contact linkage and mutation authority, pagination completeness, webhook/realtime behavior, and provider-to-North-Start E2E continuity. No claim in this report upgrades those states.

## Source basis

- `docs/external-apis/pancake/pancake-api-knowledge-base.yaml` (local official contract: token scopes, Page and conversation routes).
- `docs/reports/r4.13-pancake-deep-admission/provider-validation-journal.md` (four-request bounded journal and explicit blocked matrix).
- `product/src/adapters/pancake/pancake-message-scope.ts` and `pancake-history-readback.ts` (offline exact-scope checks; completeness UNKNOWN).
- `product/src/application/pancake-admission/pancake-request-policy.ts` (server-owned target and mutation preconditions).
- `docs/canonical/IDENTITY_MODEL.md` and frozen invariants I-01, I-02, I-05, I-07, I-08, I-09, I-10, I-11, I-12.
