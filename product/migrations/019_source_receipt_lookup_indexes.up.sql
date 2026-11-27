-- Measured local fabricated baseline: the 018 native index has a conversation_id
-- prefix gap for message lookup; explicit event lookup scans unrelated receipts.
CREATE INDEX source_receipt_message_history
 ON source_receipt(workspace_id,native_system,page_id,message_id,created_at,id);
CREATE INDEX source_receipt_explicit_event
 ON source_receipt(workspace_id,native_system,page_id,event_id,revision)
 WHERE event_id IS NOT NULL;
