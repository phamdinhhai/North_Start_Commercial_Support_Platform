-- 003_pilot_loop down — rollback: work item table + pilot columns (chính xác theo 003 up)
DROP TABLE IF EXISTS pilot_work_item;
ALTER TABLE lead DROP COLUMN IF EXISTS source_envelope_id;
ALTER TABLE handoff DROP COLUMN IF EXISTS recipient_user_id;
ALTER TABLE lead DROP COLUMN IF EXISTS owner_user_id;
