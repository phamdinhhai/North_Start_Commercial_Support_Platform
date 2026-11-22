# Independent QA

QA independently reviewed the browser permission policy, outbox, diagnostic
redaction and hybrid observation contract. Results: 57 focused Vitest tests,
18 Node browser/security tests, typecheck and lint passed. PostgreSQL passed 31
suites/162 tests with zero skips. Secret and dependency checks were run with no
provider credentials.

Remaining QA limitation: optional CDP diagnostics enforce origin and the last
matched context, but same-origin SPA account changes can leave a short window
before DOM observation records the change. Diagnostic completeness and provider
authority therefore remain UNKNOWN.

Final independent review is for exact source
`0162e524cda1a4b8ce886417e80330f950fed37b`: 55 focused Vitest tests in six
files and 20 Node tests passed. The 31-lane final manifest and 15-step combined
E2E proof were inspected against source assertions, including native target,
workspace, replay/restart, real OIDC membership and no Lead projection.

Manifest SHA-256:
`a61eefa2f52b44683a0aa6de64c65d6d458216a95c242f337c8f8b9155b628ff`.
Combined log SHA-256:
`4880a0d73154160fb39722c9f95681458e0d2f4d08debe9191e62ccf0a2c713f`.

QA accepts Gate I/S only for local browser fixtures through real North Start
authorization to durable metadata receipts. It explicitly does not accept
provider-live E2E, SDK redirect confinement, complete historical coverage or
combined SDK/API-browser reconciliation. The first ACK-loss label uses a
truncated response; a complete connection-drop case was not exercised.
