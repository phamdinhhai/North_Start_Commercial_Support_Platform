# R4.13.2 Acceptance Traceability

| Requirement / gate | Evidence required | QA status |
|---|---|---|
| Source inventory and contracts | Candidate commit, typed interfaces, tests | Pending |
| Security and secret hygiene | Sanitized artifacts; no credentials/raw payloads | Pending |
| Focused regression | `npm ci`, Vitest focused suites, typecheck/build | Pending |
| Catalog integrity | Counts and exact SHA match runner manifest | Pending |
| Identity / authorization | Server-owned account?Page?token proof | Blocked until evidence |
| Mutation admission | Reviewed plan, durable reservation, idempotency, readback/recovery | Blocked; no send authorized |
| Gate A offline engineering | Reproducible source/test evidence | Pending candidate |
| Provider gates P1–P5 | Bounded authenticated observations | Not established |

This matrix records evidence requirements; synthetic or fabricated runner output cannot substitute for provider proof.
