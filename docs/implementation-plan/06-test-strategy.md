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

## 6. Human gates (không tự động)

- Gate #A: RFC CE-1/CE-2 review (trước PH2 domain state machine).
- Gate trước PH3: persistence + migration review.
- Gate trước PH4: Pancake spike verdict (Q-03/Q-04).
- Gate L5: direction decision (Continue/Narrow/Pivot/Stop).
