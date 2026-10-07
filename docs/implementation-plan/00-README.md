# Implementation Plan — North_Start_Commercial_Support_Platform

**Phiên:** 2026-09-20
**Trạng thái:** Bước 0–1 hoàn thành; chờ Human Gate trước Bước 2.

> **Problem framing hiện hành:** [`../Dinh_nghia_bai_toan_V2.md`](../Dinh_nghia_bai_toan_V2.md) (2026-10-06) là định nghĩa bài toán và kế hoạch kiểm chứng; **chưa phải đặc tả sản phẩm/mô hình đã freeze**. Dùng cùng `discovery/v2-validation-and-traceability.md` để nối giả thuyết với tài liệu hiện có. Canonical Tier 1 vẫn có thẩm quyền cao nhất; V2 không tự thay đổi quyết định canonical.

## Cấu trúc thư mục

```
docs/implementation-plan/
├── 00-README.md                  # Tài liệu này
├── 01-scope-and-principles.md    # Phạm vi, nguyên tắc, ASSUMPTION, OPEN QUESTIONS
├── 02-evidence-map.md            # Bản đồ tri thức, trạng thái đọc, facts, contradictions, gaps, kế thừa
├── 03-requirements.md            # (Bước 2) Yêu cầu R-ID + tiêu chí
├── 04-architecture.md            # (Bước 2) Kiến trúc C-ID, data model, interface, ADR
├── 05-phase-map.md               # (Bước 3) Bảng tổng phase PH0…
├── phases/                       # (Bước 3) Mỗi phase một file
│   ├── PH0-*.md
│   ├── PH1-*.md
│   └── …
├── 06-test-strategy.md           # (Bước 3) Tầng test, công cụ, ngưỡng
├── 07-coding-session-protocol.md # (Bước 3) Quy tắc phiên code
├── 08-verification-report.md     # (Bước 4) Kết quả kiểm chứng
├── decisions/                    # (Bước 2+) ADR
│   └── ADR-*.md
└── state/                        # (Bước 3) Trạng thái
    ├── features.json
    └── progress.md
```

## Thứ bậc thẩm quyền áp dụng

Nguồn: `docs/canonical/README.md` (Tier 1–6).

1. **Tier 1** `docs/canonical/**` — normative product truth, cao nhất.
2. **Tier 2** `docs/north-star/**` + `docs/architecture/**` — strategic + integration architecture.
3. **Tier 3** `docs/delivery/**` — stories/contracts.
4. **Tier 4** `docs/research/pancake-revenue-platform-documentation/**` — bổ sung chi tiết khi Tier 1–3 im lặng.
5. **Tier 5** `docs/project/plan-archive/**`, `docs/project/revenue-continuity-context/**` — lịch sử/kế thừa.
6. **Tier 6** Generated config (`AGENTS.md`, `.agents/`, `.claude-flow/`, `.codex/`) — chỉ dùng build/test commands.

> **Khác biệt với prompt gốc:** `docs/architecture/**` được xếp Tier 2 (thay vì Tier 4) vì tài liệu kiến trúc tích hợp đang active và được canonical ARCHITECTURE_CONSTITUTION tham chiếu trực tiếp.

## Quy tắc ID

- F = Fact, R = Requirement, C = Component, PH = Phase, T = Task, A = Assumption, Q = Question, GAP = Gap
- BOOT-001 giữ nguyên ID từ delivery stories
- Gate L0–L5 giữ nguyên từ LEAN_VALIDATION_PHASE.md
- 7 OPEN_DECISIONS canonical (CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1) không được tự resolve

## Cách dùng

1. Mỗi requirement/quyết định có nguồn `[KB:…]` hoặc nhãn `[ASSUMPTION A-x]`.
2. Khi gặp OPEN_DECISION: ghi `BLOCKED-BY <ID>`, chờ Human Gate.
3. Chi tiết "build now" (LVP) lập đến task level.
4. MVP và North Star engines chỉ lập mức khung.
