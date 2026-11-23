# Page token and target validation

The official local contract defines account `access_token` for `/api/v1` and Page `page_access_token` for `/api/public_api/v1`. Existing captured Page-token material was reused in memory; generation/rotation was never called.

The approved read run used the documented minimal account metadata request and exact conversation history route. Account metadata matched the allowlisted alias to the native Page. History responses matched the exact native conversation, every message Page/conversation scope, and the captured contact reference. This is operation-scoped provider evidence; it is not production credential approval or North Start real-data admission.

The later send attempt had one POST attempt but no readable provider result. Recovery history was correctly scoped, yet the unique marker was absent, so acceptance, delivery and read state remain UNKNOWN. No retry was made.
