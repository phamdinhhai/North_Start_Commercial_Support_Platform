# Official authentication contract (local evidence)

Source: `D:\Download\Pancake_Document\pancake_api_document.yaml` (offline only).

- Account endpoint: `GET https://pages.fm/api/v1/pages?access_token=<user token>`.
- Query field `access_token` is required. Optional `fields` supports a minimal selection such as `activated{id,username}`. `settings{page_access_token}` is documented as admin-only and may be empty for non-admin callers.
- Page-level endpoints use `page_access_token` on `https://pages.fm/api/public_api/v1/...`.
- `POST /pages/{page_id}/generate_page_access_token` uses the account `access_token`; documentation says generation/refresh invalidates a previous token. Reuse an existing captured PageToken where available; do not generate during validation.
- No additional HTML/attestation requirement is specified by this source.

Sanitized capture correlation: page id was observed in local DevTools records; page alias URL was observed as a provider record. Token values and personal data were not copied.
