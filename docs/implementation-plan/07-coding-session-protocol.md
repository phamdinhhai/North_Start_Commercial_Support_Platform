# 07 — Coding Session Protocol

**Phiên:** 2026-09-21
**Nguồn:** `AGENTS.md` Code Standards, Quality Rules, Security; `06-test-strategy.md`

---

## 1. Workspace rules

- **One writer per worktree:** Không hai writer cùng lúc trong một checkout.
- **Forbidden paths:** `src/bernstein/**`, `templates/**`, `.agents/**` — không sửa, không tạo, CI fail nếu chạm.
- **Canonical unchanged:** `docs/canonical/**` không đổi — verify script trước khi merge.

## 2. Code standards

- Files < 500 lines.
- Không hardcoded secrets; secret store server-side.
- Input validation tại boundaries.
- Typed interfaces cho public APIs.
- `AGENTS.md` — `NEVER save to root folder`: `/src` (source), `/tests` (tests), `/docs` (docs), `/config` (config).

## 3. Verification pipeline (mỗi phase)

```bash
npm ci && npm run typecheck && npm test && npm run build   # từ product/
```

- CI pass = prerequisite cho merge.
- Human Gate record trước khi merge/release.

## 4. Human gates

| Gate | Khi nào | Ai quyết |
|------|---------|----------|
| Gate #A | Trước PH2 domain state machine | Product + Architecture + Data RFC |
| Gate trước PH3 | Persistence + migration review | Engineering review |
| Gate trước PH4 | Pancake spike verdict | Product + Engineering |
| Gate L5 | Direction decision (Continue/Narrow/Pivot/Stop) | Founder/Product lead |

## 5. Commit convention

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, perf, test, chore
Scope: domain, infra, adapter, module, test, ci
```

- Không auto-commit/push/merge/release trừ khi được authorize.
- Không auto-merge; merge strategy = PR.
- Human Gate required trước khi merge/release/commercial state change.

## 6. Security checks (mỗi PR)

- Hardcoded secrets: CI fail.
- PII/token trong logs: CI fail.
- RBAC: Sales lead-scoped access enforced (test).
- Auth: non-demo user authenticate required (test).
- Synthetic segregation: demo data không vào pilot evidence (test).
