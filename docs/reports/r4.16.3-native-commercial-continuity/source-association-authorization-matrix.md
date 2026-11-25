# Source association authorization matrix

| Association state | Sales/viewer origin access | Sales/viewer effective access | Visible |
|---|---:|---:|---|
| No explicit link | required | n/a | Origin evidence only |
| Explicit link | required | required | Effective association and evidence |
| Unlink | required | n/a | Origin evidence; link is no longer effective |
| Reject | required | n/a | Origin evidence; rejected relationship hidden |
| Admin/manager | workspace scope | workspace scope | Authorized workspace records |
| Revoked connection/membership | no | no | No conversation, IDs, counts or truncation state |

The explicit link rule is fail-closed: access to the effective Lead alone does not disclose evidence whose immutable origin Lead is inaccessible. Authorization is applied before grouping, message expansion, association projection and pagination.
