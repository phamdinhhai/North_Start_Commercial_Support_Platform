# R4 workflow API contract
All paths prefix `/v1/pilot`. Authentication and scope match existing pilot routes. Viewer/demo read only. Owner-only mutations; admin/manager status does not override owner policy. Commands require `expectedVersion` integer >=1 and `idempotencyKey` string 1..128. Identical actor-bound retries return original response before version checking; changed requests return 409 IDEMPOTENCY_CONFLICT, stale writes 409 STALE_VERSION. Workspace/actor never from body.

| Method/path | Request | Response |
|---|---|---|
| GET leads | classification=real(default),synthetic,all; limit=1..100(default50); after=UUID | {items:[{leadId,displayName,status,ownerUserId,version,isSynthetic,currentContext}],nextCursor?:UUID}; next page uses after |
| GET leads/:id/context | none | {version,isSynthetic,current:revision or null,revisions:[revision]} |
| POST leads/:id/context | {expectedVersion,idempotencyKey,text,reason} | {version,revision:{id,text,actor,recordedAt,reason}} |
| GET leads/:id/evidence | limit=1..20(default20) | {isSynthetic,items:[{envelopeId,sourceCapturedAt,ingestedAt,connection,externalRecordId,acquisitionMode,acquisitionSource,mappingStatus,isSynthetic,rawPayloadDigest?,rawPayload:{utterance,speaker},truncated}],accessRecorded:true} |
| POST leads/:id/next-actions | {expectedVersion,idempotencyKey,action,dueAt?,reason} | {version,workItemId} |
| POST leads/:id/next-actions/:workId/reopen | {expectedVersion,idempotencyKey,reason,dueAt?} | {version,workItemId,supersedesWorkId} |
| POST leads/:id/next-actions/:workId/complete | {expectedVersion,idempotencyKey,evidence:'declared' or 'observed',declaration?,confirmed?,evidenceRef?,occurredAt?,reason?} | {version,workItemId} |
| POST leads/:id/next-actions/:workId/reschedule | {expectedVersion,idempotencyKey,newDueAt,reason} | {version,workItemId,supersedesWorkId} |
| POST leads/:id/outcomes/:outcomeId/correct | {expectedVersion,idempotencyKey,value:'Won' or 'Lost' or 'Unknown',reason} | {version,outcomeId,supersedesOutcomeId} |
| GET leads/:id/timeline | none | {version,isSynthetic,history:[existing audit entries],contextRevisions,workItems,outcomes} |
| GET assignees | none | {items:[{userId,role}]} active workspace members eligible for handoff; no external identities |

Existing endpoints retained. Detail adds `version`, `isSynthetic`, `currentContext`, and richer work/outcome history. Queue adds `isSynthetic` and classification=real(default)|synthetic|all. Evidence only accepted source envelope of authorized lead; raw whitelist utterance(max16KiB)/speaker; audited via version-neutral append. Context max16000 chars, action max2000 chars, reason max2000 chars; dates valid ISO strings. No inferred completion/CE transition expansion.

## CAS wrappers for existing loop commands

POST leads/:id/commands/handoff: existing handoff body + expectedVersion,idempotencyKey,reason. Response {version,workItemId,leadStatus,recipient}. Recipient must be an active eligible same-workspace directory member.
POST leads/:id/commands/accept: {expectedVersion,idempotencyKey,workId,reason}. Response {version,workItemId,leadStatus,owner}.
POST leads/:id/commands/advance: {expectedVersion,idempotencyKey,to:'Contacting'|'Follow-up',reason}. Response {version,leadStatus}.
POST leads/:id/commands/outcome: {expectedVersion,idempotencyKey,value,reason}. Response {version,outcomeId,leadStatus,assertionStatus}.
These wrappers are preferred by the UI. Existing endpoints remain compatible. All POST success statuses are201, consistent with Nest default; clients should accept all2xx. Correction uses established CE-1 policy (invalid transitions422), no implicit state override.

## Composition

Register PilotClosureController plus factory PilotClosureService(PILOT_STORE,LEAD_ACCESS_POLICY,digester,directory). Digester is the configured server ContentDigester from ports/content-digester, command purpose; directory implements PilotAssigneeDirectory.list(workspaceId) returning active membership {userId,role}, no identities. In-memory unit harness may omit directory (empty/deny handoff). Existing app.module and pilot-loop.module are root-owned and intentionally untouched in backend commit. CI requiredSuites must include src/infra/postgres/pilot-closure.integration.spec.ts. Migrations012 and013 must both be applied before current PgPilotStore runs.
