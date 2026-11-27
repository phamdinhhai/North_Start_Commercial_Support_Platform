-- Explicit weaker downgrade: preserves all history, removes INSERT tuple validation.
-- Existing 020 foreign keys and append-only guards remain. Do not resume writers
-- on this weaker schema without engineering approval; re-up preflight can refuse
-- any inconsistent rows admitted during the downgrade.
DROP TRIGGER source_link_receipt_guard ON source_episode_link;
DROP FUNCTION enforce_source_link_receipt();
