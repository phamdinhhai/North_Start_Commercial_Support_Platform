# Independent platform and OSS review

Review scope: read-only inspection of the external pinned checkouts, the in-progress CRM frontend worktree and the inherited preview boundary on 2026-11-22. This is not assembled-browser, exact-final-source or production approval. No provider requests, Owner database changes or runtime restarts were performed.

## Pinned upstream evidence

| Source | Inspected immutable commit | License boundary | Decision |
|---|---|---|---|
| Atomic CRM | `832b07a89be2d9265a66bbf879fed0299c14ebfb` | `LICENSE.md`, MIT, copyright 2024-present Francois Zaninotto/Marmelab | Adopt selected React admin/UI modules, not Supabase backend |
| Chatwoot | `5d1afdf3b2f32b88e21899d62fcde12f2c0c33d7` | Root LICENSE grants community MIT Expat; enterprise and third-party components have separate terms | Adopt community pure helper and adapt inspected inbox interactions; no Enterprise/Rails transplantation |
| Twenty | `b83122a7cc112703807546f5b830b7e3ba862edb` | `packages/twenty-ui/LICENSE` and package manifest MIT; full application is outside scope | Evaluated, not adopted: a second design system adds Monaco/editor/theme dependencies without a demonstrated benefit |
| Ads Studio | `c500cc5a132142ff3de815bf6d15c50d490ea522` | Root LICENSE MIT, copyright 2024 Jason Akatiff - iSCALE.com / A4D.com | Ads specialist owns selected frontend adaptation; no Python backend/auth/optimization actions |

These are real Git checkouts outside the North Start repository at `D:/AI-for-Enterprise/north-start-ui-reuse-lab`. No upstream history should enter the product repository. Upstream build/test results must be recorded separately from integrated North Start results.

## Actual source and notice checks

The CRM worktree's `frontend/licenses/atomic-source-selection.json` listed 47 dependency-closed files. All 47 existed and had identical SHA-256 contents to the pinned upstream at the inspection snapshot. The selection includes the coherent admin data-table/list/simple-form/text-input modules and the sidebar/card/dialog/table/input primitives, not only copied styling. The Atomic notice was retained as `frontend/licenses/atomic-crm-MIT.txt`, SHA-256 `c19588f8d6a59c26ab15820671e356960f5359274445e9dca2e862427e6752c3`.

The inbox specialist's pinned complete `conversationHelper.js` reuse has a retained `CHATWOOT-LICENSE.txt` and source-specific provenance. ConversationCard and Base bubble structures are React adaptations, not claims of directly executing Vue components. A standalone Chatwoot Rails service was not run. Fabricated sample threads are UI fixtures, distinct from durable authorized North Start receipt metadata.

Maintain exact selection/provenance manifests and notices when upgrading. Compare upstream paths and rerun module tests plus the integrated browser workflows. Do not import the full upstream authentication, CRM schemas, message HTML formatter or mutation clients.

## Dependencies and reproducibility

The initial in-progress frontend lock snapshot was SHA-256 `234129bea04a4b729d31684b0a4b96ca126288f5dfdad4c9d79ffa8ad0484526`. `npm audit --json` found one HIGH direct dependency, `react-router@7.17.0`, and zero other package findings at that snapshot. Relevant advisories include `GHSA-chx6-hx7r-mcp5` (route matching denial of service), `GHSA-qwww-vcr4-c8h2` (RSC action CSRF), and moderate redirect/XSS/hydration findings. npm proposed non-major `7.18.6`; the CRM specialist was instructed to pin the corrected version and regenerate/retest the lockfile. This initial audit is a finding, not a waiver or a final clean-audit claim.

`npm sbom --omit=dev --sbom-format cyclonedx --sbom-type application` completed for that snapshot with 90 components; the artifact remains in the private local test directory. Regenerate the audit/SBOM after the Ads dependency and router correction are integrated. Final acceptance requires clean `npm ci`, frontend build/typecheck and final-source security/license checks; it cannot reuse this provisional dependency snapshot.

Atomic upstream uses Vite 8 and a Node 24 toolchain. Keep the independently installed UI/upstream toolchain separate from the Node 22 Nest backend. Do not silently upgrade backend runtime or import upstream dev infrastructure solely to render the selected modules.

## Session and cache boundary

Inspection of the selected source, dependency manifest and lock found no copied Supabase implementation, persisted React Query provider, localStorage/sessionStorage commercial cache, provider token fields or service-worker registration. The main upstream CRM root does contain persisted-query behavior, but that root was not selected. North Start's injected auth/data providers use same-origin `/v1/` requests, cookie authentication and CSRF for mutations.

The in-progress provider has a session generation check to reject late prior-session responses and identity-keyed pagination cursors. A 403 generation bump must also clear/remount query caches and refresh membership; a counter alone does not prove that old role menus/data disappear. Parent application and browser tests must prove logout, expiry, revocation and foreign-workspace isolation. This review does not claim those tests have passed yet.

Serving built assets at `/v1/app/` on the existing Nest origin is preferable to rewriting Origin or weakening CORS. Keep asset traversal/type/link protections and explicit no-store/security headers. Static assets contain no session secrets; API authorization remains mandatory for every commercial read/write.

## Hybrid preview boundary

The new UI branch initially inherited the committed V1 `preview.mjs`, which trusts a saved PID on stop and deletes the preview directory. It must not be exposed as an Owner-facing management endpoint. The previously reviewed hardened V2 implementation remains a separate uncommitted worktree change until intentionally integrated and accepted. Its existence is not proof that this branch has those protections.

The inherited pilot runtime also used its control secret as AIL signing material. The product preview must either adopt the independently keyed, opt-in preview configuration or keep hybrid management disabled. UI status must distinguish unavailable, fixture-tested and verified receipt evidence. No browser observation may become provider-authenticated evidence; completeness remains UNKNOWN. Do not collect cookies/tokens or trigger provider mutations through the frontend.

## Review disposition

Source-license selection is acceptable within the stated MIT boundaries and retained notices. Integrated distribution/security readiness remains pending the router fix, final lock audit/SBOM, exact-source browser/session tests and the runtime-preview decision. Preserve P3 `SEND_UNRESOLVED`, P4 `NOT_TESTED`, P5 `NOT_VERIFIED`, Gate B CONDITIONAL and Gate C NOT_READY. Owner acceptance and release approval have not occurred.
