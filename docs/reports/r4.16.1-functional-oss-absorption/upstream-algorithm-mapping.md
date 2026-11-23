# Upstream algorithm to native mapping

| Source | Native implementation | Tests |
|---|---|---|
| Chatwoot conversation/message ordering, dedupe and scoped read ideas | `SourceIntegrationService.conversations`, `PgSourceIntegrationStore.conversationPage`, `SourceConversation` ports and React `NativeConversationPanel` | source-integration service/http tests; bounded workspace/cursor cases |
| Atomic task date grouping | `product/src/domain/work/task/task-buckets.ts` | overdue/today/tomorrow/week/later/completed/invalid/timezone tests |
| Atomic list/search filtering ideas | `leadPage` search and `NorthStartDataProvider` `filter.q` | search projection, input-bound and cursor-scoped tests |
| Ads Studio reporting grouping | `aggregateSyntheticAdsReport` over Northstar normalized metrics | aggregation, foreign workspace and currency/timezone slice tests |

Upstream code was not copied where its runtime or schema conflicted with Northstar. Northstar PostgreSQL, OIDC, RBAC, receipts and audit remain authoritative.
