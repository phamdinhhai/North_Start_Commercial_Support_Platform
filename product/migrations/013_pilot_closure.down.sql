-- Rollback requires stopping closure writes; export history before explicitly removing tables.
DROP TABLE pilot_closure_command;
DROP TABLE pilot_context_revision;
DROP FUNCTION reject_pilot_closure_rewrite();
