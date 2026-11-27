# Authorization review

Conversation grouping and message expansion now resolve the latest source episode link before applying Lead policy. A `link` uses `effective_lead_id`; `unlink` and `reject` fall back to the immutable origin Lead. Workspace, active connection and existing owner/active-recipient policy are applied before grouping and expansion.

Only authorized Lead IDs, display names and statuses are projected. Inaccessible associations do not contribute counts, truncation metadata or pagination signals. Rejected links are excluded.

The existing SourceContinuityService remains the mutation authority and keeps administrator-only link/unlink/reject commands, version checks, idempotency, digest and audit behavior.
