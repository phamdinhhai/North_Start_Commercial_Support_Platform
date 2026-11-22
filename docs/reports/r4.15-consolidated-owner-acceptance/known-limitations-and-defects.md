# Known limitations and defects

- Hosted CI has not run for the R4.15 branch because it is still local.
- Provider API/SDK observations use fabricated loopback emulators. Live provider integration, live data admission and provider mutations are disabled.
- The historical Pancake send is unresolved; no retry is allowed. Full Pancake history completeness remains UNKNOWN.
- P4 conversation mutations and P5 North Start real-provider E2E are not verified.
- The AI domain/governed-action contracts are not a registered autonomous model runtime.
- Browser extension coexistence with Pancake V2 or AdsMeta production extensions is not verified.
- SDK distribution remains conditional and the five moderate development dependency advisories remain under review.
- Session state is process-local; restart requires sign-in again. Unsaved draft recovery is limited to the tested session-expiry paths and must not be described as durable draft storage.
- Attribution, revenue, Customer/Lead merge, payment, deposit and bank-detail semantics remain UNKNOWN or disabled.
- Preview manifests contain generated secrets and must remain on the local machine. Do not publish them or paste their contents into chat.

No known release-blocking failure remains in the tested synthetic paths. Owner acceptance is still required before merging to `main`.
