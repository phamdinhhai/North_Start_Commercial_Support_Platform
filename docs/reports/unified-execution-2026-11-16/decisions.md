# Decision boundaries for unified execution

Delivery-tier review at c9c2de814d0bc7bec9e74a918a51d6a7a16067b2, with operator patch 70c28ec0a168a565d57551d371bab4ff5e2a4885 inspected independently. This document records constraints, not approvals. See architecture-baseline.md for source evidence and unverified execution limits.

| Open decision | Frozen boundary / permitted interim work | Human resolution still required |
|---|---|---|
| CE-1 | Existing hypothesis in `product/src/domain/lead/lead-state.ts:3`; operator buttons may call existing guarded transitions. Research receipts/checkpoints cannot create commercial stages. | Product/Data transition table and Gate #A; no richer states by implementation convenience. |
| CE-2 | Keep draft inference isolated, raw observation/receipt separate; `COMMERCIAL_EVENT_MODEL.md:24` forbids silently selecting generalized event scope. | Product/Architecture RFC before event schema generalization. Existing inferred-only code is interim, not canonical settlement. |
| MM-1 | Source, acquisition lineage and credit remain separate; attribution UNKNOWN (`product/src/domain/lead/lead.ts:33-38`). Ads metrics or Won claim do not determine credit/revenue. | Attribution model and versioned semantics. |
| ID-1 | Preserve external IDs and stable episode IDs; no automatic merge. Browser page/conversation identity is external evidence. | Merge thresholds, evidence and reversible manual policy. |
| ID-2 | CRM mapper resolves external references only; does not create canonical commercial semantics. | Exact canonical-to-CRM object mapping approved separately. |
| PM-1 | Existing owner/assigned-work access only; tenant/page-bound research enrollment grants transport scope, not Sales access to an inbox. Unsigned app credentials remain local/test. | Full capability matrix and real credential model; no manager or adapter privilege expansion. |
| LG-1 | Synthetic/manual continuity loop stays the current baseline. Adaptive research is an experiment; PH7+ proposals remain deferred. | Human scope/phase promotion and Continue/Narrow/Pivot/Stop learning gate. |

Authoritative list: `docs/canonical/OPEN_DECISIONS.md:19-27`; no row closed by this execution. Canonical invariant compliance is not inferred from passing tests (`DOMAIN_INVARIANTS.md:12`).

## Research-enrollment compatibility conditions

The proposed D/E signed tenant/page-bound enrollment and PostgreSQL receipt/checkpoint implementation can fit the adapter boundary if it remains explicitly experimental local/test functionality and all these properties hold in final code/tests:

- Signature, audience/environment, expiry/replay and tenant/page/session scope checked before observation receipt; callers cannot self-assert broader upstream permission.
- Receipt and checkpoint persist atomically with idempotency and concurrency tests; rejected/duplicate/conflicting batches cannot advance progress or silently lose evidence.
- Unknown action/business causality is explicit; connectivity acknowledgement is neither customer evidence nor inferred CE nor completed work.
- No upstream credentials, raw conversation PII or tokens in research logs/telemetry; production/live enablement remains separately gated by captured contract, permission and secret controls.
- Manual fallback remains usable; no generic connector/control plane is introduced solely for this experiment.

These are review criteria derived from `ARCHITECTURE_CONSTITUTION.md:29-41,64-69` and `INTEGRATION_PRINCIPLES.md:49-65`, not a new permission model. Exact D/E commits and integration test results must be recorded by their reviewers. They were not available in A's baseline and are not approved prospectively.

## Gate sequencing

1. Engineering review of persistence/migrations before release; close identified scope/parity/claim durability issues with evidence.
2. Product/Data/Architecture Gate #A for CE-1/CE-2 remains open; interim manual tests do not freeze it.
3. Pancake spike verdict before live PH4 use, including exact read contract and security/delivery semantics. Research capture is evidence toward this gate, not closure.
4. PM-1/real-data controls before commercial pilot; measured external-user loop before L3/L4/L5 claims.
5. Explicit productization/operating/legal gate before R-29..R-41; no automatic promotion from current research.
