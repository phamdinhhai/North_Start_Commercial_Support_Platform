'# Upstream to native mapping

Chatwoot `conversationHelper.js` source-message dedupe and latest non-activity semantics are now represented by the native Northstar conversation projection contract. Northstar retains provider/page/conversation/message scope, receipt provenance, UNVERIFIED authority and UNKNOWN completeness. The Nest API is `/v1/source-integrations/conversations`; the PostgreSQL store projects existing `source_receipt` and `commercial_envelope` rows without adding a parallel conversation database.

Atomic task date grouping remains the next bounded port; existing Northstar work items remain canonical. Ads reporting remains pending backend observation input; the fixture UI is not promoted.
'
