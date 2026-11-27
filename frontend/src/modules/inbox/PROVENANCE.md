# Chatwoot community inbox reuse

- Upstream: https://github.com/chatwoot/chatwoot
- Immutable source: `5d1afdf3b2f32b88e21899d62fcde12f2c0c33d7`
- License: MIT Expat for community content; original notice in `CHATWOOT-LICENSE.txt`.
- Enterprise source: excluded, not used.

## Actual adopted source

`chatwoot-conversation-helper.mjs` is the complete upstream
`app/javascript/dashboard/helper/conversationHelper.js`, preserved as JavaScript
with a TypeScript declaration file. The module's source-message duplicate filter
and last non-activity message selector power the North Start fixture timeline and
conversation-card previews. Read/unread helper behavior is regression-tested but
is deliberately not shown as real delivery/read evidence.

`InboxPage.tsx` adapts the structure and interaction model of community
`components-next/Conversation/ConversationCard/ConversationCard.vue` and
`components-next/message/bubbles/Base.vue` to the Atomic CRM React primitives.
The contact/avatar/channel/message-preview list, directional bubbles, separate
activity rows and record context follow those inspected community modules. No Vue
component, Chatwoot authentication, Rails API, enterprise code or HTML message
formatter is transplanted. Text is rendered as React text, never raw HTML.

## Spike choice and limitations

The upstream checkout is a real sparse Git clone. Its package is Chatwoot 4.20.1,
Vue/Rails, with Redis/PostgreSQL and native/Ruby operational requirements. A full
standalone Rails service was **not run** on this Windows sandbox. Therefore no
standalone-service acceptance is claimed. The chosen option is a React inbox
adaptation with a directly reused compatible pure module, avoiding a second
commercial store or competing authentication model.

The sample threads are explicitly fabricated UI data and are not durable provider
observations. A separate evidence view reads actual authorized North Start APIs:
`GET /v1/pilot/leads?classification=synthetic&limit=25` and
`GET /v1/source-integrations/leads/:id/evidence?limit=25`. It displays stored
receipt metadata, keeps completeness UNKNOWN and does not infer Customer identity,
provider authentication, successful send or delivery. It intentionally displays a
bounded page, not a full-history claim. There are no provider or commercial writes.

## Maintenance and tests

Keep the upstream module pinned and compare its original path before future
upgrades. Preserve the license and run the inbox model suite plus browser
integration coverage. Example from repository root using Node 22:

```powershell
node --experimental-strip-types --test frontend/src/modules/inbox/inbox-model.test.mjs
```

The parent frontend must key its protected app by workspace/user/role and unmount
on logout. This module also clears evidence and invalidates pending responses on
session generation changes, mode changes, errors and unmount. It does not persist
commercial data, source payloads or tokens in browser storage.
