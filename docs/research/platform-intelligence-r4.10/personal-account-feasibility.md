# Personal account feasibility

Checked 2026-11-20; read-only source research. No packages installed, source copied, login performed, QR generated, session captured, cookie used, message sent or live account accessed. ADR-007 keeps internal/reverse-engineered protocols research-only pending written provider authorization; an open-source license cannot grant provider account rights.

| Provider/account type | Official feasible route | Personal inbox conclusion |
|---|---|---|
| Facebook personal | User-authorized public/profile products subject to individual permissions | Page Messenger permission is not personal Messenger inbox access; no approved route established |
| Instagram consumer personal | No professional messaging grant demonstrated | Consumer excluded from professional API; do not relabel personal as Creator |
| Instagram Business/Creator | Official professional messaging; distinct Facebook Login vs Instagram Login flows | Candidate after app/account permission review, not a personal session connector |
| TikTok personal/creator | Display profile/video; eligible user-authorized Data Portability export | Historical EEA/UK portability DM export is not realtime messaging or Vietnam eligibility |
| TikTok Business | Business Messaging subject to account asset and capability entitlement | Do not extend business grant to personal/creator accounts |
| Zalo personal | No official personal inbox API established by the OA docs | Community session clients remain research-only |
| WhatsApp/LINE personal | Business Platform / Official Account routes are separate | No universal personal account import inferred |
| Telegram personal | Bot API distinct from user client protocols | No user-account connector implemented or authorized |

Official links and account/permission distinctions are in [social-platform-research.md](social-platform-research.md).

## Community repositories inspected at immutable revisions

| Source | Pin and inspected implementation | License evidence | Finding / admission |
|---|---|---|---|
| [RFS-ADRENO/zca-js](https://github.com/RFS-ADRENO/zca-js/tree/1e1c503b0e3a986405a3df22017b8e39512cdcb3) | `1e1c503b0e3a986405a3df22017b8e39512cdcb3`; tree, `src/apis/login.ts`, root LICENSE | MIT read from LICENSE | Internal getLoginInfo/getServerInfo and encrypted request helpers. Separate [JustKemForFun fork](https://github.com/JustKemForFun/zca-js/tree/42812b52b13fd4b05af364393638e9d8cd1e89c6) login/loginQR source inspected: cookie jar, imei, userAgent, QR lifecycle. Session-level authority, not OA OAuth scope. Research only |
| [zalo-personal-mcp](https://github.com/minhkhoa0502/zalo-personal-mcp/tree/e91ecfe0c17d29bb50fa2adc22759407604c9b92) | `e91ecfe0c17d29bb50fa2adc22759407604c9b92`; `src/session.ts`, `docs/audit/zca-js-2.1.2.md`, LICENSE | MIT | Session source states cookies/imei/userAgent stored using AES-256-GCM with scrypt passphrase or adjacent mode-0600 key. Third-party audit says no exfiltration found for audited zca-js 2.1.2, while noting full-session trust and runtime version check. This is the maintainer's bounded claim, not our independent audit or provider approval |
| [zca-zalo-service](https://github.com/leanhluong/zca-zalo-service/tree/5f3f66f722aaa29e877a258c218de9ae6759df39) | `5f3f66f722aaa29e877a258c218de9ae6759df39`; tree, `src/sessionStore.ts`, package.json | No root LICENSE found in recursive tree; reuse rights unresolved | In-memory qrToken to SessionRecord registry and API attachment after login. Service wrapping cannot reduce underlying session authority. No adoption |
| [openclaw-zalo-connect](https://github.com/tuanminhhole/openclaw-zalo-connect/tree/636995f84ea3bb17c5ee0e704a771b178c28e252) | `636995f84ea3bb17c5ee0e704a771b178c28e252`; `index.ts`, LICENSE, tree | MIT | Registers channel and agent tool; operation surface includes profile/get-qr/update-profile. Broad account action surface needs policy isolation; no dependency/adoption |

Pins obtained by anonymous git ls-remote; trees via GitHub API and implementation/license via raw.githubusercontent.com. These small inspected files establish mechanisms and review needs, not complete security audits. Licenses may differ by file or dependency. No security claim from a README was promoted to verified evidence. Required before any later consideration: written provider rights, account consent and scope contract, dependency/version integrity review, session threat model/rotation/revocation, retention/PII policy and per-capability approval. None are satisfied by this research.
