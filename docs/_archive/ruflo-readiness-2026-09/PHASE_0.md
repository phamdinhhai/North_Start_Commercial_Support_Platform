# Phase 0 — Canonical Understanding

## Launch instruction

Use this exact instruction to start:

> Read `docs/project/ruflo-readiness/PROTOCOL.md`. Execute **only Phase 0 — Canonical Understanding**. Do not begin Phase 1. Stop at the Human Gate.

---

## Objective

Prove that the product and its invariants are understood correctly **before** reasoning about Ruflo architecture.

Do not inspect Ruflo deeply.

Do not design the final engineering system.

Do not implement product features.

---

## Required reading

Read the complete canonical set:

- `docs/canonical/README.md`
- `docs/canonical/PRODUCT_CONSTITUTION.md`
- `docs/canonical/DOMAIN_MODEL.md`
- `docs/canonical/DOMAIN_INVARIANTS.md`
- `docs/canonical/ARCHITECTURE_CONSTITUTION.md`
- `docs/canonical/COMMERCIAL_EVENT_MODEL.md`
- `docs/canonical/IDENTITY_MODEL.md`
- `docs/canonical/MEASUREMENT_MODEL.md`
- `docs/canonical/TRUST_AND_EVIDENCE.md`
- `docs/canonical/INTEGRATION_PRINCIPLES.md`
- `docs/canonical/GLOSSARY.md`
- `docs/canonical/OPEN_DECISIONS.md`

Read enough of:

`docs/north-star/**`

to distinguish strategic end-state from current scope.

Do not linearly consume unrelated research archives.

---

## Mandatory first step

Create/refresh the baseline evidence required by `PROTOCOL.md`.

Do not inspect secret-bearing config contents.

Verify that the allowed write boundary is limited to:

`docs/project/ruflo-readiness/**`

If this cannot be enforced or verified, report the limitation.

---

## Required output

Write:

`docs/project/ruflo-readiness/00-canonical-understanding.md`

with the following sections.

### 1. Product identity

Explain what the product is and what it is explicitly not.

### 2. Current phase vs North Star

Separate:

- current LVP / current normative scope;
- long-term five-engine / closed-loop direction.

### 3. Frozen invariants

Create a table:

```text
Invariant
Meaning
Canonical source
Exact file:line
Engineering implication
```

Do not summarize without line evidence.

### 4. Integration boundaries

Explain how the core relates to:

- Pancake;
- ad platforms;
- phone/Zalo/other sales channels;
- CRM systems;
- manual/synthetic adapters.

### 5. AI / truth boundary

Explain:

```text
Interaction
→ AI interpretation
→ Commercial Event
→ Evidence
→ Policy
→ Action
```

and why this prevents opaque AI mutation.

### 6. Trust / provenance model

Explain:

- acquisition mode;
- assertion status;
- evidence;
- confidence;
- append audit;
- reversibility;
- UNKNOWN.

### 7. Open decisions

List currently unresolved canonical decisions and what an implementation agent must do when one is required.

### 8. Authority hierarchy

State the effective source-of-truth precedence.

### 9. Ambiguities / NEEDS_EVIDENCE

List anything not established confidently.

---

# Mandatory comprehension challenge

Answer these scenarios using canonical evidence.

For every scenario state:

- decision;
- reason;
- exact canonical source;
- whether implementation may proceed.

## Trap A

A story asks to merge `Customer` and `Lead` into one table/entity "for simplicity".

What do you do?

## Trap B

A developer proposes using Pancake conversation ID as the canonical Lead ID.

What do you do?

## Trap C

An LLM extracts "High Intent" and directly updates a CRM-like state field.

What do you do?

## Trap D

A dashboard has no reliable acquisition linkage, so the team proposes assigning the last observed conversation channel as acquisition source.

What do you do?

## Trap E

A story requires choosing first-touch vs last-touch revenue attribution.

What do you do?

## Trap F

A feature appears in the North Star but is explicitly outside the current LVP.

Does North Star presence alone authorize implementation?

---

# Self-check table

At the end include:

```text
Question
Answer
Evidence
Confidence
Human reviewer status
```

Leave `Human reviewer status` as `PENDING`.

---

## Phase 0 exit criteria

Phase 0 is not complete unless:

- all canonical files above were inspected;
- current scope and North Star were separated;
- each critical invariant has exact file:line evidence;
- all trap scenarios were answered;
- no OPEN_DECISION was resolved;
- canonical files were not modified;
- no unexpected filesystem/config mutation occurred;
- before/after mutation check was recorded.

STOP after writing the report.

Do not begin Phase 1.
