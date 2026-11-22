# Hybrid Extension Preview

The persistent preview owns a separate local pilot database from the Sales Operator. It is running as:

```text
Fixture pages: http://127.0.0.1:54582
Operator: http://127.0.0.1:54567/v1/operator
Preview manifest: D:\AI-for-Enterprise\r415-private\hybrid-preview\manifest.json
```

Start/status/stop from `product/`:

```powershell
$env:TEMP='D:\AI-for-Enterprise\r415-private'; $env:TMP=$env:TEMP; $env:R415_PRIVATE_ROOT='D:\AI-for-Enterprise\r415-private'
node scripts/hybrid-browser/preview.mjs start
node scripts/hybrid-browser/preview.mjs status
node scripts/hybrid-browser/preview.mjs stop
```

`preview.mjs` starts the supported private synthetic pilot, then a loopback fabricated fixture page server. The page paths are `/pancake/fixture-page-pancake?c_id=fixture-conversation-pancake`, `/meta/manage?act=act_123&selected_campaign_ids=fixture-campaign-ads` and `/crm/contacts/fixture-account-crm/record/0-1/fixture-contact-crm`. It does not persist raw page text or contact data.

The MV3 package is built with `node scripts/hybrid-browser/package.mjs D:\AI-for-Enterprise\r415-private\hybrid-package --fixture`; its ZIP hash is the previously verified `856464a638708f252ad69db0aed37ddbf34a5ae40be1b9a8d1d7f0c29ac946df`. Load only the unpacked local package in a disposable Chromium profile. The extension has activeTab/scripting/storage and optional debugger permission; debugger diagnostics require explicit activation.

The Admin account can issue a scoped enrollment through `POST /v1/integration/enrollments` using the authenticated Operator session and CSRF token. Configure that signed enrollment in the extension popup with the preview Operator origin, mark it fixture mode, then visit each fixture path. Uploading sends minimized browser context to the local Nest endpoint and stores a durable receipt. The API/SDK provider path remains emulator-only; no external provider calls occur. Browser authority stays UNVERIFIED and completeness stays UNKNOWN. Duplicate capture IDs are deduplicated; no Lead is created automatically.

Coexistence with Pancake V2 or AdsMeta production extensions is NOT VERIFIED. Do not load this preview with real account tabs or production cookies.
