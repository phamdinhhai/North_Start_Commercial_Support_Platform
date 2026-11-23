# Security and provider safety

The RC is loopback-only and synthetic-only. Pilot startup rejects non-synthetic envelope/Lead history, cleans inherited provider configuration, uses an isolated PostgreSQL cluster and restricted runtime role, and exposes no default credentials. OIDC is a local fixture issuer with fabricated account choices. CSRF, session expiry, workspace membership, Viewer denial and Foreign workspace denial were exercised.

R4.14.1 egress controls are retained: fixture SDK relay rejects redirects, limits response size/time, selects credentials by exact workspace/connection, applies expiry/revocation/rate limits and redacts credentials. Real HTTPS dispatch, DNS rebinding defenses for a production resolver, real credential custody and live webhook/provider calls are not enabled.

The Pancake incident remains `SEND_UNRESOLVED`: Owner `NOT_OBSERVED`, one historical POST, zero confirmed writes, no retry, no new mutation, delivery/read UNKNOWN. No new Pancake send, Meta messaging workaround, advertising mutation, CRM writeback, customer-data admission or payment operation is performed by R4.15.

The extension minimizes DOM/network observations, never exports cookies/tokens, and keeps optional debugger capture explicitly activated and origin/native scoped. Secrets are held in private manifests outside Git. Final source/history/artifact scan is required before push. SDK redistribution remains conditional because HubSpot metadata/shipped-license discrepancy and Meta Platform License are unresolved.
