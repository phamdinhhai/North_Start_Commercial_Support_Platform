# Evidence reconciliation

- Source inventory: **171** files (secret-bearing `.env` and cookie export remain withheld; hashes are omitted from public artifacts).
- Functional catalog: **153** detailed function records from all functional Markdown files.
- Official operations: **32** exact OpenAPI operations parsed from `pancake_api_document.yaml`.
- Webhook events/schemas: **5** event payload records parsed from `pancake_webhook_document.yaml`.
- Local captured observations: **198** sanitized routes from `download.devtools`; this is observed local capture evidence, not live provider validation.
- Live provider calls: **0**.

Each functional record includes explicit links, endpoint references, group, and North Start mapping; unsupported mappings are `UNKNOWN`. Credentials are never treated as capabilities.
