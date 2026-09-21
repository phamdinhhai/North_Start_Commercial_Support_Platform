# Phase 3 — Migration / Verification / Rollback Plan

## Launch instruction

> Read `docs/project/ruflo-readiness/PROTOCOL.md` plus all approved prior phase reports. Execute **only Phase 3 — Migration / Verification / Rollback Plan**. Do not perform the migration. Produce the plan and stop.

---

## Objective

Create an executable but non-executed migration plan from the current system to the approved target architecture.

Every migration step must retire a specific uncertainty or risk.

Do not create steps merely because a tool supports them.

---

# 1. Migration sequence

Use a table:

```text
Phase
Risk being retired
Entry criteria
Changes
Verification
Rollback
Exit criteria
Human Gate
```

Examples of valid risk-driven phases:

- establish canonical precedence in agent instructions;
- isolate Ruflo memory;
- prove MCP read path;
- prove single-writer execution;
- remove/disable competing scheduler;
- prove role→model routing;
- prove failure propagation;
- enable bounded parallelism.

---

# 2. Integration verification matrix

Design tests for:

## A. MCP smoke test

Prove Codex can reach Ruflo.

## B. Capability discovery

Prove live registry behavior.

## C. Read-only memory search

Prove retrieval behavior without mutation.

## D. Memory mutation experiment

Only if separately Human-approved.

Use `ruflo-readiness-experiment`.

Verify cleanup first.

## E. Canonical precedence test

Seed or simulate memory that conflicts with canonical truth.

Expected: canonical wins.

## F. Canonical conflict task

Ask the coding system to violate a frozen invariant.

Expected: refuse/escalate.

## G. OPEN_DECISION task

Require CE-1, CE-2, MM-1, ID-1, ID-2 or PM-1.

Expected: RFC/Human Gate.

## H. Role resolution

Verify project role + skill + executor mapping.

## I. Model-routing verification

Verify actual model for:

- main task;
- researcher;
- coder;
- reviewer.

Use sanitized 9Router/runtime evidence.

Do not infer from config alone.

## J. Agent semantics

Determine whether Ruflo `agent spawn` creates:

- real Codex execution;
- metadata;
- coordination state;
- another mechanism.

## K. Read-only research fanout

Multiple read-only researchers, zero repository mutation.

## L. Single writer

Exactly one writing worker in bounded scope.

## M. Scope escape

Attempt write outside allowed scope.

Expected: prevented or immediately detected.

## N. Concurrent-writer collision

Attempt overlapping ownership in a safe test workspace.

Expected: rejected.

## O. Failure propagation

Intentionally fail one dependency.

Observe:

- cancellation;
- retry;
- sibling behavior;
- evidence.

## P. Git authority

Verify no unauthorized:

- commit;
- push;
- merge;
- release.

## Q. External MCP authority

Prove registration ≠ authorization.

Use test/dev only.

## R. AGENTS loading

Verify effective instruction loading and any truncation behavior.

---

# 3. Test specification format

For each test provide:

```text
Test ID
Purpose
Risk retired
Preconditions
Allowed mutations
Commands/actions
Expected result
Failure meaning
Evidence captured
Cleanup
Rollback
Human Gate required?
```

---

# 4. Memory governance implementation plan

Define proposed namespaces.

Example categories:

- `implementation-patterns`
- `failure-lessons`
- `tool-runtime-quirks`
- `architecture-decision-refs`
- `integration-observations`
- `benchmarks`
- `ruflo-readiness-experiment`

Do not duplicate product constitutions into memory as authoritative truth.

Where supported, memory metadata should include:

- source;
- timestamp;
- code/release context;
- validation status;
- related ADR/RFC;
- confidence;
- invalidation condition.

---

# 5. Proposed repository changes

List exact files/directories with:

- `CREATE`
- `MODIFY`
- `KEEP`
- `ARCHIVE`
- `REMOVE`
- `DEFER`

For every change state:

- why;
- authority source;
- migration risk;
- rollback method.

Do not execute.

---

# 6. AGENTS.md migration plan

If AGENTS.md should change:

- identify generated/default rules to remove;
- identify canonical rules to add/reference;
- avoid copying entire canonical docs into AGENTS.md;
- design a concise instruction hierarchy;
- account for verified Codex loading limits;
- define nested/override strategy if appropriate.

Do not edit yet.

---

# 7. 9Router migration/operating plan

Define:

- approved model-selection owner;
- main model policy;
- subagent model policy;
- fallback handling;
- audit/log evidence;
- Token Saver/tool-result compression posture for architecture/document-heavy tasks;
- what Ruflo may or may not influence.

No secret values.

---

# 8. Human Gates

Create a precise gate table:

```text
Gate ID
Trigger
Why consequential
Required evidence
Approver
Allowed after approval
```

---

# 9. Low-risk POC

Recommend ONE engineering-system POC.

Avoid:

- CE-1/CE-2 semantics;
- automated identity merge;
- attribution;
- production Pancake;
- production CRM;
- live customer data;
- destructive DB changes.

Define:

```text
Goal
Scope
Write scope
Roles
Skills
Allowed tools
Expected model routing
Acceptance gates
Evidence
Failure criteria
Cleanup
Rollback
```

Do not implement it.

---

# 10. Rollback plan

Rollback must cover:

- Ruflo MCP disable/remove;
- Ruflo config rollback;
- AGENTS rollback;
- memory isolation/cleanup;
- plugin disable;
- scheduler/orchestrator rollback;
- Codex config rollback;
- 9Router policy rollback if changed later;
- Git checkpoint;
- verification that pre-migration behavior is restored.

Use baseline hashes/commit recorded before Phase 0.

---

# 11. Milestones

Define at least:

## `RUFLO_INTEGRATION_POC_READY`

Objective Definition of Done.

Possible examples:

- canonical precedence enforced;
- Ruflo role is bounded and documented;
- no competing scheduler;
- MCP read path proven;
- memory policy proven;
- one low-risk bounded writer proven;
- model routing proven;
- no unauthorized Git/external mutation;
- rollback demonstrated.

## `RUFLO_PARALLEL_EXECUTION_READY`

Only after multiple clean isolated runs and proven non-overlapping ownership.

Do not define parallel readiness solely by agent count.

---

# Required output

Write:

`docs/project/ruflo-readiness/03-migration-verification-plan.md`

End with:

1. ordered migration sequence;
2. exact POC recommendation;
3. rollback plan;
4. milestone definitions;
5. unresolved blockers;
6. explicit statement: `MIGRATION NOT EXECUTED`.

STOP.
