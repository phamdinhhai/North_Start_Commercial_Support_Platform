# Source association transition and visibility matrix

| Command | Immutable origin | Effective Lead | Current visibility |
|---|---|---|---|
| none | receipt lead | none | origin if authorized |
| link | preserved | target Lead | target relationship only when origin and target are authorized |
| unlink | preserved | none | origin if authorized; prior link remains audit history |
| reject | preserved | none | origin if authorized; rejected relationship excluded |
| repeated idempotent command | preserved | unchanged | same result, no duplicate mutation |
| stale expected version | preserved | unchanged | 409 conflict, no mutation |
| revoked access after link | preserved | preserved | fail closed; no hidden relationship metadata |

Raw receipts and origin Lead relationships are immutable. SourceEpisodeLinkStore remains the only relationship mutation authority.
