# Commercial Envelope Schema v1

**PH0 (Spike & Research)** · **Trạng thái:** Draft — chưa freeze
**Ghi chú:** Envelope này là contract cho mọi inbound adapter (C-11, C-05). Manual/synthetic P0 dùng schema này. Pancake adapter P1 mở rộng thêm nhưng giữ backward compatibility.

---

## 1. Overview

Mỗi inbound message (manual paste, synthetic demo, Pancake read) tạo **1 versioned envelope** immutable. Envelope là boundary giữa raw external data và canonical domain projection.

```
External Source → [Adapter] → Envelope (v1, immutable) → [Anti-Corruption Mapping] → Domain Core
```

---

## 2. Envelope Fields

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| `envelopeId` | UUID (v7) | ✅ | Generated on ingest, unique |
| `schemaVersion` | `1` | ✅ | Versioned, immutable |
| `connection` | string | ✅ | Workspace-scoped connection ID |
| `externalRecordId` | string | ✅ | Immutable — idempotency key part 1 |
| `externalEventType` | string | ✅ | `message`, `conversation`, `customer`, `note`, `order` |
| `sourceCapturedAt` | ISO 8601 | ✅ | When the source captured this data |
| `ingestedAt` | ISO 8601 | ✅ | When our system ingested this envelope |
| `rawPayload` | object | ✅ | Original payload — immutable |
| `rawPayloadHash` | string (hex) | ✅ | SHA-256 of JSON-serialized `rawPayload` |
| `mappingStatus` | enum | ✅ | `pending` / `mapped` / `error` |
| `mappingError` | string? | ❌ | Set when `mappingStatus = error` |
| `canonicalProjection` | object? | ❌ | Only when `mappingStatus = mapped` |

---

## 3. Idempotency

**Key = `connection` + `externalRecordId`**

- Duplicate ingest (same connection + externalRecordId) → return existing envelope, no new record.
- External IDs immutable once stored (I-11, I-12).
- Cursor/checkpoint tách khỏi canonical state — ingest pipeline không phụ thuộc domain state.

---

## 4. Raw Evidence Preservation (I-12)

- `rawPayload` **immutable** after creation — never overwritten, never deleted.
- `rawPayloadHash` = SHA-256 of JSON-serialized `rawPayload` — verifies integrity.
- Mapping errors: `mappingStatus = error` + `mappingError` message. `canonicalProjection` = null.
- **Không fabricate** canonical fields when mapping fails (I-12).

---

## 5. Anti-Corruption Mapping

| Scenario | Behavior |
|----------|----------|
| Mapping success | `mappingStatus = mapped`, `canonicalProjection` filled |
| Mapping error | `mappingStatus = error`, `mappingError` = reason, `canonicalProjection = null` |
| Unknown fields | Preserved in `rawPayload`, not dropped |
| PII in raw | Redacted in logs/telemetry, preserved in envelope (I-11, I-12) |

---

## 6. Version Strategy

- `schemaVersion` incremented when envelope shape changes.
- Adapter must send latest version; receiver handles old versions via versioned handler.
- v1: baseline for PH1/PH2. v2+: when new fields added in later phases.

---

## 7. Mapping to Domain (v1)

```
Envelope v1 → Lead (create or update status)
             → Raw Evidence Store (immutable)
             → Audit Trail (append-only, I-05)
```

> Envelope-to-domain mapping chi tiết: `COMMERCIAL_EVENT_MODEL.md`. Schema v1 draft này đủ cho PH1 shell.
