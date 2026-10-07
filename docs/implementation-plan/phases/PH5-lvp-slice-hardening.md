# PH5 — LVP Slice Hardening

**Phase:** PH5 · **Gate trước:** L3 (usable manual loop + durable, PH3 done) · **Gate sau:** L4 (pilot value/learning)
**Trạng thái:** Planned chi tiết — chưa bắt đầu code
**Thời lượng:** 3–4 tuần
**Phạm vi:** R-04, R-08, R-12, R-13, R-15, R-16, R-23, R-24, R-25 + error contract (QA-33…35) · C-01, C-02, C-03, C-05, C-06, C-08, C-11
**Ranh giới:** Không build revenue attribution (MM-1 → UNKNOWN), không AI autonomous mutation (I-03), không generic queue/BI (D-001).

## Mục tiêu

- Vòng lặp LVP thủ công hoàn chỉnh: queues → next-action → contact/trial → outcome → data health → export/delete → feedback — tuân I-05/I-08/I-09, không tự resolve CE-1.
- Bao các ràng buộc mới từ Q&A: Lost QA-57, allocation QA-59, backdate QA-19, overdue QA-18, CSV row-level QA-11, file QA-27, error/retry QA-33…35.

## Tasks

| ID | Task | R | C | AC / Output | Lưu ý QA/spec |
|---|---|---|---|---|---|
| T5-01 | Queues: New / Today / Overdue / Closed + scoped queries | R-08, R-13 | C-01, C-02 | `product/src/modules/queues/` — overdue khi `now > dueAt` kể cả ngoài giờ; SLA deadline dùng calendar/business hours (QA-18) | Không thành generic task manager; calendar workspace-configurable (QA-17); lead-scoped |
| T5-02 | NextAction lifecycle: create/complete/reopen/reschedule, max 1 active primary/Lead (QA-18), dueAt quá khứ cho tạo sau cảnh báo (QA-19), không tự đổi Lead state/owner, optimistic version 409 | R-13 | C-01, C-06 | `product/src/modules/next-action/` — append-audited | QA-18/19/20; BR-14 |
| T5-03 | Contact attempt + consultation/trial lesson: owner/time/participants + attended/no-show/cancel/reschedule + next action (QA-21), `occurredAt` backdate có reason + `recordedAt` immutable (QA-19) | R-12 | C-01, C-06 | `product/src/modules/contact/` | Không LMS; activity immutable, correction append-only |
| T5-04 | Outcome: Won B2C first payment / B2B contract+PO (QA-22), claimed với actor/time/evidence-or-reason (QA-23), 1 current effective + `supersedes` link (QA-24), Won+refund vs mistaken Won (QA-25), Lost QA-57 (im lặng/no-show không tự Lost, mất liên lạc ≠ từ chối) + allocation QA-59 (tổng phân bổ ≤ transaction, unallocated visible, không double-count) | R-15, R-20 | C-01, C-06 | `product/src/modules/outcome/` — correction append-only, không overwrite; reuse `Outcome` + `correctOutcome` pattern | BR-11…13/24/26, AC-05; CE-1 seam giữ interim hypothesis |
| T5-05 | Data Health: deterministic/inferred/unknown rates, linkage gaps, outcome coverage per source (R-25), unknown luôn visible (I-08) | R-25 | C-08, C-01 | `product/src/modules/data-health/` | Honest unknown > false precision; không thành BI tool |
| T5-06 | Export/delete + retention + audit — capability riêng, reconfirm, legal-hold check; Sales/Manager không mặc định có (QA-31) | R-18, R-19 | C-06, C-03 | `product/src/modules/data-governance/` | QA-47/48: managed giữ 30d, backup chứa deleted ≤30d, restore apply deletion ledger (R-35 deferred nhưng contract ghi rõ) |
| T5-07 | CSV import: template + preview/validate từng dòng + commit valid rows + sửa/retry rows lỗi không duplicate (QA-11), không auto-merge cùng SĐT (I-06) | R-04 | C-05, C-11 | `product/src/adapters/csv/` | **Quyết định 2026-10-02: 3-A — giữ TBD trong spec**, đề xuất ngưỡng dev **CSV 1k–5k rows, file ≤10MB** (đã có), quota/số file/scan timeout để TBD tới pilot; không hardcode prod limit; reuse `ManualAdapter` envelope pattern |
| T5-08 | Evidence attachments: PDF/JPG/PNG ≤10MB, private storage, quyền Lead+evidence, scan quarantine không preview/download (QA-27) — **3-A: giữ TBD**, đề xuất dev quota/số file để TBD | R-16, R-09 | C-11, C-06 | `product/src/modules/evidence/` | QA-26: vẫn `claimed`, không tự `verified` (cần independent source — QA-23) |
| T5-09 | Error contract chuẩn: `code`+`correlationId`+`fieldErrors`, nhóm 400/422/401/403/404/409/429/503, retry chỉ transient/idempotent với backoff+jitter bounded (QA-33/34), audit fail → rollback/fail closed (QA-35) | — | C-04, C-06 | `product/src/infra/errors/` | 400 vs 422 và If-Match/precondition TBD — ghi `// OPEN` seam |

## Test

- Unit: overdue, primary cardinality, backdate, Won/Lost/Unknown + correction + allocation invariants (QA-59), file MIME/size/scan.
- Integration: queue queries, version conflict 409, idempotency no-op vs quarantine, attachment authorization, audit append.
- E2E: paste/CSV → Lead → qualify → handoff → accept/reject → next-action → contact/trial → outcome → export — không facilitator blocking.
- Coverage ≥80% line, 100% security-critical (RBAC, redaction, export/delete).

## DoD

- [ ] T5-01…T5-09 hoàn thành + test mỗi invariant liên quan (I-05/I-08/I-09)
- [ ] `npm ci && npm run typecheck && npm test && npm run build` pass
- [ ] Data Health honest (không false precision), UNKNOWN surfacing pass
- [ ] Lost QA-57 + allocation QA-59 đúng contract (không double-count, unallocated visible)
- [ ] Canonical + forbidden paths untouched

## Rủi ro

| Rủi ro | Mitigation |
|---|---|
| Data Health thành BI tool | Giữ scope: chỉ health honesty, không build BI/generic dashboard (D-001) |
| Queues thành generic task manager | Giữ lead-scoped + commercial loop; không generic inbox/task (NON_GOALS) |
| Export/delete sai retention | Audit append + tested retention policy; không xóa trước lưu audit |
| Tự resolve CE-1 trong outcome/state | Giữ `// OPEN: CE-1 — see ADR-001`, interim hypothesis, human gate trước freeze |

## Liên kết

- Plan chi tiết: `C:\Users\admin\.claude\plans\shimmering-whistling-cupcake.md`
- QA: QA-11, QA-17…27, QA-33…35, QA-57…59 · Spec draft: BR-11…26, AC-05, §7 · Invariants: I-05, I-08, I-09
