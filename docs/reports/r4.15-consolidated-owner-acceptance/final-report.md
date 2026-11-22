# R4.15 consolidated release candidate

The release candidate consolidates the complete R4.14.1 implementation into one runnable local product and adds the Owner acceptance layer. All historical milestone branches audited as ancestors of the selected base; no blind re-merges were performed. The candidate uses a separate worktree and leaves the Owner's dirty `main` worktree untouched.

The actual Sales pilot is running at [http://127.0.0.1:51135/v1/operator](http://127.0.0.1:51135/v1/operator). It uses a private PostgreSQL cluster, local fixture OIDC, restricted runtime role and synthetic-only admission. The current fabricated demo is `DEMO - Studio La Xanh (FABRICATED)`. A second independent Hybrid Preview is running at fixture pages [http://127.0.0.1:54582](http://127.0.0.1:54582) and Operator [http://127.0.0.1:54567/v1/operator](http://127.0.0.1:54567/v1/operator). The preview owns a separate manifest/database.

Independent runtime QA completed ten scenarios: OIDC login, synthetic Lead creation, evidence/UNKNOWN visibility, handoff acceptance, contact claim, follow-up lifecycle, outcome correction/audit, Manager exceptions, Viewer/Foreign denial and restart/history recovery. The exact result is kept privately outside Git. This is hands-on smoke evidence, not Owner acceptance.

R4.15 corrected the readiness probe to require all 23 migrations and added missing-marker regression coverage for 018–023. The supported pilot now enables only the synthetic source/Hybrid flags required to make the registered Source Lab and Sync Health views usable; no real provider credentials or endpoint is enabled. The separate preview builds an unpacked MV3 package and serves fabricated Pancake/Meta/HubSpot pages over loopback.

Final source verification is still being completed on the RC after these bounded corrections. The prior R4.14.1 source passed 33 lanes, 1,637 coverage tests and the three-provider combined E2E; those facts remain prior evidence and are not silently promoted to R4.15. The dedicated R4.15 run records exact source SHA, product tree, test totals, skips, logs and secret scan in `verification.json`.

Provider safety remains unchanged: P3 `SEND_UNRESOLVED`, P4 `NOT_TESTED`, P5 `NOT_VERIFIED`, Gate B `CONDITIONAL`, Gate C `NOT_READY`. No Pancake send, Meta messaging workaround, ads mutation, CRM writeback, real customer data admission or deployment occurred. SDK distribution remains conditional.

The branch will be pushed only after final local verification and secret/history scan. Hosted CI and a main-target PR are next release-candidate steps; neither implies merge. The Owner should use the ordered test guide, then record ACCEPT / FIX_REQUIRED / REJECT with workflow feedback before the PR is merged.
