# Product gaps and implementation backlog — R4.13 domain review

Source baseline: `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`. Agent 4 inspected source and ran 35 focused offline tests; details in `native-identity-mapping.md`. Severity below is engineering priority, not a claim of an exploitable production defect. No provider behavior is claimed by this agent.

| ID / priority | Classification | Evidence and implication | Bounded next task / acceptance |
|---|---|---|---|
| DOM-01 / P0 before live intake | SECURITY RISK BEFORE LIVE | `SourceObservation` only models synthetic authority; `decodePancakeSynthetic` permits fabricated `originalMeta`; `projectSourceTrust` correctly marks candidate/NOT_AVAILABLE | Separate authenticated provider observation admission from fixture import. Server-bound connection and reviewed account/origin assertions; forged cross-route identity cannot acquire authenticated assurance |
| DOM-02 / P0 | DESIGN LIMITATION | `SourceObservation.accountId` means transport Page, not provider human account; no dedicated contact/channel identity field | Keep principal/Page/contact distinct in admission record. Verify response linkage with minimized evidence; never map URL suffix/contact to Customer ID |
| DOM-03 / P1 | PRODUCT DECISION | `PgSourceIntegrationStore.intake` seeds one Lead per previously unmapped native message; same-conversation grouping is not automatic | Preserve explicit context links. Owner must approve an episode policy before automated grouping; do not rewrite existing Leads or history |
| DOM-04 / P0 before live intake | DESIGN LIMITATION | `admitSyncObservation`, `SyncStream` and envelope persistence are synthetic-only | Do not relabel real payload as synthetic. Approved live adapter must preserve genuine acquisition/provenance and remain disabled until privacy/custody gate; isolated fabricated contract replay only now |
| DOM-05 / P1 | NOT VERIFIED | `native.eventId` / `revision` optional; absent in narrow synthetic Pancake decoder; current fields do not prove documented live edit/delete event identity | Establish contract for stable message/event/revision and lifecycle from exact authorized readback. Leave unknown if absent; append observations without inventing latest provider state |
| DOM-06 / P1 | DESIGN LIMITATION | `SourceContinuityService.list` and linked evidence query cap results at 100 and expose possible truncation/UNKNOWN; source evidence itself has cursor pagination | Keep warnings honest. Add link-history cursor only if measured operator need; no claim of complete linked history beyond cap |
| DOM-07 / P0 | EXISTING PROTECTION | `PgSourceEpisodeLinkStore.command`, `SourceContinuityService`, linked reader reject stale/mismatched/unauthorized context and preserve audit | Integrated QA reruns ownership changes, link correction, audit failure rollback and cross-tenant pointer tests; no widening Sales inbox access |
| DOM-08 / P0 | EXISTING PROTECTION | Source-intake and continuity integration cases preserve owner, Customer ID, attribution, work/handoff/outcome under replay/edit/delete | Include these exact suites in final regression; evidence-only sync cannot mint commercial authority |

No confirmed domain defect requiring a code change was reproduced in this review. The limits above are not resolved by more provider requests or successful message delivery. Automated segmentation, identity merge thresholds and CRM mapping remain unresolved product scope; canonical files were not modified.

## Product alignment

- Acquisition intelligence: preserve acquisition lineage and attribution UNKNOWN; Page/conversation source does not establish campaign causation.
- Conversation intelligence: preserve immutable provider observations, lifecycle labels, source namespaces and incomplete history warnings.
- Commercial continuity: human evidence-context link/unlink/reject survives later messages and replays, with current source/target authorization.
- Revenue execution: provider messages remain evidence; Lead owner/work/handoff/outcome changes use existing authorized domain commands.
- Revenue intelligence: no payment/revenue/conversion assertion from message delivery, tags, conversation status or assignment.

## Release interpretation

Provider operation authorization for one selected test conversation does not grant production sync, real-data retention, North Start ingestion or broader inbox access. Gate B stays CONDITIONAL and human Sales validation NOT RUN. Gate C stays NOT READY FOR REAL CUSTOMER DATA. Final provider capability status must come from the root's actual sanitized execution journal and independent QA, separately from these offline checks.
