# Security Architecture

**Owner:** Security / Engineering  
**Maturity:** Required LVP baseline; implementation pending  
**Evidence status:** Security guardrails  
**Last updated:** 2026-09-10

## LVP baseline

- Authenticate every non-demo user; authorize by workspace, role and lead scope.
- Isolate pilot and synthetic/demo data even if deployment begins single-tenant.
- Keep Pancake/vendor/model credentials server-side in a secret store.
- Redact query tokens, headers, message content and PII from logs/telemetry.
- Encrypt traffic and persisted sensitive data using platform-supported controls.
- Append-audit important reads/writes, exports, deletions and AI mutations.
- Provide pilot data export and deletion; define retention before ingesting real data.
- Record consent/allowed-data scope and restrict raw evidence access.
- Use least-privilege connector access and credential rotation/revocation procedures.
- Scan dependencies/secrets and maintain backup/restore for pilot data.

## Special connector risk

An upstream token may expose broad page/customer data while the product promises lead-level access. Enforce authorization inside this product and ingest only allowed scope; never assume upstream token scope provides user isolation.

Pancake snapshot docs place tokens in query parameters, creating URL/proxy/access-log leakage risk. Verify current auth and test redaction across application, reverse proxy, error reporting and traces before live use.

## Real-data readiness checklist

- Data controller/credential owner and tester consent identified.
- Data classes and retention/deletion period approved.
- Workspace/role access tests pass.
- Secret/token/PII redaction tests pass.
- Backup/restore and incident contact defined.
- AI provider data handling reviewed if AI receives real content.

Synthetic data can validate functionality but cannot waive these controls for external data.
