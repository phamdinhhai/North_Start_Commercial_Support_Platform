# Local runtime startup

The Owner pilot is running on the release candidate with an owned PostgreSQL cluster and loopback-only fixture IdP:

```text
Operator: http://127.0.0.1:51135/v1/operator
Readiness: http://127.0.0.1:51135/v1/health/readiness (HTTP 200)
```

The private manifest is retained at `D:\AI-for-Enterprise\r415-private\north-synthetic-pilot-c931fe4908db530c709cbec3d6fc8c40\manifest.json`. Its contents include generated passwords and digest keys and must stay local. A fabricated demonstration Lead named `DEMO - Studio La Xanh (FABRICATED)` is present in workspace `synthetic-c931fe4908db530c709cbec3d6fc8c40`.

The pilot uses `SYNTHETIC_PILOT_ONLY=true`, OIDC fixture authentication, PostgreSQL persistence, all 23 migration files and the synthetic source integration flag. Provider calls and mutations remain disabled. The supported process cleans inherited environment variables before starting Nest and binds PostgreSQL, OIDC, control and application to `127.0.0.1`.

Run commands from `product/` with the same temporary root used to create this pilot:

```powershell
$env:TEMP='D:\AI-for-Enterprise\r415-private'
$env:TMP=$env:TEMP
$pilotManifest='D:\AI-for-Enterprise\r415-private\north-synthetic-pilot-c931fe4908db530c709cbec3d6fc8c40\manifest.json'
node scripts/pilot/local.mjs status $pilotManifest
node scripts/pilot/local.mjs restart $pilotManifest
node scripts/pilot/local.mjs backup $pilotManifest
node scripts/pilot/local.mjs stop $pilotManifest
node scripts/pilot/local.mjs start $pilotManifest
```

Restart signs the browser out by design; committed PostgreSQL history remains. Do not run `reset`, `restore` or `rehearsal.mjs` while the Owner is working. Backup/restore is synthetic-only and the backup remains private.

The dedicated Hybrid Integration Preview owns a second pilot database and is currently available at:

```text
Fixture pages: http://127.0.0.1:54582/pancake/fixture-page-pancake?c_id=fixture-conversation-pancake
Operator:     http://127.0.0.1:54567/v1/operator
Manifest:     D:\AI-for-Enterprise\r415-private\hybrid-preview\manifest.json
```

Use `node scripts/hybrid-browser/preview.mjs status|stop` with `TEMP`/`TMP` set to the private D-drive root to control that second resource.
