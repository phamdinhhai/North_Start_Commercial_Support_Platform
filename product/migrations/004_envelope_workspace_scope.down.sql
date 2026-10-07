-- 004_envelope_workspace_scope down — quay về UNIQUE cũ, bỏ cột workspace_id.
--
-- Nguyên tắc: down KHÔNG được làm mất raw evidence.
--   * Không DROP TABLE commercial_envelope_quarantine: bảng này là bản sao nguyên trạng
--     của các envelope chưa rõ scope. Nếu restore không chèn lại được (ví dụ va UNIQUE cũ),
--     dữ liệu vẫn còn trong quarantine để người vận hành xử lý. Muốn bỏ phải là quyết định
--     tường minh, kèm câu DELETE bên dưới (đã commented sẵn) — migration không tự xoá.
--   * Hàng quarantine được đưa trở lại bảng chính với workspace_id NULL (đã bỏ NOT NULL
--     trước khi chèn), ON CONFLICT DO NOTHING để không fail giữa chừng; hàng nào không
--     chèn lại được thì vẫn còn bản sao trong quarantine.

ALTER TABLE commercial_envelope DROP CONSTRAINT IF EXISTS commercial_envelope_workspace_connection_record_key;

ALTER TABLE commercial_envelope ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE commercial_envelope ADD CONSTRAINT commercial_envelope_connection_external_record_id_key UNIQUE (connection, external_record_id);

-- Hàng quarantine được đưa trở lại bảng chính với workspace_id NULL (đã bỏ NOT NULL
-- trước khi chèn), ON CONFLICT DO NOTHING để không fail giữa chừng; hàng nào không
-- chèn lại được thì vẫn còn bản sao trong quarantine.
--
-- Wrapped in a DO block + to_regclass check: a database that already applied an earlier
-- revision of 004 (which deleted unreferenced rows instead of quarantining them) has no
-- quarantine table at all, and down() must still work there.
DO $$
BEGIN
  IF to_regclass('public.commercial_envelope_quarantine') IS NOT NULL THEN
    INSERT INTO commercial_envelope (
      id, schema_version, connection, external_record_id, external_event_type,
      source_captured_at, ingested_at, raw_payload, raw_payload_hash,
      mapping_status, mapping_error, canonical_projection, is_synthetic, workspace_id
    )
    SELECT q.id, q.schema_version, q.connection, q.external_record_id, q.external_event_type,
           q.source_captured_at, q.ingested_at, q.raw_payload, q.raw_payload_hash,
           q.mapping_status, q.mapping_error, q.canonical_projection, q.is_synthetic, q.workspace_id
      FROM commercial_envelope_quarantine q
    ON CONFLICT (connection, external_record_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE commercial_envelope DROP COLUMN IF EXISTS workspace_id;

-- Sau khi đã kiểm tra dữ liệu trong quarantine, người vận hành có thể chủ động dọn:
--   DELETE FROM commercial_envelope_quarantine;
--   DROP TABLE commercial_envelope_quarantine;
