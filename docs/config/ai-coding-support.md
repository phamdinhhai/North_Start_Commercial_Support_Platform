# AI Coding Support — Consolidated Guide

> **Consolidated:** 2026-09-21
> **Sources:** `.agents/skills/*`, `templates/skills/*`, `templates/teams/typescript.toml`, `templates/prompts/*`
> **Archive originals:** `docs/_archive/skills-templates-2026-09/`

---

## 1. When to Use What

| Need | Tool / Skill | When to trigger | Skip when |
|------|-------------|-----------------|-----------|
| Multi-file changes | **swarm** (`swarm-orchestration`) | 3+ files, new features, cross-module refactoring, API changes with tests | Single file edits, simple bugs |
| New feature design | **sparc** (`sparc-methodology`) | Complex implementations, architectural changes | Simple fixes, docs, config |
| Security gate | **security-audit** | Auth, authz, payment, user data, PH3/PH5 gates | Read-only ops, internal tooling |
| Performance gate | **performance-analysis** | Slow operations, regressions, PH5 gate | Early prototyping, docs |
| GitHub CI/CD | **github-automation** (`gh pr create --draft`) | PR, CI, releases — when publishing | Local git sufficient |

### Quick Commands

```bash
# Swarm — multi-agent coordination
npx @claude-flow/cli swarm init --topology hierarchical --max-agents 8
npx @claude-flow/cli hooks route --task "implement feature X"

# Security scan
npx @claude-flow/cli security scan --depth full
npx @claude-flow/cli security scan --check input-validation

# Performance benchmark
npx @claude-flow/cli performance benchmark --suite all
npx @claude-flow/cli performance profile --target ./src

# Memory (pattern store/search)
npx @claude-flow/cli memory store --key "pattern" --value "desc" --namespace patterns
npx @claude-flow/cli memory search --query "auth patterns" --limit 10

# GitHub
gh pr create --draft
gh pr checks
```

---

## 2. Team & Roles

### Used Roles (TypeScript/NestJS/Fastify stack)

| Role | Responsibilities | Work Style |
|------|-----------------|------------|
| **backend** | API design, business logic, persistence, migrations | Read task → read code → write tests alongside → keep functions typed & small |
| **frontend** | UI components, client logic, state | Build composable components → unit tests with RTL → semantic HTML + ARIA |
| **qa** | Test suites, edge cases, regressions, coverage | Cover happy path + edge + error paths → mock deps not logic → descriptive test names |
| **manager** | Decompose goals → tasks, accept/reject work | Read codebase → plan vertical slices → create tasks with owned_files + completion_signals |
| **security** | Audit vulns, OWASP, auth, secrets, input validation | Check critical vulns first → classify severity → concrete fix with code |

### Team Manifest Reference

From `templates/teams/typescript.toml`:
```toml
name = "typescript"
version = "1.0.0"

[coordination]
parallelism = 3
review_chain = true

[[roles]]
role = "frontend"
[roles.model_policy]
model = "sonnet"
effort = "high"

[[roles]]
role = "backend"
[roles.model_policy]
model = "sonnet"
effort = "high"

[[roles]]
role = "qa"
[roles.model_policy]
model = "sonnet"
effort = "high"
```

### Work Rules (Universal)

1. Read the task description + existing code before writing.
2. Write tests alongside implementation — not as separate phase.
3. Only modify files in your task's `owned_files`.
4. Run tests before marking complete.
5. If blocked → post to bulletin → move to next task.

---

## 3. Task Slicing Rules

> Source: `templates/prompts/plan.md`

### Vertical Slice Principle

Every task is a **vertical slice** that crosses every layer it needs in one shippable unit. Horizontally-phased plans ("DB → DB → API → API → tests") are rejected.

### Hard Caps

| Metric | Ideal | Hard Cap |
|--------|-------|----------|
| Lines of code | ≤ 200 | ≤ 400 |
| Files touched | — | ≤ 10 |
| Modules touched | — | ≤ 2 |

### Task Object Schema

```json
{
  "title": "Short actionable title",
  "description": "Detailed description including acceptance criteria",
  "role": "backend | frontend | qa | manager | security",
  "priority": 2,
  "scope": "small | medium | large",
  "complexity": "low | medium | high",
  "estimated_minutes": 60,
  "depends_on": ["title of dependency task"],
  "owned_files": ["product/src/domain/lead.ts"],
  "completion_signals": [
    {"type": "test_passes", "value": "npm test -- --filter lead"},
    {"type": "file_contains", "value": "export class Lead"}
  ]
}
```

### Slicing Rules

1. One user-visible behaviour per task.
2. Tests inside the same task as production code.
3. No two tasks touch the same files (prevent merge conflicts).
4. Order by dependency — foundational work first.
5. Never have two consecutive tasks in the same layer of the same module without tests.
6. Every task must have ≥ 1 completion signal.

### Completion Signal Types

| Type | Description |
|------|-------------|
| `path_exists` | File or directory must exist |
| `glob_exists` | At least one file matching a glob |
| `test_passes` | Shell command exits 0 |
| `file_contains` | File contains given string |
| `llm_review` | Requires LLM review (use sparingly) |

---

## 4. Review & Judge

### Review Verdict (Manager reviewing work)

Source: `templates/prompts/review.md`

```json
{
  "verdict": "approve | request_changes | reject",
  "reasoning": "Brief explanation",
  "feedback": "Specific actionable feedback",
  "follow_up_tasks": []
}
```

### Judge Verdict (LLM verifying task completion)

Source: `templates/prompts/judge.md`

```json
{
  "verdict": "accept | retry",
  "confidence": 0.95,
  "feedback": "All criteria met."
}
```

**Accept criteria:** task substantially complete + correct.
**Retry criteria:** clear gaps or errors → describe exactly what needs fixing.

---

## 5. Bernstein Signals (Optional — Bernstein-only)

> [!NOTE]
> These apply only when running under Bernstein harness orchestration. Not relevant for standalone coding sessions.

- **Signal check:** `cat .sdd/runtime/signals/{SESSION_ID}/WAKEUP` / `SHUTDOWN`
- **Heartbeat:** write every 30s to `.sdd/runtime/heartbeats/{SESSION_ID}.json`
- **Progress report:** `POST /tasks/{ID}/progress` with `{files_changed, tests_passing, errors}`
- **Bulletin board:** `POST /bulletin` for coordination between parallel agents
- **Stall detection:** 3 identical reports → WAKEUP, 5 → SHUTDOWN, 7 → killed

---

## 6. References

| Topic | Canonical Source |
|-------|-----------------|
| Domain invariants | `docs/canonical/DOMAIN_INVARIANTS.md` |
| Architecture | `docs/canonical/ARCHITECTURE_CONSTITUTION.md` |
| Commercial Events | `docs/canonical/COMMERCIAL_EVENT_MODEL.md` |
| Trust & Evidence | `docs/canonical/TRUST_AND_EVIDENCE.md` |
| Implementation plan | `docs/implementation-plan/00-README.md` |
| Phase map | `docs/implementation-plan/05-phase-map.md` |
| Coding session protocol | `docs/implementation-plan/07-coding-session-protocol.md` |
| Archived originals | `docs/_archive/skills-templates-2026-09/` |
