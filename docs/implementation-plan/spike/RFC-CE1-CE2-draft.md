# RFC — CE-1 / CE-2 Interim Handling (ADR-001 Basis)

**PH0 (Spike & Research)** · **Gate:** Human Gate #A (trước PH2)
**Trạng thái:** Draft — **chờ Human approve** trước khi dùng làm basis cho PH2 domain state machine
**Nguồn:** `docs/canonical/OPEN_DECISIONS.md` (7 open decisions), `COMMERCIAL_EVENT_MODEL.md`

---

## 1. CE-1 — Lead State Machine (Hypothesis, chưa freeze)

### 1.1 Trạng thái LVP (hypothesis interim — ADR-001)

```
New → Accepted → Contacting → Follow-up → Won / Lost + Unknown
                                          Unknown = valid state (I-08)
```

### 1.2 Quy tắc interim (tới khi Gate #A chốt)

- Mọi transition **append-audited** (I-05): `actor + previous/new value + timestamp + reason`.
- Terminal states (`Won`/`Lost`/`Unknown`) **reversible** bằng correction append (không overwrite) — I-05.
- `UNKNOWN` không bị collapse thành `null`/empty — luôn surfaced với `unknown_reason` (I-08).
- Bất kỳ transition vượt frozen boundary → **abort** với comment `// OPEN: CE-1 — see ADR-001`.

### 1.3 Không tự resolve

CE-1 chỉ freeze sau Gate #A RFC review (Product + Architecture + Data). Code PH1/PH2 chỉ dùng interim handling ở seams.

---

## 2. CE-2 — Commercial Event Scope (Hypothesis, chưa freeze)

### 2.1 Phạm vi LVP (interim — ADR-003)

- **Inferred-only**: AI draft trong `CommercialEvent` pipeline — `Inferred → Evidence → Policy → Action`.
- AI **draft-only, never autonomous mutation** (I-03, I-04). Feature-flag OFF mặc định.
- Mỗi CE mang provenance envelope đầy đủ (I-04, I-05, I-12).

### 2.2 Quy tắc interim

- AI output → `CommercialEvent` với `confidence + evidence + suggested mutation + policy check`.
- Manual loop luôn fully functional khi AI flag OFF — không block L0 loop.
- Invalid AI output → fails closed → manual input (I-03).
- Bất kỳ autonomous mutation → **abort** với comment `// OPEN: CE-2 — see ADR-003`.

---

## 3. Seam Markers cho Code

```ts
// OPEN: CE-1 — see ADR-001 — interim: New→Accepted→Contacting→Follow-up→Won/Lost+Unknown
// OPEN: CE-2 — see ADR-003 — interim: inferred-only, draft-only, flag OFF
```

Mọi nơi chạm CE-1/CE-2 phải có marker này.

---

## 4. Gate #A Checklist (trước PH2)

- [ ] Product review: state names + transitions phù hợp LVP flow?
- [ ] Architecture review: CE provenance envelope đủ fields?
- [ ] Data review: UNKNOWN handling + audit fields đủ?
- [ ] Quyết định: **approve interim** hoặc **supersede ADR-001** bằng ADR mới
- [ ] Record trong `08-verification.md` + `decisions/`

> **Kết luận:** PH1 coding tiến hành với interim handling. PH2 domain state machine **không bắt đầu** trước Gate #A.
