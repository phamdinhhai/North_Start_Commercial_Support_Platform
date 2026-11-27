# Recipient flow root cause

The recovered timeout combined two defects: synthetic intake persisted an Admin-owned Lead while Lead Detail exposed owner commands only to Sales, and the test clicked the Accept button without submitting its required command dialog.

The UI now reflects existing owner-only backend policy for Admin/Manager/Sales current owners. The test resolves the recipient UUID from the signed session, submits the command dialog, asserts HTTP 201, persisted owner transfer, accepted Work Item, version increase and audit history.

The full journey now passes after correcting later UI contract issues: the Contacting transition precedes contact recording, complete uses `input[name=confirmed]`, reopen is labeled `M? k? ti?p`, and correction is available from the Context tab.
