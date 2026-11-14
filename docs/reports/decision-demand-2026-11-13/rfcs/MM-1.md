# RFC Proposal MM-1 — Revenue Attribution Model

**Status:** Proposal only — open decision; not accepted.
**Owner:** Data + Product; Architecture reviews model/storage; Security/Privacy reviews data use.

## Question
Which attribution model, credit split, lookback/time window, correction policy, and UNKNOWN presentation should assign revenue credit without confusing conversation source or acquisition lineage with causality?

## Canonical constraints
- Conversation source, acquisition lineage, and revenue attribution are three distinct concepts (I-02).
- Attribution is product-owned measurement, not an ad-platform success claim; outcomes are claims unless corroborated.
- Every measurement claim requires provenance and versioning; conflicts remain represented.
- Honest UNKNOWN is better than false precision; full attribution is outside current LVP.
- No model, threshold, or credit rule is canonicalized in `OPEN_DECISIONS.md`.

## Alternatives
1. First-touch or last-touch deterministic credit with explicit version/window.
2. Multi-touch/fractional credit with allocation and rounding rules.
3. Evidence-only linkage that leaves credit UNKNOWN until a later governed model.
4. Per-business configurable models behind a versioned measurement contract.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — MM-1 row.
- `docs/canonical/MEASUREMENT_MODEL.md` §§1–7 — distinct concepts, provenance, LVP boundary.
- `docs/canonical/DOMAIN_INVARIANTS.md` I-02 and I-08.
- `docs/reports/rebuild-baseline-2026-11-12/handoff.md` §§71, 114–119 — attribution remains UNKNOWN and deferred.
- `product/src/application/pilot/ingest-scenario.command.ts` and tests — attribution initialized UNKNOWN.

## Recommendation (proposal, not a decision)
Do not select a model until permissioned result/linkage cases and decision use are demonstrated. First define an evidence/linkage record and report deterministic, inferred, and unknown rates. If a model becomes necessary, compare first/last/multi-touch on the same versioned cases and preserve model/version, window, allocation, corrections, and UNKNOWN output.

## Migration, security, and privacy impact
A model changes attribution tables, projections, reporting, recomputation, corrections, exports, and downstream claims; historical results require versioned reproducibility rather than overwrite. Ads, identity, order, and revenue data may be sensitive; apply purpose limitation, least privilege, consent/legal basis, minimization, retention, and redaction. No revenue-credit migration or claim is authorized.

## Required approval
Product + Data; Architecture for persistence/replay; Security/Privacy and legal review before real revenue/ads data. Any commercial claim requires an explicit measurement and validation gate.

## Expiry / review
Review when validated revenue linkage is available and before work beyond LVP, or by 2027-01-13. Until then attribution remains UNKNOWN.

## Unresolved questions
- What outcome/revenue evidence is authoritative and how is it corrected?
- Are multiple Leads allowed to receive credit for one result, and how is allocation evidenced?
- Which lookback/window matches the product decision without implying causality?
- How are model changes compared and historical reports reproduced?

## No-decision / no-go conditions
- **No decision:** no validated linkage cases, unclear authority, or no agreed decision use and approval.
- **No-go:** equating conversation source with credit, claiming causal ad impact, manufacturing credit from missing links, or silently rewriting historical attribution.
