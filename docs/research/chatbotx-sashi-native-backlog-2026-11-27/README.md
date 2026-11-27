# ChatbotX & Sashi Research Continuation — Traceability & Native Capability Backlog

**Date:** 2026-11-27
**Worktree Branch / Base SHA:** `worktree-agent-af2dfdba705d4fb54` @ `5d6c20673218f02c0972263126e8654eadee18c9` (`main` / `origin/main`)
**Upstream Research Handoff Anchor:** `7c4cefe9b282770bc389abf3b4be441aefa4cb9f` (`docs/research/chatbotx-sashi-consolidated-audit-2026-11-26/`)
**Scope Mode:** Read-only continuation documentation — zero edits to `docs/canonical/**` or `product/**`, zero donor code copied, zero private/provider API calls.
**Continuation Verdict:** `TRACEABILITY_AND_NATIVE_BACKLOG_READY_OWNER_AND_CI_GATES_PENDING`

---

## 1. Continuation Baseline & Post-`7c4cefe` Delta Pinning

This continuation starts directly from consolidated audit handoff commit `7c4cefe9b282770bc389abf3b4be441aefa4cb9f` without repeating the full Phase 1/Phase 2 source audit, and reconciles repository commits landed after `7c4cefe` (`2026-11-26 20:16:27 +0700`):

| Lineage / Ref | Exact SHA | Role & Reconciled Delta Since `7c4cefe` |
|---|---|---|
| Worktree Base (`main`) | `5d6c20673218f02c0972263126e8654eadee18c9` | Active clean-checkout base of this worktree (`docs/canonical/**` and `product/**` untouched). |
| Consolidated Audit Anchor | `7c4cefe9b282770bc389abf3b4be441aefa4cb9f` | Consolidated Phase 1 (`060eb49`) + Phase 2 (`7285586`) + North Star baseline handoff (`7` docs). |
| Phase 1 Research | `060eb49367fd282288ce6121817a4fafdf17e94c` | `research/chatbotx-sashi` (`docs/research/strategic-capability-research/chatbotx-sashi/`); pre-freeze manifest `82824cf742182361860abe38c233c39aca689b1b`. |
| Phase 2 Research | `7285586d670762089fba2941954759d5c5572049` | `research/chatbotx-sashi-phase2` (`docs/research/strategic-capability-research/chatbotx-sashi-phase2/`); `10` candidates (`LX-02..11`), `0` cleared. |
| R4.16.3 Acceptance (at `7c4cefe`) | `197efa8a47d82edd7620a2f335e9f3bb9d451078` | Verified code fix `971feb34a25a4f68509253fd3554ec7818db3986` (`31` PG suites / `169` tests + `2/2` Playwright). |
| R4.16.3 Post-`7c4cefe` Delta (`A-03`) | `c77482ee4036b2711a5a5c7d234d21e37e9d511e` | Hardened R3 `A-03` durable observed-outcome assertion delivery (`PgActionStore.transition` validation + per-row lease tokens + crash/replay PG specs). |
| R4.16.3 Post-`7c4cefe` Delta (`A-02`) | `b9b6155e4ca420cec2183af0cfd124959374e824` (+ `3b3f9e01...`) | Enforced R3 `A-02` server-held workspace/purpose-keyed HMAC `ContentDigester` on `AssertionEnvelope` outcome evidence (`ADR-009`). |
| R4.16.3 Post-`7c4cefe` Head (`A-04`) | `6e98238de1f81b3ee87f2b37eb84cbcf15835171` | Implemented R3 `A-04` bounded encrypted receipt persistence (`024_research_capture_receipts`, AES-256-GCM + HKDF-SHA256, `<=7d` expiry, audited purge). `verification.json` still pins CI `45582583027` (`85b45f3`) and `ownerAcceptance: PENDING`. |
| External Donor Baseline | `fdd7ccf4f5a21186ff16d5aeb85d979e6f1559a1` | `ChatbotXIO/ChatbotX` split MIT + commercial enterprise exceptions (`ZERO_LEGALLY_CLEARED_CANDIDATES`). |
| External Reference Baseline | `doc.sashi.vn` (`76` URLs) + REA `ev_bdf64964...` | Proprietary SaaS public docs (`47` semantic + `29` machine; `20` UI screenshots) + `1` historical read-only `/experience` capture (`ev_daf7b304...` unauth redirect). |

---

## 2. Continuation Package Map (All Files < 500 Lines)

Base directory: `docs/research/chatbotx-sashi-native-backlog-2026-11-27/`

| File | Purpose | Primary Contents |
|---|---|---|
| `README.md` (this file) | Continuation handoff entry point | Baseline/delta SHA table, package index, disposition rules, non-claims, execution handoff checklist. |
| `01-research-to-product-traceability.md` | End-to-end research-to-product traceability | Maps all `7` capability themes across donor artifacts/blobs -> North Star `R-01..41`, `C-01..14`, `F-001..037`, `PH0..PH7+`, `ADR-001..009`, RFCs, and acceptance evidence. |
| `02-native-capability-backlog.md` | Actionable Native Capability Backlog (`NCB-*`) | `22` clean-room backlog items classified as `ABSORB_NOW`, `DEFERRED`, `BLOCKED`, or `REJECTED`, with dependencies, milestones, invariants, and test protocols. |
| `03-legal-provenance-and-guardrails.md` | Legal, license, provenance & API boundary matrix | Per-backlog-item legal/provenance status (`LX-01..11`, `ENT-*`, Sashi, provider ToS, `ADR-007`, `ADR-009`) and clean-room implementation guardrails. |
| `04-validation-questions-and-gate-checklist.md` | Remaining validation questions & gate checklist | Open canonical decisions (`CE-1`, `ID-1`, `ID-2`), `R4.16.4` Owner policies (`ATT-POL-*`, `DIST-POL-*`), PG 16 vs 18.7 validation, CI reconciliation, and `L1..L5` pilot questions. |

---

## 3. Backlog Disposition Taxonomy

Every capability in `02-native-capability-backlog.md` carries an explicit disposition governed by `docs/canonical/**` (`I-01..I-12`) and `ADR-005..009`:

- **`ABSORB_NOW` (Design-Ready for Next Authorized Slice `R4.16.4` / `PH5`):** Fits active LVP / `R4.16.4` scope (`ADR-007`), introduces no second domain authority, requires zero donor code, and can enter clean-room implementation immediately once Stage 0 release/policy gates (`R4.16.3` exact-SHA CI + Owner sign-off + `ATT-POL-*`/`DIST-POL-*` where applicable) close.
- **`BLOCKED` (Gated on Unresolved Canonical RFC, Policy Decision, or Live Spike):** Valid active-horizon or near-term capability whose implementation cannot proceed until an explicit blocker closes (`CE-1`, `ID-1`, `ID-2`, `Q-03/Q-04` live Pancake spike, `P3` send forensics, or exact-SHA hosted CI).
- **`DEFERRED` (Post-LVP / `L4` / `L5` / `PH7+`):** Architecturally valid clean-room pattern preserved in the backlog, but intentionally held outside active LVP execution per `ADR-007` (`LG-1`), `ADR-008` (`MM-1`), or `ARCHITECTURE_CONSTITUTION.md` §1/§4 until Learning Loops `L3..L5` prove pull.
- **`REJECTED` (Permanently Forbidden Anti-Pattern or Non-Goal):** Violates frozen canonical invariants (`I-01..I-12`), `NORTH_STAR.md` §36 non-goals (visual chatbot builder, generic workflow engine, full ERP/POS), commercial enterprise licenses (`ENT-*`), or private API rules (`ADR-007` §5).

---

## 4. Reconciled Guardrails & Non-Claims

1. **Frozen Canonical Truth Untouched:** `docs/canonical/**` on `main` (`5d6c206`) retains all `7` open decisions as frozen normative text (`AGENTS.md` forbidden path). On the `exec/r4163-acceptance` lineage, Owner-accepted `ADR-005` (`CE-2`), `ADR-006` (`PM-1`), `ADR-007` (`LG-1`), `ADR-008` (`MM-1`), and `ADR-009` govern native design, while **`CE-1`, `ID-1`, and `ID-2` remain unconditionally OPEN across all branches**.
2. **R3 `A-02 / A-03 / A-04` Status Update (Post-`7c4cefe`):** Code and local tests for R3 `A-02` (`b9b6155`), `A-03` (`c77482e`), and `A-04` (`6e98238`) have now landed on `exec/r4163-acceptance`, advancing those three real-data gates from `OPEN` at `7c4cefe` to **`CODE_IMPLEMENTED_PENDING_HOSTED_CI_AND_OWNER_ACCEPTANCE`** (distinct from early planning assumptions `A-02..A-04` in `01-scope-and-principles.md:115-117`).
3. **Zero Donor Code & Zero Private APIs:** All `11` ChatbotX candidates (`LX-01..LX-11`) remain `ZERO_LEGALLY_CLEARED_CANDIDATES`, Sashi source/bundle reuse remains `PROHIBITED`, and unapproved reverse-engineered/private provider endpoints remain `NOT_AUTHORIZED` for production (`ADR-007` §5).
4. **No Implementation or Merge Claim:** This package authorizes **zero** code edits, migrations, branch merges, or production actions.

---

## 5. Immediate Next-Step Handoff Sequence

1. **Verify Consolidated `exec/r4163-acceptance@6e98238` in Hosted CI:** Run hosted GitHub Actions CI on `6e98238de1f81b3ee87f2b37eb84cbcf15835171` (covering `971feb3` source-association fixes + `c77482e`/`b9b6155`/`6e98238` R3 `A-02..A-04` closures), reconcile `docs/reports/r4.16.3-native-commercial-continuity/verification.json`, and record explicit Owner sign-off.
2. **Record Owner Policy Choices (`ATT-POL-01..05`, `DIST-POL-01..04`):** Obtain written Owner decisions for the `9` open `R4.16.4` policy questions in `04-validation-questions-and-gate-checklist.md` §2 before cutting the `R4.16.4` implementation branch.
3. **Execute `ABSORB_NOW` Tier-1 Backlog (`NCB-ATT-01`, `NCB-DIST-01`, `NCB-COL-01`, `NCB-SASHI-01`) + Policy-Unblocked `NCB-ATT-02` / `NCB-DIST-02` on PostgreSQL 16:** Implement clean-room native services over existing North Star owners and pass `ATT-PG-01..04` and `DIST-PG-01..04` on `postgres:16-alpine`.
4. **Advance Human Pilot Loops (`L1 -> L3`) Before `DEFERRED` AI/Workflow Items:** Run external uncoached comprehension (`L1`) and multi-day manual workspace usage (`L3`) before unlocking `L4` AI draft (`NCB-AI-01`) or post-LVP RAG/workflow/attribution items.
