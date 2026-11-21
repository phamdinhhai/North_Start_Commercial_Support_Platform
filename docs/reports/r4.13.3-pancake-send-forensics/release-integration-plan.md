# Release integration plan - R4.13.3

## Preconditions

Release the integration only from a clean, reviewed SHA with migrations and
canonical hashes recorded. Keep synthetic-only mode as the default. Provider access
is out of scope for this release; credentials, cookies, tokens, and raw private
payloads must not enter the repository or test logs.

## Verification

Run `npm run typecheck`, focused adapter tests, the full Vitest suite, and `npm run
build` from `product/`. Exercise synthetic WAL replay, duplicate replay,
changed-payload quarantine, cursor restart/gap, lease fencing, revocation,
scope/RBAC denial, HMAC/hash verification, and append-only audit checks. Verify
that `SEND_UNRESOLVED` remains terminal and that `CurrentOwner=NOT_OBSERVED` never
becomes ownership.

The release gate must assert Customer and Lead separation, immutable stable Lead IDs,
raw evidence retention, unknown visibility, and absence of outcome, revenue,
attribution, merge, autonomous AI mutation, and outbound retry projections. Adapter
contracts must remain an anti-corruption boundary: provider semantics are mapped to
observations and receipts only.

## Operational decision

If any check fails, quarantine the evidence and retain the previous synthetic SHA.
Do not edit canonical files or historical migrations. No merge, push, PR update,
provider call, token rotation, or protection change is performed by this plan.

Manual review of the unresolved send is a separate human gate; it cannot be replaced
by synthetic output or a new POST.
