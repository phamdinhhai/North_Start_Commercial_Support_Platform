# PostgreSQL and HTTP evidence

Focused disposable PostgreSQL results:

- `source-performance.integration.spec.ts`: 5/5 passed, including canonical conversation pagination, same-timestamp boundaries, mixed authorization and connection/provider identity isolation.
- `source-continuity.integration.spec.ts`, `linked-evidence-reader.integration.spec.ts`, `source-continuity.http.spec.ts`: 19/19 passed.

The first run exposed a PostgreSQL `DISTINCT ... ORDER BY` error in the new association projection; it was corrected with deterministic `DISTINCT ON (lead.id)` ordering and the suite then passed.
