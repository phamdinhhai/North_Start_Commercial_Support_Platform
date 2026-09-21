# North_Start_Commercial_Support_Platform

> Revenue Continuity Platform — Multi-agent orchestration framework for agentic coding

## Project Overview

**Revenue Operating System** layer giữa Ad platforms, Pancake và CRM. Bảo toàn commercial meaning từ acquisition qua conversation, lead, handoff, Sales action, outcome, revenue và attribution.

**Tech Stack:** TypeScript, Node.js 22, NestJS + Fastify, Vitest
**Architecture:** Modular monolith, domain-driven, framework-independent domain core
**Code location:** `product/` (not yet created — PH1 Walking Skeleton)

## Quick Start (sau PH1)

```bash
cd product/
npm ci
npm run typecheck
npm test
npm run build
```

## Canonical Sources

| Tier | Path | Use |
|------|------|-----|
| 1 | `docs/canonical/**` | Normative product truth — highest authority |
| 2 | `docs/north-star/`, `docs/architecture/` | Strategic + integration architecture |
| 3 | `docs/delivery/**` | Stories, contracts |
| 4 | `docs/research/pancake-revenue-platform-documentation/` | Detail supplements |
| 5 | `docs/_archive/**` | Legacy reference (superseded) |
| 6 | `AGENTS.md`, `.agents/`, `.codex/`, `.claude-flow/` | Build/test config |

> Source: `docs/canonical/README.md` tier hierarchy.

## Implementation Plan

- Entry: `docs/implementation-plan/00-README.md`
- Requirements: `docs/implementation-plan/03-requirements.md` (R-01…R-28)
- Architecture: `docs/implementation-plan/04-architecture.md` (C-01…C-12)
- Phase Map: `docs/implementation-plan/05-phase-map.md` (PH0…PH6)
- Phases: `docs/implementation-plan/phases/PH0*.md`…`PH6*.md`

## Frozen Invariants (I-01…I-12)

Tất cả invariant trong `docs/canonical/DOMAIN_INVARIANTS.md`. Code PHẢI enforce:
- **I-01:** Customer ≠ Lead — entities tách biệt
- **I-02:** Chain identity ba khái niệm — collapse = forbidden
- **I-03:** AI draft-only — never autonomous mutation
- **I-04:** Commercial Event pipeline bắt buộc — Interaction → AI → CE → Evidence → Policy → Action
- **I-05:** Append-audited, reversible — no overwrite
- **I-06:** Merge deferred — manual + evidence
- **I-07:** Stable Lead ID — immutable
- **I-08:** UNKNOWN visible — honest, confident, surfaced
- **I-09:** Lead-scoped access — RBAC
- **I-11:** Adapter = integration boundary — no inherited semantics
- **I-12:** Raw immutable — no fabrication

## Open Decisions (DO NOT RESOLVE)

7 canonical open decisions trong `docs/canonical/OPEN_DECISIONS.md`:
CE-1 (state machine), CE-2 (event scope), MM-1 (attribution), ID-1 (merge thresholds), ID-2 (CRM mapping), PM-1 (permissions), LG-1 (scope conflict)

> Code comment `// OPEN: CE-1 — see ADR-001` tại các seam. Abort nếu privilege/transition vượt frozen boundary.

## Code Standards

### File Organization
- **NEVER** save to root folder
- `product/src/` — Source code files
- `product/tests/` — Test files
- `docs/` — Documentation
- `docs/config/` — Configuration files

### Quality Rules
- Files < 500 lines
- No hardcoded secrets
- Input validation at boundaries
- Typed interfaces for public APIs
- TDD London School (mock-first) preferred
- Coverage ≥ 80% line, 100% security-critical

### Forbidden Paths (DO NOT TOUCH)
- `src/bernstein/**`
- `templates/**`
- `.agents/skills/**`
- `docs/canonical/**` (frozen normative)

### Commit Messages
```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## Security

- NEVER commit secrets, credentials, or `.env` files
- NEVER hardcode API keys
- Always validate user input at boundaries
- Use parameterized queries for SQL
- Sanitize output to prevent XSS
- Validate file paths, prevent directory traversal
- PII/token redaction in logs/telemetry

## Human Gates

| Gate | When | Scope |
|------|------|-------|
| Gate #A | Before PH2 domain state machine | RFC CE-1/CE-2 |
| Gate before PH3 | Persistence + migration review | Engineering |
| Gate before PH4 | Pancake spike verdict | Product + Engineering |
| Gate L5 | Direction decision | Continue/Narrow/Pivot/Stop |

## Agent Coordination

### When to Use Swarms
**Invoke swarm cho:** Multi-file changes (3+), new features, cross-module refactoring, API changes with tests, security changes.

**Skip swarm cho:** Single file edits, simple bugs (1-2 lines), docs updates, config changes.

### One-Writer-Per-Worktree
Chỉ một agent/người sửa file tại một thời điểm. Read-only agents có thể share.

## Testing

```bash
cd product/
npm ci && npm run typecheck && npm test && npm run build
```

- Unit tests: mỗi invariant I-01…I-12 ≥ 1 test
- Integration tests: adapter/envelope/idempotency
- Contract tests: Pancake fixtures (PH4)
- E2E tests: L0 loop (PH5, PH6)

## Links

- Docs: `docs/implementation-plan/00-README.md`
- Canonical: `docs/canonical/README.md`
- Plan: `docs/implementation-plan/05-phase-map.md`
