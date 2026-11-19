# R3 — ADR-009 evidence content privacy (Pancake adaptive connectivity + Browser Companion)

Ngày: 2026-11-18 · Branch `work/r3-privacy` · Spec: `docs/implementation-plan/decisions/ADR-009-evidence-content-privacy.md` (Accepted)
Scope: `product/src/adapters/adaptive-connectivity/**`, `product/src/adapters/browser-companion/**`, `product/scripts/ail/**`,
`product/scripts/companion-package.mjs` (+test), the `payloadHash` contract in `product/src/application/integration/upload-validation.ts`,
minimal lines in `product/e2e/integration-upload.e2e-spec.ts`. No auth, membership, governed-action, api, migration or canonical change.

## 1. Keyed digests (ADR-009 §1)

| Change | Where | Tests |
|---|---|---|
| `ContentDigester` port: HMAC-SHA256 under a per-workspace key with `kid`. MAC input binds a label, a purpose (`frame` / `message` / `receipt`) and the workspace ID, so a mis-shared key still cannot link workspaces. `matches()` re-derives under the digest's own kid and returns `UNKNOWN` if that key is not held. `compareDigests()` returns `incomparable` when kids differ. Keys must be ≥ 32 bytes; a kid cannot be reused. | `adaptive-connectivity/content-digester.ts` (port :19, HMAC :76, factory :79, compare :53, `InMemoryWorkspaceKeyring` :102) | `adr009-content-privacy.spec.ts` › "ADR-009 ContentDigester …" (5 tests: two workspaces differ and ≠ unkeyed sha256; mis-shared key still differs; stable per workspace+key, purposes separated; rotation → new kid, old digest verifiable only under old kid; key/kid/digest validation) |
| `Observation.payloadHash` (unkeyed sha256 of the frame) replaced by `payloadDigest {alg, kid, value}`. The browser/server shared contract is now `ObservationMetadata` / `OBSERVATION_METADATA_KEYS`, which has no digest. | `observation.ts:32`, `:39`, `:66`; `phoenix-observer.ts:78` (digester injected via `CaptureContext.digester`) | "observation carries payloadDigest …", "the same frame observed in two workspaces is unlinkable …" |
| Per-message `contentHash` → keyed `contentDigest`. Read-state observations and quarantined drift records use keyed `payloadDigest`. | `message-lifecycle.ts:145`, `:171`, `:182` | "message contentDigest, read-state and quarantined drift digests are keyed with a kid" |
| The ledger compares digests only under the same kid. A sighting whose kid matches no prior variant gets the new disposition `re-observed-incomparable`, never `changed` or `same`. Ledger state version goes 2 → 3; old states fail closed. `distinctContentHashes` is renamed to `distinctContentDigests`. | `message-ledger.ts:30`, `:113` | "the ledger never calls a digest under a different kid …" |
| The continuity fingerprint includes the kid. Replaying a capture ID after key rotation shows up as `conflict`. It is not silently deduplicated. | `continuity.ts:93` | "continuity fingerprints bind the digest kid …" |
| The POS research receipt digest is keyed. It is written in self-describing form as `hmac-sha256:<kid>:<hex>` because the port field (`ports/research-receipt.port.ts`, not owned here) has no kid column. | `pos-webhook-fixture.ts:88` | `pos-webhook-fixture.spec.ts` › "records a keyed receipt digest with its kid …" |

Tests use `digest-test-support.ts`, which mints `randomBytes(32)` keys at runtime. No key literal exists anywhere.

These digests are **not** content and are left as plain hashes: the drift shape fingerprint (key/type skeleton, no values), `outboxDigest` (capture IDs), `analysisDigest` (readback IDs/offsets), the configured-header comparison in the POS fixture, and whole-file provenance hashes in `inspect-pancake-har.mjs`.

## 2. The companion sends no body-derived digest (ADR-009 §2)

- `protocol.mjs` no longer calls `crypto.subtle.digest` and no longer emits `payloadHash`. It sends filtered metadata only. `sourceRevision` is now `north-star-companion/0.3.0` and the manifest version is `0.3.0`, because the contract break is visible on the server. Schema drift still keeps only the structural fingerprint (`drift.mjs`, unchanged).
- Parity contract: the browser record must `toEqual(observationMetadata(backendObservation))`. The browser key set must equal both `OBSERVATION_METADATA_KEYS` and the server's `OBSERVATION_UPLOAD_KEYS`, and `validateUpload` must accept the body that the real worker uploads. Tests: `browser-companion/adr009-no-body-digest.spec.ts` (4 tests: key set and no 64-hex string; records identical when only the body text differs; browser/server key sets agree and the server accepts the worker upload; protocol source has no digest call), plus the updated parity tests in `worker.spec.ts`.
- Packaging test "ADR-009: the shipped decoder computes and sends no body-derived digest" checks the zipped `protocol.mjs` / `upload.mjs` / `worker.mjs` and the updated privacy summary.
- The Chromium smoke now also asserts `noBodyDigest: true` against the outbox persisted by the real MV3 worker.

## 3. Server contract (strict keys)

- `OBSERVATION_UPLOAD_KEYS` no longer includes `payloadHash`, and nothing requires it. The exact-key check rejects an observation that carries `payloadHash`, `payloadDigest`, `contentHash` or any other extra key with **400 `INPUT_INVALID`** (`upload-validation.ts:8`, `:14`). Tests: `application/integration/upload-validation.spec.ts` (5 tests).
- HTTP e2e changes: fixtures drop `payloadHash`. The 409 conflict case now changes `sourceRevision` instead. A new assertion checks that `payloadHash` → 400 (`integration-upload.e2e-spec.ts`, "rejects untrusted scope, … raw payload …").
- Compatibility: a 0.2.x companion that still sends `payloadHash` now gets 400 and keeps its outbox. It must be upgraded to 0.3.0. Intake unit fixtures (`intake.spec.ts`, `intake.principal.spec.ts`) only drop the field.

## 4. Raw frames (ADR-009 §3–4)

- Confirmed: no raw quarantined frame is retained by default. Backend drift records keep filtered key names, the key count and a keyed digest. Browser drift keeps only a shape fingerprint. The smoke and `drift-scope.spec.ts` assert this.
- Research capture paths that retain raw bytes are now gated:
  - `PosWebhookFixtureReceiver` requires `researchCapture { enabled: true, authorizedWorkspaceId === scope.workspaceId, retentionDays 1..7 }` and an injected digester. Otherwise it throws `research_capture_not_authorized` / `digester_required` (`pos-webhook-fixture.ts:48`; tests "refuses to retain raw bodies without an explicit bounded grant: …", 5 cases).
  - `scripts/ail/facebook-research-scenario.mjs` calls `researchCaptureGate`, which requires env `AIL_RESEARCH_CAPTURE=explicit` and `spec.researchCapture { authorizedWorkspaceId, retentionDays ≤ 7 }`. It writes `retainUntil` into the summary and failure records. Its `frameSha256` is replaced by a per-run HMAC with an in-memory random key (`research-capture-gate.mjs`; `research-capture-gate.test.mjs`, 2 tests).
- Encryption at rest, automatic deletion and audit for research storage are **not built**. They are obligations of whatever sink sits behind `ResearchReceiptPort` / the private research directory. Today `retainUntil` is an operator deadline (`deletion: 'operator-manual-not-automated'`).

## Results (2026-11-18, worktree `ns-r3-privacy`)

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 problems) |
| `npm run architecture:check:strict` | PASS (0 findings) |
| `npm test -- --exclude '**/*.integration.spec.ts'` | 72 files, 808 tests passed |
| `node --test scripts/companion-package.test.mjs` | 7/7 |
| `npm run test:companion` | PASS (real headless Chromium MV3, loaded from the package, `noBodyDigest: true`) |
| `TEST_DATABASE_URL=…/disposable_r3_privacy npm run test:e2e` | 2 files, 18 tests passed, 0 skipped |
| `npm run test:ail:research` / `node --test scripts/ail/research-capture-gate.test.mjs` | 12/12, 2/2 |

Package: `north-star-companion-0.3.0.zip`, 9 files, 48421 bytes, sha256 `b8c4b27f3cc1ed369c4eb9129d7ce2bad8bdb09c8778c1df5e7cd64af531511b`. The smoke's `packagedArtifact` matches this hash.

## Limitations

- No production keyring or secret store exists yet. `InMemoryWorkspaceKeyring` is for tests and single-process harnesses. Wiring a server-side key source with kid rotation belongs to infra/composition and is not done here.
- Nothing persists adaptive-connectivity observations today, so no stored digests need migration. If an old ledger state (v2) or continuity state is restored, the ledger rejects it, and continuity treats it as a conflict on replay.
- After rotation, the same content counts once per kid in `distinctContentDigests`, and a capture replay surfaces as `conflict`. This is deliberate: different keys are never compared.
- `ResearchReceipt.payloadHash` keeps its field name. The kid is embedded in the value because the port is outside this scope. The port owner should split it into `payloadDigest {kid, value}`.
- `research-capture-gate.test.mjs` is not yet listed in the `test:ail:research` npm script, because `package.json` is outside this scope.
- `docs/reports/r2-2026-11-18/*` still describe `payloadHash` / `contentHash` as they were at R2. They are historical and were not edited.
