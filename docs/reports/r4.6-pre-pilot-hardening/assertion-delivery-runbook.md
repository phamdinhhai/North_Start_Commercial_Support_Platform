# Internal assertion delivery runbook

Owner: engineering reliability operator. This foundation runs only with ASSERTION_DELIVERY_ENABLED=true, DEPLOYMENT_MODE=local/test, PILOT_STORE_MODE=postgres and configured PostgreSQL. Default remains off. No pilot/production enablement is authorized by this runbook.

After module wiring with AUTH_MODE=oidc, authenticated admin requests use server-resolved membership workspace:
- GET /v1/internal/assertion-delivery returns up to 100 newest rows with assertion id, status, attempts, next attempt and fixed failure category; never envelopes.
- POST /v1/internal/assertion-delivery/:id/stop permanently stops an unclaimed PENDING item and audits actor/previous status/attempts. LEASED/DELIVERED items conflict. It does not undo evidence or external effects.
- POST /v1/internal/assertion-delivery/:id/replay resets a FAILED retryable item for delivery and appends audit atomically. Foreign, absent and disallowed states return the same conflict. INVALID_ENVELOPE/ENVELOPE_CONFLICT cannot be replayed: investigate producer/schema and append a corrected assertion under a new id through its authorized path.

For global shutdown set ASSERTION_DELIVERY_ENABLED=false and restart the application under the normal deployment procedure. The runner stops scheduling and awaits its bounded in-flight pass. This configuration switch does not retract an emitted assertion. An expired lease becomes reclaimable; exhausted leases fail categorically. Do not manually overwrite envelopes, remove inbox evidence, truncate audit, or clear active lease tokens.

Before replay inspect metadata, verify sink recovery and idempotency, confirm the relevant assertion id and current workspace, then replay once and inspect again. SINK_TIMEOUT may include a late sink completion; deduplication is mandatory. Repeated replay is an explicit admin action with fresh audit, not unlimited automatic retries.

Migration 017 rollback is allowed only when it loses no operator audit/new failure-category evidence. Refusal requires preserving the migration and following forward recovery; never delete records to force rollback.

Local verification: npm run typecheck; targeted Vitest delivery/controller suites; targeted ESLint. Actual restart experiment requires an exclusively owned temporary PostgreSQL17 cluster matching the REL_PRIVATE_PG_DATA guard and TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55467/north_rel_test; use --testTimeout=40000. Never set this variable for a shared/custom server.
