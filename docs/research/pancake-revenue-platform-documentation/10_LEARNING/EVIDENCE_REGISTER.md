# Evidence Register

**Owner:** Product / Research  
**Maturity:** Living source of truth  
**Evidence status:** No Case 001 or primary customer evidence yet  
**Last updated:** 2026-09-10

## Evidence model

### Acquisition mode

- `automatic_observation`: product/system captured directly.
- `user_confirmed`: a person explicitly confirmed an assertion.
- `imported_record`: received from another system/file.
- `inferred`: derived by a model/rule/person.
- `unknown`: not observed or responsibly derivable.

### Assertion status

- `recorded`: direct record of an event within the observing system.
- `claimed`: statement made by a participant/operator.
- `inferred`: interpretation from records/claims.
- `conflicted`: sources disagree.
- `unknown`: insufficient evidence.

### Claim level

- **F0:** Direct observation/record.
- **F1:** Operational consequence.
- **F2:** Business consequence.
- **F3:** Commercial/market consequence.

Evidence at one level does not automatically prove the next level.

## Register

No primary evidence entries. Synthetic scenarios and repository brainstorm documents must not be entered as customer evidence.

| ID | Date | Source/case | Mode | Level | Observation/claim | Proves | Does not prove | Hypothesis impact |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | No primary evidence yet | — | — | — |

## Entry requirements

Every entry records source, captured/occurred times, context/scope, artifact pointer, privacy class, product/model/rule version where relevant, alternative explanations and an owner.

Corrections append a new entry and reference the superseded one; they do not erase history. Raw evidence is access-controlled and may be retained separately from this index.
