# ADR-006 — PM-1: Capability matrix, principal identity and membership lifecycle (resolves PM-1)

**Ngày:** 2026-11-18
**Trạng thái:** Accepted — owner approval (Phạm Đình Hải) 2026-11-18, theo đề xuất R2-P-05…R2-P-08 và P-2026-11-18-06
**Giải quyết:** `OPEN_DECISIONS.md` PM-1. I-09 (frozen) giữ nguyên và là ràng buộc cao nhất.
**Liên quan:** I-03, I-05, I-09 · `docs/reports/r2-2026-11-18/{iam-membership.md,enrollment-issuance.md,governed-actions.md,architecture-canonical-review.md}`

## Context

OIDC + membership (migration 010) khiến role manager/admin có thể gán cho user thật, nên phạm vi các role không còn có thể để mở. Các bề mặt mới (enrollment connector, connector health, membership, governed actions) cần quyền rõ ràng. Base roles hiện có: `admin`, `manager`, `sales`, `viewer` — **không thêm role**.

## Options

- Manager phạm vi team bắt buộc ngay (cần entity Team chưa có) · manager toàn workspace · **ma trận theo capability với scope resolver (chọn)**.
- Principal = `sub` · `iss+sub` · **internal user id ánh xạ từ external identities (chọn)**.
- Membership: versioned row · **revoke-terminal + grant row mới (chọn)** · nhóm IdP ánh xạ server-side (loại: IdP không được cấp quyền thương mại).

## Decision — capability matrix

| Capability | admin | manager | sales | viewer | AI / service |
|---|---|---|---|---|---|
| Đọc lead/context/hội thoại liên quan | workspace | scope quản lý¹ | lead được assign hoặc recipient của work đang active (I-09) | như sales, chỉ đọc | — |
| Mutation công việc lead (accept/advance/complete/reschedule/outcome) | theo `work-mutation-policy` hiện hành (owner/recipient) — không mở rộng | như admin | owner/recipient | — | không (I-03) |
| Handoff/reassign lead | ✓ | ✓ trong scope | handoff lead của mình | — | — |
| Export / delete dữ liệu | ✓ | — | — | — | — |
| Identity merge | chỉ sau ID-1 | — | — | — | — |
| Membership grant/revoke/đổi role | ✓ (workspace của mình, audited) | — | — | — | — |
| Enrollment connector issue/revoke | ✓ | — | — | — | — |
| Connector health (đọc) | ✓ | ✓ | — | — | — |
| Governed action — propose | ✓ | ✓ | trên lead được assign | — | AI: draft + CE ref (ADR-005) |
| Governed action — authorize/execute/verify, risk **low** | ✓ | ✓ | — | — | không |
| Governed action — authorize/execute/verify, risk **high**² | ✓ | — | — | — | không |
| Kill switch | ✓ | — | — | — | — |
| Ingest observation | — | — | — | — | connector service identity: chỉ `observation:append` |

¹ Scope quản lý = toàn workspace trong LVP; được thu hẹp theo Team khi entity Team ra đời (resolver `ManagerScope`, không đổi API).
² High = tiền/ngân sách/đơn hàng/thanh toán/tin nhắn gửi ra khách hàng/upload conversion. Luôn separation of duties (approver ≠ proposer); approval gắn digest và hết hạn.

Quy tắc chung: deny-by-default; IdP role/group **không bao giờ** cấp quyền thương mại — base role chỉ đến từ membership server-side; workspace chỉ đến từ membership đã xác minh, không từ header/body/claim.

## Decision — principal & membership

1. **Principal (R2-P-07):** bảng `platform_user(id UUID)` + `external_identity(issuer, subject) → user_id`. `AuthContext.userId` = internal UUID. Ownership lead tham chiếu internal id. Đổi/thêm IdP chỉ thêm `external_identity`, không chuyển quyền sở hữu. Thay thế dạng tạm `oidc:<hash>:<sub>` trước khi có dữ liệu thật.
2. **Membership lifecycle (R2-P-06):** revoke là terminal; cấp lại = row mới (unique chỉ trên row `active`); đổi role = revoke + grant (giữ lịch sử); DELETE bị chặn; mọi grant/revoke vào `membership_audit` với actor là internal user id của admin. Hiệu lực revoke: request kế tiếp. Vô hiệu hoá ở IdP có hiệu lực khi token hết hạn → access token TTL ≤ 15 phút.
3. **Issuer-secret enrollment (R2-P-08):** chỉ chạy khi `DEPLOYMENT_MODE` ∈ {local, test} **và** opt-in; pilot/production fail closed. Gỡ hẳn sau khi đường OIDC được xác minh trên môi trường pilot.

## Why this is the best fit

Giữ nguyên ranh giới I-09 cho sales; tách rõ quyền rủi ro cao (credential connector, membership, action tốn tiền) về admin; manager có quyền giám sát cần cho vận hành SMB mà vẫn mở đường thu hẹp theo team; internal user id tránh khoá cứng vào một IdP và giữ ownership ổn định — điều bắt buộc với SaaS đa tenant.

## Consequences / implementation (workstreams R3-D, R3-G)

- Enrollment principal path: manager → **403**; admin only.
- Migration 010 (chưa release, sửa tại chỗ): `platform_user`, `external_identity`, membership tham chiếu `user_id`, partial unique active, audit actor.
- Admin membership API tối thiểu (grant/revoke/list) — admin, audited, workspace từ context.
- Production `ActionPolicy`, `ActorResolver`, lead-scope hook cho governed actions theo bảng trên.
- `// OPEN: PM-1` đổi thành `// ADR-006`.

## Revisit trigger

Kết quả kiểm định role với tester bên ngoài (Gate L3/L4); khi có entity Team; khi thêm role mới (cần ADR mới).
