# SDK egress security

Scope: fabricated loopback emulators only. Real credential admission and external HTTPS dispatch remain disabled. `validateSdkEndpoint` validates prospective HTTPS configuration; it does not implement a production DNS resolver or enable a sender.

Both official SDKs now execute each read through `withBoundedFixtureRelay`. The relay pins the destination to numeric `127.0.0.1`, accepts GET only, forwards only the required authorization/accept headers, rejects all 3xx responses, buffers at most 1 MiB, and applies a two-second total deadline as well as an inactivity timeout. SDK redirect handlers never receive a redirect. No DNS lookup occurs on the dispatch path, preventing DNS rebinding in this fixture transport. HTTPS allowlist validation rejects credentials, non-root paths, queries, fragments, non-443 ports, localhost and IP-shaped hosts. A future production transport requires separate DNS/IP validation and authorization review.

`ConfiguredHybridFixtureReader` selects credentials from server configuration by workspace, connection and account. It rejects real-token shapes, expired/revoked credentials, duplicate scopes and remote origins. Each connection is bounded to 25 reads/minute with at least one second between admissions. SDK pagination remains one bounded page; opaque next positions never authorize following a provider URL. HubSpot page results cannot exceed the requested limit; Meta results cannot exceed 100. These local limits are not provider quota claims.

The backend checks current enrollment and issuing-admin membership before dispatch and again inside the receipt transaction. Revocation during an already dispatched read cannot recall the request; the transaction rejects persistence. The PostgreSQL regression explicitly exercises that race. This fixture is not production key custody or a distributed rate limiter.

Error handling maps confirmed 401/403/429 to stable categories and collapses unknown transport errors into provider unavailable. No error detail, token, cookie, authenticated URL or response body is exposed at the HTTP boundary. The historical unparsed Pancake POST is never assigned a policy error retroactively.

Reproduce from `product/`:

```text
npm test -- src/adapters/hybrid-sdk
```

The egress suite covers redirect receiver zero hits for both SDKs, credential redaction, DNS aliases/metadata addresses, oversized bodies, stalled responses, slow-drip total deadlines, scoped expiry/revocation and local request budgets. Exact final execution evidence is in `verification.json`.
