# R4.12 credential security design

Status: **OFFLINE VERIFIED / TEST_ONLY**. No vault, KMS, provider account, network transport, webhook route or production credential backend is enabled.

## Boundary

`ProviderConnectionIdentity` carries only server-owned workspace/connection/provider/account binding and a bounded scope list. `ProviderCredentialMetadata` contains lifecycle state, version, expiry and rotation audit fields; it never contains a token, secret, hash, or credential material. `ProviderServicePrincipal` is issued by the credential store after an authenticated admin operation and is tracked as an opaque in-memory object. A caller cannot mint an equivalent JSON object and pass `resolve`.

`TestOnlyProviderCredentialStore` is deliberately unavailable unless constructed for `local` or `test` with an explicit enabled flag. It also fails closed when process environment indicates `production`, `prod`, or `pilot`, or `NODE_ENV=production`. The store is memory-only and has no persistence, encryption, master key, or secret serialization. A future vault implementation must be a separate reviewed adapter; this class cannot be promoted by configuration.

Only the existing `admin` role may configure, rotate, revoke, inspect, or issue a provider service principal, following ADR-006. Managers may consume operator health projections when a future API permits it, but they do not receive credential material or lifecycle mutation authority. `isDemo` contexts are refused.

## Lifecycle and service identity

Configuration validates provider/account/scope formats, workspace binding, secret size and control characters, and optional UTC expiry. Credential rows are keyed by workspace plus connection, preventing same connection IDs in different workspaces from colliding. Revocation is terminal for that connection in this test store: configuration cannot reactivate it. Rotation requires the expected version and increments a version. Previously issued principals fail after rotation with a version conflict. Revocation blocks all subsequent resolution.

Human OIDC context is used only for the admin lifecycle command. Provider workers receive an opaque `provider_service` principal with read capability and exact workspace/connection/provider/account/version binding. A provider payload cannot select a workspace or inherit a human role. Webhook signature validity, when a provider documents one, remains a separate admission fact and cannot create a principal.

## Adversarial evidence

The colocated tests cover disabled/non-test/production guards, admin-only mutation, demo/sales/manager refusal, metadata and JSON secret exclusion, opaque principal forgery, cross-workspace/provider/account binding, per-workspace connection collisions, expiry, optimistic rotation, stale principal invalidation, terminal revocation, malformed secrets, and categorical errors. A bounded in-memory audit records actor/action/version/workspace only and never records secret material.

These tests do not prove vault custody, encryption at rest, provider OAuth, webhook replay windows, real account rights, or live ingestion. Those remain explicit provider-admission blockers.
