# Meta Ads adapter acceptance

The Meta Ads read connector uses the official Business SDK in a local HTTP
emulator. It validates account scope, currency, timezone, date ranges,
pagination-shaped output and 401/403/429 handling. No budget, conversion or
campaign mutation is present. Fabricated Meta Ads observations use
`meta_ads` native identities and remain technical evidence with UNKNOWN
completeness.
The timezone is the configured fixture account label, not independently
corroborated provider metadata. The SDK slice validates one insights response;
it does not claim full multi-page reporting completeness or production egress
confinement.
