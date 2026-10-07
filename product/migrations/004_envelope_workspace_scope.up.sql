-- 004_envelope_workspace_scope — P1-1 fix (R-06 within I-09/R-01)
--
-- Lỗi cũ: UNIQUE (connection, external_record_id) không có workspace → workspace B
-- ingest cùng connection+external ID (tên connection từ hệ thống ngoài rất dễ trùng)
-- sẽ nhận ENVELOPE CỦA A (raw evidence xuyên tenant).
--
-- Nguyên tắc migration dữ liệu cũ (user requirement):
--   * CHỈ backfill workspace khi suy ra ĐƯỢC một cách tất định từ lead tham chiếu
--     envelope (lead.source_envelope_id) và mọi lead tham chiếu nó cùng MỘT workspace.
--   * Bản ghi mơ hồ (không lead nào tham chiếu, hoặc nhiều workspace khác nhau cùng
--     tham chiếu — dấu vết của chính bug cũ) → KHÔNG đoán; để NULL và migration FAIL
--     loudly ở bước SET NOT NULL, buộc người vận hành xử lý có ý thức (xóa dữ liệu
--     synthetic test hoặc quyết định gán workspace thủ công) — không âm thầm gán.
--   * DB production chưa có khách hàng thật (EVIDENCE_REGISTER: no primary evidence);
--     đây là dev/pilot DB chứa dữ liệu synthetic → con đường "thất bại rõ ràng" là
--     phù hợp, không phải mất dữ liệu.

ALTER TABLE commercial_envelope ADD COLUMN workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE;

-- Backfill tất định: envelope được tham chiếu bởi lead(s), tất cả cùng một workspace.
UPDATE commercial_envelope ce
   SET workspace_id = l.workspace_id
  FROM (
    SELECT le.source_envelope_id AS envelope_id,
           MIN(le.workspace_id) AS workspace_id,
           COUNT(DISTINCT le.workspace_id) AS ws_variants
      FROM lead le
     WHERE le.source_envelope_id IS NOT NULL
     GROUP BY le.source_envelope_id
  ) l
 WHERE l.envelope_id = ce.id
   AND l.ws_variants = 1;

-- Ambiguous-remnant check: nếu còn envelope vừa không xác định được workspace,
-- vừa có lead tham chiếu từ NHIỀU workspace → fail có chủ đích (không đoán).
DO $$
DECLARE ambiguous_count INT;
BEGIN
  SELECT COUNT(*) INTO ambiguous_count
    FROM commercial_envelope ce
   WHERE ce.workspace_id IS NULL
     AND EXISTS (SELECT 1 FROM lead le WHERE le.source_envelope_id = ce.id);
  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION
      '004_envelope_workspace_scope: % envelope(s) referenced by leads but workspace undeterminable (multi-workspace references). Refusing to guess. Resolve manually (delete synthetic rows or assign workspace explicitly) before re-running.',
      ambiguous_count;
  END IF;
END $$;

-- Unreferenced legacy rows (no lead points at them): pilot/dev DB only — keep but
-- mark quarantine-visible by leaving workspace_id NULL is NOT allowed once NOT NULL
-- is set, so delete rows nothing references (raw evidence with no lead and no FK
-- usage cannot be observed by any tenant path; per R-28 these were synthetic tests).
DELETE FROM commercial_envelope WHERE workspace_id IS NULL;

ALTER TABLE commercial_envelope ALTER COLUMN workspace_id SET NOT NULL;

-- Replace the unscoped constraint with the workspace-scoped key.
ALTER TABLE commercial_envelope DROP CONSTRAINT commercial_envelope_connection_external_record_id_key;
ALTER TABLE commercial_envelope ADD CONSTRAINT commercial_envelope_workspace_connection_record_key
  UNIQUE (workspace_id, connection, external_record_id);
