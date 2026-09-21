# Trạng thái hiện tại của dự án

**Ngày tham chiếu:** 2026-09-10  
**Giai đoạn hiện tại:** Lean Validation Product — Reset và readiness  
**Active plan:** `LEAN_EXECUTION_PLAN.md`

> `PROJECT_PLAN_AI.md` và `project_plan.yaml` là baseline lịch sử/dài hạn. Trình tự task của chúng đã được supersede cho phase hiện tại; không dùng dependency cũ để chặn Build–Measure–Learn.

## Epistemic state

```text
Product vision candidate     Có
Problem hypotheses H0–H8     Có
Scenario giả định            Có
Case khách hàng thực tế      Chưa có
Primary customer evidence    Chưa đủ
API knowledge snapshot       Có, cần current/live verification
```

## Đã thiết lập

- Active Lean phase manifest and decision baseline.
- Hypothesis, experiment and evidence systems.
- LVP working bet: conversation input → context handoff → Sales action → next action → outcome assertion.
- Manual/synthetic fallback; optional AI/Pancake tracks.
- Provenance/evolution/security architecture guardrails.

## Cần quyết định để qua L0

1. Team/capacity thực tế và người ra quyết định kỹ thuật.
2. Chủ sở hữu recruitment pipeline và ứng viên tester đầu tiên.
3. Real-data consent, retention, deletion and credential authority.
4. Tech stack after inspecting actual implementation scaffold.
5. Vietnamese-first default versus bilingual requirement.
6. Whether the first recruited workflow can test with manual input or requires verified read sync.

## Việc tiếp theo theo active plan

- Close L0 decisions and register owners.
- Build a task-based responsive prototype with labeled synthetic data.
- Start candidate recruitment immediately.
- Pre-register EXP-00 and verify prototype comprehension.
- Do not expand beyond L3 without an external tester.

## Technical boundary

API code must follow the audited v2 knowledge-base rules. `endpoint_verified` is a dated snapshot, `family_verified` is not a contract, and Pancake webhook schema remains unlocked until live raw capture.
