# R4.16.1 functional OSS absorption

This release contains working native Northstar functionality derived from the inspected OSS sources:

- A PostgreSQL-backed, workspace-scoped read-only conversation projection over existing source receipts and commercial envelopes, exposed by `GET /v1/source-integrations/conversations`. It preserves native IDs, message identity, bounded pagination, provenance, `UNVERIFIED` authority and `UNKNOWN` completeness without creating Leads or Customers.
- A timezone-aware task bucket classifier adapted from Atomic CRM date grouping and applied to existing `pilot_work_item` semantics.
- Backend-authorized Lead search with bounded input, workspace/RBAC filtering, cursor scope including the search term, and frontend provider wiring.
- Native synthetic Ads report aggregation over normalized provider observations, preserving currency/timezone/date/source version and excluding foreign/non-synthetic records.
- React Inbox native mode that reads the new conversation API while retaining fabricated demo mode and existing evidence mode.

No upstream app, database, migration, auth system or provider mutation client is required.
