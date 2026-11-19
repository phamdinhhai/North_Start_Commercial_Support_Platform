# R4.6 independent security cross-review

Reviewed DATA `f276715`, Commercial `59d803c`, root JWKS cutoff `0a17bd1`, and the uncommitted reliability migration017/operations draft visible on 2026-11-19. Read-only production-source review; only this report was written. No live data, provider, outbound calls or PostgreSQL writes were performed.

## Findings sent to integration owner

**Immutable history bypass (015/016):** new planning-history and contact-history tables have row UPDATE/DELETE guards but no statement TRUNCATE guards. A database principal with TRUNCATE can erase history through `TRUNCATE pilot_contact_attempt` or lifecycle tables with dependent tables handled together. Add BEFORE TRUNCATE triggers and transactional PG negative tests. Migration017 already demonstrates that pattern. This was confirmed from SQL, not executed against PostgreSQL here.

Root independently identified unconditional destructive016 rollback and UUIDv4 contact-history ordering; root owns nonempty rollback refusal and `(recorded_at,id)` keyset correction. These fixes were not present in the reviewed Commercial commit and are not claimed verified by this review.

## Boundary assessment

- DATA controller/service require authenticated non-demo admin; injected workspace/actor/as-of fields are rejected or ignored in favor of context/server time. SQL identifiers come from a closed data-class selector, values are parameterized. Policy revision uses transaction advisory lock and expected revision; preview uses repeatable snapshot and retains revision/as-of. Audit failure rolls back policy/preview. Execution is always unavailable and immutable history remains blocked. Approval reference is an opaque reviewed-schedule reference, not erasure authority.
- Synthetic vault is an isolated local/test fixture with fixed generated plaintext, no user payload/capture input or production factory. AES-GCM AAD binds workspace/id/expiry; lookup isolates workspace; access expires; audit failure prevents returned plaintext or deletion; serial purge avoids duplicate audit. It has no automatic expiry scheduler or entry-cap resource policy. Those are limitations of this fixture and must not be represented as a production research-retention implementation.
- Contact reads reuse lead-access policy; writes additionally require owner and refuse viewer/demo. Workspace originates from context. Evidence is checked for workspace, immutable synthetic classification and lead relation; attaching evidence never changes `assertionStatus:'claimed'` to verified/corroborated. Contact record appends with actor/server recording time and does not schedule work, advance state or establish revenue attribution. Source, lineage and attribution remain separate fields; missing lineage stays UNKNOWN. UI uses textContent for newly displayed claim/source values.
- PostgreSQL contact append locks scoped lead, rechecks current owner/version, inserts claim/audit/receipt and increments version transactionally. Receipt lookup is scoped by workspace+lead+key+operation. Shared closure receipt namespace, operation/digest/actor checks and lead CAS block cross-operation reuse; concurrent collision may report stale version rather than idempotency conflict, without duplicate effects. Existing PG suite exercises closure-to-contact collision; reverse and concurrent distinct-operation collisions need explicit regression coverage.
- Export adds contact records to existing bounded consistent snapshot; all new child queries include lead+workspace, and credential/membership exclusions remain. No unlinked evidence or manufactured lineage is introduced by the new query.
- Root JWKS cutoff is deny-only: last successful fetch age is checked before a cached resolver is used, including failed-refresh cooldown. Only successful install updates timestamp. Config enforces maximum age >= refresh age and finite upper bound. Existing key rotation, poisoning and signature checks remain. The dedicated test covers just-before/exact cutoff, failed refresh, cooldown and successful recovery. No absolute stale-cache finding remains open for that patch.
- Reliability017 draft: admin internal UUID, OIDC mode and research-delivery gating precede access; operations lock/filter workspace+assertion, reject replay of poison/conflicting envelopes, and refuse stop of live leases. Mutation and immutable operations audit share transaction. Inspection is metadata-only. This is a partial draft review, not final integrated approval.

## Independent execution

Executed 2026-11-19 in each owning worktree, without modifying source:

| Worktree | Command (`product/`) | Result |
|---|---|---|
| `ns-r46-data` | `npm test -- src/api/data-lifecycle.controller.spec.ts src/application/data-lifecycle/data-lifecycle.service.spec.ts src/infra/data-lifecycle/synthetic-research-vault.spec.ts` | 3 files, 23 passed |
| `ns-r46-commercial` | `npm test -- src/api/contact-attempt.controller.spec.ts src/application/pilot/contact-attempt.service.spec.ts` | 2 files, 8 passed |
| `ns-r4-gaps` at root cutoff patch | `npm test -- src/infra/auth/jwks-staleness.spec.ts src/infra/auth/oidc-config.spec.ts src/infra/auth/oidc-token-verifier.spec.ts` | 3 files, 41 passed |

These commands intentionally selected non-PG suites: zero skips, zero failures. PostgreSQL concurrency, rollback, foreign-key/trigger immutability, cross-operation receipt collisions, final cursor correction and migration lifecycle remain the integration owner's disposable synthetic PG gate. No security coverage percentage, full browser/IdP acceptance or blanket pilot readiness is asserted.
