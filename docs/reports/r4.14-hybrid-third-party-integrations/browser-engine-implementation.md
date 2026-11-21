# Browser integration runtime

The installable local MV3 package is under
`product/src/adapters/hybrid-browser-runtime/`. It has explicit Configure,
Start, Upload, Stop and Disconnect actions; metadata-only DOM observation for
Pancake, Meta Ads and HubSpot candidates; an encrypted-value-free local outbox;
explicit ACK handling; restart gap reporting; and optional `chrome.debugger`
diagnostics. The debugger permission is optional and never used during ordinary
capture.

`product/scripts/hybrid-browser/package.mjs` creates a deterministic unpacked
fixture package and reuses the Research Companion lifecycle and ZIP/secret
scanner. Fixture Chromium smoke passed: fabricated Pancake page → extension
context → one minimized observation → `stored` ACK. No raw DOM, cookies, tokens,
or provider response bodies were uploaded.
