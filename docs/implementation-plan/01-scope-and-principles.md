# Phạm vi và Nguyên tắc

**Phiên:** 2026-09-20  
**Bước 1 — Phạm vi, giả định, câu hỏi mở**

---

## 1. Sản phẩm là gì

**Revenue Continuity Platform** là một **Revenue Operating System layer** nằm giữa Ad platforms, Pancake và CRM. Nó sở hữu **Meaning → Continuity → Action → Intelligence**: bảo toàn commercial meaning từ acquisition qua conversation, lead, handoff, Sales action, outcome, revenue, attribution và learning.

- **Lời hứa LVP (hiện tại):** *"Khi nhận được một lead, Sales có thể nhanh chóng hiểu khách hàng cần gì, kiểm tra bằng chứng gốc và biết hành động tiếp theo mà không cần dựa vào trí nhớ."*
- **North Star (dài hạn):** *"Turn every customer conversation into a measurable commercial journey — from acquisition to revenue."*

**Cho ai:** Operator/Marketing (tạo lead, handoff), Sales (nhận, liên hệ, ghi outcome), Manager/Admin (giám sát ngoại lệ).

**Giá trị thật:** (1) Giảm context loss trong handoff; (2) Sales có evidence + next action thay vì nhớ; (3) Manager thấy exception thay vì mò funnel.

[KB:docs/canonical/PRODUCT_CONSTITUTION.md#1]  
[KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#10]

---

## 2. Phạm vi LVP (Build Now — PH1)

### In scope (P0)
- Single-tenant pilot workspace + demo workspace
- Manual/synthetic input adapter (first-class, fallback)
- Lead create/assign/accept/reassign với audit
- Evidence-backed editable context summary
- Sales queues: New, Today, Overdue, Completed/Closed
- Contact attempt/outcome + next action (due/complete/reopen)
- Minimal outcome: Won/Lost/Unknown
- Append-only audit cho mọi mutation
- Product telemetry, release version, experiment exposure
- Structured feedback; pilot data export/delete
- Authentication + role-based access

### In scope (P1 — sau learning gate L3/L4)
- Pancake read-only sync (conversations/messages/customers)
- AI extraction behind feature flag
- Manager exception view
- Basic usage/data-coverage view

### Out of scope (không phải LVP)
- Public SaaS, billing, enterprise multi-tenancy
- Full CRM, generic inbox/task/workflow/BI
- Meta/TikTok acquisition connectors
- Revenue attribution, lost-revenue prediction
- Pancake message sending
- Automated identity merge/graph
- Full CRM, workflow builder, forecasting
- AI autonomous state changes, routing, outbound messaging

[KB:docs/research/…/00_EXECUTIVE/LEAN_VALIDATION_PHASE.md#70]  
[KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#56]

---

## 3. Phạm vi MVP (mức khung)

MVP là **instrumented usable loop** cho 3 vai trò chính, đủ để chạy Loop 0–4 learning gates. Chi tiết module trong PH2+.

Mở khóa qua:
- **Loop 0 (L0):** Người ngoài hoàn thành core journey với synthetic data → mở khóa Loop 1
- **Loop 1 (L1):** Tester thật dùng manual-input product → mở khóa Loop 2
- **Loop 2 (L2):** Tester dùng lại qua nhiều leads/ngày → mở khóa Loop 3
- **Loop 3 (L3):** Pancake sync + AI improve loop không giảm trust → mở khóa Loop 4
- **Loop 4 (L4):** Buyer đưa commitment thật → mở khóa commercial decision

[KB:docs/research/…/03_PRODUCT/ROADMAP.md]

---

## 4. Nguyên tắc kỹ thuật

1. **Modular monolith:** Một deployable app, internal modules rõ ràng; microservices không upfront.
2. **Domain independence:** Domain layer không import NestJS/Fastify/ORM/external SDK.
3. **Anti-corruption adapters:** Pancake/Twenty/CRM/Meta/TikTok đều là integration boundaries.
4. **Append-audited + reversible:** Mọi important mutation có audit trail + undo.
5. **UNKNOWN là valid state:** Không manufacture precision; `unknown`, `not_applicable`, `not_observed`, `not_requested`, `redacted` là states riêng biệt.
6. **Manual fallback luôn available:** AI/integration failure không block manual loop.
7. **Idempotent ingestion:** External IDs immutable; raw envelopes immutable.
8. **Server-controlled feature flags:** AI, sync modes, experiment variants qua feature flags.
9. **No premature abstraction:** Không build generic connector framework/event platform trước khi có nhu cầu thứ 2.
10. **Human Gate bắt buộc:** Trước mọi merge, trước mọi Commercial Event state change, trước mọi release.
11. **One-writer-per-worktree:** Chỉ một agent/người sửa file tại một thời điểm.
12. **TDD London School (mock-first), coverage ≥ 80%:** Áp dụng cho PH2+.

[KB:docs/canonical/ARCHITECTURE_CONSTITUTION.md]  
[KB:docs/delivery/stories/BOOT-001.md]

---

## 5. Definition of Done (chung)

Một phase/story đạt DoD khi:

1. **Runs:** `npm ci && npm run typecheck && npm test && npm run build` đều pass từ `product/`.
2. **Tests:** Mỗi invariant I-01…I-12 có ≥1 test/kiểm tra tự động; coverage ≥ 80%.
3. **Canonical unchanged:** `docs/canonical/**` không có mutation.
4. **Forbidden paths untouched:** `src/bernstein/**`, `templates/**`, `.agents/**` không đổi.
5. **Open decisions respected:** Không tự resolve CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1.
6. **Human Gate passed:** PR review + human approval trước merge.
7. **Telemetry + audit:** Mọi mutation có actor, previous/new value, timestamp.
8. **UNKNOWN handled:** Data model + API expose UNKNOWN states rõ ràng.

---

## 6. ASSUMPTION (A-ID)

| ID | Assumption | Lý do | Cách đảo ngược |
|----|-----------|-------|---------------|
| A-01 | BOOT-001 deferred persistence; LVP "usable pilot workspace" yêu cầu durable persistence (PostgreSQL target) trước Gate L2/L3. [KB:docs/research/…/00_EXECUTIVE/LEAN_VALIDATION_PHASE.md#72] mâu thuẫn A-01 gốc nếu hiểu deferred toàn LVP | Boot-001 (Tier 3) chỉ deferred bootstrap; LEAN_VALIDATION_PHASE (Tier 2) yêu cầu persistence cho usable pilot | Thêm migration + schema khi persistence chốt trong PH2 |
| A-02 | Vietnamese-first UI cho LVP | [KB:docs/research/…/00_EXECUTIVE/OPEN_QUESTIONS.md#Q-X5] | Bổ sung i18n layer khi có evidence |
| A-03 | Manual/synthetic adapter đủ cho Loop 0–2; Pancake sync chỉ cần cho Loop 3 | [KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#56] | Nếu tester workflow đòi hỏi sync sớm hơn → re-prioritize PH3 |
| A-04 | Single-tenant đủ cho LVP; multi-tenant deferred | [KB:docs/research/…/00_EXECUTIVE/DECISION_LOG.md#D-009] | Thêm workspace isolation khi cần SaaS |
| A-05 | No automated identity merge trong LVP; manual merge + audit là đủ | [KB:docs/canonical/OPEN_DECISIONS.md#ID-1] | RFC khi có evidence + thresholds |
| A-06 | RBAC chỉ cần enforce frozen boundary (Sales scoped to assigned lead) | [KB:docs/canonical/OPEN_DECISIONS.md#PM-1] | Mở rộng RBAC khi có RFC |
| A-07 | Commercial Event scope = inferred/AI-derived only trong LVP; generalized event deferred | [KB:docs/canonical/OPEN_DECISIONS.md#CE-2] | RFC khi cần generalize |
| A-08 | Revenue Attribution = UNKNOWN + unknown_reason trong LVP | [KB:docs/canonical/OPEN_DECISIONS.md#MM-1] | RFC khi attribution model chốt |
| A-09 | Pancake sending, Meta/TikTok acquisition connectors = deferred | [KB:docs/canonical/ARCHITECTURE_CONSTITUTION.md#67] | Spike khi có verified need + permission |
| A-10 | No AI autonomous mutations trong LVP; AI = draft-only, policy-gated | [KB:docs/canonical/TRUST_AND_EVIDENCE.md#74] | Expand AI scope qua Loop 4 |

---

## 7. OPEN QUESTIONS (Q-ID) — chỉ câu chặn build

| ID | Câu hỏi | Tác động | Nguồn | Cần trả lời trước |
|----|---------|---------|-------|-----------------|
| Q-01 | CE-1: Transition table Commercial Event ↔ Commercial State chưa có | BLOCK domain events | [KB:docs/canonical/OPEN_DECISIONS.md#CE-1] | PH0 → Human Gate #A |
| Q-02 | CE-2: CommercialEvent scope inferred-only vs generalized chưa chốt | BLOCK event schema | [KB:docs/canonical/OPEN_DECISIONS.md#CE-02] | PH0 → Human Gate #A |
| Q-03 | Pancake read endpoints + permissions có accessible không? | Block realtime sync | [KB:docs/research/…/00_EXECUTIVE/OPEN_QUESTIONS.md#Q-F1] | PH0 spike |
| Q-04 | Pancake webhook/polling semantics + security đủ rõ không? | Block realtime sync design | [KB:OPEN_QUESTIONS.md#Q-F2] | PH0 spike |
| Q-05 | AI extraction Vietnamese commercial context có đủ chính xác + an toàn không? | Block AI feature | [KB:OPEN_QUESTIONS.md#Q-F4] | PH3 spike |
| Q-06 | Build capacity + team availability đủ cho timeline không? | Block implementation start | [KB:OPEN_QUESTIONS.md#Q-X4] | Ngay |
| Q-07 | First external testers recruitment owner + timeline? | Block Loop 1 | [KB:OPEN_QUESTIONS.md#Q-X1] | Loop 1 planning |

> Tối đa 7 câu, chỉ câu chặn build hoặc đổi kiến trúc. Các câu về pricing/GTM/viability (Q-V1..V3) không chặn build → đưa vào learning gate Loop 4.

---

## Tóm tắt cho Human Gate (≤150 từ)

**Sản phẩm:** Revenue Continuity Platform — layer bảo toàn commercial meaning giữa Pancake/Ad platforms/CRM. LVP test loop: handoff → Sales action → follow-up → minimal outcome. Stack: NestJS+Fastify+TS, code trong `product/**`, domain framework-independent. 12 invariants frozen; 7 canonical open decisions không tự resolve (CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1). Plan gồm PH0 spike/Research → PH1 walking skeleton → PH2 domain/events → PH3 Pancake sync → PH4 LVP slice → PH5 measurement → hardening → pilot. Có 7 câu hỏi mở chặn build (Q-01..Q-07); 3 giả định chính (A-01 persistence deferred, A-02 Vietnamese-first, A-03 manual fallback đủ LVP). 3 rủi ro lớn nhất: (1) Pancake API không đủ/permission thiếu, (2) CE-1/CE-2 chưa có transition table/scope, (3) AI extraction không đủ chất lượng cho commercial context.

---

## Danh sách A và Q để bạn phản hồi

**ASSUMPTION (A-01…A-10):** Xem bảng ở mục 6.  
**OPEN QUESTIONS chặn build (Q-01…Q-07):** Xem bảng ở mục 7.

**Bạn cần trả lời:**
1. Các Assumption A-01…A-10 có chấp nhận được không? Cần đổi/thêm/bớt gì?
2. Q-01/Q-02 (CE-1/CE-2): Bạn có RFC sẵn cho transition table + event scope không? Hoặc tôi propose draft?
3. Q-03/Q-04 (Pancake API): Có account Pancake test sẵn không? Cần tôi prepare spike plan không?
4. Q-06 (capacity): Timeline có chặt? Hay linh hoạt theo evidence?
5. Q-07 (testers): Có tester pool sẵn không?

Sau khi bạn phản hồi, tôi sẽ chuyển sang **Bước 2** (requirements + architecture).
