'# Feature acceptance

Native conversation service/controller/store path implemented with scoped query options, stable created-at/id ordering, grouped conversation identity, message identity where available, null message content when receipts do not carry content, UNVERIFIED authority and UNKNOWN completeness. Service/API tests pass 16/16. PostgreSQL implementation uses existing source receipt/envelope authority and does not add migrations.

Foreign workspace is enforced by the existing authenticated store query; outbound message APIs remain absent.
'
