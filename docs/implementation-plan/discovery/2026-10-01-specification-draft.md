# North Star — Đặc tả tổng hợp (Draft)

**Biên bản gốc:** [Q&A đã xác nhận](file:///d:/AI-for-Enterprise/North_Start_Commercial_Support_Platform/docs/implementation-plan/discovery/2026-10-01-qa.md). Đây là bản chuyển hóa Q&A thành đề xuất đặc tả, không phải transcript. Khi hai tài liệu khác nhau về lựa chọn người dùng, đối chiếu QA-ID và lịch sử thay thế trước; canonical vẫn có thẩm quyền cao hơn cả hai.

**Cảnh báo review:** Các AC cụ thể và hàng permission do assistant suy ra (ví dụ chặn tạo tenant khi email chưa verified, quyền đọc theo role, withdrawal, audit-read) là **proposal**, không mặc nhiên đã được người dùng duyệt. Các nhánh Lost, pilot cardinality và payment allocation đã có ý định xác nhận tại QA-57…59; reason taxonomy, data schema và quyền liên quan vẫn cần review. Không dùng bản này làm implementation contract hoàn chỉnh trước khi review các điểm đó.

**Ngày:** 2026-10-01 · **Cập nhật:** 2026-10-02 (QA-57…59)  
**Trạng thái:** Draft từ phỏng vấn người dùng; chưa freeze, chưa là RFC/cam kết SLA  
**Nguồn:** `docs/north-star/NORTH_STAR.md`, `SERVICE_MODEL.md`, R-01…R-41, canonical invariants/open decisions, Q&A phiên 2026-10-01.

> [!IMPORTANT]
> Không sửa/thay thế `docs/canonical/**`; không tự resolve CE-1, CE-2, PM-1, MM-1, ID-1, ID-2, LG-1. Policy hết hạn/khóa dữ liệu và dữ liệu trẻ cần legal review.

## 1. Phạm vi và roadmap

### 1.1 North Star và pilot

North Star bảo toàn commercial context từ social conversation → Lead → Marketing/Sales handoff → Sales action → outcome → learning. Đặc tả bao gồm app/data plane và control plane, nhưng không xây mọi capability cùng release.

Pilot chuẩn là giáo dục/đào tạo, hỗ trợ B2C, phụ huynh đăng ký cho con, người học tự liên hệ và B2B doanh nghiệp mua cho nhân viên.

**P0 loop:** manual/paste + CSV → Customer/Lead → qualify → handoff → Sales queue → contact/consultation/trial lesson → next action → asserted outcome/evidence → audit/export.

**Boundary:** Pancake read-only P1, flag OFF mặc định; không build sending. Không build CRM clone, inbox, ERP, LMS, lớp/điểm danh dài hạn, generic workflow engine/BI.

- **P0:** continuity core, auth/isolation, evidence/audit, action/outcome, export/privacy.
- **P1:** Pancake read sync, acquisition/intelligence, explainable scoring.
- **P2:** control plane, provisioning/billing/license, installer, fleet upgrade, customer-hosted ops.
- Timeline trong SERVICE_MODEL không phải delivery commitment.

## 2. User journeys

### J-01 — Trial/onboarding → workspace ready

Đăng ký → email verification/password auth → tạo tenant/workspace/deployment record → trial deployment riêng/single-tenant → instance ready → invite workspace admin → admin thiết lập credential → cấu hình timezone/calendar/users → health check.

Portal/control-plane identity tách workspace identity. Auto-provision VPS không là prerequisite initial trial. Invite one-use/expiring, không shared/default password. Failure: unverified identity, expired invite, retry provisioning, bootstrap failure, disabled admin, DB unavailable. Onboarding idempotent/audited.

### J-02 — Conversation/import → Customer/Lead

Manual paste/create hoặc CSV là P0; Pancake read-only là P1. Preview/preflight → validate từng dòng → user xác nhận → lưu immutable raw envelope/pointer/hash → tạo/resolve Lead bằng explicit action hoặc deterministic policy → Customer linkage riêng, có thể unresolved → kết quả từng dòng.

Event ID bất biến tách record ID/version. Retry cùng event/version + payload là no-op. Record update hợp lệ tạo raw version mới. Cùng event/version khác payload → quarantine. Không đoán thứ tự thiếu version; checkpoint tách canonical state.

Lead là một quyết định mua/đăng ký có thể chốt độc lập. Cùng conversation nhưng nhu cầu mua mới cần authorized user xác nhận Lead mới. Không tự chia 20 học viên thành 20 Lead và không merge học viên theo số điện thoại phụ huynh.

### J-03 — Qualify → handoff

B2C cần nhu cầu, learner/decision-maker role, kênh liên hệ và căn cứ phù hợp. B2B cần tổ chức, nhu cầu đào tạo, đầu mối và căn cứ phù hợp. Budget/timeline UNKNOWN vẫn được handoff nhưng visible.

Handoff tối thiểu: recipient, context/summary, contact channel, proposed next action, evidence hoặc missing-evidence reason. Marketing chịu trách nhiệm đến khi Sales accept; assignee xem gói tối thiểu nhưng chưa ghi contact/outcome. Reject cần reason, quay về Marketing/queue, giữ Lead ID và lịch sử. Quyền là proposal PM-1.

### J-04 — Sales action

Sales ghi contact activity immutable; `occurredAt` được backdate có reason, `recordedAt` server-generated. Có consultation/trial lesson/discovery/demo với owner/time/participants tối thiểu và attended/no-show/cancel/reschedule.

Một Lead có nhiều Next Action nhưng tối đa một active primary. DueAt quá hạn thì overdue kể cả ngoài giờ; calendar/timezone tính SLA deadline, không tự đổi owner/state. Won/Lost yêu cầu rà soát action mở: giữ, hoàn thành nếu có bằng chứng, hoặc hủy có reason; không tự hoàn thành.

SLA có hai clock: handoff→accept và accept→first-contact, cộng tổng elapsed; reject/reassign không reset lịch sử. Workspace mặc định `Asia/Ho_Chi_Minh`, admin xác nhận; timestamp lưu UTC.

### J-05 — Outcome

- B2C Won: khoản thanh toán đầu tiên hợp lệ, deposit tính nếu policy chấp nhận.
- B2B Won: hợp đồng/PO accepted. Won không có nghĩa đã thu đủ tiền.
- Sales nhập mốc và upload evidence thủ công, outcome vẫn `claimed`; không tự `verified`.
- Một current effective outcome; correction append-only với supersedes link.
- Won đúng rồi refund/cancel: giữ Won và thêm cancellation/refund. Won sai: correction có reason.
- Verified chỉ khi independent source có adapter contract/schema/provenance/evidence/policy.
- Lost (QA-57): Sales xác nhận quyết định mua không tiếp tục, có reason và evidence hoặc lý do thiếu. Im lặng/no-show không tự Lost; dừng theo đuổi vì mất liên lạc phải khác khách từ chối.
- Payment/refund (QA-59): ghi amount/currency/date/evidence; phân bổ thủ công một giao dịch cho nhiều Lead, tổng không vượt giá trị giao dịch, phần chưa phân bổ visible. Vẫn claimed tới đối soát; không đếm cùng giao dịch hai lần qua nhiều evidence links.

CE-1 state transition và CE-2 event scope vẫn là interim proposal/test contract, không phải freeze.

### J-06 — Manager/learning

Manager chỉ xem exceptions trong đội/chi nhánh được cấp quyền (QA-58, PM-1 proposal), không mặc định workspace-wide; overdue/stalled/unknown/missing linkage là observations. Learning record version, participants, events, blockers, limitations; không suy ra PMF khi chưa có baseline/exposure.

### J-07 — Deployment/license lifecycle

Cùng versioned artifact/Compose contract; mỗi khách có DB/deployment/secrets riêng. Managed: control plane provision/operate. Customer-hosted: khách cài/nâng cấp, agent outbound-only. Control plane giữ tenant/subscription/instance/license metadata và health summaries; không nhận raw chat, end-customer PII, attachment, AI prompt/response.

Trial 14 ngày từ instance ready; trial grace 3 ngày; paid grace 7 ngày. Sau grace khóa business và read/export API ở cả hai mode, không xóa dữ liệu; renewal portal/license path và backup tiếp tục. License còn hạn không bị khóa chỉ vì control-plane outage. Offline grace tối đa 72h, không vượt commercial lock deadline. Customer-hosted application lock không ngăn chủ server đọc DB/backup. Chính sách này khác SERVICE_MODEL §2.1, cần legal/contract review.

### J-08 — Evidence/privacy/notifications

Evidence pilot: PDF/JPG/PNG, ≤10MB/file, private storage, quyền theo Lead+evidence; file chưa safety scan không preview/download. Không account cho trẻ chưa thành niên; chỉ learner description/age group/need tối thiểu, phụ huynh là contact; không chủ động thu ID/health files; raw child data hạn chế quyền và không gửi LLM mặc định.

External LLM opt-in theo workspace/provider/data scope, redact/pseudonymize; BYOK trước, encrypted tại instance; provider-funded wallet/quota phase sau. In-app cho handoff/reject/reassign/due/overdue. Email/Zalo cho invite/reset/service digest, không chứa chat/evidence/learner data; reset token chỉ email. Zalo official API feasibility.

### J-09 — Export/delete/recovery

Export scoped theo workspace/capability. Managed explicit cancellation: active data giữ 30 ngày rồi xóa sau notice/legal-hold check; payment expiry không tự xóa. Customer-hosted không remote delete. Backup chứa deleted data hết hạn tối đa 30 ngày sau active deletion; restore phải apply deletion ledger trước mở service.

Managed pilot target RPO≤15 phút/RTO≤1 giờ 24/7, đo outage thực tế→core workflow restored; detection/response đo riêng. Chưa là SLA cho tới khi drill đạt. Customer-hosted chỉ cam kết tương đương sau validation/drill.

## 3. Business rules

| ID | Rule | Status |
|---|---|---|
| BR-01 | Customer ≠ Lead; một Customer có nhiều episode; không đồng nhất thread/phone. | Canonical I-01 |
| BR-02 | Lead = independent purchase decision; episode mới cần authorized confirmation. | Q&A; data review |
| BR-03 | Source/lineage/attribution tách biệt; revenue attribution UNKNOWN tới MM-1. | Canonical I-02 |
| BR-04 | Import/retry không tự tạo episode; explicit action/deterministic policy mới tạo. | Q&A; policy TBD |
| BR-05 | Same event/version retry no-op; version mới append raw; contradictory payload quarantine. | Proposed adapter contract |
| BR-06 | Không auto-merge; unresolved linkage giữ UNKNOWN. | I-06/ID-1 |
| BR-07 | Handoff cần recipient/context/channel/next action/evidence-or-reason. | Q&A |
| BR-08 | Marketing accountable tới accept; reject cần reason; quyền pending là PM-1 proposal. | Q&A/PM-1 |
| BR-09 | Reassign/reject thu hồi access cũ ngay; mỗi request authorize lại. | Q&A/PM-1 |
| BR-10 | Activity/outcome correction append; recordedAt server-owned; backdate cần reason. | Q&A |
| BR-11 | Won B2C=first eligible payment; B2B=accepted contract/PO; refund/payment riêng. | Q&A/CE-1 seam |
| BR-12 | Upload/Manager không tự làm outcome verified; cần independent source/policy. | Q&A |
| BR-13 | Valid Won+refund khác mistaken Won correction. | Q&A |
| BR-14 | Nhiều action, tối đa một active primary; outcome không auto-complete. | Q&A |
| BR-15 | SLA accept/contact clocks tách, elapsed không reset. | Q&A; threshold TBD |
| BR-16 | Mutation atomic với audit/outbox; audit fail → rollback/fail closed. | Technical proposal |
| BR-17 | AI chỉ draft/CE→evidence→policy/human approval. | Canonical I-03/I-04 |
| BR-18 | Năm UNKNOWN states distinct; required unknown không null/empty. | I-08/I-12 |
| BR-19 | Scope server-derived; invisible=404, forbidden visible action=403. | Q&A proposal |
| BR-20 | Control plane không nhận business content/PII; data plane authoritative. | Q&A |
| BR-21 | Post-grace khóa app read/write/export, không xóa; renewal/backup path còn. | Q&A; legal gate |
| BR-22 | Managed cancellation retention 30d; backup final purge ≤30d sau đó. | Q&A; legal gate |
| BR-23 | Child data minimized, no direct account, no default LLM egress. | Q&A; legal gate |
| BR-24 | Lost có reason/evidence-or-reason; no-show/im lặng không tự Lost; mất liên lạc khác từ chối. | QA-57/CE-1 seam |
| BR-25 | Pilot một khách → một deployment → một workspace; branch/team bên trong, Manager không mặc định toàn workspace. | QA-58/PM-1 seam |
| BR-26 | Payment/refund claimed; phân bổ nhiều Lead không vượt transaction value, unallocated visible. | QA-59; schema/reconciliation review |

## 4. Acceptance criteria

### AC-01 Auth/onboarding

- Unverified identity không tạo/quản lý tenant.
- Invite one-use/expiring, admin tự thiết lập credential.
- Reset/disable/compromise revoke mọi session relevant domain; logout-current khác logout-all.
- Token khác identity domain bị reject; body workspaceId không widen scope.

### AC-02 Import/Lead

- CSV preview báo valid/invalid row với stable code; valid rows commit độc lập.
- Retry row thành công là no-op; row sửa lỗi import một lần.
- Mapping lỗi giữ raw, không fabricated projection.
- New Lead cùng conversation cần authorized create-new; replay không tạo episode.
- Customer/Lead IDs độc lập; shared phone không auto-collapse.

### AC-03 Handoff/access

- Handoff validate recipient/context/channel/action/evidence-or-reason; missing fields visible.
- Pending Marketing accountable; designated Sales chỉ xem package, chưa contact/outcome.
- Reject reason bắt buộc, giữ Lead ID/history.
- Reassignment thu hồi Lead/evidence/export access của owner cũ.
- Assigned same-workspace allow; invisible/cross-workspace 404; forbidden visible action 403.

### AC-04 Sales/action

- Backdate cần reason; recordedAt immutable.
- Past due action warning + overdue ngay.
- Concurrent primary action enforce max one; stale write stable 409.
- Hiện accept clock, contact clock, total elapsed; không reset khi reassign.
- Won/Lost bắt chọn keep/complete/cancel cho open actions.

### AC-05 Outcome/education

- B2C first payment và B2B accepted contract/PO ghi được `claimed` với actor/time/evidence hoặc reason.
- Evidence upload không tự label verified.
- Current outcome một projection; correction giữ history.
- Valid Won+refund giữ Won và thêm event; mistaken Won correction append-only.
- Unknown khác no outcome.
- Trial lesson/consultation có attended/no-show/cancel/reschedule + next action; không cần LMS.
- Im lặng/no-show không tự Lost; reason mất liên lạc không hiển thị như khách từ chối. Lost cần Sales assertion + reason/evidence-or-reason.
- Ví dụ test đề xuất cho QA-59: giao dịch 10.000.000 VND phân bổ 4.000.000 và 5.000.000 cho hai Lead thì unallocated=1.000.000; thêm phân bổ 2.000.000 bị reject, dữ liệu trước giữ nguyên. Concurrent allocation không được vượt tổng. Vẫn claimed và không tự đổi Lead state.
- Test proposal QA-58: Manager chỉ có grant chi nhánh A không tự được đọc Lead chi nhánh B dù chung workspace; PM-1 phải duyệt trước implementation.

### AC-06 File/privacy/notification

- Chỉ PDF/JPG/PNG ≤10MB; invalid/oversize không persist và không mất form.
- Private object không mở direct unauthorized link; scan fail không preview/download.
- Log/telemetry/email/Zalo không chứa chat/evidence/learner data.
- External LLM cần grant; không được egress thì local/manual.
- Deep link notification re-authorize; reset token chỉ email.

### AC-07 Lifecycle/service

- DB/secrets isolated; artifact contract cùng version; control plane không business content.
- Trial/grace đúng configured values; config không tự hardcode ngoài contract.
- Sau grace business/read/export lock; renewal path/backup còn.
- Signed license hợp lệ chịu được network outage; offline grace ≤72h và không vượt lock date.
- Renewal mở lại, expiry không delete.

### AC-08 Reliability/performance

- Restore drill managed target RPO≤15m/RTO≤1h 24/7, gồm DB/object/key/deletion ledger.
- Customer-hosted chỉ commit tương đương sau validation/drill.
- Test profile 5–20 users, ≤10 concurrent, 10k Leads, 1k interactions/day.
- API list/detail/ordinary write p95≤1s, main screen≤3s trên setup công bố; heavy jobs async.
- External user hoàn tất synthetic L0 không facilitator-blocking, không critical error; chưa suy ra PMF.

## 5. Error/recovery matrix

| Code | Trường hợp | Contract | Recovery |
|---|---|---|---|
| AUTH_INVALID | token thiếu/hết hạn/sai | 401, safe code | Re-auth/security log |
| RESOURCE_NOT_VISIBLE | cross-workspace/unassigned | 404, không leak existence | Refresh authorized queue |
| ACTION_FORBIDDEN | resource visible, action cấm | 403 | Xin capability/assignment |
| INPUT_INVALID | schema/field lỗi | 400/422, field errors | Sửa, không retry |
| VERSION_CONFLICT | stale version | 409 | Refresh/review/resubmit |
| IDEMPOTENCY_CONFLICT | same event/version khác payload | 409/quarantine | Reconcile |
| RATE_LIMITED | provider throttling | 429/Retry-After | Bounded backoff |
| DEPENDENCY_UNAVAILABLE | DB/provider/network | 503/async failed | Retry transient/idempotent |
| MAPPING_FAILED | shape không hỗ trợ | raw giữ, no projection | Manual remap/replay |
| FILE_REJECTED | type/size/malware/timeout | no preview/download | Safe re-upload/review |
| AUDIT_UNAVAILABLE | audit/outbox fail | rollback/fail closed | Retry idempotently |
| AI_INVALID/LOW_CONFIDENCE | schema/evidence/confidence fail | no mutation/manual | Manual fallback |
| JOB_EXHAUSTED | retry bound exhausted | visible dead-letter | Diagnose/replay |
| LICENSE_OFFLINE | cannot refresh | uncertainty visible | Reconnect, no stacked grace |
| LICENSE_EXPIRED | lock deadline passed | app business/read/export locked | Renewal channel |
| RESTORE_INCOMPLETE | DB/object/key/ledger mismatch | no partial tenant exposure | Reconcile before opening |

Error envelope proposal: `code`, safe `message`, `correlationId`, optional `fieldErrors`, retry guidance; không provider payload/token/PII/existence. Retry chỉ transient+idempotent, exponential backoff/jitter bounded; attempts/timeouts TBD.

## 6. Access model proposal (PM-1 chưa resolve)

Deny-by-default; workspace scope server-derived; check mỗi request kể cả download/export. Các quyền dưới đây là proposal, không phải permission freeze.

| Capability | Sales | Marketing/Operator | Manager | Workspace Admin | Support |
|---|---|---|---|---|---|
| Assigned Lead | Allow | Scoped proposal | Granted team/branch proposal, no workspace-wide default | Capability proposal | Deny |
| Pending handoff package | Designated recipient | Sender | Proposal | Proposal | Deny |
| Accept/reject | Designated; reject reason | Create/withdraw proposal | Escalation proposal | Configure | Deny |
| Reassign | Deny default | Proposal | Proposal | Capability-gated | Deny |
| Raw/evidence | Separate evidence permission | Separate permission | Proposal | Capability | Temporary grant |
| Contact/action/outcome | Accepted assigned | Context proposal | Exception proposal | Capability | Deny |
| Bulk export/delete | Deny | Deny | Deny default | Separate capability/reconfirm | Deny |
| Users/integrations/secrets | Deny | Scoped proposal | Deny | Explicit capability/audit | Temporary approved |
| Audit/security read | Own receipt proposal | Own receipt | Scoped proposal | Explicit capability | Temporary |

PM-1 RFC còn cần chốt manager scope, field classification, break-glass, support grant, API/service identities, demo access, export/audit visibility.

## 7. Logical data contract

| Record | Required concepts | Integrity/privacy |
|---|---|---|
| PortalIdentity | domain, verified email, credential status, sessions | separate workspace user; password hash; revoke sessions |
| Tenant/Workspace | IDs, branch/team mapping, timezone/calendar | Pilot: one customer/deployment/workspace (QA-58); scope server-derived, branch permissions PM-1 |
| Deployment/Instance | customer, mode, version, status, health | metadata only in control plane |
| Subscription/License | plan, trial/grace, signed validity, renewal | separate Lead state; idempotent events |
| Membership/RoleGrant | identity, workspace, capability, assignment | PM-1; immediate revoke |
| Customer | workspace, minimal refs, createdAt | not Lead; merge deferred |
| Lead/PurchaseEpisode | IDs, roles, version, state seam | independent closable decision; child PII minimal |
| Connection | provider, encrypted secret ref, status | no secret in domain/log |
| RawEnvelope/RawVersion | event/record ID/version, type, timestamps, schema, pointer/hash | append-only/private/encrypted |
| Handoff/Assignment | recipient/sender/context/action/evidence/status | history immutable; pending ownership seam |
| ContactActivity | actor/occurred/recorded/channel/reason | append-only/backdate reason |
| NextAction | owner/kind/due/status/primary/version | max one active primary |
| Consultation | owner/time/participant roles/result | no LMS/child profile |
| OutcomeAssertion | value, basis, claim/verified source, evidence, supersedes | one effective projection; payment separate |
| Cancellation/Refund | time, amount/currency/source/evidence | does not erase Won; claimed until reconciliation |
| Payment / Allocation | transaction ID, amount/currency/date, evidence, Lead allocations, unallocated | Aggregate allocation ≤ transaction value under concurrency; currency/rounding/refund rules and actor grants need review |
| EvidenceAttachment | private key/MIME/size/hash/scan/classification | PDF/JPG/PNG ≤10MB; reauthorize |
| Audit/Outbox | actor, action, prior/new, times, reason, correlation | append-only, atomic, no raw PII |
| Product/OpsTelemetry | event/version/flags/allowlist health | separate business content; no PII |
| DeletionLedger | subject/policy/purge/backup expiry/legal hold | apply before restore open |

Five truth states (`unknown`, `not_applicable`, `not_observed`, `not_requested`, `redacted`) remain distinct. `null` only when field schema explicitly permits; never silently map null/empty. Per-field serialization/reason still required.

## 8. Invariants and trace

| Invariant | Coverage | Required verification |
|---|---|---|
| I-01 | BR-01/02, AC-02 | independent IDs/multiple episodes |
| I-02 | BR-03 | anti-collapse/UNKNOWN until MM-1 |
| I-03 | BR-17 | AI cannot mutation path |
| I-04 | BR-17 | evidence/confidence/policy contract |
| I-05 | BR-10/16 | append history + audit rollback |
| I-06 | BR-06 | meaningful no-auto-merge/undo test |
| I-07 | J-03/04 | ID survives handoff/channel |
| I-08 | BR-18/AC-05 | state-specific API/UI/report |
| I-09 | AC-03/access | cross-workspace/unassigned/reassigned/evidence/export |
| I-10 | adapter rules | CRM cannot own semantics |
| I-11 | J-02/BR-05 | adapter boundary/manual fallback |
| I-12 | J-02/data | hash/raw immutability/no fabrication |

Existing sweep has tautological I-06/I-09 checks and I-10/I-11 label mismatch; must repair. Green tests alone are not proof.

## 9. Verification strategy

- Unit/domain: rules, truth states, meaningful I-01…I-12 checks.
- API/integration: auth, workspace/RBAC, errors, atomic audit, optimistic concurrency, idempotency.
- Postgres: migration forward/rollback, constraints/indexes, restart, isolation, deletion-ledger restore.
- Adapter: CSV/manual/provider fixtures, event/version, checkpoint, redaction, 429/timeout/schema drift.
- File: MIME/size/malware/quarantine/object authorization/presigned expiry.
- AI: egress consent/redaction, malformed/low confidence, prompt injection, manual fallback.
- E2E: signup/invite → Lead → qualify/handoff → accept/reject → action → outcome → evidence/export; failure branches.
- Ops: load profile, restore drills, license outage/expiry/renewal, signed upgrade/rollback.
- UX/accessibility: Vietnamese responsive desktop/mobile, keyboard/errors, UNKNOWN/evidence visibility.

**Targets (not achieved evidence):** ≥80% line; auth/RBAC/redaction 100%; 5–20 users, ≤10 concurrent, 10k Leads, 1k interactions/day; p95≤1s API and ≤3s main screen; RPO≤15m/RTO≤1h managed; external tester completes L0 without facilitator block/no critical error.

Required scenarios include: cross-tenant non-enumeration; reassignment revokes old access; audit failure rollback; replay/no duplicate; conflicting version quarantine; concurrent primary-action conflict; Won/refund/correction; file security; PII/minor egress; valid license outage; post-grace lock/renew; restore with keys and deletion ledger.

## 10. Open decisions and gates

| ID | Action |
|---|---|
| CE-1 | RFC Product+Data for state transitions |
| CE-2 | RFC Product+Architecture for event scope |
| PM-1 | Security/Product permission matrix RFC |
| MM-1 | Keep revenue credit UNKNOWN; future attribution RFC |
| ID-1 | No auto-merge; thresholds/undo RFC |
| ID-2 | Provider feasibility + adapter mapping RFC |
| LG-1 | Separate full North Star from gated LVP |
| Legal/privacy | Child data, retention, legal hold, expiry lock/export, evidence proof |
| Commercial | Trial/grace/payment/refund/late renewal contract |
| Operations | Hosting/provider, 24/7 on-call, RPO/RTO drill, customer-hosted support |
| Interfaces | 400 vs 422, 409 precondition, TTL/quotas/retry, session TTL |

## 11. Decision ledger

### Confirmed by user

- Whole North Star, phased; social-led continuity prioritized.
- Education pilot B2B/B2C; Lead = independent purchase decision; contact/payer/learner roles distinct.
- Trial 14d, trial grace 3d, paid grace 7d; offline grace max 72h bounded by known lock date.
- Post-grace locks app read/write/export in both modes, no deletion; renewal path and backups continue. This supersedes prior read-only choice and conflicts with SERVICE_MODEL; legal review required.
- Managed cancellation retention 30d; backup purge ≤30d later; no remote customer-hosted deletion.
- Managed RPO≤15m/RTO≤1h 24/7 target; customer-hosted equivalent only after validation.
- Pilot evidence formats/limit, notification/privacy, responsive Vietnamese web, load/performance targets.

### Not frozen

Proposal/TBD/CE-1/CE-2/PM-1/legal/provider feasibility/target-not-measured remain open. Do not turn them into canonical facts silently.
