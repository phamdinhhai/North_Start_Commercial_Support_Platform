# Local end-to-end execution

Completed fixture path: fabricated Pancake page → Chromium MV3 runtime →
metadata-only outbox → bounded backend ACK emulator → scope/native assertions.
The PostgreSQL gate separately demonstrated durable receipt, duplicate replay,
conflict and revocation behavior for Pancake, Meta Ads and HubSpot envelopes.

The full combined Chromium-to-Nest-AppModule-to-PostgreSQL harness remains a
follow-up acceptance item. The current browser smoke uses a local ACK emulator,
so Gate I is partial and must not be described as provider or production E2E.
