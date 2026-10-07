# Q4 — Bảng ánh xạ provenance và thời gian (draft)

**Status:** Draft — evaluation mapping only; does not change canonical vocabulary or resolve CE-2.
**Organization / Reviewers:** TBD. Use synthetic examples until organization, data permission, consent, retention and access rules are confirmed.
**Sources:** TRUST_AND_EVIDENCE §§2–3; RFC-005 Q4; V2 §7.3.

## Vocabulary mapping candidates

| Observed input / situation | V2 evaluation label (candidate) | Canonical acquisition mode candidate | Canonical assertion status candidate | Notes / unresolved |
|---|---|---|---|---|
| Connected source directly records sending a message | observed (the message event only) | automatic_observation | recorded | Does not prove action described in message. |
| Employee says “em gửi báo giá qua Zalo rồi” | declared | user_confirmed only if a reviewer/user confirms recording; otherwise mode depends on capture path | claimed | Confirmation of a claim does not turn off-system sending into an observed event. |
| Model infers a next action from the conversation | inferred | inferred | inferred | Must retain evidence span, model/rule version; draft-only. |
| CSV/imported note says “called yesterday” | declared/imported source | imported_record | claimed or recorded per source semantics | Keep source status and assertion semantics distinct. |
| No evidence found that customer spoke with manager | unobserved (absence, not a fact provenance) | unknown / source-specific | unknown | Never treat absence as proof the event did not happen. |

## Time mapping candidates

| Time field | Candidate meaning | Example | Rule / unresolved question |
|---|---|---|---|
| `occurred_at` | When the asserted business event happened | Call took place at 15:00 | Source-asserted event time with timezone and precision; may be interval/unknown. |
| `captured_at` | When source/system observed or captured the evidence | Connected channel recorded the message at 15:02 | Do not substitute for event time without evidence source semantics. |
| adapter receipt/ingestion | When adapter received/imported the record | Webhook received 15:10 | Preserve separately if available; receipt time is not necessarily `captured_at`. |
| `recorded_at` | Application assertion/recording time candidate | Operator enters the call next day | Exact canonical mapping unresolved by Q4; do not assume synonymous with ingestion or `captured_at`. |
| evaluated_at | Time a derived temporal status was evaluated | Whether an internal task is overdue at 16:00 | Derived status can change; preserve basis and timezone. |

## Synthetic examples

1. A connected conversation message has source timestamp 09:02; text says “em gửi học phí rồi” but no send event is connected: message observation is observed; sending remains declared/claimed.
2. A counselor enters at 10:00 that a phone call occurred “yesterday afternoon”: event time is imprecise/interval; capture/record time is 10:00 today. Do not set exact `occurred_at` to capture time.
3. A webhook arrives at 09:10 with source event time 08:55: preserve both if source semantics are known; adapter receipt is a separate timestamp.
4. A follow-up due “chiều mai” is recorded without known timezone or message time: keep relative/unknown until context is available.

Labels here are proposed for research reporting only, not a final one-to-one mapping to production fields.
