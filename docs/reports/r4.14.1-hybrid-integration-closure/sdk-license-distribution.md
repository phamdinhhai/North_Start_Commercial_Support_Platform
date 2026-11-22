# SDK licenses and reproducibility

No dependency version or lockfile was upgraded for R4.14.1. Official SDK use remains local evaluation against fabricated emulators. Downloaded upstream repositories and installed node_modules remain outside tracked source. The installable MV3 package contains ten runtime files and does not include either SDK.

| Published package | Declared metadata | Shipped LICENSE SHA-256 | Distribution decision |
|---|---|---|---|
| @hubspot/api-client 14.1.3 | ISC | c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4 | Retain ISC/Apache-2.0 discrepancy; backend redistribution pending review |
| facebook-nodejs-business-sdk 27.0.0 | Platform License | 48d97b3c936203a750a3288c2b924327769d62327383a1060244b3d3c05ad01f | Meta Platform License and Platform Policy apply; backend redistribution pending review |

The exact registry artifact integrity pins remain in the committed lockfile and R4.14 `oss-implementation-ledger.json`. The installed LICENSE texts are retained in node_modules. No root NOTICE file is shipped by these installed packages; absence is recorded rather than inventing a notice grant. Any later redistribution must retain applicable LICENSE/NOTICE material and resolve the metadata conflict and platform restrictions. Source installation does not resolve rights by choosing the more convenient license label.

`node scripts/hybrid-browser/sdk-distribution-review.mjs` emits sanitized license digests and exits 2 while redistribution is unresolved. `--allow-review` permits inspection to complete with exit 0; its JSON still says `redistributionAllowed:false`. It is an audit command, not a legal approval or a packaging permission. No backend bundle or extension publication was performed. Gate R remains conditional for distribution, while SDK fixture execution is tested.

Five moderate development advisories are retained for review: @nestjs/cli and its glob/minimatch dependency chain, plus @typescript-eslint/parser and typescript-estree. Production audit is clean. They remain development tooling risk; there is no automatic upgrade, waiver or claim of a vulnerability-free full dependency tree. Production CycloneDX SBOM and full audit artifacts are retained privately with hashes in `verification.json`.

Independent clean worktree validation runs `npm ci --prefer-offline`, typecheck, build, focused tests and package generation with the committed lockfile. Package contents are inspected for SDKs, node_modules, credentials, cookies and private artifacts. Exact source SHA/tree and outcomes are recorded separately from earlier-source results in the verification manifest.
