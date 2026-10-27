# Implementation Plan — North_Start_Commercial_Support_Platform

**Phiên:** 2026-10-27 (khởi tạo 2026-09-20)
**Trạng thái:** PH0–PH2 hoàn thành phần code; PH3 (PostgreSQL persistence + auth/RBAC + P0 pilot loop) đang kiểm chứng tại checkpoint `1b72b61` / `7c26944` (xem `state/progress.md`, `08-verification.md`, `../reports/project-status-and-handover.md`).

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
├── 08-verification.md            # (Bước 4) Kết quả kiểm chứng
├── decisions/                    # (Bước 2+) ADR + RFC
│   ├── ADR-*.md
│   └── RFC-*.md
├── discovery/                    # Q&A, spec draft, V2 traceability, Q3/Q4 guides
├── spike/                        # PH0 spike artifacts (Q-03, Q-04, envelope, CE-1/CE-2)
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
5. **Tier 5** `docs/_archive/**` (trong `docs/canonical/README.md` gọi theo tên lịch sử `docs/project/plan-archive/**`, `docs/project/revenue-continuity-context/**`) — lịch sử/kế thừa.
6. **Tier 6** Generated config (`AGENTS.md`, `docs/config/`, `.agents/`, `.claude-flow/`, `.codex/`) — chỉ dùng build/test commands.

> **Khác biệt với prompt gốc:** `docs/architecture/**` được xếp Tier 2 (thay vì Tier 4) vì tài liệu kiến trúc tích hợp đang active và được canonical ARCHITECTURE_CONSTITUTION tham chiếu trực tiếp.
> **Cầu chú dẫn cho `docs/canonical/**` (frozen, không chỉnh sửa trực tiếp):**
> - Các đường dẫn viết tắt `00_EXECUTIVE/...`, `01_PRODUCT/...`, `02_ARCHITECTURE/...`, `10_LEARNING/...` trong `docs/canonical/README.md` và `OPEN_DECISIONS.md` đều trỏ vào thư mục `docs/research/pancake-revenue-platform-documentation/<thư_mục_tương_ứng>/`.
> - Trong `docs/canonical/IDENTITY_AND_CONTINUITY.md`, nhãn ngắn `I-01`..`I-05` là số hiệu nội bộ của riêng tài liệu đó và ánh xạ sang bảng chuẩn `DOMAIN_INVARIANTS.md` như sau: `IDENTITY I-01 → DOMAIN I-01`, `IDENTITY I-02 → DOMAIN I-02`, `IDENTITY I-03 → DOMAIN I-06`, `IDENTITY I-04 → DOMAIN I-07`, `IDENTITY I-05 → DOMAIN I-08`.
> - Dòng `Maturity: Canonical v0.1 — Draft for alignment` ở đầu các file canonical là dấu vết lịch sử từ đợt khởi tạo `2026-09-19`; toàn bộ `docs/canonical/**` đã được khóa (frozen normative Tier 1) theo `AGENTS.md`.

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
