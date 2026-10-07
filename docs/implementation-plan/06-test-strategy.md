# 06 — Test Strategy (LVP)

**Phiên:** 2026-09-21
**Nguồn:** `TRUST_AND_EVIDENCE.md`, `LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md`, `DOMAIN_INVARIANTS.md`

---

## 1. Tầng test

| Tầng | Mục tiêu | Khi chạy |
|------|---------|----------|
| **Unit (domain)** | Mỗi invariant I-01…I-12 ≥1 test; mock-first (London TDD) | Mỗi PR |
| **Integration** | Adapter/envelope/idempotency/checkpoint/redaction | Mỗi PR |
| **Contract** | Pancake fixtures (anonymized) + envelope mapping | PH4 |
| **E2E** | L0 loop: create → assign → handoff → outcome (manual) | PH5, PH6 |

## 2. Phạm vi mỗi phase

- **PH1:** Lead/Handoff shell + health + workspace isolation unit + integration.
- **PH2:** Domain entities + CommercialEvent schema + UNKNOWN + audit (invariant sweep).
- **PH3:** PostgreSQL + auth/RBAC + workspace scoping + telemetry.
- **PH4:** Pancake adapter + idempotency + checkpoint + redaction.
- **PH5:** Queues + next-action + contact/outcome + Data Health + export/delete.
- **PH6:** Segregation end-to-end + experiment exposure + gate review.

## 3. Ngưỡng

- **Coverage:** ≥80% line coverage; **100%** cho security-critical (auth, RBAC, redaction).
- **Tất cả public API** phải có test (`AGENTS.md` Quality Rules).
- **Invariant coverage:** I-01…I-12 mỗi cái ≥1 automated check.
- **Forbidden paths untouched:** `src/bernstein/**`, `templates/**`, `.agents/**` — CI check.
- **Canonical unchanged:** `docs/canonical/**` không đổi — verify script.

## 4. Kiểm tra cố định (CI)

```
npm ci && npm run typecheck && npm test && npm run build   # từ product/
npx tsc --noEmit
vitest --coverage
```

- Hardcoded secrets: fail.
- Input validation at boundaries: required.
- Typed interfaces cho public APIs: required.

## 5. Danh sách test theo invariant (checklist)

- [ ] I-01: Customer != Lead — tách entity test
- [ ] I-02: Source != lineage != attribution — collapse test
- [ ] I-03: AI draft-only — no direct mutate test
- [ ] I-04: CE pipeline — evidence+provenance test
- [ ] I-05: Append-audited — audit store test
- [ ] I-06: Merge deferred — no auto-merge test
- [ ] I-07: Stable Lead ID — immutability test
- [ ] I-08: UNKNOWN visible — surfacing test
- [ ] I-09: Lead-scoped access — RBAC test
- [ ] I-11: Adapter boundary — envelope test
- [ ] I-12: Raw preserved + UNKNOWN valid — raw immutability test

## 6. Learning / validation checks (V2 — research gate, not domain tests)

`docs/Dinh_nghia_bai_toan_V2.md` adds a separate evidence-evaluation layer. It supplements, and does not replace, invariant tests or the existing human gates.

- Maintain H1–H8 in the learning/evidence artifacts only; do not add hypothesis IDs or validation-only fields to production schema, API, or telemetry.
- Before evaluation, pre-register the hypothesis, proposed threshold, eligible sample/denominator, exclusions, metric/rule/model/prompt version, and locked evaluation split. V2 thresholds are internal proposals, not industry benchmarks.
- Every hypothesis result must be **proceed**, **fail**, or **insufficient data**. Report numerator, denominator, missingness, exclusions, uncertainty and business clustering; do not treat unknown as complete evidence.
- For AI extraction (H3), report precision/recall and action/owner/due-date agreement on a locked set; small-sample success is not authorization for unsupervised business actions.
- For off-system capture (H4), independently establish the eligible interaction denominator; counts of user-entered records alone cannot measure omissions.
- For attribution (H8), show eligible cohort and each deterministic linkage segment. Linkage is not causation; H8 is not a prerequisite for the handoff/follow-up MVP.
- Keep the Validation Schema disposable and outside application dependencies. Promote findings into canonical/domain/requirements only through the relevant human-reviewed RFC/ADR.

Protocol and proposed thresholds: `discovery/v2-validation-and-traceability.md` §§4–8. Do not run or interpret a locked evaluation until data permission, consent, retention, and access conditions are approved.

## 7. Human gates (không tự động)

- Gate #A: RFC CE-1/CE-2 review (trước PH2 domain state machine).
- Gate trước PH3: persistence + migration review.
- Gate trước PH4: Pancake spike verdict (Q-03/Q-04).
- V2 learning gate: review H1–H8 evidence and disposition; distinct from Gate #A, persistence, or provider feasibility gates.
- Gate L5: direction decision (Continue/Narrow/Pivot/Stop).
