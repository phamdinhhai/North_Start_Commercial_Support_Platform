# ADR-003 — Pancake Adapter Contract (P1, Flagged)

**Ngày:** 2026-09-21
**Trạng thái:** Proposed
**Liên quan:** `INTEGRATION_PRINCIPLES.md` · `ARCHITECTURE_CONSTITUTION.md` §3/§5 · `03-requirements.md` R-05/R-06/R-26/R-27 · `04-architecture.md` C-05/C-11

## Context

- Pancake read P1 cần anti-corruption mapping + idempotent ingestion; manual/synthetic P0 vẫn là fallback.
- Q-03 (API paging/filter/auth có giữ hợp đồng?), Q-04 (webhook semantics?) chưa verified bằng live verification (snapshot KB phải re-verify trước build).

## Decision

1. **Versioned envelope:**
   ```
   connection (workspace-scoped)
   external_record_id (immutable)
   record_type (conversation/message/customer)
   source timestamps (source + captured)
   raw payload pointer + hash (immutable)
   schema_version
   ```
   Mapping error: preserve raw envelope; không fabricate canonical fields.

2. **Idempotency:** `connection_key + external_record_id` → idempotent ingestion; retry bounded; duplicate dropped với audit.

3. **Live verification (spike):** Pancake read spike trong PH0 trước khi code path production dùng Pancake. Snapshot KB không justified production attribute claims.

4. **Security:** Credential encryption, least-privilege, redaction trong logs/telemetry (INTEGRATION_PRINCIPLES §6). Flag default OFF; manual/synthetic không chặn bởi Pancake lỗi.

5. **No generic connector framework** trước nhu cầu thứ hai (ARCHITECTURE_CONSTITUTION §2).

## Consequences

- Pancake code path testable qua manual/synthetic envelope mà không cần Pancake live.
- Live behavior mismatch lộ sớm (PH0 spike) thay vì production.

## Related

- `03-requirements.md` R-05, R-06, R-26, R-27
- `04-architecture.md` C-05, C-11
- `05-phase-map.md` PH0 spike, PH1–PH2 P1 flag
