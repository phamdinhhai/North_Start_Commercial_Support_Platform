# Browser integration runtime

The installable local MV3 package is under
`product/src/adapters/hybrid-browser-runtime/`. It has explicit Configure,
Start, Upload, Stop and Disconnect actions; metadata-only DOM observation for
Pancake, Meta Ads and HubSpot candidates; a bounded durable local outbox;
explicit ACK handling; restart gap reporting; and optional `chrome.debugger`
diagnostics. The debugger permission is optional and never used during ordinary
capture.

`product/scripts/hybrid-browser/package.mjs` creates a deterministic unpacked
fixture package and reuses the Research Companion lifecycle and ZIP/secret
scanner. Fixture Chromium smoke passed: fabricated Pancake page → extension
context → one minimized observation → `stored` ACK. No raw DOM, provider cookies,
provider tokens or provider response bodies were uploaded. The independently
issued North Start enrollment capability is used only for backend authentication.

The final combined test on `0162e524cda1a4b8ce886417e80330f950fed37b` passed all
three browser adapters through actual OIDC/CSRF enrollment, Nest AppModule and
PostgreSQL. The tested 10-file package SHA-256 is
`ce0cb4d261dd9ba0d7f2a186b4ff339c7e34401cb6cff94e23bd4b8f8a014b57`.
Its fixture build grants loopback host access explicitly for automated sandbox
testing; the ordinary build retains exact optional provider/backend host grants.
