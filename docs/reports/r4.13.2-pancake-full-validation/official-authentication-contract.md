# Official authentication contract (local evidence)

Source: `D:\Download\Pancake_Document\pancake_api_document.yaml` (offline only).

- Account endpoint: `GET https://pages.fm/api/v1/pages?access_token=<user token>`.
- Query field `access_token` is required. Optional `fields` supports a minimal selection such as `activated{id,username}`. `settings{page_access_token}` is documented as admin-only and may be empty for non-admin callers.
- Page-level endpoints use `page_access_token` on `https://pages.fm/api/public_api/v1/...`.
- `POST /pages/{page_id}/generate_page_access_token` uses the account `access_token`; documentation says generation/refresh invalidates a previous token. Reuse an existing captured PageToken where available; do not generate during validation.
- No additional HTML/attestation requirement is specified by this source.

Sanitized capture correlation: page id was observed in local DevTools records; page alias was observed in URL/referrer only; provider page metadata correlation remains unproven. Token values and personal data were not copied.


## Local credential/cookie content inspection

Local cookie JSON was fully parsed, and JWT-shaped values were decoded only in memory for structural correlation with the account token. No signature/authentication claim follows from decoding. 1 cookie values were JWT-shaped; account-claim equality and expiry were checked without retaining values or native account/session identifiers. Non-JWT locale/payment-session tracking cookies do not establish Page API rights. The actual official API read accepted the existing Page token; cookie-only behavior is a separate UI contract.
