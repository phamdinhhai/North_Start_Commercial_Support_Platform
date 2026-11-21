# Provider contract reconciliation

Official REST YAML, historical DevTools metadata and current scoped reads agree on the message-history route shape and Page/conversation native scope. The YAML documents `current_count` as positional and text-vs-content-id message alternatives. DevTools shows private UI routes and cursor-shaped conversation search, but those routes are not promoted to official APIs.

Current provider evidence:

- Account private probe: accepted, but private/unstable and not Page entitlement.
- Cookie-only Page permission private probe: HTTP 200 with `success=false`; no conclusion about user-token rights.
- Later user-token Page-role probe: HTTP 200/success; user ID matched fresh `/me.uid`, role present, explicit matching-user permission map absent. Mutation capability remains UNKNOWN.
- Official history route: two successful bounded reads, 30 then 13 scoped messages.
- UI alias: cookie-authenticated HTML 200 with alias text but no native identity bootstrap; earlier no-session 302.
- Send, webhook, rate-limit, lifecycle, attachment and mutation behavior: UNKNOWN or BLOCKED.

The upstream REST/Webhook specifications retain their previously recorded validation diagnostics; no source overlay or silent correction was introduced.
