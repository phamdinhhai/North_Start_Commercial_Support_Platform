# ADR-005 — CE-2: Commercial Assertion scope (resolves CE-2; supersedes ADR-001 §2)

**Ngày:** 2026-11-18
**Trạng thái:** Accepted — owner approval (Phạm Đình Hải) 2026-11-18, theo đề xuất R2-P-01/R2-P-02 và review A (`docs/reports/r2-2026-11-18/architecture-canonical-review.md`)
**Giải quyết:** `OPEN_DECISIONS.md` CE-2. **Không** giải quyết CE-1 (transition table vẫn OPEN; ADR-001 §1 còn hiệu lực).
**Liên quan:** I-03, I-04, I-05, I-08, I-12 · `COMMERCIAL_EVENT_MODEL.md` §2 · `TRUST_AND_EVIDENCE.md` · ADR-001

## Context

CE-2 hỏi `CommercialEvent` chỉ là ý nghĩa suy luận (AI-derived) hay là primitive tổng quát cho observed/claimed/imported/inferred. Hai nhóm nguồn canonical đều đúng một phần: I-04 bắt buộc thay đổi *suy luận* đi qua pipeline Interaction → AI → CE → Evidence → Policy → Action; trong khi `TRUST_AND_EVIDENCE.md` mô tả assertion observed/claimed/imported có provenance. Code hiện có (ADR-001 interim) đã tách `CommercialEvent` (inferred) và `AssertionEnvelope` (non-inferred) dùng chung `AssertionId` + `ProvenanceEnvelope`, có test. Vòng R2 thêm governed actions và adaptive integration nên cần chốt: action do AI đề xuất có phải gắn CE không (R2-P-01), và kết quả action đã xác minh có được đổi Commercial State không (R2-P-02).

## Options

1. **Generalized single type:** mọi fact là `CommercialEvent` với `acquisitionMode`. Đơn giản truy vấn, nhưng làm loãng invariant riêng của inferred (confidence/model/rationale bắt buộc) thành điều kiện runtime, dễ vô tình cho AI ghi "observed".
2. **Inferred-only, không có khung chung:** đúng I-04 nhưng observed/claimed/imported thiếu chỗ đứng chuẩn → mỗi module tự chế provenance.
3. **Commercial Assertion umbrella với hai kiểu cụ thể (chọn):** một không gian định danh và provenance chung; kiểu nào mang invariant nấy, được type system cưỡng chế.

## Decision

1. **Commercial Assertion** là khái niệm bao (umbrella) cho mọi khẳng định có ý nghĩa thương mại về Lead/Customer/Handoff/Outcome. Mọi assertion có `AssertionId`, `ProvenanceEnvelope`, `acquisitionMode`, `assertionStatus` (draft/claimed/corroborated/superseded), append-only (I-05).
2. **`CommercialEvent` = assertion `inferred`** (AI/model-derived). Bắt buộc confidence (producer, model, version, rationale) và evidence pointer; luôn bắt đầu là `draft`; chỉ ảnh hưởng trạng thái qua Policy + hành động con người (I-03, I-04).
3. **`AssertionEnvelope` = assertion `observed | claimed | imported | user_confirmed`.** Không mang inferredMeaning/confidence. Dữ kiện từ provider chỉ thành `observed`/`imported` assertion qua **ánh xạ adapter tường minh + policy**; tag, trạng thái hội thoại, đơn POS, conversion của Ads **không bao giờ tự động** thành assertion hay Commercial State (I-10, I-11).
4. **Không phải mọi mutation là assertion.** Bản ghi kỹ thuật/vận hành — integration receipt, enrollment, checkpoint, telemetry, audit, vòng đời governed action, membership — **không** là Commercial Assertion. Chúng có thể được trích dẫn làm evidence.
5. **R2-P-01:** Governed action do actor `ai` đề xuất **phải** tham chiếu một `CommercialEvent` draft cùng workspace (và cùng lead nếu có) với ≥1 evidence pointer; thiếu → từ chối (`EVIDENCE_REQUIRED`). Đề xuất của con người phải có lead/context reference hoặc rationale; evidence tuỳ chọn nhưng hiển thị cho người phê duyệt. Phương án "cho phép với evidence UNKNOWN" bị loại: người phê duyệt không thể đánh giá rủi ro nếu thiếu căn cứ.
6. **R2-P-02:** Kết quả action đã xác minh **không bao giờ** trực tiếp đổi Commercial State/Outcome. Nó sinh một `AssertionEnvelope` `observed` (sourceSystem = provider, sourceRecordId = providerReference, evidence = readback) có thể được dẫn chiếu làm evidence. Chuyển trạng thái vẫn chỉ qua hành động con người hoặc transition policy của CE-1 (OPEN).

## Why this is the best fit for the end product

- Một xương sống provenance/evidence cho toàn bộ dữ kiện thương mại (truy vết, audit, giải thích được) mà không xoá ranh giới an toàn giữa *suy luận* và *quan sát*.
- Giữ nguyên code đã kiểm thử (không migration phá vỡ), mở rộng được cho CRM import, POS, Ads mà adapter không sở hữu ngữ nghĩa.
- Agentic AI về sau vẫn chỉ sinh draft có căn cứ; con người và policy là nơi quyết định.

## Consequences / implementation

- `COMMERCIAL_EVENT_MODEL.md` §2 và `OPEN_DECISIONS.md` cập nhật trỏ tới ADR này (supersede có ngày, không xoá lịch sử).
- Governed-action `propose`: thêm `commercialEventRef` + `evidenceRefs`; AI thiếu → `EVIDENCE_REQUIRED` (workstream R3-G).
- Verifier outcome → port tạo `AssertionEnvelope observed`; không gọi state transition (R3-G).
- Comment `// OPEN: CE-2` đổi thành `// ADR-005`; `// OPEN: CE-1` giữ nguyên.

## Revisit trigger

Khi RFC CE-1 chốt transition table, hoặc bằng chứng Gate L3/L4 cho thấy cần assertion kind mới.
