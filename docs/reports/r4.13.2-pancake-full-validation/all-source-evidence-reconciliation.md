# Machine evidence reconciliation

| Evidence class | Count | Interpretation |
|---|---:|---|
| Documented source files | 171 | Present in local corpus; parser/hash verified |
| Observed runtime behavior | 0 | No runtime/provider calls allowed for this validation |
| Live provider confirmation | 0 | Deliberately deferred; credentials never emitted |
| Deferred claims | 171 | Require governed fixture or approved live probe |

All capability records are therefore **documented=true, observed=false, live=false, deferred=true**. YAML/JSON/HAR/devtools files are classified as developer evidence; Markdown files as functional/grouped documentation. North Start mappings are hypothesis mappings for later adapter review and do not assert canonical semantics.

Security handling: `.env`, cookie exports and any token-like material were not copied; only byte length and SHA-256 appear in the inventory.
