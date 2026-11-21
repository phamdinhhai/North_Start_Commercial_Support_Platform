# Durable synchronization integration

R4.14 reuses R4.12's `integration_enrollment` and `integration_receipt`
transaction boundary. The hybrid envelope is fixture-only, workspace and
connection scoped, native identity keyed, append/replay safe and separate from
provider cursor/checkpoint semantics. PostgreSQL integration exercised 31
suites and 162 tests with zero skips, including three provider surfaces,
concurrent duplicate delivery, changed payload conflict, sequence gap,
enrollment revocation and issuing-membership revocation.

No Lead, Customer, CommercialEvent, revenue or attribution record is created by
hybrid observation intake. Completeness remains UNKNOWN.
