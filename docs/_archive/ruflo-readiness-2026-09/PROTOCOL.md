# Ruflo Integration Readiness Protocol

Repository: `North_Start_Commercial_Support_Platform`

## Purpose

This protocol governs a phased investigation of how Ruflo should integrate with the existing AI coding system for this repository.

The objective is **not** to install tools, maximize autonomy, or implement product features.

The objective is to establish a safe, evidence-based engineering operating model with:

- clear truth hierarchy;
- one authoritative owner per control-plane responsibility;
- bounded autonomy;
- diagnosable failures;
- reproducible execution;
- safe rollback;
- explicit Human Gates.

---

## 1. Mandatory execution model

The investigation is divided into four phases:

1. **Phase 0 — Canonical Understanding**
2. **Phase 1 — Existing System + Runtime Forensics**
   - **Phase 1A — Repository / legacy / configuration forensics**
   - **Human Gate**
   - **Phase 1B — Live runtime verification**
3. **Phase 2 — Control-Plane Architecture**
4. **Phase 3 — Migration / Verification / Rollback Plan**

Execute **only the phase explicitly authorized by the human**.

At the end of every phase or subphase:

1. write the required report;
2. list unresolved questions;
3. state whether exit criteria were satisfied;
4. STOP;
5. wait for Human Gate approval.

Never silently continue to the next phase.

---

## 2. Output location

All investigation artifacts MUST be written only under:

`docs/project/ruflo-readiness/`

Allowed structure:

```text
docs/project/ruflo-readiness/
├── PROTOCOL.md
├── 00-canonical-understanding.md
├── 01a-repository-forensics.md
├── 01b-runtime-forensics.md
├── 02-control-plane-architecture.md
├── 03-migration-verification-plan.md
└── evidence/
    ├── baseline.md
    ├── environment.md
    ├── commands.md
    ├── runtime-capabilities.md
    ├── config-fingerprints.md
    └── redacted-findings.md
```

Do not modify `docs/canonical/**`.

Do not modify product source code during this investigation.

---

## 3. Source authority hierarchy

### Tier 1 — Normative

`docs/canonical/**`

Human-controlled product truth.

These documents outrank generated prompts, memory, agent configuration, runtime defaults, historical plans and tooling conventions.

### Tier 2 — Strategic

`docs/north-star/**`

Long-term direction if hypotheses are validated.

North Star is not automatically current implementation scope.

### Tier 3 — Delivery

`docs/delivery/**`

Stories, contracts and implementation-oriented artifacts derived from canonical truth.

### Tier 4 — Research / historical reasoning

`docs/research/**`
`docs/project/**`
archived plans
handoff packs
brainstorm documents
legacy AI-team setup documents
Bernstein material

Evidence and context only unless explicitly elevated elsewhere.

### Tier 5 — Engineering assets

`templates/**`

Reusable roles, skills, teams, workflows, recipes, prompts and previous orchestration assets.

Not automatically active runtime policy.

### Tier 6 — Generated/runtime configuration

Examples:

- `AGENTS.md`
- `.agents/**`
- `.claude-flow/**`
- `.codex/**`
- BMad configuration
- Bernstein configuration
- Ruflo configuration
- 9Router configuration
- MCP registrations

These must conform to higher-authority layers.

---

## 4. Evidence discipline

Every important conclusion MUST include:

- **Claim**
- **Evidence type**
- **Evidence source**
- **Confidence**
- **Implication**

Evidence types:

- `CANONICAL`
- `REPOSITORY`
- `RUNTIME`
- `UPSTREAM_DOC`
- `HISTORICAL`
- `INFERENCE`

Never present an inference as a discovered fact.

For runtime evidence record:

- exact command;
- version;
- relevant redacted output;
- timestamp where useful.

If evidence is unavailable, write `NEEDS_EVIDENCE`.

---

## 5. Secret-safety rule: never read secret values into model context

"Do not print secrets" is insufficient.

Do not directly open or cat credential-bearing files into model context.

This includes, but is not limited to:

- `~/.codex/config.toml`
- 9Router configs
- `.env*`
- credential stores
- MCP secret files
- provider config files
- files containing API keys, tokens, cookies or passwords.

When inspection is necessary, use a **redacted projection** produced outside model-readable output.

The redaction process must replace values associated with names matching, case-insensitively:

`key|token|secret|password|credential|cookie|authorization|api_key|apikey`

with `REDACTED`.

Only inspect the redacted projection.

Allowed findings:

```text
9Router credential: PRESENT
OPENAI_API_KEY: NOT PRESENT
```

Forbidden:

```text
OPENAI_API_KEY=sk-...
```

Never include secret values in reports, command evidence or appendices.

---

## 6. Sandbox / write-boundary requirement

Before Phase 0 begins, the human operator should configure Codex so that this investigation can write only to:

`docs/project/ruflo-readiness/**`

Everything else should be read-only unless explicitly approved.

If the installed Codex version cannot enforce this exact boundary, record the limitation before proceeding.

Use approval mode for any operation that would write outside the allowed path.

Do not assume prompt instructions alone are sufficient isolation.

---

## 7. Baseline / recovery checkpoint before Phase 0

Before reading large project context, record a recovery baseline in:

`docs/project/ruflo-readiness/evidence/baseline.md`

Record:

- repository path;
- current branch;
- current commit hash;
- whether working tree is clean;
- `git status --short`;
- Ruflo version;
- Codex version;
- Node version;
- Git version.

Also record fingerprints only, never contents, for sensitive/global config files if they exist:

- `~/.codex/config.toml`
- `~/.claude/CLAUDE.md`
- relevant 9Router config file(s)

For each file record only:

- path;
- exists / missing;
- byte size;
- SHA-256 checksum;
- last modified time.

Do not print file contents.

---

## 8. Mutation detection

Before and after each phase/subphase, capture repository state.

At minimum:

```text
git status --short
git diff --stat
```

For `.claude-flow/**`, capture a filesystem manifest containing:

- relative path;
- size;
- last modified time;
- SHA-256 where practical.

Store before/after manifests under `evidence/`.

If a supposedly read-only operation changes `.claude-flow/**`, `.agents/**`, `.codex/**`, global config, Git state or other repository files, stop and report the side effect.

Do not automatically clean it up unless explicitly authorized.

---

## 9. 9Router prerequisite before Phase 0

Phase 0 reads long canonical documents.

Therefore, BEFORE Phase 0:

The human operator must verify 9Router settings manually or provide sanitized evidence.

Specifically determine:

- whether tool-result compression / Token Saver is active;
- whether long-context content is summarized or truncated;
- whether model fallback is enabled;
- intended main model;
- intended subagent model.

For this investigation, prefer disabling lossy tool-result compression when feasible.

The AI must NOT change 9Router settings automatically.

If actual 9Router behavior cannot be verified, write `NEEDS_EVIDENCE`.

Do not claim the actual executing model unless supported by sanitized 9Router logs or equivalent evidence.

If unexpected fallback is observed, record it as an investigation limitation.

---

## 10. Read-only default

During Phases 0, 1A and 2, default to repository read-only inspection except for writing investigation reports under the allowed output directory.

Phase 1B may perform runtime inspection, but should prefer commands known to be read-only.

Allowed without additional Human Gate:

- read repository files;
- inspect Git status/history;
- query tool versions;
- list MCP registrations;
- inspect already-redacted config projections;
- inspect existing templates and documentation;
- inspect runtime capability listings only where verified read-only.

Not allowed without explicit Human Gate:

- rerun Ruflo `init`;
- `doctor --fix`;
- install or update plugins;
- modify Codex global config;
- modify 9Router config;
- start autonomous background mutation;
- spawn persistent workers for product work;
- mutate project memory;
- modify canonical docs;
- commit;
- push;
- merge;
- release;
- write to external production systems.

If a command advertised as "read-only" may write local state, classify it as `POTENTIALLY_MUTATING` until proven otherwise.

---

## 11. Experimental namespace

If Human Gate later authorizes Ruflo memory mutation tests, use only:

`ruflo-readiness-experiment`

Never put test entries into normal project/pattern namespaces.

Before writing:

- verify cleanup/delete capability;
- capture pre-test state;
- define test key names;
- define cleanup steps.

If cleanup cannot be proven, do not perform the mutation experiment.

---

## 12. Runtime truth model

For every Ruflo capability distinguish:

- `DOCUMENTED`
- `REGISTERED`
- `CONFIGURED`
- `REACHABLE`
- `HEALTHY`
- `AUTHORIZED`
- `TESTED`

A registered tool is not necessarily healthy.

A healthy tool is not necessarily authorized.

A documented capability may not exist in the installed version.

Never invent tool names or schemas.

---

## 13. Model-routing scope

Inspect all layers capable of influencing model selection:

- Codex default model;
- Codex agent/subagent model configuration;
- `.codex/**`;
- `.codex/agents/*.toml` if present;
- 9Router main/subagent routing;
- Ruflo model/router capabilities;
- Bernstein model/executor selection if legacy material remains;
- role-specific model declarations elsewhere.

Determine:

1. who selects the main model;
2. who selects subagent models;
3. whether Ruflo can override them;
4. whether Bernstein can override them;
5. what 9Router can actually observe;
6. whether role-specific routing requires another scheduler;
7. whether Ruflo agent templates become executable Codex agents or remain metadata;
8. whether `agent spawn` creates real execution or only coordination state;
9. who should own role→model selection.

Runtime claims require runtime evidence.

---

## 14. AGENTS.md effective-loading audit

Do not assume a remembered Codex instruction-size limit.

Measure current `AGENTS.md` byte size.

Investigate current Codex behavior regarding:

- root `AGENTS.md`;
- nested `AGENTS.md`;
- override files;
- maximum instruction size;
- truncation behavior.

Use installed/runtime evidence first.

Use upstream documentation only if needed and available.

If unavailable, report `NEEDS_EVIDENCE` instead of guessing.

---

## 15. Bernstein status

Treat Bernstein as `LEGACY` unless runtime/repository evidence shows it is active.

Do not restore it by default.

Investigate Bernstein only from repository/runtime evidence that already exists.

Determine:

- what responsibilities Bernstein previously owned;
- which concepts/assets may still be reusable;
- whether any active runtime dependency remains;
- whether Ruflo would conflict with surviving Bernstein components.

Do not reconstruct why Bernstein was abandoned if that reason is not present in repository evidence.
Record such missing history as:

`NEEDS_EVIDENCE — historical Bernstein operational failure reason not available.`

Do not reintroduce Bernstein runtime merely because its historical design looks coherent on paper.

The burden of proof is on reintroduction.

---

## 16. Report size

Main narrative target: preferably ≤ 2,500 words per phase.

**Tables do not count toward this target.**

Large matrices and raw evidence should be moved to appendices/evidence files.

Priorities:

- `P0`: canonical authority / safety
- `P1`: control-plane ownership
- `P2`: runtime verification
- `P3`: optional optimization

Do not spend significant effort on P3 while P0/P1 remain unresolved.

---

## 17. Language

Write reports in Vietnamese.

Keep technical identifiers, paths, command names and architecture terms in English where clearer.

---

## 18. Global stop conditions

STOP and report if:

- canonical sources conflict;
- an `OPEN_DECISIONS` item is required;
- a required runtime capability cannot be verified;
- a command may expose secret values;
- an operation requires production mutation;
- authority is unclear;
- two systems appear able to mutate the same control plane;
- an unexpected filesystem/config mutation occurs;
- the next step requires architecture-changing edits.

---

## 19. Optimization target

Do not optimize for maximum autonomous coding.

Optimize for:

```text
clear truth
clear ownership
clear evidence
bounded authority
reproducible execution
diagnosable failures
safe rollback
```

Autonomy should increase only when evidence demonstrates that the next level is safe.
