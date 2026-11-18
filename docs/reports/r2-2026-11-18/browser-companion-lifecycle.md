# Browser companion lifecycle hardening (R2, 2026-11-18)

Scope: `product/src/adapters/browser-companion/**`, `product/scripts/ail/companion-browser-smoke.mjs`, `product/scripts/companion-package.mjs` (+ test), one `companion:package` npm script line. Model A only (user-owned browser session). No server HTTP contract, infra, api, migration or canonical change. Synthetic pages only; no provider contacted.

## What changed

| Area | Behaviour |
|------|-----------|
| Worker termination | Pending request, outbox, enrollment and `captureSeq` are persisted before network I/O / in the same write as the record. Restarted worker retries the identical request (same captureId + sequence). |
| Alarm policy | None. No `alarms` permission, no `chrome.alarms`, no `setInterval`. Upload/retry happens only on an explicit popup click. Browser restart stops capture (`browser-restarted`). |
| Outbox bounds | 1000 records or 1 MiB (UTF-8 JSON). Reaching a bound stores the record and stops capture with `capture: OUTBOX_FULL` (badge `FULL`). A record that does not fit is refused, counted in `dropped`, and `gapSince` is set. Existing records are never evicted or overwritten. Start is refused with `outbox_full` until the user uploads, or exports and resets. |
| 409 conflict | `blocked` + `blockedReason` from allowlist `SEQUENCE_GAP`/`RECEIPT_CONFLICT`/`CHECKPOINT_REGRESSION`, otherwise `CONFLICT_UNKNOWN`. Server text is never echoed. Capture stops (badge `BLK`). No automatic retry. Re-pasting the same grant is refused (`blocked_requires_reset`). |
| Reset flow | Popup "Reset enrollment": allowed only when blocked/unauthorized/expired/disconnected, or for a local-only outbox. The outbox must be either exported (export digest over the ordered captureIds must match the current outbox) or discarded with the exact displayed record count confirmed. Reset removes the local grant and sequence, appends a `resetHistory` entry and requires a fresh issuer enrollment. |
| Schema drift | Frames on the scoped `pages:<pageId>` topic that the allowlist rejects (unknown event, rejected known-event shape, unparseable, non-Phoenix envelope) increment `drift.count`. A 24-hex fingerprint (SHA-256 of kind + key/type skeleton, ID-like keys collapsed) is kept, max 20 samples plus an overflow counter. Phoenix control frames and other page topics are not drift. The notice appears in popup status and in the redacted export (`driftNotice`). |
| Tab/origin | Permissions `activeTab`, `debugger`, `storage`. No required host permissions or content scripts. `optional_host_permissions: https://*/*` is requested at runtime for exactly one backend origin. `tabs.onRemoved` stops capture with `tab-closed`. `tabs.onUpdated` stops with `navigated-away` when the debugger target leaves pancake.vn/app.pancake.vn. This needs no `tabs` permission. Per-frame origin checks remain. |
| Export | Redacted: no token, pending request or socket request IDs. Includes delivery status, blocked reason and drift notice. |
| Popup a11y | Every control has an explicit `<label for>` or a wrapping label. Polite `role=status` live summary. Two `role=alert` regions (blocked, OUTBOX_FULL). Fieldset/legend for reset. Visible `:focus-visible`. No positive tabindex. DOM focus order starts at the first scope field. Error codes map to human messages. |
| Packaging | `npm run companion:package [-- --out dir]` writes `north-star-companion-<version>.zip` (stored, sorted, 1980 timestamps, CRLF normalised) plus `.package.json` (file SHA-256 list, zip hash, permission purposes, privacy summary). Only files reachable from the manifest entry points ship. Packaging is refused for: broad host permissions (`<all_urls>`, `*://*/*`, any-host required patterns), `key`/`oauth2`/`update_url`, unreviewed permissions, non-self/unsafe CSP, remote scripts, secret-like literals/PEM/JWT, or missing files. |

## Decision: `pages:seen_conversation`

This event is left as **schema drift**; it is deliberately not allowlisted. Its payload shape is ASSUMED upstream. The browser/backend decoder parity test on this branch has no counterpart, and the strict server observation contract has no field for a seen value. The companion records only a structural fingerprint for it and uploads nothing. A test asserts this. To promote it, the backend decoder, the server contract and evidence of the payload shape must change together.

## Evidence (run in `product/`)

- `npm run typecheck`: pass. `npm run lint`: pass. `npm run architecture:check:strict`: PASS (0 findings).
- `npm test -- --exclude '**/*.integration.spec.ts'`: **40 files, 446 tests passed**. Companion subset: 4 files, 41 tests (previously 2 files, 21).
- `node --test scripts/companion-package.test.mjs`: 5/5 pass.
- `npm run test:companion` (real headless Chromium MV3, local TLS fixture): PASS, run three consecutive times. The extension is loaded **from the packaged zip**. Capture, private-text exclusion, drift fingerprint only, real worker termination (`Target.closeTarget`; a fresh instance is proven by a lost in-memory nonce) followed by capture with `captureSeq` 2, popup labels/live region/focus, tab close → `tab-closed`, and browser-restart persistence were all asserted.
- Package: `north-star-companion-0.2.0.zip`, 9 files, 43393 bytes, sha256 `1cd97d7b1a9380d856cc90b1fdbf6d7561f04d522e7d8124e8ac0a3a3833ff04`. The hash is identical across runs, directories and CRLF checkouts.

## Limitations

- The drift notice is **not** sent in the upload body. The server validator rejects extra keys, and D2 owns that contract. The notice is visible in the popup and in the redacted export only.
- Export binding proves that the worker produced the export, not that the browser download completed.
- While an upload fetch is in flight (≤10 s abort), CDP events queue behind it. If the worker is terminated in that window, those in-memory events are lost. This is a declared gap: continuity stays UNKNOWN. No no-loss claim is made for unpersisted CDP events.
- In-app navigation without a tab `loading` event is caught by the per-frame origin check, not by `onUpdated`.
- `rejected-shape` drift also counts scope-violating frames (for example a foreign `page_id` claim). These are refused for security and are not necessarily a provider change.
- Unpacked research build, not store-signed. Authenticity, completeness and continuity remain UNKNOWN. Open decisions and human gates are unchanged.

## Review fixes (independent QA R2-I-09..12)

Branch `work/r2-fix-companion`, based on integration `4ec9bd1`. The server contract is unchanged.

- **R2-I-09, retired enrollments.** An enrollment id is retired when it is reset (`lifecycle.mjs:95-98`) or replaced by a different id (`upload.mjs:30-32`). Re-pasting a retired id is refused locally with `fresh_enrollment_required` (`upload.mjs:21`). Status exposes `freshEnrollmentRequired` and the popup tells the user to obtain a fresh grant. Tests: `review-fixes.spec.ts` (reset → same grant refused → fresh id accepted; A→B→A refused).
- **R2-I-10, gap markers and drop counting.** `gapSince` was never advanced; it is replaced by gap intervals (`lifecycle.mjs` `openGap`/`closeGap`/`possibleGap`, bounded to 50 with an overflow count). `gapSince` is now the start of the latest gap.
  - **Gaps opened:** every stop opens a gap (`worker.mjs:46`). This covers OUTBOX_FULL, tab-closed, navigated-away, debugger-detached, enrollment-reset, socket-closed (`worker.mjs:219`), and not-started at install.
  - **Gaps closed:** Start and a new socket close the gap.
  - **Worker loss:** a new worker instance during an active session records a closed `possible` gap from `lastObservedAt` (`worker.mjs:255-262`).
  - **Dropped after OUTBOX_FULL:** frames queued for the stopped session are counted in `dropped` (`worker.mjs:199-203`). Heartbeat and control frames are not counted.
  - **Dropped by guards:** frames refused by the size or backlog guards are counted (`worker.mjs:38-46,180,189`).
  - Tests: `review-fixes.spec.ts` and `lifecycle.spec.ts`.
- **R2-I-11, `captureSeq` removed.** It was never written to records, uploads or the digest. Non-reuse is carried by the persisted pending request plus `nextSequence`.
  - The smoke now asserts this across a **real** worker termination: upload reserves sequence 1 through the real popup message path, with no origin grant so no request leaves. After termination the retry has an identical `pending` and `nextSequence` is still 1.
  - Unit test: `review-fixes.spec.ts`. Smoke: `companion-browser-smoke.mjs`.
- **R2-I-12, packager imports.** `moduleReferences` (`scripts/companion-package.mjs:60`) follows `import … from`, `export … from`, side-effect `import './x'` and literal `import('./x')`. It refuses non-literal dynamic imports and non-relative specifiers. Test: `companion-package.test.mjs` (R2-I-12 case).

### New defect found while fixing R2-I-11 (fixed)

Real Chromium was observed with Playwright and CDP:
- Terminating the extension service worker (CDP `Target.closeTarget`) **drops the extension's `chrome.debugger` session**. `sendCommand` then fails with "Debugger is not attached", and **no `onDetach` is delivered**.
- The stored session therefore stayed "active" while nothing could be captured.

Earlier round claim withdrawn: the round-1 smoke result "capture continues after worker termination" is retracted. That run read state through a stale Playwright worker handle and did not verify the termination with CDP.

Fix: the fresh worker instance probes its debugger session (`worker.mjs:255-262`). If the session is gone, it stops with `worker-lost-debugger` and opens a gap. It never re-attaches automatically; the user must Start again, because re-attaching shows the debugging infobar and requires consent. Unit test: `review-fixes.spec.ts` (lost debugger). The smoke now proves the following on real Chromium:
- the terminated target is gone
- no capture happens while the session is lost
- the fresh worker reports `active: false` with `lastStop: worker-lost-debugger`
- a possible worker-restarted gap is declared and an open gap remains until restart
- capture resumes after an explicit re-Start

Residual: if the worker is terminated and never woken (no popup open, no browser restart), the stored state still says active until the next wake. There is no alarm, by policy.

### Evidence

All commands were run in `product/`:
- `npm run typecheck`, `npm run lint` and `npm run architecture:check:strict` pass (0 findings).
- Full unit suite (`npm test -- --exclude '**/*.integration.spec.ts'`): 65 files, 722 passed, plus 8 expected-fail QA reproductions. Those are in non-companion `*.r2-review.spec.ts` files.
- Companion subset: 5 files, 49 tests.
- `node --test scripts/companion-package.test.mjs`: 6/6.
- `npm run test:companion`: PASS, four consecutive runs on real headless Chromium, with the extension loaded from the package.
- Package: `north-star-companion-0.2.0.zip`, 9 files, 48372 bytes, sha256 `39d555ef4a3fbdb2a8e776d426ea146b52aed425d3114ac48d9faee502f5ba92`.
