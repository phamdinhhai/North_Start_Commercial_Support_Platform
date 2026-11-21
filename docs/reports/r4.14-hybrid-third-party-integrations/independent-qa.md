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
