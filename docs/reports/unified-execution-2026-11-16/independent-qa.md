# Independent QA — signed sandbox HTTP upload

Scope: synthetic observations only, localhost PostgreSQL port 55439, dedicated disposable database `disposable_qa_http`. No provider account, credential or live payload used. Frozen domain invariants read; no canonical document or commercial policy changed.

The new `product/e2e/integration-upload.e2e-spec.ts` uses the actual `AppModule`, Nest/Fastify listener on an ephemeral localhost TCP port, native fetch, signed enrollment and PostgreSQL migrations. It dynamically imports the actual companion upload module; upload responses are real HTTP responses, not mocks.

Commands executed in `product/`:

- `npm ci`: passed, 420 packages installed; npm reported five moderate dependency vulnerabilities.
- `npm run typecheck`: passed.
- `$env:TEST_DATABASE_URL='postgresql://north_test@127.0.0.1:55439/disposable_qa_http'; npm run test:e2e -- e2e/integration-upload.e2e-spec.ts`: initial result **3 passed, 2 failed, 0 skipped**.

Initial passing evidence: discarded committed ACK followed by complete application/pool restart yields one durable receipt and a duplicate ACK; enroll/receipt audit exists once; concurrent duplicate uploads serialize; revoke prevents retry while retaining local evidence and removing local authority; explicit research opt-in is required. Negative tests also reached missing auth, forged signatures, foreign workspace and raw-payload rejection before the size assertion failed.

Defects immediately reported to coordinator:

1. **HTTP body limit ineffective:** a 20 KB request to `/v1/integration/observations` returned validator status 400 rather than transport status 413. `@RouteConfig({ bodyLimit: 8192 })` did not enforce the intended request parser limit under the actual Fastify adapter. Oversized material was parsed before validation.
2. **Sequence gap advances checkpoint:** upload sequence 2 before sequence 1 returned 201 rather than 409. Coordinator already independently identified this issue and owns repair.
3. **Late duplicate ACK compatibility:** code inspection found companion requires `checkpoint === sequence` whereas server returns current enrollment checkpoint for old duplicates. Regression test requires a bound duplicate sequence 1 at checkpoint 2 to be accepted. This assertion lies after the initial sequence-gap failure and therefore was not reached in the initial run; coordinator owns repair.

The tests also assert cross-enrollment/capture/sequence/continuity/receipt ACK binding, conflicting replay rejection and metadata export token redaction. Second execution ran all additional binding/privacy/conflict assertions successfully. A sixth HTTP test injects a PostgreSQL trigger failure on the final audit insert for its own enrollment, verifies status 503 with zero receipts and checkpoint zero, removes the trigger/function in finally, and successfully retries. Second execution: **4 passed, 2 failed, 0 skipped**, with the same body-limit and sequence-gap failures. Typecheck passed again.

Limits: committed ACK loss is injected by deliberately discarding the response and restarting the application, not by killing a process mid-commit. This suite does not run Chromium, real provider capture, the operator state progression; those require separate evidence. Without `TEST_DATABASE_URL` the entire database suite explicitly skips, so a default e2e invocation alone is not durability evidence.

