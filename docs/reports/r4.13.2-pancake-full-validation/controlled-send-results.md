# Controlled send results

Status: **SEND_UNRESOLVED — MANUAL REVIEW REQUIRED**.

One official conversation-scoped POST was attempted after the read target and contact proof passed. The request used the documented `reply_inbox` + text `message` body and the existing Page token. The transport did not produce a readable HTTP/business response. The durable ledger entered `SEND_AMBIGUOUS`; recovery performed history-only GETs and found no unique test marker. No second POST or retry occurred.

Confirmed: one POST attempt, zero confirmed provider writes, no duplicate confirmed, no cleanup action. Accepted/delivered/read status: UNKNOWN. Do not send another message or mutate tags/assignment/status/notes until an Owner-approved manual review resolves the provider-side state.

The later transport audit identified a potential Unicode stdin encoding defect in the Python bridge. This is another reason to preserve UNKNOWN and avoid replay; the transport was corrected only in local code after the run.
