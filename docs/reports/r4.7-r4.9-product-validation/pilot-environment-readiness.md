# ENV-01 local synthetic environment readiness

Baseline `08bdefaca792e34a2142a575db198e0ee5c8f45f`; Windows, Node22.21.0, PostgreSQL17.11. Audited AGENTS, canonical invariants/open decisions, ADR006/007/009, R4 reliability/lifecycle and R4.6 reliability/data-lifecycle/final-readiness evidence before implementation. Existing acceptance fixture correctly refuses reused business data and uses fixed ports; production main binds all interfaces. Neither is a persistent local pilot launcher. This work leaves those paths unchanged and composes the existing Nest app and local PKCE fixture protocol through new owned scripts.

Implemented: generated private OS-temp cluster, login role/database/workspaces/manifest/digest keys; SCRAM credentials generated at runtime; current-user Windows ACL; loopback binds; sanitized child environment; identity-only initialization once; durable restart; singleton PostgreSQL advisory lock; control secret not printed; fresh-database reset/restore; synthetic backup; no cloud/service/deployment/push. Operator commands and account role meanings: `docs/config/local-synthetic-pilot.md`.

Actual commands from `product/`:

```powershell
npm run build
node --test scripts/pilot/safety.test.mjs
node scripts/pilot/local.mjs init
node scripts/pilot/local.mjs status <manifest>
node scripts/pilot/verify.mjs <manifest>
node scripts/pilot/local.mjs backup <manifest>
node scripts/pilot/local.mjs restart <manifest>
node scripts/pilot/local.mjs restore <manifest>
node scripts/pilot/local.mjs reset <manifest>
node scripts/pilot/local.mjs stop <manifest>
```

Build PASS. Node safety tests3/3 PASS: refuses caller-selected customer/shared manifest paths, refuses arbitrary database selection, strips inherited DB/auth/provider secrets. Private fixture `a4eb58d502ef4d72a10df7afe9b5b6d6`: PostgreSQL59348, app59349, issuer59350 (loopback), runtime role restricted (all four privileged role flags false). Generated names are recorded only in the private manifest. ReadinessHTTP200. Chromium actual UI synthetic intake + app restart: leads2, memberships6, four base roles, owner/foreign workspace identity separation PASS. First verification attempt failed because it assumed browser sessions survive restart; corrected rehearsal signs in again, as required by the process-local browser session store. Lead persistence assertion was already passing.

`pg_dump` custom archive PASS. Restore into a NEW generated database PASS; direct SQL check: leads2, memberships6, migrations17. Reset into another NEW database PASS; previous databases retained; no destructive cleanup or existing-service interaction. Early init exposed inherited pipe behavior from pg_ctl: changed tool stdio to ignore so daemon handles cannot hold launcher output open; both early and final owned clusters were subsequently stopped. No secrets or DB artifacts tracked. All owned app/IdP/PG processes stopped at handover; launchable private manifests retained on this machine only.

Limits: fixture IdP is local-only and allows fabricated account selection without proving human identity. Runtime database owner is restricted from cluster administration but can run schema migrations; production role separation is not claimed. Database dump/restore does not prove disaster recovery/SLA. Local OS administrators are trusted; no encrypted-at-rest backup guarantee. Singleton is enforced by a database session lock plus bound local ports; no distributed service manager. No Sales adoption/value or representative participant evidence claimed. Gate B operator/owner acceptance remains pending and Gate C is NOT READY FOR REAL CUSTOMER DATA.

Integration requirement: launcher always forces `SYNTHETIC_PILOT_ONLY=true`; server-side root policy enforcement is required (requested from root) so an unchecked UI checkbox cannot produce a real-classified record. These scripts alone cannot prohibit a user typing actual PII; operator boundary forbids it. No real participant, live provider, raw research capture, outbound or attribution capability enabled.

Final operator checkpoint: requesting user explicitly volunteered to operate the synthetic pilot. This identifies the local operator; it does not approve an organizational human pilot, real accounts or invitations. Final stop/start after reset PASS; direct SQL leads0/memberships6 confirms fresh database identity-only initialization. A second concurrent `start` refused with `Pilot control port already in use` and left the original service intact. Final `stop` PASS. Runtime data directories retained outside git; none deleted.
