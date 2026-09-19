# Phase 2 — Control-Plane Architecture

## Launch instruction

> Read `docs/project/ruflo-readiness/PROTOCOL.md` plus the approved Phase 0, Phase 1A and Phase 1B reports. Execute **only Phase 2 — Control-Plane Architecture**. Do not perform migration. Stop at the Human Gate.

---

## Objective

Choose one coherent target engineering operating model.

Start from responsibilities, not tools.

Do not reward a design for having more features.

Prefer clear authority, low overlap, observability and diagnosability.

---

# 1. Responsibility matrix

Cover at least:

- Product truth
- Product planning
- Story/spec generation
- Execution-contract generation
- Task decomposition
- Dependency graph
- Scheduling
- Agent lifecycle
- Role resolution
- Skill resolution
- Main-model selection
- Subagent-model selection
- 9Router transport/routing
- MCP/tool authority
- Memory
- Context retrieval
- Worktree ownership
- Write scope
- Parallelism
- Retries
- Cancellation
- Policy
- Verification
- Tests
- Janitor/quality gates
- Integration
- Review
- Git commit
- Push
- Merge
- Release
- Receipts/audit

For every row assign exactly one **authoritative owner**.

Other systems may be:

- advisor;
- observer;
- executor;
- evidence source;

but must not independently mutate the same control plane.

---

# 2. Mandatory Ruflo questions

Answer:

1. Why should Ruflo exist in this repository?
2. What exact problem does it solve?
3. What becomes materially worse without it?
4. Which Ruflo capabilities should remain disabled?
5. Which capabilities are useful only later?
6. Does Ruflo own orchestration, or support another owner?
7. What role does Ruflo memory have?
8. What role does Ruflo policy have?
9. What role do Ruflo agent records have?
10. Does Ruflo add a second scheduler anywhere?

---

# 3. Bernstein burden of proof

Bernstein is legacy.

Only recommend reintroducing a Bernstein component if Phase 1 evidence shows:

- a concrete unsolved requirement;
- unique value not cleanly provided elsewhere;
- acceptable operational cost;
- no control-plane duplication.

If not, preserve useful concepts/assets without preserving the runtime.

Explicitly distinguish:

```text
legacy lesson
legacy template
legacy contract
legacy runtime
```

---

# 4. 9Router ownership

Determine:

- who selects main model;
- who selects subagent model;
- whether 9Router is transport/routing only;
- whether Ruflo may influence model choice;
- whether Codex agent configs may choose models;
- how to prevent multiple role→model authorities.

There must be one owner for model-selection policy.

---

# 5. Agent / role / skill abstraction

Define the relationship between:

```text
runtime agent type
engineering role
skill
model
MCP/tool permission
write scope
canonical context
acceptance gates
```

Do not create one Ruflo runtime agent type per project role unless runtime evidence proves that is the cleanest design.

Preserve richer project roles where useful without confusing them with runtime primitives.

---

# 6. Memory governance architecture

Define:

- allowed namespaces;
- who can write;
- who can read;
- provenance;
- validation status;
- invalidation;
- canonical precedence;
- ADR/RFC references;
- stale-memory handling;
- failed-experiment representation.

Required precedence concept:

```text
Canonical
>
Approved ADR/RFC
>
Current delivery contract
>
Validated implementation memory
>
Unvalidated memory
```

Memory must never resolve an `OPEN_DECISION`.

---

# 7. Concurrency architecture

Concurrency must derive from ownership boundaries, not `maxAgents`.

Define:

- one-writer-per-worktree;
- read-only research fanout;
- file/path ownership;
- shared manifests;
- lockfiles;
- migrations;
- integration ownership;
- conflict detection;
- cancellation;
- dependency failure propagation.

Define evidence required before parallelism increases.

---

# 8. Security / authority model

Define who may authorize:

- filesystem writes;
- shell commands;
- Git mutations;
- MCP usage;
- network access;
- external writes;
- DB migrations;
- secrets/config changes;
- background workers;
- architecture changes;
- release.

Tool availability ≠ authorization.

---

# 9. Human Gates

Evaluate gates for:

- canonical changes;
- open product decisions;
- architecture changes;
- production writes;
- destructive migration;
- secret/config changes;
- new external-system write authority;
- autonomous background workers;
- concurrency increase;
- model-routing policy changes;
- control-plane changes;
- merge;
- release.

Avoid gates for ordinary safe implementation where policy is already clear.

---

# 10. Architecture alternatives

Evaluate at least:

## Option A
Codex-led execution + bounded Ruflo memory/policy/coordination support.

## Option B
Ruflo as primary orchestration/control plane.

## Option C
Legacy Bernstein component retained only if Phase 1 evidence justifies it.

Do not force equal weighting.

If Option C has no evidence, mark it `REJECTED — burden of proof not met`.

---

# 11. Collision matrix

Use severity:

- `NONE`
- `ADVISORY_OVERLAP`
- `CONTROL_PLANE_OVERLAP`
- `UNSAFE`

Cover at least:

- task decomposition;
- scheduling;
- worktrees;
- write ownership;
- retries;
- cancellation;
- model routing;
- memory;
- MCP authority;
- Git side effects;
- integration;
- release.

---

# Required output

Write:

`docs/project/ruflo-readiness/02-control-plane-architecture.md`

Required sections:

1. Executive architecture decision.
2. Responsibility matrix.
3. Collision matrix.
4. Target operating flow.
5. Model-routing ownership.
6. Agent/role/skill abstraction.
7. Memory governance.
8. Concurrency/worktree model.
9. Security authority model.
10. Human Gates.
11. Selected architecture.
12. Strongest rejected alternative.
13. What remains disabled.
14. Risks / NEEDS_EVIDENCE.
15. Decision register.

For every major conclusion include evidence type/source/confidence.

Tables do not count toward the 2,500-word narrative target.

---

## Exit criteria

No unexplained dual authority over:

- scheduling;
- worktrees;
- write ownership;
- model routing;
- retries;
- memory authority;
- external mutation;
- Git merge/release.

STOP.

Do not migrate anything.
