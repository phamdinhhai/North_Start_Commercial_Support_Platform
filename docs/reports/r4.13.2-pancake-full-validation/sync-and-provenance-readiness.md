# Synchronization and provenance readiness — R4.13.2

Migrations 001–023 establish domain/workspace scope, immutable envelopes and evidence, receipts, source links, sync streams and fabricated-delivery ledgers. The stream lease/checkpoint model separates transport cursor from durable progress; bounded reads are 100 observations/page and 100 pages/run.

Authenticated read-only admission requires request-time workspace, account/Page and conversation authorization; raw request/response metadata persisted before projection; idempotency by workspace+connection+external id; changed payload quarantine; transactional receipt/page/checkpoint commits with lease fencing; append-only evidence and independent erasure/redaction. Tags, assignment and status remain observations with UNKNOWN, never ownership or outcome. Synthetic-only mode remains default; no credentials or live calls were used.
