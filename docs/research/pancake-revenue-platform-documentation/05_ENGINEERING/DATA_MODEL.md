# LVP Data Model — Conceptual

**Owner:** Engineering / Data  
**Maturity:** Active conceptual model; implementation schema pending stack selection  
**Evidence status:** Engineering design supporting solution hypotheses  
**Last updated:** 2026-09-10  
**Supersedes:** 2026-09-09 pre-spec for the current build

## Access boundary

- **Workspace:** pilot/data isolation boundary.
- **User:** authenticated actor.
- **Membership/Role:** workspace authorization; operator/Marketing, Sales, Manager/Admin are initial hypotheses.

## Commercial context

- **CustomerRef:** internal reference to a person/entity; does not imply resolved identity.
- **ExternalIdentity:** platform-scoped identifier with source and merge/correction history.
- **Lead:** one commercial/acquisition episode; distinct from CustomerRef.
- **ConversationRef:** reference to an interaction thread/channel, not an acquisition or attribution claim.
- **InteractionEvidence:** immutable/pointer-based raw excerpt or record with provenance/privacy controls.

## Workflow

- **Handoff:** transfer package, creator, target owner and context version.
- **Assignment:** owner transition with accepted/rejected/reassigned status.
- **Activity:** product-recorded or user-claimed work event.
- **NextAction/Commitment:** actor, owner, due time, status and evidence.
- **OutcomeAssertion:** Won/Lost/Unknown assertion with source and correction history.

## Truth and change

- **Assertion:** versioned statement using acquisition mode and assertion status.
- **Provenance:** source system/record/actor, times, raw evidence, schema/rule/model version.
- **AuditEntry:** append-only previous/new values and responsible actor/process.

## Learning

- **ProductEvent:** privacy-safe behavioral telemetry with release/feature flags.
- **Feedback:** structured participant input separated from behavior.
- **ExperimentExposure:** participant/workspace, variant, release and time window.

## Integrations

- **ExternalConnection:** encrypted credential reference and access scope; never raw credential in domain events.
- **RawEnvelope:** immutable external payload/pointer and hash.
- **SyncCursor/Job:** idempotency, cursor, attempts, status and errors.

## Future, not LVP requirements

Attribution Record, Revenue Record, Opportunity complexity and identity graph remain separate modules. Their future possibility must not force fake values into the current schema.
