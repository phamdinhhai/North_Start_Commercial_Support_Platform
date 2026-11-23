# Reproduce local R4.14 acceptance

Use Node 22, npm 10+, installed Playwright Chromium and a disposable PostgreSQL
17 server bound to `127.0.0.1` on an explicit port. Keep temporary artifacts on
a drive with enough free space. Do not supply production `DATABASE_URL`,
Pancake credentials, cookies or customer records.

From `product/`:

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
npm run architecture:check:strict
npm run registry:validate
npm run security:audit
node --test scripts/hybrid-browser/runtime.test.mjs scripts/hybrid-browser/security.qa.test.mjs scripts/hybrid-browser/durable-e2e-policy.test.mjs
```

Create a private temporary directory, then point the combined rehearsal at the
disposable loopback PostgreSQL server. The example contains fabricated local
database credentials; use the credentials of your disposable server only.

```powershell
$taskTemp = 'D:\AI-for-Enterprise\r414-local-rehearsal'
New-Item -ItemType Directory -Force -Path $taskTemp | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:R414_TEMP_ROOT = $taskTemp
$env:TEST_DATABASE_URL = 'postgresql://postgres:fixture-password@127.0.0.1:55444/postgres'
node scripts/hybrid-browser/durable-e2e.mjs
```

The script creates a generated `qa_browser_r414_<hex>` database, applies the
existing migrations, starts its own Nest/OIDC fixture process and loads the
packaged extension in disposable Chromium. It drops only that generated
database and closes its own browser/backend. Verification and private fixture
logs remain in the task temporary directory. It never contacts a provider.

To build an unpacked local extension:

```powershell
node scripts/hybrid-browser/package.mjs "$taskTemp\extension" --fixture
```

Load that directory through Chromium's developer-mode **Load unpacked** action.
The fixture build permits loopback; omitting `--fixture` produces the ordinary
exact-origin optional-permission package. Neither build is store-published.
The local API remains fixture-only, and credentials for real providers are not
accepted by the SDK connector constructors.

For the PostgreSQL CI gate, supply a fresh empty `/north_start_ci` database on
the same disposable server, unset `DATABASE_URL`, set `CI=true`, then run
`npm run test:integration:ci` and `npm run test:cov -- --no-file-parallelism`.
The acceptance manifest records the exact commands and hashes of all 31 lanes.
