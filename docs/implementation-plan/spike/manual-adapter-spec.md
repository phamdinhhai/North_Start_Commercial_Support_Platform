# Manual/Synthetic Adapter Spec (P0)

**PH0 (Spike & Research)** · **Trạng thái:** Draft
**Liên quan:** R-04, R-05, R-06 (P0), C-05, C-11, I-11, I-12
**Nguồn:** `COMMERCIAL_ENVELOPE_SCHEMA_v1.md`, `ARCHITECTURE_CONSTITUTION.md`

---

## 1. Purpose

Manual/synthetic adapter là **P0 fallback** — luôn hoạt động kể cả khi Pancake integration fail. Đây là adapter đầu tiên được implement trong PH1 (walking skeleton shell).

---

## 2. Input types

| Type | Description | Source |
|------|-------------|--------|
| `manual_paste` | Operator paste conversation text raw | Human input |
| `manual_import` | Operator upload structured data (CSV/JSON) | Human input |
| `synthetic_demo` | Synthetic demo data cho pilot/testing | System generated |
| `manual_correction` | Sales ghi lại/sửa kết quả sau interaction | Human input |

---

## 3. Adapter flow (per inbound message)

```
1. Receive raw input + connection context
2. Create Envelope v1:
   - envelopeId = uuid()
   - schemaVersion = 1
   - connection = workspace-scoped connection ID
   - externalRecordId = generated (manual = hash(raw + timestamp))
   - externalEventType = determined from input type
   - sourceCapturedAt = now
   - ingestedAt = now
   - rawPayload = original input (immutable)
   - rawPayloadHash = SHA-256(JSON(rawPayload))
   - mappingStatus = pending
3. Attempt anti-corruption mapping:
   - Success: mappingStatus → mapped, canonicalProjection filled
   - Failure: mappingStatus → error, mappingError = reason, canonicalProjection = null
4. Store envelope (idempotent by connection + externalRecordId)
5. If mapped: project to domain (Lead create/update)
6. Append audit trail entry (I-05)
```

---

## 4. Idempotency

- **Key:** `connection` + `externalRecordId`
- Duplicate → return existing envelope, no new record
- Raw payload immutable after creation (I-12)

---

## 5. Raw evidence preservation (I-12)

- `rawPayload` immutable — never overwritten, never deleted
- `rawPayloadHash` verifies integrity on read
- Mapping errors preserve raw envelope, no canonical fabrication

---

## 6. Synthetic segregation (I-12, R-28)

- Synthetic/demo data tagged: `isSynthetic = true` in envelope metadata
- Synthetic excluded from pilot evidence analysis
- Demo workspace: synthetic visible with label
- `workspaceId` segregation enforced

---

## 7. API endpoints (PH1 shell)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/adapters/manual/ingest` | Create envelope from manual input |
| `GET` | `/v1/adapters/manual/envelope/:id` | Retrieve envelope by ID |
| `GET` | `/v1/adapters/manual/envelopes` | List envelopes (workspace-scoped) |

---

## 8. Test cases (PH1)

1. Create envelope — all required fields present
2. SHA-256 hash correctness
3. Duplicate ingest → idempotent (1 record)
4. Mapping error → raw envelope preserved, no fabrication
5. Synthetic flag → excluded from pilot evidence
6. Workspace isolation → scoped query
