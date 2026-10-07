-- 004_envelope_workspace_scope — P1-1 fix (R-06 within I-09/R-01)
--
-- Lỗi cũ: UNIQUE (connection, external_record_id) không có workspace → workspace B
-- ingest cùng connection+external ID (tên connection từ hệ thống ngoài rất dễ trùng)
-- sẽ nhận ENVELOPE CỦA A (raw evidence xuyên tenant).
--
-- Nguyên tắc migration dữ liệu cũ:
--   1. Backfill CHỈ khi suy ra được một cách tất định: mọi lead tham chiếu envelope
--      cùng MỘT workspace → gán workspace đó.
--   2. Envelope có lead tham chiếu mà workspace suy ra MÂU THUẪN (nhiều workspace —
--      dấu vết của chính bug cũ) → RAISE EXCEPTION, KHÔNG đoán.
--   3. Envelope KHÔNG có lead nào tham chiếu → KHÔNG mặc định là dữ liệu được phép bỏ.
--      Raw evidence chưa được lead hoá vẫn là bằng chứng (I-12: raw immutable, migration
--      không có quyền huỷ). Những hàng đó được SAO NGUYÊN TRẠNG sang bảng
--      commercial_envelope_quarantine (kèm lý do + thời điểm) rồi mới rời bảng chính để
--      SET NOT NULL đứng được. Điều kiện áp dụng rất hẹp: workspace_id IS NULL VÀ không có
--      lead nào tham chiếu. Quyết định cuối (gán workspace thật, hay xoá vì chắc chắn là
--      dữ liệu thử) thuộc về người vận hành khi đã nhìn thấy payload — migration chỉ giữ
--      và báo cáo, không tự quyết.
--   4. Không có đường nào âm thầm xoá raw evidence: down() đưa hàng quarantine trở lại.
--
-- DB hiện tại là dev/pilot (EVIDENCE_REGISTER: no primary evidence) nên số hàng bị
-- quarantine dự kiến bằng 0; nếu khác 0 thì NOTICE + bảng quarantine cho thấy đúng cái gì.

ALTER TABLE commercial_envelope ADD COLUMN workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE;

-- (1) Backfill tất định: envelope được tham chiếu bởi lead(s), tất cả cùng một workspace.
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

-- (2) Từ chối đoán với bản ghi mâu thuẫn: còn envelope có lead tham chiếu mà chưa xác
-- định được workspace.
DO $$
DECLARE ambiguous_count INT;
BEGIN
  SELECT COUNT(*) INTO ambiguous_count
    FROM commercial_envelope ce
   WHERE ce.workspace_id IS NULL
     AND EXISTS (SELECT 1 FROM lead le WHERE le.source_envelope_id = ce.id);
  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION
      '004_envelope_workspace_scope: % envelope(s) referenced by leads but workspace undeterminable (multi-workspace references). Refusing to guess. Resolve manually (assign the correct workspace, or delete rows proven to be disposable) before re-running.',
      ambiguous_count;
  END IF;
END $$;

-- (3) Giữ lại, không huỷ: bản sao nguyên trạng sang quarantine.
CREATE TABLE IF NOT EXISTS commercial_envelope_quarantine (
  id UUID PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  connection TEXT NOT NULL,
  external_record_id TEXT NOT NULL,
  external_event_type TEXT NOT NULL,
  source_captured_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL,
  raw_payload_hash TEXT NOT NULL,
  mapping_status TEXT NOT NULL,
  mapping_error TEXT,
  canonical_projection JSONB,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  workspace_id TEXT,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quarantine_reason TEXT NOT NULL DEFAULT 'no lead reference; workspace not inferable (004_envelope_workspace_scope)'
);

INSERT INTO commercial_envelope_quarantine (
  id, schema_version, connection, external_record_id, external_event_type,
  source_captured_at, ingested_at, raw_payload, raw_payload_hash,
  mapping_status, mapping_error, canonical_projection, is_synthetic, workspace_id
)
SELECT ce.id, ce.schema_version, ce.connection, ce.external_record_id, ce.external_event_type,
       ce.source_captured_at, ce.ingested_at, ce.raw_payload, ce.raw_payload_hash,
       ce.mapping_status, ce.mapping_error, ce.canonical_projection, ce.is_synthetic, ce.workspace_id
  FROM commercial_envelope ce
 WHERE ce.workspace_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM lead le WHERE le.source_envelope_id = ce.id)
ON CONFLICT (id) DO NOTHING;

-- Xóa khỏi bảng chính CHỈ những hàng đã có bản sao trong quarantine (không mất dữ liệu).
DELETE FROM commercial_envelope ce
 WHERE ce.workspace_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM lead le WHERE le.source_envelope_id = ce.id)
   AND EXISTS (SELECT 1 FROM commercial_envelope_quarantine q WHERE q.id = ce.id);

DO $$
DECLARE total INT; non_synthetic INT;
BEGIN
  SELECT COUNT(*) INTO total FROM commercial_envelope_quarantine;
  SELECT COUNT(*) INTO non_synthetic FROM commercial_envelope_quarantine WHERE NOT is_synthetic;
  RAISE NOTICE '004_envelope_workspace_scope: envelope(s) without an inferable workspace were QUARANTINED, not deleted. quarantine total=%, not-marked-synthetic=% (these need a human decision). Verify before trusting the NOT NULL constraint.', total, non_synthetic;
END $$;

ALTER TABLE commercial_envelope ALTER COLUMN workspace_id SET NOT NULL;

-- Replace the unscoped constraint with the workspace-scoped key.
ALTER TABLE commercial_envelope DROP CONSTRAINT commercial_envelope_connection_external_record_id_key;
ALTER TABLE commercial_envelope ADD CONSTRAINT commercial_envelope_workspace_connection_record_key
  UNIQUE (workspace_id, connection, external_record_id);
