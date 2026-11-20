# Synthetic source rehearsal and recovery

Use this only for invented fixture content in a new disposable loopback database. Do not use or edit the Project Owner synthetic-pilot manifest/database, forward fixture ports, grant a real provider token, or connect a real social account. The local fixture IdP is an account selector, not human identity assurance. R4.10 has no live receiver, polling service or provider writes.

From the R4.10 worktree product directory, install locked dependencies, build and run the signed source acceptance:

```powershell
npm ci
npm run build
$env:QA_DATABASE_URL = 'postgresql://<local-test-user>:<local-test-password>@127.0.0.1:<private-port>/qa_browser_source_<unique-suffix>'
npx playwright test --config playwright.source-integration.config.ts
```

The target database must already exist, be fresh, have an explicit loopback port and qa_browser_* name. The source harness migrates this disposable target and provisions only fabricated workspace/identity memberships, not business records. It binds app3420, IdP3421 and runner-secret control3422 on127.0.0.1. If these are occupied, stop and resolve ownership; never kill an unrelated process. The Playwright runner sets a random control secret and closes its fixture at completion. Test logs must not include database URLs, token/cookies or raw message content. Source and legacy OIDC acceptance use different databases/ports and run sequentially in CI.

Source controls are visible only to an authenticated admin when SOURCE_INTEGRATION_SYNTHETIC_ENABLED=true. Bootstrap additionally requires explicit DEPLOYMENT_MODE=local/test, AUTH_MODE=oidc, PILOT_STORE_MODE=postgres and nonproductionNODE_ENV. Production/pilot modes refuse this flag. The normal Owner launcher strips inherited configuration and leaves this feature off; do not change its allowlist just to enable the lab.

In the isolated source harness, sign in as fabricated admin. Create a Pancake synthetic connection with transport page synthetic-page-1 and a Meta Page connection with transport page synthetic-page. Import the provided examples. The Pancake preset contains explicit fabricated original Meta linkage; this is a demonstration input, not a provider-verified crosssource mapping. The presets align nativepage/message while keeping transport account/provider/route separate. Remove that linkage or change message ID for independent intake. Matching text never aligns identity.

The responsibility checkbox is initially clear. Selecting it is an explicit admin creation command that makes that admin owner only for a newly created episode. Replays/later observations cannot change owner. Use the existing handoff UI to propose responsibility to a Sales fixture; authenticated recipient can inspect source observations under current lead-scoped access. Unclaimed imports stay unassigned and can be reviewed by manager/admin. No automatic action/outcome is created.

Reimporting unchanged receipt returns receipt_duplicate with no extra evidence/Lead. A new receipt for the same native object retains another source observation under the same seed. Changed immutable receipt or explicit event collision returns409; preserve the original and correct the fixture identity deliberately. Source revocation is terminal locally and refuses further imports; accepted history remains inspectable under lead rights. UNKNOWN completeness, missing native event ID, no full sync and UNVERIFIED authority must remain visible. Transport receipt success never confirms payment, conversion or a complete history.

On failure, inspect categorical code/readiness, preserve accepted evidence and retry the same immutable receipt only after the cause is resolved. Do not invent a new receipt merely to bypass a collision. Audit failure rolls back the whole intake transaction; retry is safe. App/pool restart does not confer production key custody. Extended restore-rehearsal.mjs uses only generated disposable source/target databases, retains its generated key for that rehearsal, compares11tables and proves replay after restore; no production RPO/RTO or keybackup policy is established.

Migration018 rollback is allowed only with no source connections/native mappings/receipts. Nonempty history fails before DROP, keeping migration bookkeeping/history. Repair forward rather than dropping accepted evidence. Do not use reset/clean/down against the Owner pilot or shared databases. Real-data erasure is a separate unapproved governance problem, not a schema rollback operation.
