# Meta API Versioning — snapshot 2026-09-10

## Current snapshot
- Meta official developer news currently lists **Graph API v26.0** and **Marketing API v26.0** as the latest major release, introduced on 2026-07-29.
- Meta versions have independent deprecation timelines; an endpoint existing in an older version does not imply it remains usable in the current version.

## Coding rule
1. Never hard-code the version from this snapshot without rechecking the current changelog.
2. Record the tested API version per connector.
3. Track deprecation dates and breaking changes as operational risk.
4. For official Postman examples, note that sample responses can show older version headers; use current docs as source of truth.

Official developer news: https://developers.meta.com/blog/
