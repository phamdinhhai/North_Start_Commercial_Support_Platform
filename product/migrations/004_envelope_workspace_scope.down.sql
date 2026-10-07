-- 004_envelope_workspace_scope down — quay về UNIQUE cũ, bỏ cột workspace_id.
-- Lưu ý: up có thể ĐÃ XÓA các envelope unreferenced (không đoán workspace) — không
-- thể khôi phục các hàng đó; down chỉ đảo ngược schema, không khôi phục dữ liệu.
ALTER TABLE commercial_envelope DROP CONSTRAINT IF EXISTS commercial_envelope_workspace_connection_record_key;
ALTER TABLE commercial_envelope ADD CONSTRAINT commercial_envelope_connection_external_record_id_key UNIQUE (connection, external_record_id);
ALTER TABLE commercial_envelope DROP COLUMN IF EXISTS workspace_id;
