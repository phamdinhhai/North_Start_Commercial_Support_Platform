# Phase 1 — Existing System + Runtime Forensics

Phase 1 is deliberately split into two subphases.

- Phase 1A: repository and legacy forensics — file inspection only.
- Human Gate.
- Phase 1B: live runtime verification — commands and runtime evidence.

Do not run Phase 1B automatically after Phase 1A.

---

# Phase 1A — Repository / Legacy / Configuration Forensics

## Launch instruction

> Read `docs/project/ruflo-readiness/PROTOCOL.md` and the approved Phase 0 report. Execute **only Phase 1A — Repository / Legacy / Configuration Forensics**. Do not run live Ruflo experiments and do not begin Phase 1B. Stop at the Human Gate.

## Objective

Reconstruct the engineering system from repository evidence without mutating runtime state.

## Inspect

### Engineering configuration

- `AGENTS.md`
- `.agents/**`
- `.claude-flow/**`
- `.codex/**`
- BMad artifacts if present
- Bernstein artifacts if present
- execution contracts
- relevant `docs/project/**`
- relevant `docs/delivery/**`

### Project-local workforce assets

- `templates/roles/**`
- `templates/skills/**`
- `templates/teams/**`
- `templates/workflows/**`
- `templates/agent_plugin/**`
- other relevant capability templates

### Historical architecture

Recover former responsibilities of:

- BMad
- Bernstein Planner
- Bernstein Janitor
- Codex
- Antigravity
- wshobson/agents-derived roles/skills
- MCP profiles
- Human Gates

Treat Bernstein as `LEGACY` unless repository/runtime evidence proves an active dependency.

Do not attempt to explain why Bernstein was abandoned unless that reason is explicitly documented in the repository.

If not documented, record:

`NEEDS_EVIDENCE — historical Bernstein operational failure reason not available.`

Do not reconstruct or revive Bernstein.

### Model-routing configuration

Inspect only non-secret / redacted evidence regarding:

- Codex model config;
- Codex subagent config;
- `.codex/agents/*.toml`;
- 9Router routing evidence supplied by the human;
- legacy Bernstein model/executor mapping;
- Ruflo model-related static config.

Never open secret-bearing global config directly.

### AGENTS.md

Measure:

- bytes;
- lines;
- major sections.

Audit every meaningful generated rule as:

- `KEEP`
- `ADAPT`
- `REMOVE`
- `DEFER`
- `NEEDS_EVIDENCE`

Pay attention to:

- TypeScript/Node assumptions;
- DDD/bounded-context assumptions;
- hierarchical topology;
- max agents;
- Raft/consensus;
- automatic swarm thresholds;
- test philosophy;
- coverage thresholds;
- path conventions;
- performance targets;
- static MCP tool lists;
- static agent types;
- hooks/workers;
- Git behavior;
- publish behavior.

Do not treat Ruflo-generated text as repository authority.

---

## Phase 1A output

Write:

`docs/project/ruflo-readiness/01a-repository-forensics.md`

Required sections:

1. Repository engineering-system map.
2. Active-looking vs legacy-looking assets.
3. BMad/Bernstein/Codex/Ruflo responsibility history.
4. Role/skill/template inventory.
5. Static model-routing map.
6. AGENTS.md audit.
7. Suspected control-plane overlaps.
8. Runtime questions that Phase 1B must answer.
9. `NEEDS_EVIDENCE` list.

Use status labels:

- `ACTIVE_BY_REPO_EVIDENCE`
- `LEGACY`
- `TEMPLATE_ONLY`
- `UNKNOWN`

Do not call something runtime-active solely because config exists.

Record before/after mutation manifests.

STOP.

---

# Human Gate between 1A and 1B

The human should review:

- whether the repository reconstruction is accurate;
- whether sanitized 9Router evidence is available;
- which runtime commands are approved.

Only then begin Phase 1B.

---

# Phase 1B — Live Runtime Verification

## Launch instruction

> Read `docs/project/ruflo-readiness/PROTOCOL.md`, the approved Phase 0 report, and the approved Phase 1A report. Execute **only Phase 1B — Live Runtime Verification**. Prefer commands proven read-only. Stop if any supposedly read-only command mutates repository/runtime state unexpectedly.

## Objective

Verify what the installed system actually does.

Do not choose the final architecture yet.

---

## Runtime inventory

Record versions where discoverable:

- Codex
- Ruflo
- Node
- npm/npx
- Git
- Python/uv if relevant
- BMad if installed
- Bernstein if installed
- 9Router version only from sanitized evidence if available

---

## Ruflo runtime verification

For each capability determine:

```text
DOCUMENTED
REGISTERED
CONFIGURED
REACHABLE
HEALTHY
AUTHORIZED
TESTED
```

Investigate only through approved commands.

Relevant areas:

- MCP registration;
- MCP tool/capability discovery;
- health/status;
- memory;
- agent lifecycle;
- orchestration/swarm;
- hooks;
- background workers;
- policy;
- worktree/concurrency support;
- receipts/evidence;
- security capability;
- performance capability;
- GitHub capability;
- installed skills/plugins.

Do not mutate memory without a separate Human Gate.

Do not run hooks merely to see what happens if their side effects are unknown.

Classify uncertain commands as `POTENTIALLY_MUTATING`.

---

## Agent semantics investigation

Determine with evidence whether:

- Ruflo `agent spawn` launches a real Codex execution process;
- it creates only coordination/ledger state;
- it creates a template/config;
- execution is delegated elsewhere.

If verifying this requires mutation, propose a safe experiment but do not run it without approval.

---

## Model-routing runtime map

Determine what can be proven about:

- main Codex model;
- subagent model;
- 9Router model routing;
- Ruflo routing;
- legacy Bernstein routing.

Actual executing model claims require:

- sanitized 9Router log;
- Codex runtime evidence;
- or equivalent trusted evidence.

If unavailable: `NEEDS_EVIDENCE`.

Do not guess from configured model names.

---

## AGENTS.md effective-loading investigation

Determine:

- whether full root AGENTS.md is loaded;
- nested/override behavior;
- size/truncation behavior.

If runtime/upstream evidence is unavailable, report `NEEDS_EVIDENCE`.

Do not rely on memory of a historical Codex limit.

---

## Side-effect detection

Before and after every approved runtime command group:

- inspect Git status;
- compare `.claude-flow/**` manifest;
- compare relevant project config fingerprints.

If unexpected mutation occurs:

1. stop the command sequence;
2. preserve evidence;
3. report;
4. do not clean automatically.

---

## Phase 1B output

Write:

`docs/project/ruflo-readiness/01b-runtime-forensics.md`

Required sections:

### 1. Runtime inventory

### 2. Ruflo capability matrix

Columns:

```text
Capability
Documented
Registered
Configured
Reachable
Healthy
Authorized
Tested
Mutation risk
Potential project value
Evidence
```

### 3. Actual vs assumed agent semantics

### 4. Runtime model-routing findings

### 5. AGENTS.md loading findings

### 6. Unexpected side effects

### 7. Security/authority surface

### 8. Remaining NEEDS_EVIDENCE

### 9. Inputs required for Phase 2

STOP.

Do not select architecture until Human Gate.
