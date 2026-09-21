# PH5 — LVP Slice Hardening

**Phase:** PH5 · **Gate trước:** L3 (usable manual loop + durable) · **Gate sau:** L4 (pilot value/learning)
**Trạng thái:** Draft — chưa bắt đầu
**BLOCKED-BY:** (bất kỳ) CE-1/CE-2 → human resolves + ADR-001 supersede; không tự resolve
**Thời lượng:** 3–4 tuần

## Mục tiêu
- Queues chuẩn hoá: New / Today / Overdue / Completed-Closed (R-34 clusters C/D)
- NextAction lifecycle: due date, overdue, complete, reopen, reschedule — append-audited (R-13, I-05)
- Contact attempt/outcome recording với actor + timestamp (R-12, R-15, I-05)
- Minimal outcome Won/Lost/Unknown — UNKNOWN valid, không hidden (R-18, I-08)
- Data Health view: deterministic/inferred/unknown rates, linkage gaps, duplicate risk, outcome coverage (R-25; I-02, I-08)
- Export/delete + retention + audit (R-24; I-08, I-12)
- Structured feedback + telemetry tách biệt (R-23, R-21; I-05)
- Correction append-audited, reversible (R-15, R-16; I-04, I-05)

## Out of scope (không build)
- Revenue attribution (MM-1) — UNKNOWN
- AI autonomous mutation (I-03)
- Generic queue framework (seam #9)

## Tasks
| ID | Task | R coverage | C coverage | Output |
|----|------|-----------|-----------|--------|
| T5-01 | Queues module: New/Today/Overdue/Closed + scoped queries | R-34 | C-01, C-07 | `src/modules/queues/` + test |
| T5-02 | NextAction lifecycle: overdue detection, complete/reopen/reschedule + audit | R-13 | C-01, C-06 | `src/modules/next-action/` + test |
| T5-03 | Contact attempt + outcome recording + history | R-12, R-15 | C-01, C-06 | `src/modules/contact-outcome/` + test |
| T5-04 | Outcome Won/Lost/Unknown + correction history | R-18 | C-01, C-06 | `src/modules/outcome/` + test |
| T5-05 | Data Health view: per-source rates + linkage gaps + duplicate risk | R-25 | C-08, C-01 | `src/modules/data-health/` + test |
| T5-06 | Export + delete with retention + audit append | R-24 | C-06, C-03 | `src/modules/data-governance/` + test |
| T5-07 | Structured feedback repository (tách telemetry) | R-23, R-21 | C-08, C-07 | `src/modules/feedback/` + test |

## Risks
| Risk | Mitigation |
|------|-----------|
| Data Health thành BI tool | Giữ scope: chỉ health honesty, không build BI/generic dashboard (D-001) |
| Queues thành generic task manager | Giữ lead-scoped + commercial loop; không generic inbox/task (NON_GOALS) |
| Export/delete sai retention | Audit append + tested retention policy; không xoá trước lưu audit |

## DoD
- [ ] T5-01…T5-07 hoàn thành + test mỗi invariant liên quan
- [ ] `npm ci && npm run typecheck && npm test && npm run build` pass
- [ ] Data Health exposes deterministic/inferred/unknown rates honest (không false precision)
- [ ] UNKNOWN surfacing test pass
- [ ] Canonical + forbidden paths untouched
