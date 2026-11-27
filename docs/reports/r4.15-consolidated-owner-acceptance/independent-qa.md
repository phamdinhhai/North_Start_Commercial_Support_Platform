# Independent QA

Independent runtime QA on the prior exact source completed the ten-step Sales smoke, supported `verify.mjs`, backup/status/stop and a dynamic-port OIDC pilot without provider calls. It reported no product defect. The final RC adds readiness coverage for migrations 018–023, enables the synthetic source flag in the supported runtime and adds the persistent preview launcher; those changes require final exact-source regression and hosted CI.

The R4.15 capability audit independently confirmed all historical milestone refs are ancestors, 23 migration pairs exist, canonical files are unchanged from R4.14.1, and no historical branch should be blindly re-merged. The release candidate uses a separate worktree and leaves `main` dirty files untouched.

The following are independently checked: typecheck/lint/build/safety; OIDC synthetic Lead/handoff/contact/follow-up/outcome/Manager/security/restart smoke; 31-suite PostgreSQL integration gate from the R4.14.1 foundation; MV3 package generation; readiness migration tests. Final coverage, full exact-source regression, secret scan, Hosted CI and PR checks remain the release-candidate gates recorded in `verification.json`.
