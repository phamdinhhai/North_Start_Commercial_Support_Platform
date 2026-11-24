# Existing capability reuse map

| Journey capability | Reused implementation | R4.16.3 result |
|---|---|---|
| Conversation projection | `SourceIntegrationService`, `PgSourceIntegrationStore` | Extended with authorized Lead associations |
| Explicit source association | `SourceContinuityService`, `PgSourceEpisodeLinkStore` | Reused; link/unlink/reject semantics preserved |
| Lead context | `PilotClosureService`, `LeadDetail` | Existing API/UI reused |
| Handoff and recipient acceptance | `PilotClosureService`, `PilotLoopService` | Existing canonical commands reused |
| Contact/work/outcome/audit | Pilot closure, contact attempt, manager exception services | Existing regression coverage reused |
| Browser acceptance | OIDC Playwright harness | Dedicated commercial-continuity lane added |

No parallel Conversation-to-Lead, RBAC, CRM or workflow model was introduced.
