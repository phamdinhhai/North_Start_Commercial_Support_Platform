# Bản đồ tri thức — Evidence Map

**Phiên:** 2026-09-20
**Bước 0 — Bản đồ tri thức và kế thừa**

---

## 1. Trạng thái đọc theo thư mục

### Bậc 1 — docs/canonical/** (Nguồn sự thật)

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `README.md` | ĐỌC KỸ | Quy tắc đọc/thứ bậc thẩm quyền |
| `PRODUCT_CONSTITUTION.md` | ĐỌC KỸ | Product scope, promise, non-goals, architectural boundaries |
| `ARCHITECTURE_CONSTITUTION.md` | ĐỌC KỸ | Shape, change seams, adapter contract, Pancake policy, security baseline |
| `DOMAIN_MODEL.md` | ĐỌC KỸ | Canonical entities, critical distinctions, relationships |
| `DOMAIN_INVARIANTS.md` | ĐỌC KỸ | 12 frozen invariants I-01…I-12 |
| `COMMERCIAL_EVENT_MODEL.md` | ĐỌC KỸ | Pipeline, required fields, event classes, open decisions CE-1/CE-2 |
| `IDENTITY_MODEL.md` | ĐỌC KỸ | Customer/Lead split, stable Lead ID, channel continuity |
| `MEASUREMENT_MODEL.md` | ĐỌC KỸ | 3 attribution concepts, funnel, UNKNOWN state |
| `TRUST_AND_EVIDENCE.md` | ĐỌC KỸ | Acquisition modes, assertion status, provenance, audit |
| `INTEGRATION_PRINCIPLES.md` | ĐỌC KỸ | Anti-corruption adapters, idempotency, permission model |
| `GLOSSARY.md` | ĐỌC KỸ | 30 term definitions G-01…G-30 |
| `OPEN_DECISIONS.md` | ĐỌC KỸ | 7 open decisions CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1 |

### Bậc 2 — docs/architecture/**

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `pancake-realtime-sync-architecture.md` | LƯỚT | Kiến trúc sync realtime Pancake; chi tiết kỹ thuật cho phase tích hợp sau |

### Bậc 2 — docs/research/…/00_EXECUTIVE/**

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `LEAN_VALIDATION_PHASE.md` | ĐỌC KỸ | Phase decision, build-first, gates L0-L5, "build now"/"do not build yet" |
| `CURRENT_THESIS.md` | LƯỚT | Vision/problem/solution hypotheses; xác nhận primary customer evidence chưa đủ |
| `DECISION_LOG.md` | ĐỌC KỸ | D-001…D-009 active-guardrail/bet, D-S01…D-S03 superseded |
| `OPEN_QUESTIONS.md` | ĐỌC KỸ | Q-D1…D6, Q-V1…V3, Q-F1…F4, Q-X1…X6 — blockers vs non-blockers |
| `PRODUCT_ONE_PAGER.md` | BỎ QUA | Pitch deck, không có thông tin kỹ thuật mới |

### Bậc 2 — docs/research/…/03_PRODUCT/**

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `LVP_PRODUCT_SPEC.md` | ĐỌC KỸ | Core loop, P0 capabilities, states, UX rules |
| `LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md` | ĐỌC KỸ | Functional acceptance, integrity guardrails, learning signals |
| `MVP_SCOPE.md` | ĐỌC KỸ | Active scope = LVP, historical proposal superseded |
| `NON_GOALS.md` | LƯỚT | Xác nhận deferred items trùng với canonical |
| `PRODUCT_BOUNDARIES.md` | LƯỚT | Boundaries mapped arch -> canonical |
| `PRODUCT_MODEL.md` | LƯỚT | Five engines; hypothesis-level |
| `PRODUCT_PRINCIPLES.md` | LƯỚT | Product principles; consistent with canonical |
| `PRODUCT_VISION.md` | LƯỚT | Vision; consistent with NORTH_STAR |
| `ROADMAP.md` | ĐỌC KỸ | Loop 0–4, learning gates, expansion rule |
| `MODULES/COMMERCIAL_CONTINUITY.md` | LƯỚT | Access scoping, channel intelligence |
| `MODULES/MARKETING_SALES_HANDOFF.md` | ĐỌC KỸ | Handoff tax, channel downgrade, seat tension |
| `MODULES/SALES_EXECUTION.md` | LƯỚT | Sales queue/outcome |
| `MODULES/FOLLOW_UP_COMMITMENT.md` | LƯỚT | Commitment lifecycle |
| `MODULES/CRM_LITE.md` | LƯỚT | CRM-lite minimal surface |
| `MODULES/ACQUISITION_INTELLIGENCE.md` | LƯỚT | Acquisition Hub |
| `MODULES/ATTRIBUTION.md` | LƯỚT | Attribution; hypothesis-level |
| `MODULES/DATA_HEALTH.md` | LƯỚT | Data health coverage |
| `MODULES/REVENUE_INTELLIGENCE.md` | LƯỚT | Future; not LVP |
| `MODULES/CONVERSATION_INTELLIGENCE.md` | LƯỚT | Future; not LVP |
| `Untitled-*.txt`, `# Custom Providers.txt` | BỎ QUA | Nháp, chỉ dùng khi có nguồn khác xác nhận |
| `# Custom Providers.txt` | BỎ QUA | Nháp; không có nguồn xác nhận |
| `Untitled-1.txt … Untitled-8.txt` | BỎ QUA | Nháp brainstorming, không normative |

### Bậc 2 — docs/research/…/05_ENGINEERING/**

| Thư mục con | Trạng thái | Lý do |
|-------------|-----------|-------|
| `EVOLUTION_ARCHITECTURE.md` | LƯỚT | Change seams — đã trích vào canonical ARCHITECTURE_CONSTITUTION |
| `DOMAIN_MODEL.md` | LƯỚT | Research domain model — canonical đã consolidate |
| `DATA_MODEL.md` | LƯỚT | Data model — canonical đã reference |
| `COMMERCIAL_EVENT_SCHEMA.md` | LƯỚT | Event schema — canonical đã consolidate |
| `INTEGRATION_ARCHITECTURE.md` | LƯỚT | Integration arch — canonical INTEGRATION_PRINCIPLES đã consolidate |
| `PANCAKE_INTEGRATION.md` | LƯỚT | Pancake integration — canonical đã reference |
| `PANCAKE_LVP_FEASIBILITY.md` | LƯỚT | LVP feasibility matrix |
| `SECURITY_ARCHITECTURE.md` | LƯỚT | Security baseline — canonical ARCHITECTURE_CONSTITUTION đã consolidate |
| `AI_ARCHITECTURE.md` | LƯỚT | AI controls — canonical TRUST_AND_EVIDENCE đã reference |

### Bậc 2 — docs/research/…/08_DATA_MEASUREMENT/**

| Thư mục con | Trạng thái | Lý do |
|-------------|-----------|-------|
| `OBSERVABILITY_AND_PROVENANCE_MODEL.md` | LƯỚT | Truth semantics — canonical TRUST_AND_EVIDENCE đã consolidate |
| `DATA_CONTRACT.md` | LƯỚT | Data contract — canonical đã reference |
| `DATA_QUALITY_RULES.md` | LƯỚT | Quality rules — canonical đã reference |
| `ATTRIBUTION_MODEL.md` | LƯỚT | Attribution — canonical MEASUREMENT_MODEL đã reference |
| `FUNNEL_DEFINITIONS.md` | LƯỚT | Funnel definitions — canonical MEASUREMENT_MODEL reference |

### Bậc 2 — docs/research/…/09_FINANCE_LEGAL_SECURITY/**

| Thư mục con | Trạng thái | Lý do |
|-------------|-----------|-------|
| Toàn bộ | BỎ QUA | Framework only; chưa có real-data/commercial readiness |

### Bậc 2 — docs/research/…/10_LEARNING/**

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `HYPOTHESIS_REGISTER.md` | LƯỚT | Hypotheses H0-H8; cần cho learning gate nhưng chưa block build |
| `EXPERIMENT_REGISTER.md` | LƯỚT | Experiments EXP-01…EXP-04; cần cho telemetry |
| `EVIDENCE_REGISTER.md` | BỎ QUA | Chưa có primary customer evidence |

### Bậc 3 — docs/external-apis/pancake/api-knowledge-base-2026-09-10/**

| File | Trạng thái | Lý do |
|------|-----------|-------|
| `AI_README.md` | ĐỌC KỸ | Quy tắc dùng API KB |
| `MASTER_INDEX.md` | ĐỌC KỸ | Index endpoints theo platform |
| `SCOPE_AND_COMPLETENESS.md` | ĐỌC KỸ | Phạm vi snapshot |
| `REMAINING_GAPS.md` | ĐỌC KỸ | Gaps chưa verify |
| `VERIFICATION_LOG_v2.md` | ĐỌC KỸ | Kết quả verify |
| `04_CROSS_PLATFORM/PROJECT_INTEGRATION_PRIORITY.md` | ĐỌC KỸ | Ưu tiên tích hợp |
| `04_CROSS_PLATFORM/API_FEASIBILITY_TEST_PLAN.md` | ĐỌC KỸ | Kế hoạch test khả thi |
| `04_CROSS_PLATFORM/AUTH_MATRIX.md` | LƯỚT | Auth matrix |
| `04_CROSS_PLATFORM/DATA_AVAILABILITY_MATRIX.md` | LƯỚT | Data availability |
| `04_CROSS_PLATFORM/OPEN_QUESTIONS.md` | ĐỌC KỸ | API open questions |
| `01_PANCAKE_CHAT/` | LƯỚT | Pancake chat endpoints — cần cho P3 |
| `02_META/`, `03_TIKTOK/` | BỎ QUA | Chưa thuộc scope LVP |

### Bậc 4 — docs/research/…/01_BUSINESS_STRATEGY/**

| Thư mục con | Trạng thái | Lý do |
|-------------|-----------|-------|
| Toàn bộ | BỎ QUA | Chỉ đọc lướt khi ảnh hưởng yêu cầu; PACKAGING/PRICING chưa block LVP |

### Bậc 5 — History

| Thư mục con | Trạng thái | Lý do |
|-------------|-----------|-------|
| `docs/project/plan-archive/PROJECT_IMPLEMENTATION_PLAN_2026-09-10/` | ĐỌC KỸ | 119 tasks, 11 phases, gates 2-5, current_state |
| `docs/project/revenue-continuity-context/` | LƯỚT | AGENTS.md + README_AI_CONTEXT.md; bối cảnh lịch sử |
| `docs/recovery/` | BỎ QUA | Recovered conversation; provenance only |
| `docs/project/ruflo-readiness/` | BỎ QUA | Investigation artifacts; agent orchestration |

### Bỏ qua hoàn toàn

| Thư mục | Lý do |
|---------|-------|
| `.agents/`, `.claude-flow/`, `.codex/` | Agent orchestration config |
| `templates/` | Bernstein template library |
| `docs/project/ruflo-readiness/` | Agent readiness investigation |

---

## 2. Facts (F-ID)

| ID | Fact | Nguồn |
|----|------|-------|
| F-01 | Product = Revenue Continuity Platform, không phải CRM/ERP/BI | [KB:docs/canonical/PRODUCT_CONSTITUTION.md#1] |
| F-02 | LVP promise: "When receiving a lead, Sales can quickly understand what the customer needs, inspect original evidence and know the next action without relying on memory" | [KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#10] |
| F-03 | 12 frozen domain invariants (I-01…I-12) | [KB:docs/canonical/DOMAIN_INVARIANTS.md] |
| F-04 | Commercial Event pipeline: Interaction → AI → CE → Evidence → Policy → Action | [KB:docs/canonical/COMMERCIAL_EVENT_MODEL.md#14] |
| F-05 | 7 open decisions: CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, LG-1 — không được tự resolve | [KB:docs/canonical/OPEN_DECISIONS.md] |
| F-06 | Stack: NestJS + Fastify + TypeScript + Vitest, code trong product/** | [KB:docs/delivery/stories/BOOT-001.md#15] |
| F-07 | Domain layer phải framework-independent | [KB:docs/delivery/stories/BOOT-001.md#33] |
| F-08 | UNKNOWN là state hợp lệ, không manufacture precision | [KB:docs/canonical/TRUST_AND_EVIDENCE.md#67] |
| F-09 | Build-first, learn-fast strategy; discovery chạy song song, không gate build | [KB:docs/research/…/00_EXECUTIVE/LEAN_VALIDATION_PHASE.md#23] |
| F-10 | Manual/synthetic adapter = P0; Pancake sync = P1; Meta/TikTok = deferred | [KB:docs/canonical/ARCHITECTURE_CONSTITUTION.md#64] |
| F-11 | Core states: New → Accepted → Contacting → Follow-up → Won/Lost + Unknown | [KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#68] |
| F-12 | L0-L5 learning gates; Loop 0-4 learning loops | [KB:docs/research/…/00_EXECUTIVE/LEAN_VALIDATION_PHASE.md#98] |
| F-13 | Moduler monolith; microservices không upfront | [KB:docs/canonical/ARCHITECTURE_CONSTITUTION.md#12] |
| F-14 |-append-audited and reversible mutations; append-only audit | [KB:docs/canonical/TRUST_AND_EVIDENCE.md#58] |
| F-15 | 10 change seams bắt buộc | [KB:docs/canonical/ARCHITECTURE_CONSTITUTION.md#26] |
| F-16 | Archive plan: 119 tasks, 11 phases, gates 2-5, start 2026-10-26, ends 2027-06-30 | [KB:docs/project/plan-archive/…/CURRENT_STATE.md] |
| F-17 | D-001…D-009 active decisions; D-S01…D-S03 superseded | [KB:docs/research/…/00_EXECUTIVE/DECISION_LOG.md] |
| F-18 | Idempotent ingestion, raw envelope immutable, external IDs immutable | [KB:docs/canonical/INTEGRATION_PRINCIPLES.md#49] |
| F-19 | P0 capabilities: auth, workspace, manual input, lead lifecycle, queues, audit, telemetry | [KB:docs/research/…/03_PRODUCT/LVP_PRODUCT_SPEC.md#32] |
| F-20 | No auto-commit/push/merge/release unless human authorized | [KB:docs/delivery/contracts/BOOT-001.manager.json#70] |

---

## 3. Mâu thuẫn / Khác biệt

| ID | Mô tả | Nguồn A | Nguồn B | Xử lý |
|----|-------|---------|---------|-------|
| C-01 | Blackstar Task 6.13 dùng PostgreSQL ngay; canonical deferred persistence | [KB:tasks.csv#task 6.13] | [KB:ARCHITECTURE_CONSTITUTION.md#73] + [KB:BOOT-001.md#20] | Theo canonical: PostgreSQL = future primary target, persistence deferred trong BOOT-001 |
| C-02 | Blackstar Task 2.11 đặt Meta attribution = P0; canonical đặt Meta = deferred | [KB:tasks.csv#task 2.11] | [KB:LEAN_VALIDATION_PHASE.md#78] + [KB:OPEN_DECISIONS.md#MM-1] | Theo canonical: Meta attribution outside LVP |
| C-03 | Blackstar Task 3.13 đặt Pancake write = P0; canonical deferred Pancake sending | [KB:tasks.csv#task 3.13] | [KB:ARCHITECTURE_CONSTITUTION.md#67] | Theo canonical: Pancake sending deferred |
| C-04 | Blackstar Gates dùng "Cổng" n+1; canonical dùng "L{n}" gates + "Loop {n}" learning loops | [KB:DECISION_GATES.md] | [KB:LEAN_VALIDATION_PHASE.md#98] + [KB:ROADMAP.md] | Đánh dấu rõ: PH{n} map sang cả hai hệ thống |
| C-05 | Archive plan đặt end-to-end demo ở Phase 8; canonical gating yêu cầu lát cắt mỏng sớm | [KB:tasks.csv#task 8.11] | [KB:LEAN_VALIDATION_PHASE.md#28] | Theo canonical + phase_design: walking skeleton sớm hơn |

---

## 4. Khoảng trống (GAP-ID)

| ID | Khoảng trống | Ảnh hưởng | Ghi chú |
|----|-------------|-----------|---------|
| GAP-01 | Chưa có customers/testers thực tế (primary customer evidence chưa đủ) | Không block build, nhưng block Loop 1+ | [KB:LEAN_VALIDATION_PHASE.md#16] |
| GAP-02 | Chưa có account Pancake để test API spike | Block Q-F1, Q-X3 | [KB:OPEN_QUESTIONS.md#Q-X3] |
| GAP-03 | Chưa có quyết định stack/capacity thực tế | Block implementation start | [KB:OPEN_QUESTIONS.md#Q-X4] — story BOOT-001 đã chốt stack |
| GAP-04 | Chưa có quyết định UI language (Vietnamese-first vs bilingual) | Không block domain layer | [KB:OPEN_QUESTIONS.md#Q-X5] — default: Vietnamese-first |
| GAP-05 | Pancake webhook/polling semantics chưa capture | Block realtime sync | [KB:OPEN_QUESTIONS.md#Q-F2] |
| GAP-06 | Pancake message sending permission/terms chưa verify | Block outbound | [KB:OPEN_QUESTIONS.md#Q-F3] — deferred |
| GAP-07 | Manual import vs read sync cho first external test | Affects Loop 1 design | [KB:OPEN_QUESTIONS.md#Q-X6] |
| GAP-08 | Chưa có Permissions matrix chi tiết beyond frozen boundary | Không block LVP; chỉ enforce frozen boundary | [KB:OPEN_DECISIONS.md#PM-1] |
| GAP-09 | Chưa có state transition table cho Commercial Event | Affects domain layer design | [KB:OPEN_DECISIONS.md#CE-1] |
| GAP-10 | Chưa có scope resolution cho CommercialEvent (inferred-only vs generalized) | Affects event schema | [KB:OPEN_DECISIONS.md#CE-2] |

---

## 5. Bảng kế thừa

### Từ archive PROJECT_IMPLEMENTATION_PLAN_2026-09-10

| Mục cũ | ID cũ | Quyết định | Lý do | Ánh xạ mới |
|--------|-------|-----------|-------|------------|
| Gate 2: Xây/Thu hẹp/Thử nghiệm lại | Cổng 2 | GIỮ (map sang learning gate) | Tương đương L2 Vertical slice | Gate L2 |
| Gate 3: Sẵn sàng Alpha | Cổng 3 | GIỮ (map sang learning gate) | Tương đương L3 Usable over time | Gate L3 |
| Gate 4: Giá trị có lặp lại? | Cổng 4 | GIỮ (map sang learning gate) | Tương đương L4 Optional leverage | Gate L4 |
| Gate 5: Sẵn sàng thương mại? | Cổng 5 | GIỮ (map sang learning gate) | Tương đương L5 Direction | Gate L5 |
| Task 1.1 Cập nhật luận điểm | 1.1 | ĐỔI | Canonical đã consolidate; task này trở thành校对 | Không cần task riêng |
| Task 1.4 Domain ngữ nghĩa | 1.4 | ĐỔI | 12 frozen invariants đã canonical; task trở thành校对 | Không cần task riêng |
| Task 2.1 Xác minh Pancake API | 2.1 | GIỮ | Q-F1 chưa trả lời; cần API spike | PH0 spike |
| Task 2.5 Mô hình tương tác trung lập | 2.5 | GIỮ | Canonical DOMAIN_MODEL đã define; task = implement | PH2 domain |
| Task 2.7 Kiến trúc đa khách hàng | 2.7 | BỎ | LVP = single-tenant; multi-tenant deferred | Không thuộc LVP |
| Task 2.9 Thử nghiệm AI trích xuất | 2.9 | GIỮ | Q-F4; AI feature-flagged | PH3 spike |
| Task 2.11 Meta attribution | 2.11 | BỎ | Canonical deferred Meta attribution | Không thuộc LVP |
| Task 3.1 Pancake write | 3.1 | BỎ | Canonical deferred Pancake sending | Không thuộc LVP |
| Task 6.13 PostgreSQL persistence | 6.13 | ĐỔI | BOOT-001 deferred persistence; use in-memory/file-based first | PH2 persistence |
| Task 8.11 E2E demo | 8.11 | ĐỔI | Walking skeleton sớm hơn; E2E ở PH1 | PH1 walking skeleton |

---

## 6. Sổ câu hỏi hợp nhất

### Từ OPEN_DECISIONS.md (canonical — BLOCKING)

| ID | Câu hỏi | Trạng thái | Ảnh hưởng |
|----|---------|-----------|-----------|
| CE-1 | Commercial Event ↔ Commercial State transition table | Chưa trả lời | BLOCKING — cần trước domain layer |
| CE-2 | Commercial Event scope (inferred-only vs generalized) | Chưa trả lời | BLOCKING — cần trước event schema |
| MM-1 | Attribution model choice | Chưa trả lời | Không block LVP (keep UNKNOWN) |
| ID-1 | Identity merge thresholds/undo | Chưa trả lời | Không block LVP (defer automated merge) |
| ID-2 | Field mapping for Twenty/CRM | Chưa trả lời | Không block LVP (CRM adapter deferred) |
| PM-1 | Detailed permissions | Chưa trả lời | Không block LVP (enforce frozen boundary only) |
| LG-1 | North Star vs LVP scope conflict | Chưa trả lời | Không block build (keep both layers) |

### Từ OPEN_QUESTIONS.md (research)

| ID | Câu hỏi | Trạng thái | Blocker? |
|----|---------|-----------|---------|
| Q-D1 | Context handoff improves first Sales action? | Chưa test | No |
| Q-D2 | Original-channel continuity important? | Chưa test | No (channel feature deferred) |
| Q-D3 | Follow-up leakage frequent/painful? | Chưa test | No |
| Q-D4 | Sales sustain minimal action updates? | Chưa test | No |
| Q-D5 | Current tags/notes/CRM already good enough? | Chưa test | No |
| Q-D6 | Repeatability across companies? | Chưa test | Yes for category claim; no for LVP build |
| Q-V1 | Who owns budget/authority? | Chưa test | Yes for pricing/GTM |
| Q-V2 | Manager visibility produces action? | Chưa test | No (deferred) |
| Q-V3 | Utility worth paying for? | Chưa test | Yes for commercial claim |
| Q-F1 | Pancake read endpoints accessible? | Chưa test | No; manual fallback |
| Q-F2 | Webhook events/payload/security semantics? | Chưa test | Yes for realtime sync |
| Q-F3 | Message sending + commercial terms? | Chưa test | Yes for outbound; deferred |
| Q-F4 | AI extract Vietnamese context safely? | Chưa test | No; manual fallback |
| Q-X1 | First testers + recruitment owner? | Chưa resolve | Yes for L5 |
| Q-X2 | Real conversation data use policy? | Chưa resolve | Yes for real-data ingest |
| Q-X3 | Credentials + account consent? | Chưa resolve | Yes for API spike |
| Q-X4 | Build capacity + selected stack? | Chưa resolve | BOOT-001 đã chốt |
| Q-X5 | Vietnamese-only or bilingual? | Chưa resolve | No; default Vietnamese-first |
| Q-X6 | Manual import vs read sync for first test? | Chưa resolve | No |

### Từ REMAINING_GAPS.md (API KB)

| ID | Gap | Blocker? |
|----|-----|---------|
| G-API-01 | Live endpoint verification pending | Yes for API integration |
| G-API-02 | Auth flow complete documentation | Yes for API integration |
| G-API-03 | Rate limits per endpoint | Partially block |

---

## 7. Phân loại câu hỏi: BLOCK vs KHÔNG BLOCK build

### BLOCK build (phải trả lời hoặc Assumption trước khi code)

| ID | Nguồn | Xử lý |
|----|-------|-------|
| CE-1 | OPEN_DECISIONS | Xếp vào PH0 research; Human Gate cần trước khi code domain events |
| CE-2 | OPEN_DECISIONS | Xếp vào PH0 research; Human Gate cần trước khi code event schema |
| Q-X3 | OPEN_QUESTIONS | Đã trả lời bởi BOOT-001: stack chốt NestJS+Fastify+TS |
| Q-X4 | OPEN_QUESTIONS | Đã trả lời bởi BOOT-001: Node.js 22, TypeScript |
| Q-F1 | OPEN_QUESTIONS | Xếp vào PH0 spike; manual fallback available |

### KHÔNG BLOCK build (chạy song song hoặc chờ learning gate)

| ID | Nguồn | Xử lý |
|----|-------|-------|
| MM-1 | OPEN_DECISIONS | Giữ UNKNOWN; resolve ở phase measurement |
| ID-1 | OPEN_DECISIONS | Defer automated merge; resolve ở phase identity |
| ID-2 | OPEN_DECISIONS | Defer CRM mapping |
| PM-1 | OPEN_DECISIONS | Enforce frozen boundary only |
| LG-1 | OPEN_DECISIONS | Giữ cả hai layer |
| Q-D1…D6 | OPEN_QUESTIONS | Learning signals; test qua Loop 1-4 |
| Q-V1…V3 | OPEN_QUESTIONS | Viability; test qua Loop 4 |
| Q-F2 | OPEN_QUESTIONS | Block realtime sync; manual fallback cho LVP |
| Q-F3 | OPEN_QUESTIONS | Deferred |
| Q-X1…X2 | OPEN_QUESTIONS | Tester recruitment; parallel track |
| Q-X5 | OPEN_QUESTIONS | Vietnamese-first default |
| Q-X6 | OPEN_QUESTIONS | Decide from Loop 1 context |
