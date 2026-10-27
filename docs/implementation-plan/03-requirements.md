# 03 — Requirements (LVP)

**Phiên:** 2026-09-21 (Bước 2 — planning)  
**Trạng thái:** Draft cho human review — chưa freeze  
**Phạm vi:** Chỉ LVP (P0/P1). Các capability deferred nằm ngoài.

> **Cách đọc:** Mỗi R có ID `R-xx`, invariant cover, P0/P1, nguồn canonical, acceptance criteria Given/When/Then. R nào BLOCKED-BY open decision (CE-1/CE-2/Q-03/Q-04…) ghi rõ, **không tự resolve**.

---

## 1. Cluster A — Workspace / Auth / RBAC

### R-01: Pilot Workspace Isolation
**Mô tả:** Pilot workspace isolation kể cả single-tenant deploy. Demo/synthetic data tách khỏi pilot evidence.
**Invariant:** I-08 (workspace scoped), I-12 (synthetic segregation)
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#82](../canonical/ARCHITECTURE_CONSTITUTION.md), [DOMAIN_INVARIANTS.md#61](../canonical/DOMAIN_INVARIANTS.md)
**Acceptance Criteria:**
- Given Operator trong pilot workspace, When querying leads, Then chỉ thấy leads của workspace mình
- Given synthetic demo data, When querying evidence, Then synthetic bị exclude khỏi pilot evidence

### R-02: Authentication
**Mô tả:** Mọi non-demo user phải authenticate. Demo access không cần auth.
**Invariant:** I-09 (scoped access)
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#80](../canonical/ARCHITECTURE_CONSTITUTION.md)
**Acceptance Criteria:**
- Given unauthenticated user, When accessing non-demo endpoint, Then request bị reject
- Given demo workspace, When accessing demo endpoints, Then access cho phép

### R-03: Role-Based Access (Frozen Boundary)
**Mô tả:** Sales access scoped assigned lead; không truy cập leads ngoài scope. Manager/Admin quản lý access + xử lý exception.
**Invariant:** I-09
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#80](../canonical/ARCHITECTURE_CONSTITUTION.md); `DOMAIN_INVARIANTS.md` I-09
**Acceptance Criteria:**
- Given Sales assigned Lead X, When Sales truy cập Lead Y (không assigned), Then request bị reject
- Given Manager xem exception, When query, Then chỉ leads trong workspace scope

---

## 2. Cluster B — Manual / Synthetic Input

### R-04: Manual / Synthetic Lead Import
**Mô tả:** Operator tạo lead qua paste/import hoặc synthetic demo. Manual adapter first-class, P0, fallback khi integration fail. Raw evidence preserve trước canonical projection.
**Invariant:** I-12 (raw evidence preserved)
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#50](../canonical/ARCHITECTURE_CONSTITUTION.md)
**Acceptance Criteria:**
- Given Operator paste conversation text, When import, Then raw text stored immutable + canonical Lead created
- Given synthetic data, When viewing evidence, Then synthetic label visible

### R-05: Versioned Inbound Envelope
**Mô tả:** Mỗi inbound message tạo versioned envelope: connection, external IDs, record type, source timestamps, raw payload pointer + hash. Mapping error preserve raw envelope, không fabricate canonical fields.
**Invariant:** I-11 (adapter contract), I-12 (raw evidence preserved)
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#47](../canonical/ARCHITECTURE_CONSTITUTION.md); `INTEGRATION_PRINCIPLES.md`
**Acceptance Criteria:**
- Given inbound message, When envelope created, Then required fields present (connection, external IDs, record type, timestamps, payload pointer, hash)
- Given mapping error, When processing fails, Then raw envelope preserved + canonical fields không fabricated

### R-06: Idempotent Ingestion
**Mô tả:** External IDs immutable. Ingestion idempotent theo connection + external record/event ID. Raw envelope immutable.
**Invariant:** I-11, I-12
**P0/P1:** P0
**Nguồn:** [INTEGRATION_PRINCIPLES.md#49](../canonical/INTEGRATION_PRINCIPLES.md)
**Acceptance Criteria:**
- Given duplicate inbound message (cùng connection + external ID), When processed 2 lần, Then chỉ 1 canonical record
- Given raw envelope stored, When query, Then payload + hash không đổi

---

## 3. Cluster C — Lead / Handoff / Evidence

### R-07: Lead Create with Stable Lead ID
**Mô tả:** Lead = một commercial episode. Stable Lead ID survive channel transitions. Lead ≠ Customer (I-01).
**Invariant:** I-01 (Customer ≠ Lead), I-07 (stable Lead ID)
**P0/P1:** P0
**Nguồn:** [DOMAIN_MODEL.md](../canonical/DOMAIN_MODEL.md); `IDENTITY_MODEL.md`
**Acceptance Criteria:**
- Given Operator tạo Lead, When Lead created, Then stable Lead ID generated + immutable
- Given Lead có channel context, When reassigned, Then Lead ID không đổi

### R-08: Lead Assignment / Acceptance / Reassignment
**Mô tả:** Lead assign cho Sales; Sales accept/reject; reassignment có audit trail. Mọi thay đổi append-audited.
**Invariant:** I-05 (auditable), I-09 (scoped access)
**P0/P1:** P0
**Nguồn:** [DOMAIN_MODEL.md](../canonical/DOMAIN_MODEL.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given Lead assigned Sales, When Sales accepts, Then assignment recorded actor + timestamp
- Given Lead reassigned, When querying audit, Then previous owner + reason visible

### R-09: Context Summary (Evidence-Backed, Editable)
**Mô tả:** Product tạo context summary từ raw evidence. Summary editable nhưng original evidence immutable. Inference visually distinguishable (I-03).
**Invariant:** I-03 (AI != direct mutate)
**P0/P1:** P0
**Nguồn:** [TRUST_AND_EVIDENCE.md#74](../canonical/TRUST_AND_EVIDENCE.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given raw conversation, When viewing Lead detail, Then raw evidence visible cạnh context summary
- Given AI-drafted summary, When viewing, Then inference visually distinguishable
- Given Sales edits summary, When saving, Then original evidence không đổi, edit recorded actor + timestamp

### R-10: Conversation Source ≠ Acquisition Lineage ≠ Revenue Attribution
**Mô tả:** Ba khái niệm không collapse. Conversation Source = where. Acquisition Lineage = origin. Revenue Attribution = credit (UNKNOWN trong LVP).
**Invariant:** I-02
**P0/P1:** P0
**Nguồn:** [DOMAIN_INVARIANTS.md#22](../canonical/DOMAIN_INVARIANTS.md); `MEASUREMENT_MODEL.md`
**Acceptance Criteria:**
- Given Lead có conversation, When viewing details, Then "Conversation Source" + "Acquisition Lineage" là field riêng biệt
- Given chưa có attribution model, When viewing Attribution, Then value = UNKNOWN với unknown_reason

### R-11: Handoff Package
**Mô tả:** Handoff = Marketing→Sales context package: identity, channel context, conversation summary, evidence, proposed next action. Mỗi handoff có stable Lead ID.
**Invariant:** I-07 (stable Lead ID), I-09 (scoped access)
**P0/P1:** P0
**Nguồn:** [DOMAIN_MODEL.md](../canonical/DOMAIN_MODEL.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given Operator handoff Lead, When Sales views, Then Lead ID stable + context summary + evidence references intact
- Given handoff, When querying audit, Then handoff event recorded actor + timestamp

### R-12: Contact Attempt / Outcome Recording
**Mô tả:** Sales ghi contact attempt + outcome. Mỗi record có actor, timestamp, previous/new value.
**Invariant:** I-05 (auditable)
**P0/P1:** P0
**Nguồn:** `LVP_PRODUCT_SPEC.md`; `TRUST_AND_EVIDENCE.md`
**Acceptance Criteria:**
- Given Sales contacts, When recording attempt, Then actor + timestamp + outcome captured
- Given outcome corrected, When viewing history, Then previous outcome + correction reason visible

### R-13: Next Action Lifecycle
**Mô tả:** Sales tạo next action với due date; complete/reopen/reschedule. Mỗi state change append-audited.
**Invariant:** I-05 (auditable)
**P0/P1:** P0
**Nguồn:** `LVP_PRODUCT_SPEC.md`; `TRUST_AND_EVIDENCE.md`
**Acceptance Criteria:**
- Given Sales tạo next action có due date, When due date passes, Then action xuất hiện trong Overdue queue
- Given Sales completes action, When viewing history, Then completion recorded actor + timestamp
- Given Sales reopens action, When viewing audit, Then reopen event + reason visible

### R-14: Lead State Machine (Hypothesis — BLOCKED-BY CE-1)
**Mô tả:** LVP state: New → Accepted → Contacting → Follow-up → Won/Lost + Unknown. Mọi transition append-audited, reversible.
**Invariant:** I-03 (AI != mutate), I-05 (auditable)
**P0/P1:** P0
**BLOCKED-BY:** CE-1 (transition table chưa freeze — ADR-001 interim)
**Nguồn:** [COMMERCIAL_EVENT_MODEL.md](../canonical/COMMERCIAL_EVENT_MODEL.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given Lead New, When Sales accepts, Then state → Accepted + audit
- Given Lead terminal state, When correcting, Then correction appended (không overwrite)
- Given state transition, When querying audit, Then previous/new value + actor + timestamp + reason

---

## 4. Cluster D — Persistence / Outcome / Commercial Event

### R-15: Minimal Outcome (Won / Lost / Unknown)
**Mô tả:** Sales ghi minimal outcome: Won/Lost/Unknown. Mỗi outcome user claim unless corroborated. UNKNOWN là valid state.
**Invariant:** I-08 (UNKNOWN visible)
**P0/P1:** P0
**Nguồn:** [TRUST_AND_EVIDENCE.md#54](../canonical/TRUST_AND_EVIDENCE.md); `MEASUREMENT_MODEL.md`
**Acceptance Criteria:**
- Given Sales records "Won", When viewing, Then value = "Won" + acquisition_mode = "user_confirmed" + assertion_status = "claimed"
- Given no outcome, When viewing, Then value = UNKNOWN (không null, không empty)
- Given Sales corrects Won→Lost, When viewing history, Then cả 2 assertions visible

### R-16: Commercial Event Provenance Envelope
**Mô tả:** Mỗi commercial assertion mang: assertion_id, workspace_id, subject, event type, value, assertion_status, acquisition_mode, source system/record/actor, timestamps, raw_evidence_pointer, schema_version, created_by, supersedes_assertion_id.
**Invariant:** I-05 (auditable), I-12 (raw evidence)
**P0/P1:** P0
**Nguồn:** [COMMERCIAL_EVENT_MODEL.md](../canonical/COMMERCIAL_EVENT_MODEL.md); [TRUST_AND_EVIDENCE.md#34](../canonical/TRUST_AND_EVIDENCE.md)
**Acceptance Criteria:**
- Given state mutation, When querying provenance, Then required envelope fields present (assertion_id, actor, previous/new value, timestamp, reason)
- Given AI-produced value, When viewing provenance, Then confidence metadata (producer/model/version/rationale) present

### R-17: UNKNOWN States Handling
**Mô tả:** `unknown`, `not_applicable`, `not_observed`, `not_requested`, `redacted` là truth states riêng biệt. Không backfill với assumptions.
**Invariant:** I-08 (UNKNOWN valid), I-12
**P0/P1:** P0
**Nguồn:** [TRUST_AND_EVIDENCE.md#67](../canonical/TRUST_AND_EVIDENCE.md); [DOMAIN_INVARIANTS.md#61](../canonical/DOMAIN_INVARIANTS.md)
**Acceptance Criteria:**
- Given unknown attribution, When viewing, Then value = "unknown" (không null)
- Given unknown source linkage, When querying, Then "unknown" surfaced + Data Health linkage gap visible

### R-18: Durable Persistence (PostgreSQL)
**Mô tả:** Durable pilot workspace yêu cầu persistence (PostgreSQL). Forward migrations + tested rollback.
**Invariant:** I-11, I-12
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#88](../canonical/ARCHITECTURE_CONSTITUTION.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given pilot data, When server restart, Then data preserved (durable)
- Given schema change, When migration forward, Then rollback plan tested
- Given data export/delete, When executed, Then deletion audited + retention enforced

> **A-01 (updated):** BOOT-001 deferred persistence chỉ trong story bootstrap. LVP yêu cầu durable persistence trước Gate L2/L3. Persistence partition vào PH2/PH3, KHÔNG trong PH0/PH1.

---

## 5. Cluster E — Audit / Provenance / UNKNOWN

### R-19: Append-Only Audit Trail
**Mô tả:** Mọi important mutation có audit trail: actor, previous/new value, timestamp, reason. Append-only; corrections append assertions.
**Invariant:** I-05 (auditable), I-12
**P0/P1:** P0
**Nguồn:** [TRUST_AND_EVIDENCE.md#58](../canonical/TRUST_AND_EVIDENCE.md); [DOMAIN_INVARIANTS.md#43](../canonical/DOMAIN_INVARIANTS.md)
**Acceptance Criteria:**
- Given state mutation, When querying audit, Then actor + previous/new value + timestamp + reason present
- Given correction applied, When viewing audit, Then original assertion + correction visible

### R-20: AI Draft-Only (Non-Mutating)
**Mô tả:** AI có thể draft context/needs/objections/commitments/next actions. Mọi AI output → CommercialEvent pipeline (Inferred → Evidence → Policy → Action). AI never writes directly.
**Invariant:** I-03 (AI != direct mutate), I-04 (inferred → CE)
**P0/P1:** P0 (pipeline), P1 (AI inference — feature-flag)
**BLOCKED-BY:** CE-2 (event scope)
**Nguồn:** [TRUST_AND_EVIDENCE.md#74](../canonical/TRUST_AND_EVIDENCE.md); [COMMERCIAL_EVENT_MODEL.md](../canonical/COMMERCIAL_EVENT_MODEL.md)
**Acceptance Criteria:**
- Given AI feature-flag ON, When AI produces draft, Then output → CommercialEvent với confidence + evidence + suggested mutation
- Given AI feature-flag OFF, When processing lead, Then manual loop fully functional
- Given AI output invalid, When schema validation fails, Then fails closed → manual input

---

## 6. Cluster F — Telemetry / Experiment / Governance

### R-21: Product Telemetry
**Mô tả:** ProductEvent observe behavior inside product. Tagged release version + feature flag exposure. Feedback tách khỏi behavior.
**Invariant:** I-05
**P0/P1:** P0
**Nguồn:** [TRUST_AND_EVIDENCE.md#80](../canonical/TRUST_AND_EVIDENCE.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given user action, When telemetry event emitted, Then event bao gồm release version + feature flag set
- Given feedback submitted, When stored, Then feedback record tách riêng khỏi telemetry

### R-22: Release Version + Experiment Exposure
**Mô tả:** Mỗi build có release version. Feature flag exposure recorded per session. Old variants remain available cho rollback.
**Invariant:** I-05
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#76](../canonical/ARCHITECTURE_CONSTITUTION.md); `LVP_PRODUCT_SPEC.md`
**Acceptance Criteria:**
- Given deployed version, When querying, Then release version returned trong health/metadata
- Given feature flag experiment, When user session active, Then exposure recorded với variant + timestamp

### R-23: Structured Feedback
**Mô tả:** Users submit structured feedback (rating + free text + context). Feedback là product signal, không phải demand proof.
**Invariant:** —
**P0/P1:** P0
**Nguồn:** `LVP_PRODUCT_SPEC.md`; `LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md`
**Acceptance Criteria:**
- Given Sales action, When feedback submitted, Then captured với context (lead ID, action type)
- Given feedback submitted, When querying, Then feedback separable từ telemetry

### R-24: Manager Exception View
**Mô tả:** Manager thấy leads cần attention: overdue, stalled, unknown outcomes. Observations-based, không inference.
**Invariant:** I-08 (UNKNOWN visible), I-09 (scoped access)
**P0/P1:** P1
**Nguồn:** `LVP_PRODUCT_SPEC.md`; `MEASUREMENT_MODEL.md`
**Acceptance Criteria:**
- Given leads overdue, When Manager views exceptions, Then leads xuất hiện với overdue indicator
- Given Manager query, When scoped, Then chỉ workspace leads visible

### R-25: Data Health Coverage View
**Mô tả:** Data Health expose: deterministic linkage rate, inferred rate, unknown rate, missing handoff linkages, outcome coverage per source. Honest unknown > false precision.
**Invariant:** I-02, I-08
**P0/P1:** P1
**Nguồn:** [MEASUREMENT_MODEL.md#36](../canonical/MEASUREMENT_MODEL.md); [DOMAIN_INVARIANTS.md#61](../canonical/DOMAIN_INVARIANTS.md)
**Acceptance Criteria:**
- Given leads với source status, When viewing Data Health, Then per-source breakdown: deterministic/inferred/unknown %
- Given missing handoff linkage, When viewing Data Health, Then linkage gap visible (không hidden)

---

## 7. Cluster G — Pancake Sync (P1, Feature-Flagged)

### R-26: Pancake Read-Only Sync (Flagged OFF)
**Mô tả:** Read conversations/messages/customers từ Pancake. Feature flag default OFF. Cần live verification trước khi use. Raw envelope stored immutably.
**Invariant:** I-11, I-12
**P0/P1:** P1
**BLOCKED-BY:** Q-03 (Pancake API accessible?), Q-04 (webhook semantics?)
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#64](../canonical/ARCHITECTURE_CONSTITUTION.md); `INTEGRATION_PRINCIPLES.md`
**Acceptance Criteria:**
- Given Pancake flag OFF, When syncing, Then không có Pancake API calls
- Given Pancake flag ON, When syncing, Then raw envelope stored immutable + canonical projection
- Given Pancake sync fails, When fallback, Then manual loop vẫn hoạt động

### R-27: Pancake Adapter (Idempotency + Redaction)
**Mô tả:** Pancake adapter: encrypted server-side credentials, per-workspace connection, internal lead-level authorization, idempotent ingestion, cursor/checkpoint tách khỏi canonical state, full token/PII redaction.
**Invariant:** I-11, I-12
**P0/P1:** P1
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#69](../canonical/ARCHITECTURE_CONSTITUTION.md); `INTEGRATION_PRINCIPLES.md`
**Acceptance Criteria:**
- Given Pancake message chứa PII, When logged, Then PII redacted
- Given duplicate Pancake event, When processed, Then idempotent (không duplicate)
- Given Pancake credentials, When stored, Then encrypted server-side, không bao giờ trong domain events/logs

### R-28: Synthetic / Demo Segregation
**Mô tả:** Synthetic/demo data không vào customer evidence analysis. Synthetic visible trong demo workspace nhưng segregated.
**Invariant:** I-12
**P0/P1:** P0
**Nguồn:** [ARCHITECTURE_CONSTITUTION.md#46](../canonical/ARCHITECTURE_CONSTITUTION.md); [TRUST_AND_EVIDENCE.md#82](../canonical/TRUST_AND_EVIDENCE.md)
**Acceptance Criteria:**
- Given synthetic demo data, When querying evidence, Then synthetic excluded
- Given demo workspace, When viewing, Then synthetic label visible

---

## 8. Invariant Coverage Matrix

| Invariant | Covered by R-IDs |
|-----------|-----------------|
| I-01 | R-07 |
| I-02 | R-10, R-25 |
| I-03 | R-09, R-14, R-20 |
| I-04 | R-20 |
| I-05 | R-08, R-12, R-13, R-14, R-16, R-19, R-21, R-22 |
| I-07 | R-07, R-11 |
| I-08 | R-01, R-15, R-17, R-24, R-25 |
| I-09 | R-02, R-03, R-11, R-24 |
| I-11 | R-05, R-06, R-18, R-26, R-27 |
| I-12 | R-01, R-04, R-05, R-06, R-16, R-17, R-18, R-26, R-27, R-28 |

> Mỗi invariant I-01…I-12 có ≥1 requirement cover. ✓

---

## 9. BLOCKED-BY Summary

| Requirement | Blocked By | Resolution Path |
|-------------|-----------|-----------------|
| R-14 | CE-1 | ADR-001 interim + Human Gate |
| R-20 | CE-2 | ADR-001 interim (AI draft-only) |
| R-26, R-27 | Q-03, Q-04 | PH0 spike (Pancake feasibility) |

## 10. Proposed Service Model Requirements (Deferred — chưa được duyệt vào LVP)

**Trạng thái:** Đăng ký delta để product review; không phải cam kết scope hiện hành. Các requirement dưới đây không mở rộng PH3. Chỉ promote sau khi human gate cập nhật phase map và giải quyết các quyết định liên quan.

| R-ID | Yêu cầu đề xuất | C-ID đề xuất | Phase gợi ý | Gate / lưu ý |
|------|----------------|-------------|-------------|--------------|
| R-29 | Cùng một gói phần mềm hỗ trợ managed VPS và customer-hosted; tách control plane khỏi data plane, mỗi instance có identity/config/secret riêng. | C-03, C-12; cần C-13 Control Plane | Productization | PM-1, LG-1; customer/instance/workspace không đồng nhất. |
| R-30 | First-run `/setup` tạo workspace và admin đúng một lần, an toàn và có audit. | C-04, C-06, C-12 | Onboarding | PM-1; chưa quyết định invite/password/SSO/bootstrap credential. |
| R-31 | Provisioning là workflow có trạng thái, idempotent, retryable và có compensation/cleanup khi lỗi. | C-06, C-09; cần C-13 | Control plane | Chọn mode A/provider và ownership trước. |
| R-32 | Quản lý lifecycle instance/subscription riêng khỏi Lead state; mọi chuyển trạng thái có audit. | C-06, C-09; cần C-13/C-14 | Control plane | Không nhập chung với CE-1; hết hạn/past-due policy cần duyệt. |
| R-33 | Nếu mở customer-hosted: license ký số, agent outbound-only, grace/offline policy; không khóa/xóa dữ liệu khách khi hết hạn. | C-09, C-12; cần C-14 | Customer-hosted | Human/legal review cho license và read-only policy. |
| R-34 | Image có version/digest/signature; upgrade có backup/preflight/changelog/rollback và khách kiểm soát lịch nâng cấp ở mode B. | C-03, C-09, C-11 | Release engineering | Chốt license/distribution strategy trước phát hành. |
| R-35 | Backup/restore có kiểm thử, retention và portability B↔A; bảo toàn audit, provenance, evidence và workspace boundaries. | C-03, C-06, C-11 | Reliability/productization | RPO/RTO, key custody, trách nhiệm dữ liệu cần duyệt. SQL migration rollback không thay thế backup/restore. |
| R-36 | Tách ops telemetry control-plane khỏi ProductEvent; allowlist dữ liệu, redact PII/token, diagnostic chi tiết opt-in. | C-06, C-08, C-12; cần C-13 | Trước central telemetry | I-12; legal/privacy review. Không gửi nội dung hội thoại/prompt/PII theo mặc định. |
| R-37 | Remote support chỉ qua grant có consent, scope, thời hạn/revoke; mọi thao tác audit, diagnostic bundle đã redact. | C-06, C-12 | Trước customer-hosted support | PM-1; permissions/support consent cần RFC/human gate. |
| R-38 | Installer preflight kiểm tra môi trường/tài nguyên/network trước mutation; từ chối an toàn với lỗi actionable. | C-04, C-09, C-11 | Installer/productization | Ngưỡng phần cứng trong SERVICE_MODEL còn là ước lượng, phải xác minh. |
| R-39 | Secret riêng từng instance/customer, không log, có rotation/revocation; custody phù hợp deployment mode. | C-06, C-12 | Security hardening | Chốt secret store/key custody; không đưa secret vào repo. |
| R-40 | Nếu mở rộng beyond Pancake read-only: channel gateway chuẩn hóa webhook, chống giả mạo/replay, idempotency và rate policy. | C-05, C-09, C-11 | Theo từng channel | App riêng hay shared relay còn mở; không mở rộng PH4 mặc định. |
| R-41 | Trước đóng gói thương mại: inventory dependency/license, SBOM và review nghĩa vụ host/phân phối. | Chưa có C-ID | Release/governance gate | License strategy chưa chốt; cần chuyên gia pháp lý khi cần. |

### Ranh giới và quyết định cần duyệt

- R-29…R-41 là backlog đề xuất từ `docs/north-star/SERVICE_MODEL.md`; không thay thế R-01…R-28 và không tự đổi phạm vi LVP.
- PH3 đã duyệt vẫn là persistence/auth/RBAC/telemetry-feedback cho app; control plane, provisioning, licensing, installer và fleet upgrade không thuộc PH3 nếu chưa có quyết định scope mới.
- Login/token endpoint không tự xác định credential model. Không phát hành token chỉ dựa trên email/workspace do caller gửi; cần chọn one-time bootstrap/invitation, password flow hoặc external IdP trước khi implement login thật.
- Không resolve CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, LG-1. Các capability liên quan phải giữ seam và human gate.
- Trước khi promote các R này: quyết định mode A/B sequencing, lõi build-vs-compose, license strategy, LLM key custody, provider/data location, ICP/kênh đầu tiên, app-vs-relay, và expiry policy.

---

> Quy tắc: Không tự resolve open decision; ghi `BLOCKED-BY` và để Human Gate quyết. CE-1/CE-2 xử lý interim bằng ADR-001.
