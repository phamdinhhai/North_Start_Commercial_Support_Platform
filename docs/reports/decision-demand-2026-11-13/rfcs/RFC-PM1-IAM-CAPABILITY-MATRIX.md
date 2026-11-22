# RFC-PM1 — IAM and Capability Matrix Proposal

**Status: Proposal only — non-canonical; pending human approval**
**Date:** 2026-11-13
**Decision owner:** Security + Product, with Engineering implementation review
**Scope:** PM-1 permissions and credential boundary for the LVP pilot

> This RFC does not resolve canonical PM-1, change a frozen invariant, or authorize production IAM. It is a review artifact under `docs/reports/`; no production IAM implementation is included.

## 1. Decision requested

Approve, reject, or revise a capability model that preserves I-09 (lead-scoped access) while making workspace, lead, raw-evidence, audit, export, delete, legal-hold, credential, and support capabilities explicit. Decide the credential/session model separately from the role names. Until approval, the current deny-by-default interim boundary remains the only permitted behavior.

## 2. Current implementation facts

- Canonical `OPEN_DECISIONS.md` keeps PM-1 open: only the Sales assigned-lead boundary is frozen; the detailed matrix is not.
- `product/src/infra/auth/auth.service.ts` currently has a bounded bootstrap path and development-only unsigned bearer parsing. Unsigned tokens are rejected outside local/development/test/demo deployments and cannot grant `admin` or `manager`. The demo header resolves to a `demo:*` sandbox only when explicitly enabled.
- `product/src/infra/rbac/rbac.service.ts` currently allows `admin`/`manager` workspace-wide lead view as an interim policy. `sales`/`viewer` require the lead owner or an actionable work recipient. Export and delete helpers currently return true only for `admin`.
- The current application records `ownerUserId` and per-work-item `actor`; an addressed recipient may view/accept that item, while mutation requires the current owner and assigned actor. These are implementation facts, not an approved complete matrix.
- No production credential/session, MFA/SSO, invite lifecycle, support-grant, or global capability policy is approved. No role expansion may be inferred from an upstream connector token.

**Evidence:** `docs/canonical/OPEN_DECISIONS.md` (PM-1); `docs/canonical/DOMAIN_INVARIANTS.md` (I-09); `docs/implementation-plan/03-requirements.md` (R-01–R-03, R-08, R-19, R-28); `product/src/infra/auth/auth.service.ts`; `product/src/infra/rbac/rbac.service.ts`; `product/src/ports/auth.ts`; `docs/reports/rebuild-baseline-2026-11-12/handoff.md`.

## 3. Proposed capability matrix (review draft)

The symbols are a proposal vocabulary only: **D** = deny by default, **S** = assigned-lead scope, **W** = workspace scope, **A** = explicit administrative approval, **H** = legal-hold/retention workflow only.

| Capability | Viewer | Sales | Manager | Admin | Support break-glass |
|---|---:|---:|---:|---:|---:|
| Authenticate and enter an approved workspace | S | S | W | W | A + time bound |
| List/read lead projection | S | S | W | W | A + case scope |
| Read raw conversation/evidence | D or S (Product choice) | S | W only for assigned exception | W + reason | A + reason |
| View audit history | S (own visible scope) | S | W | W | A + immutable audit |
| Create/update handoff | D | S | W or delegated | W | D unless approved |
| Accept addressed work | addressed item only | addressed item only | explicit delegation | explicit delegation | D |
| Complete/reschedule/stage/outcome mutation | D | current owner + item actor | explicit delegated scope | explicit delegated scope | D |
| Correct an outcome/assertion | D | D or second-review workflow | A + reason | A + reason | D |
| Export | D | D | A + approved scope | A + approved scope | A + ticket |
| Delete under approved policy | D | D | D | A + dual control | D |
| Place/release legal hold | D | D | request only | A + Legal authorization | D |
| Manage memberships/roles/credentials | D | D | request only | A | D |
| Configure connector scope/rotate secrets | D | D | request only | A + secret owner | D |
| Read synthetic/demo workspace | explicit demo sandbox only | explicit demo sandbox only | no cross-boundary access | no cross-boundary access | D |

### Proposed non-negotiable rules

1. Every request has one authenticated subject, one workspace context, and a server-derived capability decision; caller-supplied workspace/role fields never grant access.
2. A role is not a scope. Lead ownership, addressed work, temporary delegation, and support grants are separate predicates.
3. `admin` is not an automatic raw-evidence or export right without an auditable purpose, scope, and policy check.
4. Sensitive actions (raw evidence, export, delete, hold, credential, support) require explicit capability checks and append-only audit records; denial must fail closed.
5. Synthetic/demo data is visibly marked and cannot enter real-customer evidence analysis or cross the demo boundary.
6. Break-glass access, if approved, is time-limited, case-scoped, reason-coded, MFA-protected, and automatically audited; no standing support superuser is proposed.

## 4. Alternatives

- **A — Keep current interim policy:** fastest and least migration, but manager/admin workspace-wide view and dev credential paths remain unsuitable for real users. This is acceptable only for synthetic/local use.
- **B — Role matrix only:** centralize role checks but retain application-derived lead scope. Lower migration cost, but database/query mistakes can still create tenant exposure.
- **C — Hybrid capability + policy engine (proposed for review):** signed sessions/claims identify the actor; a server-side capability service evaluates role, workspace, lead, item, purpose, and policy; storage adds tenant defense-in-depth. Highest assurance, more migration and operational complexity.
- **D — External IdP/central authorization service:** strongest federation/audit potential, but adds dependency, provisioning, outage, and data-residency decisions that are not yet validated.

## 5. Security and migration impact

**Security impact:** Positive if approved and implemented as deny-by-default; it reduces privilege ambiguity and prevents upstream token scope from becoming product authorization. It also creates higher assurance requirements for session signing, key rotation, MFA, audit integrity, revocation, support grants, and authorization test coverage.

**Migration impact:**

1. Inventory existing users, workspace memberships, demo identities, bootstrap tokens, and any persisted actor IDs; do not infer missing ownership.
2. Introduce versioned membership/capability records and a credential migration with an emergency read-only path. Preserve old audit records; never rewrite actor history.
3. Replace unsigned development tokens before any real-data pilot; install a global authorization boundary and explicit route exceptions.
4. Add positive, negative, cross-workspace, recipient/owner, export/delete/hold, revocation, replay, session expiry, and pool/request-context tests.
5. Roll out in shadow-deny/report mode only for synthetic data, then enforce after Security sign-off. Rollback must disable new grants, not broaden access.

No migration or production code change is authorized by this RFC.

## 6. Unresolved questions

- Which credential model is approved: managed IdP/SSO, password plus MFA, invitation-only, or another provider? Who owns signing keys and revocation?
- Is Viewer allowed to read raw evidence, or only a redacted/context projection?
- Does Manager receive workspace-wide read, exception-only read, or delegated lead scope? Who may delegate?
- Is outcome correction two-person approval, and which roles may perform it?
- What exact legal basis and purpose code are required for export, delete, support access, and raw-evidence access?
- Are support grants allowed at all, and what customer consent, region, retention, and notification requirements apply?
- How are dormant users, departed users, shared accounts, service identities, and connector identities revoked?
- Which routes are public health/demo routes, and how is the exception list independently reviewed?

## 7. Required approvals and evidence

Required before implementation or real-data use:

- Security approval of the matrix, threat model, credential/session design, MFA, key custody, revocation, and test plan.
- Product approval of user workflows, role semantics, manager/support behavior, and the user-visible scope model.
- Engineering/DBA approval of storage/query enforcement and migration/rollback plan.
- Legal/privacy approval of raw-evidence access, export/delete, support access, consent/legal basis, jurisdiction, subprocessors, and retention dependencies.
- Independent security review and negative authorization test evidence, including cross-tenant and stale-session cases.

## 8. No-go conditions

Do not implement or enable real-data access if any of the following holds: PM-1 remains unapproved; unsigned/dev credentials can reach the deployment; caller input can select workspace, role, or lead scope; manager/admin privilege is expanded without a tested matrix; raw evidence/export/delete lacks purpose, audit, and approval; support access lacks consent/time bounds; revocation/MFA/key ownership is unknown; cross-workspace negative tests are absent; or an unresolved contradiction would require guessing ownership.

## 9. Evidence gaps

No evidence currently proves a production credential lifecycle, MFA/SSO, signed-session verification, key rotation/revocation, global guard coverage, complete route inventory, manager/admin least privilege, support-grant controls, or real-user authorization behavior. Local unit/E2E evidence is not production security proof. These gaps remain open and block promotion of this proposal.
