# Connector and Agent Skills evaluation

**Document class:** Non-canonical research artifact
**Prepared:** 2026-11-13
**Scope:** Source-level evaluation of connector/integration frameworks and Agent Skills/MCP repositories named by the decision-demand brief.
**Decision status:** Recommendation for bounded research and architecture planning only; no production approval, live verification, credential use, installation, or execution is implied.

## 1. Evidence boundary and method

This review uses public repository source/metadata and official documentation pages available on 2026-11-13. It did not install, import, execute, invoke, or connect any reviewed skill, MCP server, connector, workflow, or provider. No credentials, customer data, private endpoints, or live provider calls were used. Repository metadata (stars, issue counts, latest push) is maintenance context, not proof of correctness or security.

A claim is classified as:

- **Observed source evidence:** visible in a repository license, README, security policy, CI/workflow inventory, or official documentation page.
- **Derived assessment:** an engineering implication from observed source evidence (for example, a distributed worker topology increases operational surface).
- **Unknown:** not established by the supplied source; absence of evidence is not evidence of absence.

The reviewed commit/metadata references are reproducibility anchors, not a claim that the exact current default branch is production-safe:

| Candidate | Source | Default branch | License signal | GitHub metadata observed 2026-11-13 |
|---|---|---:|---|---|
| Airbyte | https://github.com/airbytehq/airbyte | `master` | `LICENSE` is Elastic License 2.0 (ELv2) | 22,373 stars; 5,461 forks; 2,733 open issues; pushed 2026-11-13 |
| Nango | https://github.com/NangoHQ/nango | `master` | `LICENSE` is ELv2 | 13,219 stars; 1,531 forks; 140 open issues; pushed 2026-11-13 |
| n8n | https://github.com/n8n-io/n8n | `master` | `LICENSE.md` is Sustainable Use License 1.0; EE material has separate terms | 210,379 stars; 61,498 forks; 1,215 open issues; pushed 2026-11-13 |
| Activepieces | https://github.com/activepieces/activepieces | `main` | `LICENSE` states MIT outside `ee/`; `ee/` has separate license | 25,513 stars; 4,464 forks; 932 open issues; pushed 2026-11-13 |
| Meltano | https://github.com/meltano/meltano | `main` | `LICENSE` is MIT | 2,679 stars; 281 forks; 169 open issues; pushed 2026-11-13 |
| Chatwoot | https://github.com/chatwoot/chatwoot | `develop` | `LICENSE`: MIT outside `enterprise/`; enterprise has separate terms | 39,787 stars; 9,667 forks; 1,599 open issues; pushed 2026-11-13 |
| MCP servers | https://github.com/modelcontextprotocol/servers | `main` | README/source states transition from MIT to Apache-2.0; docs CC-BY-4.0; contribution-level provenance matters | 91,969 stars; 11,961 forks; 18 open issues; pushed 2026-11-12 |
| Anthropic skills | https://github.com/Anthropic/skills | `main` | README/source describes directory-specific licensing; many document skills Apache-2.0 | Source/revision independently unverified in this checkpoint |
| Agent Skills specification | https://github.com/agentskills/agentskills | `main` | Apache-2.0 source; documentation may be CC-BY-4.0 and directory-specific terms can apply | 27,258 stars; 2,031 forks; 125 open issues; pushed 2026-11-04 |
| Google skills | https://github.com/google/skills plus the three supplied Data Manager skill paths | `main` (exact revision unavailable) | Unknown pending retrieval | No installation or execution |

The metadata was queried through the GitHub API; source links above are the durable review references. GitHub's SPDX field reported `NOASSERTION` for several repositories even where the repository license file was directly inspected; the license-file text is authoritative for this report's limited assessment.

## 2. Evaluation criteria

Each candidate is assessed against the requested dimensions:

1. **License/commercial reuse:** whether embedding, redistribution, hosted service, or copied components are clearly permissible; directory and third-party exceptions remain separate.
2. **Maintenance:** release activity, CI/security workflow signals, and repository scope. Activity is not a security or correctness guarantee.
3. **Security:** source/security policy signals, execution model, secret exposure, and major review obligations.
4. **Tenant isolation:** whether tenant/workspace identity and authorization can be made an explicit boundary rather than inherited from a single deployment.
5. **Credential custody/OAuth:** ownership, encryption, token audience, rotation/revocation, and provider-specific consent remain implementation obligations unless directly established.
6. **State/replay:** cursors, checkpoints, execution history, idempotency, ordering, replay and reset semantics.
7. **Tests/CI:** visible test and CI/security automation signals; not independently run here.
8. **Embedding/operational complexity:** process topology, queues, databases, workers, storage, upgrades, and failure modes.
9. **Modular-monolith fit:** whether a bounded adapter/library can fit North Star without importing a second business/event/workflow authority.
10. **Verdict:** `REFERENCE`, `ADAPT`, `ADOPT`, or `REJECT`. `ADOPT` means only a narrowly bounded, separately approved use—not unrestricted production inclusion.

## 3. Candidate assessments

### 3.1 Airbyte — **REFERENCE**

**Source-level evidence**

- The repository is a large connector platform with `airbyte-cdk`, connector integrations, connector CI, connector compatibility tests, CodeQL, Dependabot, and multiple build/test workflows in `.github/workflows`.
- The repository `LICENSE` is ELv2. ELv2 grants broad use/copy/distribution rights but prohibits providing the software to third parties as a hosted or managed service where users access a substantial set of its functionality; license-key and notice protections may not be removed or bypassed.
- The source layout demonstrates a broad connector runtime and image/build ecosystem, not a small TypeScript library.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | **Blocking for embedding.** ELv2 requires legal review before incorporating Airbyte runtime or exposing substantial Airbyte functionality in North Star's commercial SaaS. Connector-specific and third-party licenses also require inventory. |
| Maintenance | Strong activity and extensive CI/security workflow inventory observed. Large issue volume and wide surface increase upgrade/review burden; stars do not establish correctness. |
| Security | CodeQL/Dependabot and connector CI are positive process signals. Connector images and third-party connector code create a large trust boundary; no claim of complete supply-chain or tenant-security proof. |
| Tenant isolation | Airbyte has workspace/connection concepts, but source-level presence does not prove North Star-compatible per-tenant authorization, row-level isolation, cache isolation, or worker isolation. Must not inherit its workspace identity as canonical tenant authority. |
| Credential custody/OAuth | Connector/provider auth is a central capability, but exact custody, encryption-key ownership, OAuth refresh/revocation and token audience behavior for each selected connector remain provider/version-specific unknowns. |
| State/replay | Incremental streams, state/cursor, backfill and schema-drift machinery are strong **reference patterns**. They do not by themselves supply North Star's immutable raw envelope, evidence provenance, idempotency, or commercial-event semantics. |
| Tests/CI | Extensive connector compatibility/build/test workflows and CodeQL are observed; tests were not executed and coverage of every connector is unknown. |
| Embedding/operations | High. Connector images, workers, orchestration, schema/catalog management, upgrades and operational data plane are a second platform. |
| Modular-monolith fit | Poor as an embedded subsystem; good as an architectural reference for a thin adapter's cursor/checkpoint and contract-test design. |
| Verdict | **REFERENCE.** Extract patterns only: stream state, backfill boundaries, connector contract fixtures, retry classification, and schema-drift quarantine. Do not embed the Airbyte platform in PH4. |

**Required gate before any future ADAPT proposal:** legal review of ELv2 and all connector dependencies; exact connector source audit; tenant/credential threat model; isolated contract tests; explicit raw-envelope and replay mapping; operational cost and failure rehearsal.

### 3.2 Nango — **REFERENCE**

**Source-level evidence**

- Nango is presented as an OAuth/connection and sync framework. Repository structure includes packages, provider-scope synchronization workflows, client tests, validation and deployment workflows, and `SECURITY.md`.
- `LICENSE` is ELv2 with the same hosted/managed-service and license-key limitations described above.
- Nango's intended abstractions are useful for connection lifecycle, provider auth, syncs and webhooks, but the review did not run the service or inspect a tenant under load.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | **Blocking/uncertain for SaaS embedding.** ELv2 hosted-service restriction requires counsel; do not assume a commercial connector SaaS can embed or expose Nango functionality. |
| Maintenance | Active release/deploy/CLI/client-test workflow signals and a private vulnerability-reporting process were observed. |
| Security | SECURITY.md requests private advisories and limits testing to owned instances/accounts. This is a reporting process, not proof of complete isolation or token safety. OAuth proxy/confused-deputy risks require independent review. |
| Tenant isolation | Connection/user/provider concepts are promising, but North Star must prove workspace binding at every read/write, callback, sync, webhook and cache boundary. No source review here establishes that it satisfies I-09. |
| Credential custody/OAuth | Best candidate in this set for **reference** on OAuth connection lifecycle, scopes and refresh handling. Custody, encryption key ownership, revocation and provider-specific token audience remain deployment/version questions. Never let a provider credential become canonical commercial identity. |
| State/replay | Sync state/cursors and webhook processing are relevant patterns; exact replay, ordering, duplicate handling and reset semantics remain unverified without running source tests or a controlled instance. |
| Tests/CI | Client/tests, validation and deployment workflows are visible; no tests were run. |
| Embedding/operations | Medium-to-high: API/service, database, workers/sync scheduler, provider definitions, secrets, callbacks and upgrades. |
| Modular-monolith fit | A narrow connection-port pattern could fit; the full Nango service would add a second integration authority and operational plane. |
| Verdict | **REFERENCE.** Use concepts to shape a North Star `Connection` port and OAuth lifecycle; do not import the service or claim ADAPT until license and tenant-security gates pass. |

### 3.3 n8n — **REFERENCE** (not an embedded runtime)

**Source-level evidence**

- `LICENSE.md` is Sustainable Use License 1.0. Internal business use is permitted, but commercial distribution/resale or providing the software to customers is restricted; EE paths have a separate license.
- The repository contains extensive workflow, database, queue, E2E, security, SBOM and release CI. The official queue-mode documentation states that main instances enqueue executions to Redis, workers execute them, results are stored in a database, all instances share encryption configuration, and scalable binary data may need shared/external storage.
- n8n's breadth and workflow execution semantics are materially broader than North Star's canonical commercial-event pipeline.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | **Commercial embedding blocker.** Sustainable Use License restrictions must be reviewed before distribution or customer-facing hosted functionality; do not rely on the MIT/Apache licenses of individual nodes to clear the platform. |
| Maintenance | Very active repository with broad CI, E2E, security scans, SBOM and release automation. High velocity increases upgrade and compatibility review needs. |
| Security | Security workflows and SECURITY.md are positive signals. Workflow nodes can execute arbitrary integrations/data transformations; untrusted workflow authoring, expression evaluation, credentials, webhooks and SSRF/secret exfiltration require an independent threat model. |
| Tenant isolation | Instance/project/credential controls are not evidence of North Star's workspace-scoped authorization. A shared workflow runtime would need hard tenant context propagation and resource quotas; no such claim is made here. |
| Credential custody/OAuth | Broad credential and OAuth support exists at product level; exact custody, encryption key separation, revocation, provider scope and per-tenant callback routing need version-specific verification. |
| State/replay | Queue executions persist state/results across Redis, database and binary storage; queue-mode docs make this distributed state explicit. This is useful operational reference but not equivalent to append-only commercial evidence or deterministic replay. |
| Tests/CI | Extensive CI/E2E/security/SBOM workflows observed; not executed. |
| Embedding/operations | Very high: main, workers, Redis, database, webhooks, shared encryption keys, binary storage, load balancing, upgrades and observability. |
| Modular-monolith fit | Poor. It would create a second workflow engine and business-action authority. |
| Verdict | **REFERENCE.** Study node contracts, retry/error UX and operational failure handling. Reject embedding or customer-facing n8n runtime in this checkpoint. |

### 3.4 Activepieces — **REFERENCE**

**Source-level evidence**

- Repository source has `LICENSE` stating MIT outside `ee/`, with enterprise material under a separate license; it has piece packages, OAuth/action/trigger code, cloud/self-hosted release workflows, E2E/agent tests, and security workflow signals.
- Piece-based connectors and triggers are architecturally closer to a modular adapter catalog than a full data warehouse, but execution, auth and scheduling still form a workflow runtime.
- The review could not fetch the public documentation host reliably; conclusions therefore remain source-level and conservative.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | MIT portions are permissive with notice retention, but `ee/` and third-party components are separate. No broad reuse claim may be made without path-level license inventory. |
| Maintenance | Active release/self-hosted/piece/test/E2E workflows observed. Large piece catalog increases dependency and review surface. |
| Security | SECURITY.md provides coordinated disclosure expectations. Pieces execute provider calls and may process secrets/data; every piece and transitive dependency needs review. No claim of North Star-grade isolation. |
| Tenant isolation | Workspace/project concepts may exist, but source evidence here does not establish end-to-end workspace authorization through triggers, OAuth callbacks, execution payloads, queues, logs and retries. |
| Credential custody/OAuth | OAuth/action/trigger abstractions are useful references; exact secret storage, encryption, rotation, revocation and tenant callback binding remain unknown. |
| State/replay | Trigger/polling/execution patterns are present; deterministic replay and immutable evidence semantics are not established. |
| Tests/CI | CI, E2E, piece release and validation workflows observed; not executed. |
| Embedding/operations | High if the workflow executor is embedded: workers, scheduling, queues, logs, retries and piece lifecycle. Lower for copying a small, separately audited piece contract. |
| Modular-monolith fit | Moderate for **patterns**, poor for full executor. Adapter contracts must remain inside North Star ports and anti-corruption boundaries. |
| Verdict | **REFERENCE.** Consider ADAPT only for independently reviewed piece metadata/schema ideas; no runtime adoption. |

### 3.5 Meltano / Singer — **REFERENCE**

**Source-level evidence**

- Meltano repository is MIT-licensed and has Python source, integration tests, CI, CodeQL, dependency review and schema/lint workflows.
- Meltano/Singer's extractor/loader model and state files are relevant to incremental extraction and cursor checkpointing, but this is a data-pipeline model rather than a tenant-aware commercial interaction model.
- Singer taps/targets are independently licensed and independently maintained; a Meltano license does not clear every plugin.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | Core MIT is permissive, subject to notices and plugin-specific licenses. Plugin inventory is mandatory before reuse. |
| Maintenance | Active project and test/CI/security workflow signals observed; ecosystem maturity and individual tap maintenance vary. |
| Security | CodeQL/dependency review are positive process signals. Extractors can access broad credentials/data; subprocess/plugin execution creates a supply-chain and secret-redaction boundary. |
| Tenant isolation | Not a SaaS tenant-isolation solution. Project/environment separation must not be mistaken for per-workspace authorization or database/cache isolation. |
| Credential custody/OAuth | Pipeline configuration may reference credentials, but no claim of North Star-compatible custody, OAuth lifecycle or tenant-bound secret handling is established. |
| State/replay | Strong reference for state/cursor/checkpoint and incremental reset semantics. Singer messages and state are not automatically an immutable raw evidence envelope, and out-of-order/duplicate/replay rules require explicit design. |
| Tests/CI | Repository CI, integration tests and security/dependency workflows observed; plugin tests are uneven and were not run. |
| Embedding/operations | Medium-to-high: subprocesses, environment/config, state storage, scheduling and tap/target dependencies. |
| Modular-monolith fit | Good as a conceptual reference; poor as a direct runtime for commercial events and operator workflow. |
| Verdict | **REFERENCE.** Borrow cursor/state/reconciliation concepts only; implement a TypeScript-native, tenant-bound adapter port instead of embedding Meltano. |

### 3.6 Chatwoot — **REFERENCE**

**Source-level evidence**

- Chatwoot is a complete Rails/JS customer-support application with inboxes, conversations, contacts, assignments and webhooks. Its source license is MIT outside `enterprise/`; enterprise and third-party components have separate terms.
- The repository includes tests, RSpec, frontend tests, dependency/security workflows, Docker/deployment assets and a coordinated vulnerability process.
- Chatwoot is a workflow/reference application, not a drop-in North Star domain model.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | Core MIT is permissive; `enterprise/` and dependencies need separate review. Do not copy enterprise code or semantics without path-level approval. |
| Maintenance | Active, mature repository with broad test/deployment/security signals. Scope is large and Rails-specific. |
| Security | SECURITY.md prioritizes code execution, injection, authentication/authorization, XSS, CSRF and unauthorized administration; it requires testing only owned self-hosted instances. This is useful threat-model input, not proof of North Star security. |
| Tenant isolation | Inbox/account/workspace concepts are useful reference points. North Star must retain its own workspace-scoped RBAC, Lead-scoped access and canonical entity rules; no source-level equivalence is claimed. |
| Credential custody/OAuth | Channel integrations and OAuth/webhooks exist, but exact token custody, callback binding, provider scopes and revocation are version/deployment-specific. |
| State/replay | Conversation/message history and webhooks are useful reference patterns. Chatwoot history is not automatically North Star's immutable raw evidence or Commercial Event pipeline. |
| Tests/CI | Strong test and deployment workflow signals observed; not executed. |
| Embedding/operations | Very high as an application; Rails/Postgres/Redis/jobs/storage/frontend and upgrade burden. |
| Modular-monolith fit | Poor as embedded application; good as a bounded UX/domain reference for inbox, assignment, handoff and message timeline. |
| Verdict | **REFERENCE.** Study conversation/inbox/assignment abstractions and negative security tests; do not replace North Star's Lead/Journey/Obligation semantics. |

### 3.7 Model Context Protocol servers — **REFERENCE / ADAPT only per server**

**Source-level evidence**

- The official `modelcontextprotocol/servers` repository describes a small set of steering-group reference servers for education and SDK demonstration, not production deployment. It directs broader server discovery to the MCP Registry.
- The README states that most servers use stdio (client-started subprocesses), while the Everything server also supports Streamable HTTP and therefore has network-service concerns. It explicitly says implementers must add safeguards appropriate to their threat model.
- The repository is undergoing a license transition from MIT to Apache-2.0 for new/relicensed code; documentation contributions (excluding specifications) are CC-BY-4.0, and older contributions may remain MIT. Per-file provenance is required.
- The MCP authorization specification requires resource-server/client token audience binding, protected-resource metadata, OAuth authorization-server metadata, PKCE, HTTPS, state checking, and forbids token passthrough. STDIO implementations should generally obtain credentials from the environment rather than use HTTP authorization discovery.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | Mixed/provenance-sensitive. Do not treat the repository as one uniform license. Preserve file-level notices and contribution origin. |
| Maintenance | Active official repository, CI/release/security workflow signals observed. Reference status and broad ecosystem do not establish production hardening. |
| Security | Explicitly untrusted tool/server boundary. Stdio subprocesses inherit a client-controlled execution context; HTTP servers require OAuth audience validation, PKCE, HTTPS, state and anti-confused-deputy controls. Tool descriptions and outputs are not authorization. |
| Tenant isolation | Protocol has no automatic North Star workspace authorization. Every server/tool invocation must carry verified workspace context; never trust a model-supplied tenant ID or forward inbound bearer tokens downstream. |
| Credential custody/OAuth | MCP HTTP authorization specification is a strong reference for OAuth 2.1/resource indicators/PKCE; implementation and upstream provider credentials remain server responsibilities. Stdio environment credentials require process and log isolation. |
| State/replay | Protocol/session/tool semantics do not establish business idempotency, replay, ordering or evidence provenance. Each tool call needs a North Star command envelope and dedupe/audit policy. |
| Tests/CI | Official CI and SDK/example tests exist; individual server behavior and dependencies remain server-specific and were not executed. |
| Embedding/operations | Low for a tiny in-process adapter; high for arbitrary stdio subprocesses or HTTP servers due to process, network, sandbox, secret, timeout and tool lifecycle controls. |
| Modular-monolith fit | **ADAPT** the protocol boundary only after allowlist/schema/auth review. Do not adopt arbitrary servers or MCP Registry entries. |
| Verdict | **REFERENCE** repository examples; **ADAPT** MCP transport/schema ideas behind a North Star-owned, read-only/draft-only tool boundary. No unreviewed server installation or execution. |

### 3.8 Anthropic Agent Skills — **REFERENCE**

**Source-level evidence**

- `anthropics/skills` describes portable skill directories centered on `SKILL.md`, with optional scripts, references, templates and resources; it includes examples and a starter/specification-related template.
- The README warns that examples may behave differently in a real environment and should be tested before important use. Source-level material indicates Apache-2.0 licensing for many document skills, while directory-specific terms can differ.
- A skill can include executable scripts/resources. Loading a skill is therefore code/data execution authority, not merely documentation.

**Criterion findings**

| Dimension | Assessment |
|---|---|
| License | Must audit each skill directory and transitive dependency; many examples are Apache-2.0, but repository-level presence is not a blanket license grant. |
| Maintenance | High repository activity and broad community usage; large issue count and many skills imply per-skill review rather than blanket trust. |
| Security | Treat `SKILL.md`, scripts, templates and references as untrusted input until reviewed. Prompt injection, filesystem/network access, secret exfiltration and unsafe generated artifacts are material risks. |
| Tenant isolation | Skill format provides no tenant isolation. A skill cannot authorize access to tenant data; host application must enforce workspace/Lead-scoped capabilities at tool boundaries. |
| Credential custody/OAuth | No generic credential custody/OAuth guarantee. Skills must not receive raw provider tokens unless an explicitly scoped host tool mediates access. |
| State/replay | Format does not define durable state, idempotency, replay, audit or evidence semantics. Host must own append-only records and tool call trace. |
| Tests/CI | Repository workflows and examples are signals only; each skill script needs static review and isolated tests. No skills were installed or executed. |
| Embedding/operations | Low for static reviewed instructions; potentially high for scripts, generated files, network tools or data transformations. |
| Modular-monolith fit | Good as reviewed, project-specific instruction assets; never as a substitute for domain services or authorization. |
| Verdict | **REFERENCE.** May adapt the directory/metadata convention for a project-local, reviewed skill pack later. No community/example skill is enabled by this report. |

### 3.9 Agent Skills specification — **REFERENCE**

**Source-level evidence**

- `agentskills/agentskills` documents a portable format with a required `SKILL.md`, progressive disclosure, optional scripts/references/templates, and compatibility across agent clients.
- Source is Apache-2.0; documentation may carry CC-BY-4.0 and directory-specific terms.
- The format itself does not provide sandboxing, signature verification, tenant isolation, OAuth, credential custody, replay, or audit guarantees.

**Assessment and verdict:** **REFERENCE.** Adopt the metadata/progressive-disclosure *concept* only if North Star's own allowlist, static review, resource limits, no-secret-by-default policy, and verification checklist are implemented. Do not treat format compliance as security approval.

### 3.10 Google Data Manager skills — **DOCUMENTED / UNKNOWN for execution**

The supplied demand identifies `https://github.com/google/skills` and these exact Data Manager paths as official source inputs: `https://github.com/google/skills/tree/main/skills/ads/data-manager-api-setup`, `https://github.com/google/skills/tree/main/skills/ads/data-manager-api-event-ingestion`, and `https://github.com/google/skills/tree/main/skills/ads/data-manager-api-audience-ingestion`. Retrieval was **UNAVAILABLE** on 2026-11-14 in this environment, so exact revision, source files, license scope, scripts, tests, credential custody and security posture remain UNKNOWN. No skill was installed or executed.

**Verdict:** **DOCUMENTED source input only**; do not treat the skill paths as execution approval or provider contract evidence. Re-open after an exact source revision and static/security review are available.

### 3.11 Google skills retrieval boundary — **UNKNOWN / REJECT for current scope**

The exact Google-maintained source URLs are now recorded, but retrieval and exact revision authentication were unavailable in this environment. License, maintenance, security, tenant isolation, credential custody, OAuth, state/replay, tests/CI and embedding fit therefore remain **UNKNOWN**.

**Verdict:** **REJECT as an implementation input for this checkpoint** (not a claim that Google has no skills). Re-open only after an exact official revision and source-level license/security review are available.

## 4. Comparative decision matrix

| Candidate | License fit | Tenant/credential fit | State/replay value | Operational burden | Modular-monolith fit | Verdict |
|---|---|---|---|---|---|---|
| Airbyte | ELv2 hosted-service concern | Requires independent binding/custody proof | High reference value | Very high | Low as runtime | **REFERENCE** |
| Nango | ELv2 hosted-service concern | Best reference for OAuth/connection lifecycle, not proven fit | Medium/high reference value | High | Medium only as port pattern | **REFERENCE** |
| n8n | Sustainable Use commercial embedding concern | Workflow/secret boundary too broad | Medium reference value | Very high | Low | **REFERENCE** |
| Activepieces | MIT core; EE/dependencies separate | Piece auth/tenant boundary unproven | Medium reference value | High | Medium only as contract patterns | **REFERENCE** |
| Meltano/Singer | MIT core; plugin licenses vary | Not tenant-isolation solution | High cursor/state reference value | Medium/high | Medium as conceptual reference | **REFERENCE** |
| Chatwoot | MIT core; enterprise/dependencies separate | Useful inbox model, not canonical authority | Medium conversation-history reference | Very high as app | Low runtime / high UX reference | **REFERENCE** |
| MCP servers | Mixed MIT/Apache/CC-BY provenance | Protocol security requirements strong; server-specific isolation unknown | Low business-state value | Low-to-high depending transport | **ADAPT** protocol boundary only | **REFERENCE/ADAPT** |
| Google skills | Unknown until exact source retrieval | No intrinsic isolation/custody established | None intrinsic | Unknown | Unknown | **REJECT pending evidence** |
| Agent Skills spec | Apache-2.0 source; docs terms | No intrinsic security guarantees | None intrinsic | Low format, host controls required | Medium as local convention | **REFERENCE** |
| Google skills | Unknown until retrieval | Unknown | Unknown | Unknown | Unknown | **REJECT pending evidence** |

## 5. Recommended North Star posture

1. **Do not add a second connector/workflow platform to the modular monolith.** Keep canonical Commercial Events, Evidence, Policy, Action, Lead identity, workspace authorization and audit in North Star.
2. **Create a narrow connector port, not a framework dependency.** The port should accept verified workspace/connection context and produce an immutable raw envelope with source, provider, external IDs, observed/recorded timestamps, cursor/checkpoint, request correlation, redaction status, and explicit UNKNOWN/conflict outcomes.
3. **Borrow patterns selectively.**
   - Airbyte/Meltano: cursor/checkpoint, backfill, schema drift and reconciliation fixtures.
   - Nango: OAuth connection state, callback correlation, refresh/revocation lifecycle and provider-scope inventory.
   - Activepieces/n8n: trigger/action contract vocabulary and failure UX, not the execution runtime.
   - Chatwoot: inbox/conversation/assignment UX vocabulary, not canonical identity or outcome semantics.
   - MCP: typed tool schemas, resource indicators, PKCE, audience validation and no token passthrough.
   - Agent Skills: reviewed local workflow packaging and progressive disclosure only.
4. **Credential custody is host-owned.** Tokens must be tenant-bound, encrypted/isolated, redacted from logs, revocable, and unavailable to model text or arbitrary skills. Provider OAuth scopes and consent must be recorded per connection.
5. **Treat all third-party code as untrusted until reviewed.** Static review must cover scripts, subprocesses, network destinations, dependencies, generated files, permissions, license notices and prompt/tool injection paths. No unreviewed skills or MCP servers are installed/executed.
6. **Test boundaries, not vendor claims.** Minimum contract suite per connector: 401/403, 429, timeout/network loss, expired token, duplicate/out-of-order webhook, schema drift, partial batch, stale cursor, cross-tenant access, invalid evidence reference, cancellation and replay. Preserve raw fixtures and hashes.
7. **Keep release gates explicit.** Source review and contract tests can reach `CONTRACT_TESTED`; they do not reach `LIVE_VERIFIED` or `RELEASE_APPROVED` without credential-bound evidence and a separate security/tenant review.

## 6. Open questions / next probes

- Which exact provider connectors and read-only use cases are required for the first pilot?
- Does legal counsel permit use of ELv2 Airbyte/Nango or Sustainable Use n8n in the intended commercial SaaS distribution model?
- What is the selected secret manager and key hierarchy for tenant-bound OAuth tokens?
- What exact MCP transport is allowed (in-process, stdio subprocess, or HTTP), and what sandbox/resource limits apply?
- Should a project-local skill pack be created only after a reviewed `SKILL.md` schema, static scanner, allowlist, test harness and no-secret policy are approved?
- Which exact Google-maintained skills source is intended, if any?

These questions remain unresolved; this report does not resolve canonical decisions CE-1, CE-2, MM-1, ID-1, ID-2, PM-1 or LG-1.

## 7. Explicit non-claims

This report does not claim that any candidate is secure, production-ready, tenant-safe, compatible with North Star, live-verified, correctly licensed for the intended deployment, or behaviorally equivalent to a North Star adapter. It does not claim endpoint availability, OAuth success, replay correctness, schema stability, credential safety, data quality, revenue correctness or customer-data correctness. It does not authorize PH4, production deployment, private endpoint use, skill/MCP installation, or registry/canonical-document edits.
