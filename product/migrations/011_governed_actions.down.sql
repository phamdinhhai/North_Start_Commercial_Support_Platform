-- Destructive rollback: drops governed-action proposals and their append-only audit trail.
-- Export governed_action_event and governed_action_refusal before running against retained data (I-05).
DROP TABLE governed_action_refusal;
DROP TABLE governed_action_event;
DROP TABLE governed_action_proposal;
DROP FUNCTION governed_action_event_append_only();
DROP FUNCTION governed_action_proposal_guard();
