# Social provider capability matrix

Checked 2026-11-20. Social section for consolidation with other provider research. Provider, accountType, connectionMode, capability and permission are separate dimensions. Every row is documentation research; only Meta Page fabricated incoming-text decode is implemented. No row authorizes live use or outbound execution (ADR-007).

| Provider | accountType | connectionMode | Candidate capability | Required permission / limitation | Delivery here |
|---|---|---|---|---|---|
| Meta Facebook | Page | official Page webhook/Graph | Incoming message; conversation readback | Page-scoped token, Page subscription, pages_manage_metadata/pages_messaging as endpoint requires; app review/asset rights | Fabricated text fixture → shared SourceObservation; event/conversation may be UNKNOWN |
| Meta Facebook | personal | unestablished | Personal inbox | No official grant established by Page docs | Research only, unavailable |
| Instagram | Business / Creator | official Instagram Login | Professional messaging | instagram_business_manage_messages; app review and account consent | Research only |
| Instagram | Business / Creator | official Facebook Login | Professional messaging | Linked Page, instagram_basic/instagram_manage_messages/pages_manage_metadata as endpoint requires | Research only; separate mode |
| Instagram | consumer personal | none established | Consumer inbox | Professional API excludes consumers | Unavailable |
| TikTok | Business | official Business Messaging | Conversations/messages | Business asset DM permission, onboarding entitlement; capabilities per account, not universal | Research only |
| TikTok | Creator / Personal | official Display | Profile/videos | Login Kit + approved product and user consent | Research only; no DM |
| TikTok | eligible user, EEA/UK | official Portability | Historical DM export | portability.directmessages.single or ongoing, user authorization/app approval | Research only; no realtime inbox/send |
| Zalo | OA | official OA OAuth/webhook | OA interactions, followers, message candidates | OA-scoped grants; current replacement API and message policy must be checked | Research only |
| Zalo | personal | community session protocol | Session-based messaging | No provider authorization established; cookie/imei/userAgent session authority | Read-only pinned research, no admission |
| WhatsApp | Business | official Cloud API | Business phone messages/status webhooks | Business/phone assets and current endpoint grants; outbound gated separately | Research only |
| LINE | Official Account | official Messaging API channel | Inbound webhook/reply candidates | Channel token, signature verification, account/channel grant | Research only |
| Telegram | bot | official Bot API | Bot updates/read permitted chats | Bot token/chat visibility; webhook secret or polling contract | Research only, not personal history |

Sources, immutable SDK/sample and community pins, access failures and unresolved entitlement limits: [social-platform-research.md](social-platform-research.md), [personal-account-feasibility.md](personal-account-feasibility.md). Identity is provider/system + page + message under server workspace scope; neither display name nor PSID establishes customer identity. Permission to access a provider inbox never grants internal lead access (I-09, ADR-006).
