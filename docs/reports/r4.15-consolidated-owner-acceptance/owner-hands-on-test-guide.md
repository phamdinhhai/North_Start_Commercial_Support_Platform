# Owner hands-on test guide

Open `http://127.0.0.1:51135/v1/operator`. The fixture login page is labelled **Loopback fixture identity**. Select `owner` for the Sales owner, `recipient` for the handoff recipient, `bystander` for Manager, `viewer` for read-only checks, `admin` for integration/source health, and `foreign` for the separate workspace. These are fabricated local identities, not employees.

1. Select `owner`, choose **Synthetic** in the classification filter, create or open `DEMO - Studio La Xanh (FABRICATED)`, inspect source evidence and confirm `UNKNOWN` attribution remains visible.
2. Open **Handoff to Sales**, select `recipient`, record an invented callback and save. In a separate browser context select `recipient`, choose **Synthetic**, refresh, accept the handoff and inspect audit history.
3. Record a phone contact attempt with `no-answer` and an invented follow-up implication. Create an independent next action, reschedule it, complete it with a human-claim declaration, reopen it as a successor, then advance through Contacting and Follow-up.
4. Record outcome `Won`, then correct it to `Unknown` with reason `payment not verified`. Confirm both claims and the correction remain in the audit view. `Won` is a claim, not verified revenue.
5. Select `bystander` in another context, choose **Synthetic** in Manager exceptions, and inspect scanned handoff/work classifications. Manager visibility does not grant Sales mutation rights.
6. Select `viewer` and confirm Lead creation/mutation is denied. Select `foreign` and confirm the demonstration Lead returns not found. Do not paste any token into the development-token field.
7. Use the recovery controls by signing out/re-authenticating, then restart only after closing unsaved dialogs. Reopen the Lead and verify committed history survives.
8. Open the Hybrid Preview fixture and the second Operator URL. The extension package is at `D:\AI-for-Enterprise\r415-private\hybrid-package\north-start-hybrid-runtime.zip`. In Chromium, load it unpacked from the package's `unpacked` folder, configure the Operator origin and a signed enrollment produced by the Admin integration enrollment endpoint, then visit the Pancake/Meta/HubSpot fixture paths. Observe the minimized context, upload it and confirm receipt/UNKNOWN health. Repeat the same capture to verify dedupe.

Record personal acceptance separately. Automated smoke evidence confirms the first seven paths on fabricated data; it is not Owner acceptance. Note confusing labels, missing controls, visual problems, incorrect UNKNOWN states and any required product changes.
