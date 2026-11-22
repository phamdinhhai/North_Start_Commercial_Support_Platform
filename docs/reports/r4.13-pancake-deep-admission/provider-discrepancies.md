# Provider contract and runtime discrepancies

Root public documentation retrieval/validation: 2026-11-20 UTC. Anonymous documentation fetches did not use account credentials and are not provider-account tests.

| Source | Bytes / SHA256 | Current validation |
|---|---|---|
| Official REST `https://developer.pancake.biz/openapi/openapi.yaml` | 180475 / `1340453bf7ff92979e875d99577fc1948d10b2ede1d0da58c9df009258aef39f` | OpenAPIV30SpecValidator0.9.0:21 diagnostics |
| Owner local REST YAML | 186487 / `798bd7be798c01832af3c50cbca66d07fa6020e3c9bade04b3a5d34c35699d73` | Same validator:21 diagnostics |
| Official/local webhook YAML | 38933 / `ab327fea1a398553351edde68a992f96c66dbc6fc4a93045d1d23e03f8d0e09d` | Same validator:2 diagnostics |

**CONFIRMED SOURCE REPRESENTATION DIFFERENCE, informational:** parsed local/public REST YAML structures are equal under recursive comparison (zero different nodes); raw bytes differ and line-ending normalization does not explain the difference. There is no evidence of semantic contract drift between these two parsed snapshots. Do not replace source hashes or infer the exact formatting/comment cause without further comparison. Agent inventory initially recorded the hash discrepancy as unknown; this later result resolves the structural question without rewriting it.

**CONFIRMED UPSTREAM SPEC DEFECT, medium tooling limitation:** both REST snapshots still contain the existing full-validation defects (including UUID schema type, WhatsappTemplate properties.type and token route path-parameter declarations). Webhook declares OAS3.0 with top-level webhooks/without required paths. No original was modified and no compatibility overlay/client generation is claimed. The first root validator attempt failed before validation due to incompatible user-site jsonschema imports; re-execution used the existing isolated `%TEMP%/r410-pancake-validator`0.9.0 environment. Counts above come from the successful isolated validator execution, not that failed command.

**AUTHORIZED OBSERVATION, not defect:** private GET `/api/v1/me` accepted an account token query; cookie-only HTTP200 had success false. No stable public contract for this endpoint was established. The official exact-conversation messages endpoint returned the documented success/conversation/messages subset. Full response-schema conformance, error codes, pagination, edit/delete semantics, signature verification, rate-limit behavior and permissions beyond this read remain UNKNOWN.

**SECURITY LIMIT BEFORE MUTATION:** target alias HTML returned302 and was not followed. Native conversation read permission does not substitute for Page alias/contact/account binding. No arbitrary redirected host, broad `/pages` list or other inbox was requested to fill this gap. Mutation admission remains blocked.

**DESIGN LIMITATION:** `current_count` is a positional readback index. The new `pancake-history-readback.ts` planner keeps completeness/lifecycle UNKNOWN and durableResumeSafe=false. Short/empty pages do not prove reliable backfill or current provider truth. The R4.12 durable stream remains synthetic-only; real payloads are not relabeled as synthetic to bypass Gate C.

**CONFIRMED NEW-POLICY DEFECTS FIXED, medium before use:** QA reproduced manual3xx failing to stop (7 negative cases), and root reproduced missing required target keys being replaced by unknown keys (5 cases). `PancakeRequestPolicy.observe` now terminally stops every3xx; constructor validates all five own required keys. This corrects the new offline helper, not an exploited live-provider vulnerability. Exact source and regression evidence are in verification.json.
