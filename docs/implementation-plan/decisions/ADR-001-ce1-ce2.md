# ADR-001 — Interim handling cho CE-1 và CE-2

**Ngày:** 2026-09-21  
**Trạng thái:** Proposed — chờ Human Gate #A (RFC) trước PH2  
**Liên quan:** `OPEN_DECISIONS.md` CE-1, CE-2 · `DOMAIN_INVARIANTS.md` I-03/I-04/I-05 · `COMMERCIAL_EVENT_MODEL.md` · `03-requirements.md` R-14/R-20 · `04-architecture.md` C-01/C-02

---

## Context

- **CE-1:** Không có transition table / state-machine enum nào được freeze. Research chỉ có sketch LVP `New → Accepted → Contacting → Follow-up → Won/Lost + Unknown` (hypothesis) và một tập richer states (qualified / churn risk / lost-revenue…) chỉ là aspirations.
- **CE-2:** Không rõ `CommercialEvent` chỉ cover inferred/AI-derived meaning hay là generalized assertion primitive cho observed/claimed/imported/inferred.

Cả hai đều chạm tới I-03 (AI → CE → Evidence → Policy → Action), I-04 (append-audited, reversible), I-05 (provenance). Không được tự resolve.

## Decision (interim — không freeze)

1. **State lifecycle (CE-1):** LVP dùng hypothesis enum `New → Accepted → Contacting → Follow-up → Won / Lost` + `Unknown` như **hypothesis, không freeze**. Mọi transition append-audited, reversible; corrections append new assertion. Không mở rộng state trước RFC.
2. **Event scope (CE-2):** Trong LVP, `CommercialEvent` dùng ở **inferred-only** scope (AI draft) cho tới khi RFC chốt generalized scope. Observed/claimed/imported facts đi qua provenance envelope riêng (§3 `TRUST_AND_EVIDENCE.md`), không tự gộp vào CommercialEvent.
3. **BLOCKED-BY:** `R-14` (state lifecycle) và `R-20` (AI draft) ghi `BLOCKED-BY: CE-1` / `CE-2`, trace tới ADR này. Code phải comment `// OPEN: CE-1 — see ADR-001` / `// OPEN: CE-2` tại các seam liên quan và **abort nếu privilege/transition vượt frozen boundary**.
4. **Gate:** Không vào PH2 domain/events trước **Human Gate #A** (RFC Product + Architecture + Data review transition table + scope). Gate outcome được ghi append vào ADR này (supersede, không silent rewrite).

## Consequences

- Domain layer code có thể proceed với hypothesis states mà không pretend đã chốt.
- Mọi consumer (queue, next action, outcome) chỉ consume hypothesis states; không hardcode transition table vào generic logic.
- Khi RFC chốt, ADR này được supersede (date + replacement), không xoá hàng CE-1/CE-2 trong `OPEN_DECISIONS.md` — chỉ supersede với evidence.

## Alternatives considered

- Freeze `New → … → Won/Lost` ngay: **rejected** — trái `OPEN_DECISIONS.md`, không có source.
- Generalize CommercialEvent ra observed/claimed/imported ngay: **rejected** — chưa có RFC, vi phạm CE-2 boundary.

## Revisit trigger

RFC chốt transition table + scope, hoặc evidence mới từ experiment Gate L3/L4.

## Related

- `OPEN_DECISIONS.md` CE-1, CE-2
- `03-requirements.md` R-14, R-20
- `04-architecture.md` C-01
- `05-phase-map.md` PH2 gate
