# Phase 1A — Phuc tap Repository / Legacy / Configuration

> Ngay thuc hien: 2026-09-20
> Phien ban: Phase 1A — Repository / Legacy / Configuration Forensics
> Trang thai: BAN DRAFT — can duyet boi Human Gate truoc khi tien hanh Phase 1B

---

## 1. Repository Engineering-System Map

### 1.1 Cau truc thu muc

| Thu muc / File | Loai | Tracked | Mo ta |
|---|---|---|---|
| `AGENTS.md` | Config | Yes | Root instruction file — 12,915 bytes, 427 lines |
| `.agents/config.toml` | Config | Yes | Claude Flow / Ruflo config (8,946 bytes) |
| `.agents/skills/*/SKILL.md` | Skills | Yes | 6 active skills |
| `.claude-flow/agents/store.json` | State | Yes | Agent registry (2 idle agents) |
| `.claude-flow/policy/state.json` | State | Yes | Policy receipts (legacy-default-allow) |
| `.claude-flow/metrics/swarm-activity.json` | State | Yes | Swarm activity metrics |
| `.codex/config.toml` | Config | Gitignored | Local Codex override (danger-full-access) |
| `.codex/AGENTS.override.md` | Config | Gitignored | Local dev overrides (stub/template) |
| `docs/canonical/**` | Canonical | Yes | 12 files — Tier 1 product truth |
| `docs/delivery/**` | Delivery | Yes | BOOT-001 story + 5 role contracts |
| `docs/recovery/` | Recovery | Yes | Recovered Antigravity conversation |
| `docs/project/ruflo-readiness/` | Investigation | Yes | Ruflo readiness investigation artifacts |
| `templates/**` | Templates | Yes | 195 files — Bernstein legacy template library |
| `docs/research/**` | Research | Yes | Pancake research archives |
| `docs/external-apis/**` | Reference | Yes | Pancake/Meta/TikTok API knowledge base |
| `docs/architecture/` | Architecture | Yes | Pancake realtime sync architecture |
| `docs/north-star/` | Strategic | Yes | North Star direction document |

### 1.2 Phien ban / Cong cu (nen tang)

| Cong cu | Phien ban | Nguon |
|---|---|---|
| Node.js | v22.21.0 | `node --version` |
| npm | 10.9.0 | `npm --version` |
| Git | 2.47.1.windows.2 | `git --version` |
| Codex CLI | 0.155.1 | `codex --version` |
| Bernstein | 3.19.2 | `bernstein --version` |
| ruflo (npm package) | 3.42.4 | Process: `npx -y ruflo@3.42.4 mcp start` |

### 1.3 Git state

| Gia tri | Gia tri |
|---|---|
| Branch | `main` |
| HEAD | `957deda3fb0a305a4620ca4b67525624c5776068` |
| So commit | 3 |
| Working tree | Clean (trước khi viet report) |
| Remote | `origin/main` |

```
957deda docs: complete Ruflo readiness phase 0
127e376 chore: add Ruflo readiness protocol
88528db first commit
```

### 1.4 Khong co san pham code

- **Khong co** `package.json`, `src/`, `tests/`, `tsconfig.json`, `node_modules/`
- **Khong co** `product/` (duoc tham chieu trong BOOT-001 nhung chua duoc tao)
- Day la **repo chi chua config/docs/templates** — chua co product code

---

## 2. Active-Looking vs Legacy-Looking Assets

### 2.1 Bang phan loai

| Asset | Trang thai | Loai | Ly do |
|---|---|---|---|
| `docs/canonical/**` | **ACTIVE_BY_REPO_EVIDENCE** | Tier 1 | Human-controlled product truth |
| `docs/north-star/` | **ACTIVE_BY_REPO_EVIDENCE** | Tier 2 | Strategic direction |
| `docs/delivery/` | **ACTIVE_BY_REPO_EVIDENCE** | Tier 3 | BOOT-001 approved story + contracts |
| `AGENTS.md` | **UNKNOWN** (generate, chua verify runtime) | Tier 6 | Ruflo-generated, khong phai repo authority |
| `.agents/config.toml` | **UNKNOWN** (config only, chua verify runtime) | Tier 6 | Ruflo-generated config |
| `.claude-flow/**` | **UNKNOWN** (state files, chua verify runtime) | Tier 6 | Runtime state — 2 agents registered but idle |
| `.codex/config.toml` | **UNKNOWN** (gitignored, local override) | Tier 6 | Local dev config only |
| `.agents/skills/**` | **UNKNOWN** (chua verify loaded at runtime) | Tier 6 | 6 skills — need runtime verification |
| `templates/**` (Bernstein) | **TEMPLATE_ONLY** | Tier 5 | Bernstein template library — no runtime evidence |
| `templates/roles/**` | **TEMPLATE_ONLY** | Tier 5 | 18 Bernstein role definitions |
| `templates/skills/**` | **TEMPLATE_ONLY** | Tier 5 | 16 Bernstein skill definitions |
| `templates/teams/**` | **TEMPLATE_ONLY** | Tier 5 | Bernstein team manifests (Python/TypeScript) |
| `templates/workflows/**` | **TEMPLATE_ONLY** | Tier 5 | 6 Bernstein workflow templates |
| `templates/adapter_contracts/**` | **TEMPLATE_ONLY** | Tier 5 | 20+ CLI adapter contracts |
| `templates/agent_plugin/**` | **TEMPLATE_ONLY** | Tier 5 | Bernstein plugin skeleton |
| `docs/recovery/` | **LEGACY** | Tier 4 | Recovered Antigravity conversation |
| `docs/research/**` | **LEGACY** | Tier 4 | Pancake research archives |
| `docs/project/plan-archive/` | **LEGACY** | Tier 4 | Historical implementation plans |
| `docs/project/revenue-continuity-context/` | **LEGACY** | Tier 4 | Historical revenue continuity context |

### 2.2 Quan sat quan trong

- **Khong co src/bernstein/** — thu muc Bernstein history khong ton tai trong repo
- **Khong co ai-team/** — thu muc ai-team history khong ton tai
- **Khong co .sdd/** — Bernstein state directory khong ton tai
- **Bernstein CLI** (v3.19.2) da duoc cai dat tren may nhung **khong co runtime evidence** trong repo

---

## 3. BMad / Bernstein / Codex / Ruflo Responsibility History

### 3.1 Bernstein

| Hinh thuc | Trang thai | Evidence |
|---|---|---|
| `templates/bernstein.yaml` | TEMPLATE_ONLY | Seed file for Bernstein runs (8,686 bytes) |
| `templates/agent_plugin/` | TEMPLATE_ONLY | Bernstein plugin: orchestrator, commands, rules, bernstein-run skill |
| `templates/skills/bernstein-*.md` | TEMPLATE_ONLY | 4 Bernstein-specific skills (commit, completion, signal-check, test-runner) |
| `templates/roles/**` | TEMPLATE_ONLY | 18 Bernstein role definitions |
| `templates/skills/**` | TEMPLATE_ONLY | 16 Bernstein skill definitions |
| `templates/teams/**` | TEMPLATE_ONLY | Bernstein team manifests (Python, TypeScript) |
| `templates/workflows/**` | TEMPLATE_ONLY | 6 Bernstein workflows |
| `templates/adapter_contracts/**` | TEMPLATE_ONLY | Bernstein adapter contracts (codex, claude, gemini, etc.) |
| `templates/capabilities/adapters.yaml` | TEMPLATE_ONLY | Bernstein adapter capability tags |
| `templates/capabilities/mcp_tools.yaml` | TEMPLATE_ONLY | Bernstein MCP tools listing |
| `docs/delivery/contracts/*` | LEGACY | Referen `src/bernstein/**` trong forbidden_paths |
| `docs/delivery/stories/BOOT-001.md` | ACTIVE_BY_REPO_EVIDENCE | Referen `src/bernstein/**` trong "remain unchanged" |

**Ket luan Bernstein:**
- **Repository assets:** LEGACY / TEMPLATE_ONLY (195 files in templates/)
- **Bernstein CLI:** INSTALLED (v3.19.2) on machine
- **Active Bernstein orchestration for this project:** NOT PROVEN
- **Authorization for Bernstein in this project:** UNKNOWN
- **Relationship to observed Ruflo MCP processes:** NONE OBSERVED

**NEEDS_EVIDENCE:** Ly do Bernstein bi bo — khong tim thay trong repository evidence.

### 3.2 BMad

| Hinh thuc | Trang thai | Evidence |
|---|---|---|
| `docs/delivery/README.md` | LEGACY | "BMad-managed / delivery-oriented artifacts" |
| Khong co BMad config | - | Khong co file BMad config nao |
| Khong co BMad binary | - | Khong cai dat BMad |

**Ket luan BMad:** BMad chi xuat hien nhu text reference trong delivery README. Khong co bat ky artifact config hay binary nao.

### 3.3 Antigravity

| Hinh thuc | Trang thai | Evidence |
|---|---|---|
| `templates/adapter_golden/gemini_adapter.yaml` | TEMPLATE_ONLY | Adapter capability tag: `adapter.antigravity` |
| `templates/capabilities/adapters.yaml` | TEMPLATE_ONLY | Same adapter tag |
| `templates/adapter_contracts/antigravity.yaml` | TEMPLATE_ONLY | Adapter contract |
| `docs/recovery/RECOVERED_CONVERSATION_REDACTED.md` | LEGACY | Recovered conversation tu Antigravity IDE |

**Ket luan Antigravity:** Chi xuat hien nhu adapter template va recovered conversation. Khong co runtime evidence.

### 3.4 Ruflo / Claude Flow

| Hinh thuc | Trang thai | Evidence |
|---|---|---|
| `AGENTS.md` | Tier 6 (generated) | "Claude Flow powered project", "Ruflo is the coordination ledger" |
| `.agents/config.toml` | Tier 6 (generated) | "Generated by: @claude-flow/codex", MCP server: `ruflo@latest` |
| `.claude-flow/` | Tier 6 (state) | Agent registry (2 agents), policy (legacy-default-allow), metrics |
| `.codex/config.toml` | Tier 6 (local) | Local override for Codex CLI |
| Running processes | RUNTIME | `npx -y ruflo@3.42.4 mcp start` — 3 instances running |

**Naming/version lineage:** Co nhieu ten goi khac nhau cho cung mot framework:
- "Ruflo" — dung trong PROTOCOL, AGENTS.md header
- "@claude-flow/cli" — dung trong skills commands
- ".claude-flow" — dung cho config directory
- "ruflo@3.42.4" — npm package name
- "Claude Flow" — dung trong AGENTS.md intro

### 3.5 wshobson/agents

No explicit wshobson/agents provenance reference was found in repository text.

### 3.6 9Router

| Hinh thuc | Trang thai | Evidence |
|---|---|---|
| Khong co 9Router config | - | Khong co file 9Router config |
| `docs/recovery/RECOVERED_CONVERSATION_REDACTED.md` | LEGACY | Historical discussion ve 9Router routing |
| `docs/project/ruflo-readiness/PROTOCOL.md` | Investigation | Investigator mentions 9Router |

**Ket luan 9Router:** Chi xuat hien trong recovery conversation va investigation protocol. Khong co config file hay runtime evidence trong repo.

---

## 4. Role / Skill / Template Inventory

### 4.1 Active Skills (`.agents/skills/`)

| Skill | Size | Command prefix |
|---|---|---|
| `github-automation` | 728 bytes | `gh pr create`, `gh pr checks` |
| `memory-management` | 922 bytes | `npx @claude-flow/cli memory store/search` |
| `performance-analysis` | 766 bytes | - |
| `security-audit` | 914 bytes | - |
| `sparc-methodology` | 1,046 bytes | - |
| `swarm-orchestration` | 1,044 bytes | `npx @claude-flow/cli swarm init/hooks route` |

**Tat ca** reference `@claude-flow/cli` commands. Chua verify runtime loading.

### 4.2 Bernstein Template Roles (18 roles)

`adversary`, `analyst`, `architect`, `backend`, `ci-fixer`, `devops`, `frontend`, `integration`, `manager`, `ml-engineer`, `prompt-engineer`, `qa`, `resolver`, `retrieval`, `reviewer`, `security`, `visionary`, `vp`

Moi role co: `config.yaml`, `system_prompt.md`, `task_prompt.md`

### 4.3 Bernstein Template Skills (16 skills)

`analyst`, `architect`, `backend`, `ci-fixer`, `devops`, `frontend`, `manager`, `ml-engineer`, `prompt-engineer`, `qa`, `resolver`, `retrieval`, `reviewer`, `security`, `visionary`, `vp`

Moi skill co: `SKILL.md` va `references/` voi chi tiet hon.

### 4.4 Bernstein Workflows (6)

`dependency-bump`, `doc-update`, `hot-fix`, `idea-to-pr`, `refactor-with-tests`, `security-review`

### 4.5 Bernstein Teams (2)

`python.toml` (backend+qa+security), `typescript.toml` (frontend+backend+qa)

### 4.6 Bernstein Adapter Contracts (20+)

`aider`, `amp`, `antigravity`, `bernstein`, `claude`, `codex`, `computer_use`, `copilot`, `continue_dev`, `crush`, `droid`, `forge`, `gemini`, `goose`, `kimchi`, `kimi`, `muse`, `opencode`, `plandex`, `pydantic_ai`, `q_dev`, `qwen`

### 4.7 Agent Types in AGENTS.md

| Type | Role |
|---|---|
| `researcher` | Requirements analysis |
| `architect` | System design |
| `coder` | Implementation |
| `tester` | Test creation |
| `reviewer` | Code review |

---

## 5. Static Model-Routing Map

### 5.1 Configured Models (static, chua verify runtime)

| Layer | Config key | Gia tri | File |
|---|---|---|---|
| Ruflo/Claude Flow | `model` | `gpt-5.3-codex` | `.agents/config.toml` |
| Codex local override | `model` | (inherited) | `.codex/config.toml` |
| Policy mode | `[policy] mode` | `legacy` | `.agents/config.toml` |
| Agent store | `model` | `sonnet` (coordinator), `opus` (security-architect) | `.claude-flow/agents/store.json` |

### 5.2 Bernstein Role→Model Mapping (template only)

| Team | Role | Model | File |
|---|---|---|---|
| typescript | frontend | sonnet | `templates/teams/typescript.toml` |
| typescript | backend | sonnet | `templates/teams/typescript.toml` |
| typescript | qa | sonnet | `templates/teams/typescript.toml` |
| python | backend | sonnet | `templates/teams/python.toml` |
| python | qa | sonnet | `templates/teams/python.toml` |
| python | security | opus | `templates/teams/python.toml` |

### 5.3 MCP Server Config

| Server | Command | Enabled | File |
|---|---|---|---|
| `ruflo` | `cmd /c npx -y ruflo@latest mcp start` | true | `.agents/config.toml` |

**Version drift risk:** Config free-floats `ruflo@latest`; Human Gate evidence shows observed runtime process commands use `ruflo@3.42.4`. Actual installed/configured version alignment is **NEEDS_EVIDENCE**.

### 5.4 Phat hien

- **Khong co** `.codex/agents/*.toml` files
- **Khong co** 9Router config file trong repo
- **Khong co** role→model routing config cho Codex native agents
- Agent store ghi nhan 2 agents voi models `sonnet` va `opus` — nhung day co the chi la config-time snapshot, khong phai runtime truth

---

## 6. AGENTS.md Audit

### 6.1 Thong so ky thuat

| Chi so | Gia tri |
|---|---|
| Kich thuoc | 12,915 bytes |
| So dong | 427 |
| So ky tu | ~12,503 |
| Nguon tao | Ruflo / Claude Flow generated |

### 6.2 Cac muc chinh

| Muc | Noi dung |
|---|---|
| Project Overview | "Claude Flow powered project", TypeScript/Node.js, DDD |
| Agent Coordination | Hierarchical swarm, max 8 agents, raft consensus |
| Available Skills | 6 skills (swarm, memory, sparc, security, perf, github) |
| Agent Types | 5 types (researcher, architect, coder, tester, reviewer) |
| Execution Model | claude-flow = LEDGER, Codex = EXECUTOR |
| Ruflo+Codex Workflow | 12-step workflow (Recall→Publish) |
| Concurrency Invariants | One-writer-per-worktree, authority invariants |
| Repository Harness | Lease/claim semantics |
| MCP Integration | 4 tools listed (swarm_init, memory_store, memory_search, task_orchestrate) |
| Code Standards | /src, /tests, /docs, /config; files <500 lines |
| Security | No secrets, input validation, parameterized queries |
| Memory System | @claude-flow/cli memory store/search |
| Performance Targets | HNSW 150x-12500x, MCP <100ms, CLI <500ms, SONA <0.05ms |
| Testing | TDD London School, 80% min coverage |
| Hooks System | Core, Session, Intelligence hooks |
| Background Workers | 12 workers (ultralearn, optimize, etc.) |
| Intelligence System | SONA, MoE, HNSW, EWC++, Flash Attention |

### 6.3 Audit Moi Rule

| Rule/Section | Verdict | Ly do |
|---|---|---|
| TypeScript/Node.js assumptions | **ADAPT** | BOOT-001 canonical stack is Node + TypeScript; `AGENTS.md` assumes TS/Node, which is broadly compatible |
| DDD/bounded-context | **ADAPT** | Phu hop voi ARCHITECTURE_CONSTITITUTION nhung can verify runtime |
| Hierarchical topology | **DEFER** | Confirm only after runtime verification |
| Max agents = 8 | **DEFER** | Static config — can runtime verification |
| Raft/consensus | **DEFER / CANDIDATE_REMOVE** | May not fit single-agent Codex context; defer pending runtime/architecture decision |
| Swarm thresholds (3+ files) | **DEFER** | Runtime verification required |
| Test philosophy (London School TDD) | **NEEDS_EVIDENCE / CANDIDATE_REMOVE** | Canonical testing approach is not proven to require London-school TDD in this repo |
| Coverage 80% min | **NEEDS_EVIDENCE** | Coverage requirement is stated in AGENTS.md; actual enforced threshold is unverified |
| Path conventions (/src, /tests) | **DEFER** | Product code does not exist yet; conventions may change |
| Performance targets | **DEFER** | Ruflo-internal metrics — need to verify if applicable |
| Static MCP tool list | **REMOVE** | Do not treat as authority — MCP tools are runtime-discovered |
| Static agent types | **REMOVE** | Do not treat as authority — roles are delivery-driven |
| Hooks/workers system | **DEFER** | Runtime verification required |
| Git destructive-action guardrails | **KEEP** | Retain only as safety constraints prohibiting unauthorized commit/push/merge/release |
| Publish behavior | **KEEP** | Appropriate guardrails |
| "DON'T STOP after claude-flow commands" | **REMOVE** | Dangerous — may cause premature action |
| Generic security rules | **ADAPT** | Keep as general constraints; exact enforcement model is unverified |
| Commit message format | **DEFER** | Keep unless an actual repository policy mandates it |

---

## 7. Suspected Control-Plane Overlaps

### 7.1 Doi chieu quyen luc

| Trach nhiem | He thong hien co | Co the conflict? |
|---|---|---|
| Task decomposition | Bernstein (templates), Ruflo (AGENTS.md) | TEMPLATE_ONLY khong conflict |
| Agent lifecycle | Ruflo (.claude-flow), Bernstein (templates) | TEMPLATE_ONLY khong conflict |
| Role resolution | Ruflo (AGENTS.md), Bernstein (templates) | TEMPLATE_ONLY khong conflict |
| Model routing | Codex (.codex/config.toml), Ruflo (.agents/config.toml), Bernstein (templates), 9Router (absent) | **POTENTIAL** — 3 layers can influence model |
| Memory | Ruflo (.claude-flow), Bernstein (templates) | TEMPLATE_ONLY khong conflict |
| Policy | **UNKNOWN** | Owner not proven from static evidence; requires runtime verification |
| MCP authority | **UNKNOWN** | Config declares Ruflo MCP server; active runtime authority not proven statically |

### 7.2 Naming chaos

Co 5 ten khac nhau cho framework orchestration hien tai:
1. **Ruflo** — PROTOCOL, investigation scope
2. **Claude Flow** — AGENTS.md header
3. **@claude-flow/cli** — npm commands
4. **.claude-flow** — directory name
5. **ruflo@3.42.4** — actual npm package

No Human naming decision is required before Phase 2; upstream/runtime lineage verification comes first.

---

## 8. Runtime Questions that Phase 1B Must Answer

### 8.1 Ruflo/Claude Flow

| Cau hoi | Uu tien |
|---|---|
| `@claude-flow/cli` da install chua? Phien ban? | P0 |
| `ruflo` MCP server co khoi dong duoc khong? | P0 |
| `swarm_init`, `memory_store`, `memory_search`, `task_orchestrate` co hoat dong khong? | P0 |
| Agent spawn tao Codex execution hay chi coordination state? | P0 |
| Policy mode "legacy" — ai duoc allow/deny? | P0 |
| Hooks co trigger duoc khong? | P1 |
| Background workers co chay khong? | P1 |
| SONA/HNSW neural intelligence co hoat dong khong? | P2 |

### 8.2 Model Routing

| Cau hoi | Uu tien |
|---|---|
| Codex CLI dang dung model nao thuc su? | P0 |
| 9Router co dang route model khong? | P0 |
| Subagent model khac main model khong? | P1 |
| Bernstein model routing co active khong? | P1 |

### 8.3 AGENTS.md Loading

| Cau hoi | Uu tien |
|---|---|
| AGENTS.md full 12,915 bytes co bi truncate khong? | P0 |
| Nested AGENTS.md co override khong? | P1 |
| .codex/AGENTS.override.md co effect khong? | P1 |

### 8.4 Bernstein Runtime

| Cau hoi | Uu tien |
|---|---|
| Bernstein CLI (v3.19.2) co duoc authorizd cho project nay khong? | P0 |
| Bernstein npx spawns (ruflo@3.42.4) — day la intentional hay side-effect? | P0 |
| Bernstein MCP tools co registered khong? | P1 |

### 8.5 Security

| Cau hoi | Uu tien |
|---|---|
| .codex/config.toml (sandbox=danger-full-access, approval=never) — day co phai local override hay active? | P0 |
| Bernstein adapter capabilities: [private_data, untrusted_input, external_comm] — ai authorize? | P0 |
| Co secret exposure risk tu MCP tools khong? | P0 |

---

## 9. NEEDS_EVIDENCE List

| ID | Noi dung | Ly do |
|---|---|---|
| NE-1 | Bernstein historical operational failure reason | Khong tim thay trong repository |
| NE-2 | 9Router config and routing status | Khong co config file trong repo |
| NE-3 | Effective AGENTS.md truncation behavior | Can runtime measurement |
| NE-4 | Whether `@claude-flow/cli` is installed and version | Phien ban tren may chua xac nhan |
| NE-5 | Actual executing model (not configured model) | Config ≠ runtime truth |
| NE-6 | Whether Ruflo agent spawn creates real execution | Can runtime verification |
| NE-7 | Whether hooks/workers are active | Can runtime verification |
| NE-8 | Whether .codex/config.toml (danger-full-access) is current local override | Gitignored, can't verify from repo alone |
| NE-9 | Bernstein v3.19.2 installation authorization | CLI present on machine, authority unclear |
| NE-10 | npx ruflo@3.42.4 MCP spawn instances — intentional or residual? | 3 instances running during investigation |

---

## 9.5 Secret-Safety Accounting

Phase 1A followed the secret-safety rule from PROTOCOL Section 5.

| File / Config | Opened into model context? | Evidence method |
|---|---|---|
| `AGENTS.md` | Yes | Read as public instruction file |
| `.agents/config.toml` | Yes | Read with credential-key regex redaction; only policy/model settings inspected |
| `.codex/config.toml` | **NEEDS_EVIDENCE** | Declared local-only + gitignored; no secret value is reproduced in the report; prohibit direct raw-config reading in Phase 1B |
| `.codex/AGENTS.override.md` | Yes | Read as public instruction file; contains no secrets |
| `.claude-flow/policy/state.json` | Yes | Reviewed for policy receipts/outcomes; receipt payloads did not contain secret values |
| `~/.codex/config.toml` | No | Not opened; only existence noted if relevant |
| `~/.claude/CLAUDE.md` | No | Not opened |
| 9Router config files | No | Not found in repo |

## 10. Before / After Mutation Manifests

### 10.1 Before (2026-09-20, truoc Phase 1A)

| Item | Gia tri |
|---|---|
| Branch | `main` |
| HEAD | `957deda3fb0a305a4620ca4b67525624c5776068` |
| Working tree | Clean |
| `AGENTS.md` SHA-256 | `8DC9689CFE10797B8E51B8F0A5843070BA937B6E0A0004C0615724DC4BE52035` |
| `.agents/config.toml` SHA-256 | `DB0D68B1DBEDE0C8255F55E25521159B1433E30CDDB2FBBC5539EA855B73679F` |
| `.codex/config.toml` SHA-256 | `FE5055EB3CF3F869D3B6B1344620AF5A412ACC505EEAAF997B36E72B0F51346A` |
| `.codex/AGENTS.override.md` SHA-256 | `2033EA4B75155BF5822E6BB89A2F564A4A018D6C102C11AA5530F5D27D7C95F5` |
| `.claude-flow/agents/store.json` SHA-256 | `DD50891CCF2585A4ECC95CF642BA7D1CF4E3746339CD5BCB58B7312A06182DB4` |
| `.claude-flow/policy/state.json` SHA-256 | `9F87B5A79230E5E4332E55A5E001862C297C7DC7155867A96585473A5F02F1D6` |

### 10.2 After (2026-09-20, sau Phase 1A)

| Item | Gia tri |
|---|---|
| Branch | `main` |
| HEAD | `957deda3fb0a305a4620ca4b67525624c5776068` |
| Working tree | Untracked file: `docs/project/ruflo-readiness/01a-repository-forensics.md` |
| Repo mutation | **NONE** — only new investigation artifact |
| Unexpected side effects | 3x `ruflo@3.42.4 mcp start` descendants of live Codex CLI sessions; no orphaned Ruflo MCP processes observed; no Bernstein process-tree link observed (see Section 10.3) — xem Section 10.3) |

### 10.3 Process-Tree Evidence (Human-Provided Authoritative)

Three live Ruflo MCP processes using `ruflo@3.42.4 mcp start` were observed:

| Ruflo MCP PID | cmd.exe PID | Codex CLI PID | Codex session | Status |
|---|---|---|---|---|
| 31672 | 8100 | 30776 | initial session | Alive |
| 18280 | 28588 | 18384 | `codex resume` | Alive |
| 420 | 29664 | 27520 | `codex resume <session-id>` | Alive |

**Interpretation:**
- Each Ruflo MCP process is a descendant of a separate live Codex CLI process/session.
- No observed Ruflo MCP process was orphaned at inspection time.
- No process-tree evidence links these Ruflo MCP processes to Bernstein.
- Evidence supports the hypothesis: Ruflo MCP is launched per Codex CLI session.
- Whether the Ruflo child exits when its Codex parent exits remains **NEEDS_EVIDENCE**.
- No process termination was performed during Phase 1A.
- The prior `bernstein --help` probe did NOT spawn these processes; that was an incorrect initial attribution.
## 11. Exit Criteria

| Tieu chi | Dat? |
|---|---|
| Repository structure reconstructed | Yes |
| All config files inspected | Yes |
| Active vs legacy assets classified | Yes |
| Bernstein/BMad/Antigravity/Ruflo responsibility mapped | Yes |
| Role/skill/template inventoryed | Yes |
| Model routing static map created | Yes |
| AGENTS.md audited | Yes |
| Control-plane overlaps identified | Yes |
| Runtime questions for Phase 1B listed | Yes |
| NEEDS_EVIDENCE list complete | Yes |
| Before/after mutation manifests recorded | Yes |
| Unexpected side effects recorded | Yes |
| No product code modified | Yes |
| No canonical docs modified | Yes |

---

## 12. Human Gate — Yeu Cau Duyet

Truoc khi bat dau Phase 1B, nguoi duyet can xac nhan:

1. **Bao cao nay co chinh xac khong?** — Kiem tra ket cau repo, phan loai legacy/active, Bernstein status.
2. **Side-effect tu Bernstein CLI** — 3 instances `npx ruflo@3.42.4 mcp start` dang chay. Quyet dinh: terminate hay keep?
3. **9Router evidence** — Khong co sanitized 9Router evidence trong repo. Can cung cap truoc Phase 1B?
4. **Runtime commands duoc approve** — Nhung lenh nao duoc phep chay trong Phase 1B?
5. **Naming decision** — "Ruflo" hay "Claude Flow" hay "ruflo" — framework ten la gi? Can quyet dinh truoc Phase 2.

---

**STOP. Do NOT begin Phase 1B.**

