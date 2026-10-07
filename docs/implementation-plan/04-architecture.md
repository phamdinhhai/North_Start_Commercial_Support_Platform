# 04 — Architecture (LVP)

**Phiên:** 2026-09-21 (Bước 3 — planning)
**Trạng thái:** Draft cho human review — chưa freeze
**Phạm vi:** Chỉ mô tả kiến trúc cho LVP (modular monolith + seams). Không gồm deferred / generic platform.

---

## 1. Hình dạng tổng thể

**Modular monolith** (1 deployable), các module tường minh, không microservices trừ khi có nhu cầu scaling/ownership riêng được chứng minh.

```
[Inbound adapters]
  Manual/Synthetic (P0) ─┐
  Pancake read (P1, flag)├→ Inbound Envelope (versioned, immutable, raw preserved)
                         │
[Inbound Envelope] → [Anti-Corruption Mapping] → [Canonical projection]
                         │                                   │
                         ▼                                   ▼
              [Raw evidence store]                [Domain core: Lead / Handoff /
              (immutable, hashed)                  CommercialEvent / State / Outcome]
                                                          │
              [Audit / Provenance (append)]  ←───────────┤
              [Telemetry / Experiment (flagged release)]  │
                                                          ▼
                                             [Action loop: Queues / NextAction / Outcome]
```

## 2. C-ID taxonomy

| C-ID | Tên | Mô tả | Ghi chú |
|------|-----|-------|---------|
| C-01 | Domain Core | Entities + invariants (I-01…I-12) enforcement; framework-independent | Cluster A/C |
| C-02 | Application Services | Use cases: import, assign, contact, next action, outcome, handoff | Cluster B/C |
| C-03 | Persistence | PostgreSQL durable; **KHÔNG trong BOOT-001** | Cluster D; ADR-002 |
| C-04 | HTTP Adapters | Fastify endpoints; versioned API | Cluster A/B |
| C-05 | Inbound Adapters | Manual/Synthetic (P0) + Pancake read (P1, flag) | Cluster G; ADR-003 |
| C-06 | Audit/Provenance Store | Append-only; envelope preserved; UNKNOWN valid | Cluster E |
| C-07 | Feature Flag Service | Server-controlled; release version + exposure telemetry | Cluster F |
| C-08 | Telemetry/Experiment | ProductEvent; feedback separate; release + flag tagged | Cluster F |
| C-09 | Job/Queue Abstraction | Connector jobs, idempotent, checkpoint tách biệt | P1, defer generic |
| C-10 | AI Inference | **Draft-only, policy-gated, feature-flag OFF** | P1; ADR-003 |
| C-11 | Adapter Contract (versioned envelope) | Envelope + hash + anti-corruption mapping | Mọi inbound; ADR-003 |
| C-12 | Identity / Workspace / RBAC | Workspace isolation (R-01) + Sales lead-scoped access (I-09, R-03) + demo segregation (R-28) | Cluster A; R-01/I-09 tách biệt — OPEN PM-1 |

## 3. Domain core (framework-independent)

Tuân thủ `DOMAIN_MODEL.md`:

- **Customer ≠ Lead** (I-01). Customer có thể có nhiều Lead; Lead = một acquisition episode; Lead ID stable (I-07).
- **Lead** — stable ID, immutable, survive channel transitions.
- **Handoff** — Marketing→Sales context package (identity, evidence, channel, proposed next action), stable Lead ID.
- **CommercialEvent** — packet mang provenance: identity, event type, timestamp, evidence, confidence (inferred-only trong LVP), policy → action. Mọi commercial assertion là versioned assertion với evidence + provenance (I-04, I-05).
- **Outcome** — Won/Lost/Unknown (I-08). UNKNOWN valid state; không backfill, không hidden.
- **Attribution** — Không collapse Conversation Source ≠ Acquisition Lineage ≠ Revenue Attribution (I-02). Trong LVP: UNKNOWN (MM-1).
- **Identity / Merge** — stable Lead ID; merge evidence + confidence + reversible (I-06); automated merge deferred (ID-1).

**Invariant enforcement (đã thu hẹp 2026-10-07):** Chỉ thay đổi SUY LUẬN (AI/rule-derived) phải đi qua CommercialEvent pipeline I-03→I-04 (AI → CE → Evidence → Policy → Action); ADR-001 giữ CE scope inferred-only tới khi CE-2 chốt. Thao tác thủ công/observed/imported không bị ép thành CommercialEvent — chúng vẫn bắt buộc provenance envelope + append-audit (TRUST_AND_EVIDENCE §§2-5, I-05, I-12). AI draft-only; never direct mutate. UNKNOWN visible. Nguồn đúng: DOMAIN_INVARIANTS I-04 ("Inferred changes must become a Commercial Event..."), không phải "mọi mutation".

## 4. Adapter contract & inbound envelope (C-11, C-05)

Mọi inbound (manual/synthetic/pancake) tạo **versioned envelope**:

```
connection (workspace-scoped)
external_record_id (immutable)
record_type
source_captured_timestamps
raw_payload_pointer + hash
raw_envelope (immutable, preserved on mapping error)
schema_version
```

- **Idempotency:** theo connection + external record/event ID; raw envelope lưu immutable trước canonical projection (I-11, I-12).
- **Không fabricate:** mapping error giữ raw envelope; không tự điền canonical fields.
- **AI boundary (I-03/I-11):** Adapter là integration boundary; không inherited upstream semantics; PII/token redaction.

## 5. Business rules / data model seams

| Vùng | Quyết định | Seam |
|------|-----------|------|
| Lead ID | Stable, immutable | I-07 |
| Customer vs Lead | Riêng biệt | I-01, I-07 |
| Chain Identity | Conversation Source + Acquisition Lineage + Revenue Attribution tách biệt | I-02 |
| Commercial Event | Assertion envelope với provenance | I-03, I-04, I-05 |
| UNKNOWN | Valid state; honest visibility | I-08 |
| Audit | Append-audited, auditable | I-04, I-05 |
| External adapters | Boundary; idempotent; anti-corruption mapping | I-11, I-12 |

## 6. Module boundaries (từ `ARCHITECTURE_CONSTITUTION.md` §4)

1. **Identity / access / workspace** — workspace isolation (R-01, C-12); auth, RBAC lead-scoped (I-09, R-03); synthetic/demo segregation (I-12, R-28).  // OPEN: PM-1 — I-09 lead-scoped chưa chốt chi tiết, chỉ enforce frozen boundary
2. **Lead / handoff / evidence** — Lead stable ID, handoff package, raw evidence (I-07, I-11, I-12).
3. **Sales action / next action / outcome** — queued actions, contact attempts, next action lifecycle, Won/Lost/Unknown (I-05, I-08).
4. **Audit / provenance** — append-audit (I-04, I-05).
5. **Product telemetry / experiment** — telemetry tagged release/flag; feedback tách biệt.
6. **Integration adapters / background jobs** — manual/synthetic P0 fallback; Pancake P1 flag; queue abstraction deferred.
7. **AI inference (feature-flagged)** — draft-only, policy-gated; never autonomous mutation.

## 7. Security baseline (frozen — không regress)

- Authenticate mọi non-demo user; authorize theo workspace + role + lead scope (I-09).
- Pilot/synthetic isolation; synthetic demo data không vào customer evidence analysis.
- Credentials server-side encrypted, per-workspace connection; PII/token redaction khỏi logs/telemetry.
- Append-audit important mutations; export/delete với retention + audit.
- Admin scope quản lý access; Sales access lead-scoped (I-09).

> Nguồn: `ARCHITECTURE_CONSTITUTION.md` §7.

## 8. Grid R→C mapping

| C-ID | R-IDs |
|------|-------|
| C-01 | R-07, R-08, R-09, R-10, R-11, R-12, R-13, R-14, R-15, R-16, R-17 |
| C-02 | R-04, R-08, R-11, R-12, R-13, R-14, R-15, R-20, R-21 |
| C-03 | R-18 (P0), R-01 |
| C-04 | R-02, R-03, R-21, R-22 |
| C-05 | R-04, R-05, R-06, R-26, R-27, R-28 |
| C-06 | R-16, R-19, R-21 |
| C-07 | R-22, R-20 |
| C-08 | R-21, R-22, R-23 |
| C-09 | R-26, R-27 (job/queue) |
| C-10 | R-20, R-21 (AI draft) |
| C-11 | R-05, R-06, R-26, R-27, R-28 |
| C-12 | R-01, R-02, R-03, R-28 |

## 9. BLOCKED-BY / Open Decisions

| Seam | Open Decision | Interim handling |
|------|---------------|------------------|
| C-01 CommercialEvent scope | CE-2 | ADR-003: inferred-only interim |
| C-01 Lead state transition | CE-1 | ADR-003: hypothesis New→Accepted→Contacting→Follow-up→Won/Lost + Unknown |
| C-05 Pancake sync | Q-03, Q-04 | PH0 spike + manual fallback; flagged OFF |
| C-03 Persistence | — | PH2 (sau Gate L2/L3), PostgreSQL; BOOT-001 deferred |
| C-10 AI | Q-05 | Draft-only, feature-flag OFF; manual loop fallback |

> Quy tắc: Không tự resolve open decisions. Ghi BLOCKED-BY + để Human Gate quyết.

## 10. Guardrails — KHÔNG xây trong LVP

- Không build full CRM, ERP/POS, generic BI/workflow (D-001).
- Không build revenue attribution trong LVP (MM-1) — giữ UNKNOWN.
- Không build automated identity merge (ID-1) — manual correction + evidence.
- Không build Pancake sending; Pancake read P1 flag.
- Không build generic connector framework / workflow DSL / event platform trước nhu cầu thứ 2.
- Không để AI autonomous mutate state/routing/revenue (I-03, I-04).
