# License and dependency review — R4.14

The upstream evaluations were performed in `D:\AI-for-Enterprise\third-party-reuse-lab` at immutable commits. No upstream source was copied into North Start by this workstream. The existing North Start MV3 packager remains the packaging implementation; WXT and Chrome samples were used as references only.

| Source | Pin | License evidence | Decision |
|---|---|---|---|
| WXT | `c77cd7bcc4b08355b94f9d745f3e20d72b510782` | Root `LICENSE` is MIT; workspace requires Bun and a large toolchain | `REFERENCE_ONLY`; do not introduce a second browser build runtime |
| HubSpot Node SDK | `568703577905e19a0c2708e1beb06bdc016feb9e` | `package.json` declares ISC while root `LICENSE` contains Apache-2.0 | `REFERENCE_ONLY` here; preserve the contradiction and inspect the published tarball before dependency adoption |
| Standard Webhooks | `3d65b1824b6697f05a5a4584e7062bd23512fc8e` | Root spec Apache-2.0; libraries contain separate license terms | `REFERENCE_ONLY`; no webhook receiver enabled |
| Chrome extension samples | `7314683af84cf53179ee98fdaa0b24fd9326576a` | Repository/package license Apache-2.0 | `REFERENCE_ONLY`; no source copied |

The prior R4.10 review remains authoritative for AGPL, ELv2, Sustainable Use,
GPL and unlicensed candidates. Nango, n8n engine, Twenty/Frappe server code,
erxes, personal Zalo bridges and AIECOS scraping code remain excluded. This
workstream does not grant provider access or permission to redistribute upstream
software.

## Final integrated dependency/SBOM findings

The final R4.14 branch adopts `@hubspot/api-client@14.1.3` and
`facebook-nodejs-business-sdk@27.0.0`, with exact registry integrity and shipped
LICENSE digests in `oss-implementation-ledger.json`. The SDKs perform reads
against local provider emulators only. No upstream repository source is copied.
The shipped HubSpot LICENSE contains Apache-2.0 despite ISC npm metadata;
Meta's Platform License permits SDK use for Facebook services/APIs subject to
the Facebook Platform Policy. Neither is a general provider authorization.

`npm sbom --omit=dev --sbom-format cyclonedx --sbom-type application` generated
a CycloneDX 1.5 SBOM with 91 components. The retained private artifact is
`D:\AI-for-Enterprise\r414-private\production-sbom.cdx.json`, SHA-256
`b677820f6db8a0a60a18fc85cfd8b7e1bd470711e81f3e7e9d44dcb2e4f91199`.
Production audit is clean. Five moderate development advisories remain in the
full dependency tree; no automatic dependency upgrade or waiver was applied.

The following is the earlier isolated OSS specialist's dependency boundary;
the final adopted package list above supersedes its no-addition status.

## Isolated OSS workstream checks

The R4.14 worktree introduced no npm dependency and no lockfile change in this
OSS workstream. Existing product dependency audit is the applicable baseline.
A future official SDK adoption must include `npm ci`, `npm audit --omit=dev`,
`npm ls --all`, license inventory, notice handling and connector tests in the
same reviewed commit. Transitive dependencies must not be inferred from the
upstream repository manifest alone.

## Reuse decision

The safe reusable boundary is behavioral: deterministic MV3 packaging,
permission allowlisting, static module closure, and lifecycle test patterns.
North Start's existing `product/scripts/companion-package.mjs` implements those
controls and is retained. No WXT runtime, generated SDK source, webhook server,
or provider credentials were added by this workstream.

Status: `REFERENCE_ONLY`; no production integration claim.

HubSpot's manifest/root-license discrepancy is not resolved by selecting the
more convenient label. Any adopted published SDK must retain its shipped
license/NOTICE files and record the exact tarball integrity and declared
license separately. No source from this clone was incorporated here.

## Checks run

- `npm ci`: PASS; npm reports 5 moderate advisories in full dependency tree (not auto-fixed).
- `npm run typecheck`: PASS.
- `npm run security:audit`: PASS; production dependency set clean.
- `node --test scripts/companion-package.test.mjs: 7/7 PASS.
- `npm run companion:package`: PASS; deterministic MV3 archive, 9 files.
