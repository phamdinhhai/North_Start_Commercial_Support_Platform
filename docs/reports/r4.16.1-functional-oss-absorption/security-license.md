# Security and license review

Native APIs use existing Northstar AuthContext, workspace scope and PostgreSQL receipts. Conversation authority remains UNVERIFIED and completeness UNKNOWN. Search is bounded 2..120 characters and cursor-scoped. Ads aggregation excludes foreign workspace and non-synthetic records. Upstream MIT/community notices and rejection boundaries are documented in R4.16 reports. No credentials or upstream runtime entered the repository.
