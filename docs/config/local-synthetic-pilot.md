# Local synthetic pilot operator runbook

Windows / Node 22 / PostgreSQL 17 tools at `C:/Program Files/PostgreSQL/17/bin`.
This is an isolated local test resource, not a production IdP or deployment. Enter only invented text with no real person, customer, credentials or provider connection. No participants are invited by setup.

From `product/`:

```powershell
npm ci
npm run build
node --test scripts/pilot/safety.test.mjs
node scripts/pilot/local.mjs init
```

`init` prints the private OS-temp manifest path and loopback operator URL. Save the path locally as `$pilotManifest`; it contains generated credentials/digest keys and must never be pasted into chat, copied to the repository or committed. No `.env` is needed. Windows inheritance is removed and access is granted to the current OS user; privileged OS administrators remain trusted. PostgreSQL is a newly initialized private cluster; no existing service is touched. Ports are selected locally and recorded; a collision fails rather than falling back to another database. Run only one application instance per manifest. Keep the manifest and cluster together.

```powershell
$pilotManifest = '<printed OS-temp manifest path>'
node scripts/pilot/local.mjs status $pilotManifest
node scripts/pilot/local.mjs restart $pilotManifest
node scripts/pilot/local.mjs backup $pilotManifest
node scripts/pilot/local.mjs stop $pilotManifest
node scripts/pilot/local.mjs start $pilotManifest
```

`restart` closes/recreates the app with the same PostgreSQL history and digest keys. Sign in again after restart; browser sessions are intentionally process-local. `stop` closes the app and this private PostgreSQL cluster. `start` restarts both. `status` reports readiness without credentials. Read `application.log` / `postgres.log` only inside the private manifest directory when start fails. Do not upload these files without review. If an app crashes, use `stop` then `start`; no automated service manager or availability SLA is supplied.

The sign-in page says **Loopback fixture identity**. These are fabricated local accounts: owner/recipient=sales, viewer=viewer, bystander=manager, admin=admin, foreign=sales in another generated workspace. Memberships are provisioned server-side; IdP claims cannot choose commercial roles. There is no default token to paste. The fixture does not authenticate a human and is safe only on this machine. Do not expose/forward these ports or reuse it as a production IdP.

```powershell
node scripts/pilot/verify.mjs $pilotManifest
node scripts/pilot/local.mjs backup $pilotManifest
node scripts/pilot/local.mjs restore $pilotManifest
node scripts/pilot/local.mjs reset $pilotManifest
node scripts/pilot/local.mjs stop $pilotManifest
```

`verify` adds one explicitly fabricated synthetic lead through Chromium and exercises restart and fixture identities. It requires Playwright Chromium installed (`npm run test:browser:install`). `backup` writes a private custom-format dump. `restore` restores the last owned dump into a **new generated database**; `reset` creates a **new empty database** and initializes only fixture identities. Both retain the previous databases without truncation/deletion. Restored memberships, lead history and digest keys persist; no downgrade is run. The runtime DB role owns its isolated database for migrations but has no superuser/create-role/create-database/replication privilege; this is not production least-privilege separation. Backups include synthetic records only, no production retention/legal-hold claim. Backup key continuity depends on the private manifest; a dump alone is insufficient.

All application/IdP/PostgreSQL/control binds use `127.0.0.1`. The launcher discards inherited application/provider configuration and always sets `SYNTHETIC_PILOT_ONLY=true`; the root integration's server policy must enforce it before any human pilot. The launcher cannot detect whether a human types real personal information, so the no-real-data instruction remains mandatory. Foundations/outbound remain disabled. Gate B operator approval and Gate C real-data approval are separate; neither follows from this rehearsal.
