# PANCAKE COMMERCIAL PLATFORM - AI HANDOFF CONTEXT

## 0. Purpose
This context summarizes the entire brainstorming thread about Pancake Chat, CRM, the gap between interaction capture and commercial structuring, the Marketing-to-Sales handoff problem, reporting/measurement gaps, and the resulting product vision.

Use this file as working context for another AI. Do not treat every statement as an immutable fact. Respect the labels below:
- **VERIFIED**: supported by Pancake public docs/API during the session.
- **OBSERVED / USER INSIGHT**: operational pattern supplied by the user; validate across customers.
- **INFERENCE**: reasoned conclusion from the data model/workflow.
- **HYPOTHESIS**: needs primary research before product commitment.

---

## 1. Core strategic thesis
Pancake Chat is strongest as a **conversation-centric operating system**: it captures and manages customer interactions, especially social conversations, assignment, tags, notes, agent operations, and operational reporting.

Traditional CRM is strongest as a **commercial system of record/process**: it structures Leads, Contacts, Accounts, Opportunities, Stages, Tasks, Forecasts, and organizational accountability.

The opportunity is not to rebuild either giant. The product should own the middle layer:

**Meaning -> Continuity -> Action -> Intelligence**

North-star idea:
> Preserve the relationship and commercial meaning from the first customer interaction through Marketing, Sales, outcome, revenue, and back into acquisition optimization - without forcing users to manually translate conversation into structured data.

---

## 2. Pancake Chat - working mental model
### VERIFIED / session-grounded
Pancake Chat is an omnichannel conversation platform. The working model used in this project is:

`Connection/Page -> Conversation -> Message -> Customer`

with operational layers such as:
- Tags
- Assignment / round-robin
- Read/unread state
- Customer information and notes
- Posts/comments
- Calls (where supported/integrated)
- Statistics/reporting
- API/integration capabilities

Pancake public APIs expose primitives around conversations, messages, customers, tags, assignment, notes, files/media, calls, and statistics.

### Important boundary
Pancake Chat reporting is broad for **conversation operations**. It is not accurate to call it generally weak reporting. Its natural strength is answering questions such as:
- How many conversations/interactions?
- Which page/channel?
- Who replied?
- Response/service performance?
- Which tags?
- Ad-related performance where Pancake Chat has native measurement?

It becomes weaker as the questions become commercial-process questions:
- What stage is this lead really in?
- What is the next action and due date?
- What happened after Marketing handed it to Sales?
- What is the current opportunity value?
- Why was it lost?
- Where is the funnel leaking?
- What revenue is at risk?

### Ads reporting correction
**Critical correction from the brainstorming:** native ad measurement discussed for Pancake Chat should be treated as **Meta-focused**. Pancake can receive conversations from multiple platforms, but its ad measurement coverage is not equivalent across all those conversation sources. Do not assume TikTok/Google/etc. ad measurement is natively available in Pancake Chat.

The product should therefore treat Pancake as an **interaction source**, not the universal acquisition measurement source.

---

## 3. Why CRM exists despite sales friction
CRM is not primarily valuable because one salesperson needs a database. It exists because an organization needs to:
1. **Externalize memory** - customer/commercial knowledge must survive employee absence/turnover.
2. **Coordinate** - many people/teams must work on the same customer/revenue process.
3. **Control and predict** - management needs standardized state, pipeline visibility, accountability, and future revenue forecasting.

CRM converts tacit knowledge into organizational data.

Key conflict:
| Sales wants | Organization wants |
|---|---|
| Sell quickly | Repeatable process |
| Minimal data entry | Structured data |
| Flexibility | Standardization |
| Personal memory | Shared knowledge |
| Focus on current deal | Portfolio visibility |
| Productivity | Governance / forecasting |

CRM remains must-have when the cost of not having structured commercial reality exceeds the overhead of CRM adoption.

CRM pressure rises with:
- longer sales cycles
- higher-value deals
- more simultaneous deals
- more handoffs
- more stakeholders
- recurring revenue / renewal
- need for forecast
- compliance / governance

---

## 4. The central gap: Interaction vs Commercial Reality
Pancake captures **what happened**.
CRM structures **what it means commercially**.

Example:
Customer says: "Price is acceptable. Send me the contract; Friday I will discuss with my boss."

Conversation system stores the message.
Commercial system needs to infer:
- buying intent increased
- contract requested
- decision-maker relationship exists
- buyer commitment on Friday
- seller commitment to send contract
- possible stage change
- next action and due date

The human salesperson currently acts as the compiler between these systems.

Core product opportunity:
> Turn unstructured customer interactions into evidence-backed commercial events and actions.

---

## 5. Commercial Event as the core primitive
Do not let an LLM write directly and opaquely into CRM-like fields.

Preferred architecture:
`Interaction -> AI interpretation -> Commercial Event -> Evidence -> Policy -> Action`

A Commercial Event should contain:
- customer / lead identity
- event type
- timestamp
- source interaction
- evidence
- inferred commercial meaning
- confidence
- suggested mutation/action
- previous value / new value when applicable
- audit trail / undo

Examples:
- PURCHASE_INTENT_INCREASED
- OBJECTION_PRICE
- BUYER_COMMITMENT
- SELLER_COMMITMENT
- FOLLOW_UP_DUE
- LEAD_QUALIFIED
- HANDOFF_CREATED
- SALES_CONTACTED
- OPPORTUNITY_AT_RISK
- WON / LOST

Trust and auditability are product capabilities, not implementation details.

---

## 6. Major operational insight: Marketing -> Sales handoff loses the relationship
### OBSERVED / USER INSIGHT
Typical enterprise flow:
`Facebook/Instagram -> Marketing on Pancake -> capture phone number -> handoff to Sales -> Sales uses phone/Zalo`

What is handed over is usually a lead identity (often phone number), not the full relationship.

What remains in Pancake/Marketing:
- original Facebook/Instagram identity
- full conversation history
- ad/post/context source
- expressed needs
- objections
- promises made
- attachments
- engagement behavior
- original high-engagement channel

This is **lead handoff without relationship handoff**.

### Handoff tax
Sales may need to:
- ask Marketing for chat history/context
- ask Marketing to re-contact the customer on Messenger/Instagram when phone/Zalo fails
- work without the channel the customer actually prefers

This can create **channel downgrade**: the customer chose Messenger/Instagram but the company forces Phone/Zalo because internal handoff is phone-number-centric.

### Pancake seat / operational semantics tension
Pancake is sold/operated with user seats. In many businesses, Pancake seats are naturally allocated to the Marketing/inbox team.

Giving Sales access may create tension around:
- seat economics
- excessive inbox/page access for a salesperson who only needs assigned leads
- separation of Marketing vs Sales duties
- reporting/attribution semantics
- workflow noise

Exact current pricing tiers must be reverified before using them in a business case. The stable strategic point is **seat-based access and role/workflow mismatch**.

---

## 7. Lead-scoped access and channel continuity
Potential solution:
- Marketing remains in Pancake.
- Sales receives a dedicated commercial workspace.
- Sales only sees leads assigned to them, not the whole page/inbox.
- Each lead includes conversation summary + full evidence + original channel.
- When platform/API/commercial terms permit, Sales can follow up through the customer's original channel without becoming a Pancake inbox operator.

Principle:
> Access should be scoped to the commercial lead/customer relationship, not necessarily to the entire page/inbox.

Potential channel intelligence:
- Phone: no answer
- Zalo: not connected
- Messenger: highly active
- Suggestion: follow up via Messenger

Longer-term: preferred-channel scoring.

---

## 8. Pancake operating envelope - Comfortable / Stretched / Beyond
### GREEN - Comfortable Pancake
Typical journey: `Conversation -> Decision -> Order`
Characteristics:
- short sales cycle
- one main owner
- outcome occurs in/near chat
- few follow-ups
- little commercial complexity

Examples: social commerce, fashion, cosmetics, simple retail.

### YELLOW - Stretched Pancake (the likely sweet spot)
Typical journey: `Conversation -> Lead -> Handoff -> Follow-up -> Decision`
Patterns:
- Tags are used as stages.
- Notes are used as structured fields.
- Filters are used as work queues.
- Assignment is used as lead ownership.
- Excel/Sheets are used as reporting/pipeline.
- Human memory is used as reminder/task engine.

This is **CRM debt**: the business avoids CRM license/implementation cost but pays hidden cost in manual labor, lost leads, poor handoff, and management blindness.

Likely ICP lives here.

### RED - Beyond Pancake
Typical journey requires:
- Accounts / companies
- multiple contacts/stakeholders
- multiple opportunities per customer
- long sales cycles
- proposals/procurement/contracts
- forecast and pipeline governance

At this stage a real CRM is appropriate. The product should integrate with it rather than prevent adoption.

---

## 9. Reporting insight: activity vs progress
Pancake Chat reporting should be seen as strong in **operational observability** and weaker in **commercial progression**.

Pancake naturally reports dimensions such as:
- page
- user/agent
- interaction/conversation
- tag
- call (where integrated)
- ads (Meta-oriented in Pancake Chat)
- feedback/order-related signals depending on setup

But a Sales/Revenue manager ultimately asks:
- Lead -> Qualified conversion?
- Handoff -> accepted?
- Time to first Sales contact?
- Contact success?
- Follow-up compliance?
- Won/lost?
- Lost reason?
- Revenue by source/campaign?
- Pipeline leakage?

Core distinction:
`Activity reporting != commercial progress reporting`

Specific reporting blind spot to validate:
**Marketing -> Sales handoff analytics**
- handoff volume
- handoff acceptance
- time-to-accept
- time-to-first-contact
- no-contact rate
- return-to-Marketing rate
- handoff -> won conversion

---

## 10. Product vision: Closed-loop Revenue / Commercial Continuity Platform
The platform should eventually connect:

`Acquisition -> Conversation -> Lead -> Handoff -> Sales Action -> Outcome -> Revenue -> Attribution -> Learning -> Acquisition`

Do not replace the giants:
- Ad platforms own ad execution.
- Pancake owns conversation operations.
- CRM (when needed) owns enterprise commercial records.
- Our platform owns continuity, meaning, execution intelligence, and cross-system measurement.

### Five engines
1. **Acquisition Intelligence Engine**
   - ad/source connectors beyond Pancake
   - spend/campaign/ad/creative identity
   - acquisition-source resolution
   - lead quality by source
   - revenue feedback to acquisition

2. **Conversation Intelligence Engine**
   - conversation summaries
   - needs, intent, objections, commitments
   - commercial signals
   - voice-of-customer intelligence

3. **Commercial Continuity Engine**
   - identity graph
   - lead creation
   - Marketing -> Sales handoff
   - context continuity
   - lead-scoped permissions
   - original-channel continuity

4. **Revenue Execution Engine**
   - owner
   - CRM-lite commercial state
   - next action
   - follow-up
   - buyer/seller commitments
   - SLA
   - exception-driven work queue

5. **Revenue Intelligence Engine**
   - funnel
   - revenue attribution
   - leakage detection
   - source x Sales performance
   - marketing feedback loop
   - CRM truth / hygiene when CRM exists
   - next-best-action / risk signals

---

## 11. Marketing layer: do not inherit Pancake's measurement boundary
### Critical design principle
Pancake can be a major conversation source, but the product's **Acquisition Data Hub** must be independent.

Target model:
`Ad/Acquisition sources -> Acquisition Hub -> Source Resolution -> Pancake conversation -> Lead -> Revenue`

Potential sources over time:
- Meta Ads
- TikTok Ads
- Google Ads
- organic social
- referral
- marketplaces / other sources where identifiers are available

Do not assume every conversation source equals a paid acquisition source.

### Three separate attribution concepts
1. **Conversation attribution** - where did the conversation happen?
2. **Acquisition lineage** - what source/campaign/ad originally produced or influenced the lead?
3. **Revenue attribution** - under a defined model, what source receives credit for commercial outcome?

Do not collapse these into one field.

Principle:
> Honest unknown is better than false precision.

---

## 12. Marketing-to-Sales measurement requires process, not software alone
Closed-loop revenue measurement requires:
**Software + Data Model + Operating Methodology**.

If Marketing hands Sales only a phone number and Sales works independently, source lineage dies at handoff.

### Required immutable entity
Create a stable `Lead ID` (or acquisition episode ID) linking:
- customer identity
- source/campaign/ad identifiers
- original conversation
- Marketing owner
- timestamps
- Sales owner
- downstream activities
- commercial outcome
- revenue

### Minimum Sales truth that must be captured/confirmed
Keep required fields minimal:
- contact outcome
- qualified/unqualified
- current state
- won/lost
- revenue and/or lost reason

AI should automate extraction where confidence is high, but organizational truth sometimes requires explicit confirmation.

---

## 13. Revenue Measurement Operating Model / onboarding methodology
The company must define shared semantics before dashboards are trusted.

### Marketing definitions
- What is a Lead?
- What is Qualified?
- When does Marketing hand off?
- How are returning customers handled?
- How are campaign/ad identifiers preserved?

### Sales definitions
- SLA to accept/contact a lead
- What does "Cannot contact" mean?
- What is Qualified from Sales' perspective?
- When is Won recognized?
- Required Lost reasons

### Management definitions
- Revenue recognition point: deposit, contract, payment, etc.
- Attribution model
- Duplicate/re-open policy
- SLA ownership

Potential product capability: **Measurement Readiness Setup** that configures these definitions and enforces them.

Example:
- Qualified = phone exists + target geography + product need
- Cannot contact = 3 attempts within 48h
- Won = deposit received

---

## 14. Data Health must be a first-class feature
A closed-loop dashboard must expose measurement quality.

For each source/funnel:
- deterministic linkage rate
- inferred linkage rate
- unknown rate
- missing handoff linkages
- duplicate risk
- outcome coverage

Display confidence such as:
- Known
- Inferred
- Unknown

Example:
`TikTok: 87% source matched, 9% unknown source, 4% linkage lost during handoff.`

Manager should see both performance and measurement coverage.

---

## 15. CRM-lite when no CRM exists
Do not build a full CRM. Provide only the commercial primitives needed to avoid tags/notes becoming a fake database:
- Customer
- Lead / acquisition episode
- Marketing owner
- Sales owner
- Source
- Status / commercial state
- product interest
- value
- intent
- next action
- due date
- lost reason
- limited custom fields

Pipeline is a view, not necessarily a manual Kanban workflow. The system should infer/suggest state from actual activity.

---

## 16. Follow-up & Commitment Engine
Two important event classes:

### Buyer commitment
"Call me on Friday after I speak with my boss."
-> follow-up due Friday

### Seller commitment
"I will send the quotation this afternoon."
-> obligation due this afternoon

Lifecycle:
`Detected -> Assigned -> Due -> Completed / Overdue`

This is more valuable than a generic task manager because tasks are generated from customer interactions.

Potential beachhead feature: **Never Miss a Follow-up**.

---

## 17. Manager Command Center - exception-driven, not dashboard-heavy
Manager should see items needing intervention, for example:
- high-intent leads with no next action
- handoffs not contacted within SLA
- overdue commitments
- customers marked unreachable but active on original channel
- stale opportunities
- potential revenue at risk
- source/creative producing low commercial quality

Do not build "dashboard #17". Build an **attention layer**.

---

## 18. Full funnel and feedback loop
Desired funnel:
`Spend -> Conversation -> Lead -> Qualified -> Handoff -> Sales Contacted -> Engaged -> Follow-up/Opportunity -> Won/Lost -> Revenue`

Marketing should be able to evaluate:
- Cost per conversation
- Cost per lead
- Cost per qualified lead
- Cost per Sales-contacted lead
- Cost per won customer
- Revenue / source / campaign / creative
- lead quality by campaign/creative

Sales outcome must feed back to Marketing so "Lead quality" becomes measurable rather than subjective.

### Conversation Quality / Commercial Intent
Potential AI-derived dimensions:
- buying intent
- product fit
- budget
- geography
- timeline
- decision role
- engagement depth
- objection profile
- spam/noise

Use carefully: distinguish observed signals from inferred scores.

---

## 19. Cross-team analytics
Potential high-value views:
- Marketing x Sales x Source x Outcome
- Campaign -> Qualified -> Contacted -> Won -> Revenue
- Sales performance by lead type/source
- handoff SLA and conversion
- lost reason by campaign/creative
- objection/intent trends by campaign

Longer-term opportunity:
**outcome-aware routing** - route lead types to Sales reps who historically convert them best.

---

## 20. Identity Graph
A single real customer may appear as:
- Facebook identity
- Instagram identity
- phone
- Zalo identity
- email / CRM contact

The platform should resolve to a canonical Customer while preserving multiple acquisition episodes/leads.

Important distinction:
`Customer != Lead`

Example:
Customer Minh
- Lead #1: Campaign A -> Lost
- Lead #2: Campaign B -> Won

Otherwise revenue attribution becomes corrupted.

Identity merges need confidence, evidence, manual correction, and undo.

---

## 21. CRM evolution path
### Before CRM
`Pancake + Our Platform + Phone/Zalo`

Our platform supplies:
- lead handoff
- CRM-lite state
- follow-up
- commercial timeline
- manager visibility
- closed-loop measurement

### After CRM adoption
`Pancake -> Our Commercial Context Layer <-> CRM`

CRM owns:
- account/contact/opportunity
- enterprise pipeline/forecast
- complex workflows

Our platform continues owning:
- interaction context
- commercial events
- commitments
- evidence
- channel intelligence
- identity resolution
- CRM truth/hygiene
- next-best-action
- acquisition-to-revenue lineage

Thus "delay CRM" is an entry wedge, not the final category.

---

## 22. Features/ideas ranked from the brainstorming
High-value concepts:
- Lead/relationship handoff package
- Original-channel Sales follow-up
- Follow-up / Commitment Engine
- Evidence-backed CRM/CRM-lite auto-update
- Commercial Event Compiler
- CRM Truth / Hygiene Agent
- Lost Revenue Detector
- Commercial Handoff Engine
- Full-funnel Marketing -> Sales analytics
- Data Health / measurement coverage
- Identity Resolution
- Manager commercial brief
- Next Best Action grounded in evidence
- Voice of Customer / objections / lost reasons
- Marketing lead-quality and creative-quality feedback

Avoid relying on generic AI summaries as differentiation.

---

## 23. What NOT to build
Do not rebuild:
- unified social inbox
- full enterprise CRM
- POS / ERP
- generic task manager
- generic BI/report builder
- generic chatbot
- generic workflow automation platform
- generic call transcription
- generic B2B enrichment platform

The platform should build only what helps answer:
> What does this customer interaction mean commercially, who owns what happens next, did it happen, and how did it affect revenue?

---

## 24. Likely ICP
Not all SMEs.

Best initial profile:
- inbound/social-led acquisition
- meaningful Meta/social ad spend
- Pancake is an important conversation backbone
- Marketing and Sales are separate teams
- Marketing captures phone numbers and hands leads to Sales
- Sales follows up via phone/Zalo and sometimes needs original social channel
- sales cycle is longer than instant chat-to-order, but not enterprise-complex
- multiple follow-ups are common
- tags/notes/Sheets are already compensating for missing structure
- manager lacks trustworthy cross-team visibility
- CRM is absent, rejected as too heavy, or poorly adopted

Potential verticals to validate:
- Education/admissions
- Clinic/spa/aesthetic services
- Automotive
- Interior/home improvement
- Real estate inbound (simpler workflows)
- Travel/high-ticket services
- Selected distributors / social-led B2B inbound

Do not assume vertical fit without interviews.

---

## 25. Five discovery questions - unified Sales + Manager version
Ask the same questions separately to Sales and Manager and compare answers:
1. In daily work, what does Pancake help your team do best, and what still takes the most manual effort or time?
2. When there are many customers, how does the team know whom to prioritize, who needs follow-up, and what the next action is?
3. What customer/status information does Sales understand but Management cannot immediately see in Pancake, or Management needs but Sales often does not update reliably?
4. Tell me about the most recent customer that was missed, followed up late, poorly handed off, or handled below expectations. Was the cause people, process, or tooling?
5. If customer volume or team size doubled, what part of the current Pancake-based workflow would remain comfortable and what would break first?

Always probe with: **"Can you show me a recent real example?"**

---

## 26. Research principles
Do not ask "Do you need CRM?" or "Would you use AI?"
Ask about actual behavior and the most recent real case.

For each pain capture:
- Trigger
- Current behavior
- Frequency
- Consequence
- Workaround
- Time/money/people cost
- Who suffers
- Existing willingness to solve

Strong signals:
- "Sales has to remember"
- "Manager has to ask each person"
- "We have to reread the chat"
- "We use Excel/Sheets too"
- "It depends on the salesperson"
- "We only remember when the customer messages again"
- "Sales asks Marketing to message the customer"

---

## 27. Hypotheses requiring validation
Do NOT present these as facts:
1. Sales strongly wants to continue using the original Facebook/Instagram channel after handoff.
2. Seat economics is a major reason businesses do not give Sales Pancake access.
3. Mixing Marketing and Sales users meaningfully damages native Pancake KPI/reporting for target customers.
4. Lead-scoped original-channel access is more valuable than giving Sales full Pancake seats.
5. Follow-up leakage is frequent enough to pay for a product.
6. Managers will pay for cross-team funnel/attribution visibility before a CRM purchase.
7. AI can infer commercial events at sufficient accuracy in Vietnamese sales conversations.
8. Multi-platform ad/source lineage can be linked at commercially useful coverage.
9. A vertical operating playbook materially improves data quality and adoption.
10. The product can send messages via Pancake/API in the desired commercial model and permissions; verify technical/commercial terms before promising this.

---

## 28. Product principles decided during brainstorming
- Stand on giants; do not rebuild their wheel.
- Pancake is an interaction backbone, not the boundary of our product.
- Delay CRM when appropriate, but integrate when CRM becomes justified.
- Commercial Event is more important than AI summary.
- Evidence and auditability are mandatory for AI mutations.
- Exception-driven UX beats forcing users into another workspace.
- Sales should have lead-scoped context/action, not necessarily full inbox access.
- Customer/channel continuity is a first-class business outcome.
- Marketing and Sales need a shared revenue truth.
- Source lineage, attribution, and conversation channel are different concepts.
- Software alone cannot create trustworthy measurement; operating discipline is part of the product.
- Data Health must be visible.
- Unknown should stay unknown rather than be falsely attributed.
- Customer and Lead/acquisition episode must be separate entities.

---

## 29. Recommended product naming/positioning language (working, not final)
Possible category language:
- Commercial Continuity Platform
- Revenue Continuity Platform
- Closed-loop Revenue Platform

Avoid overly narrow labels such as "Mini CRM for Pancake" or generic labels such as "AI Sales Assistant".

Useful promise:
> From customer conversation to commercial outcome - without losing context, channel, ownership, or action.

Expanded promise:
> Connect acquisition spend, customer conversations, Marketing qualification, Sales execution, and revenue into one measurable commercial journey.

---

## 30. Target end-state architecture
```text
Acquisition Platforms
Meta / TikTok / Google / Organic / Other
              |
              v
      Acquisition Data Hub
  Spend / Campaign / Ad / Creative
              |
              v
      Source Resolution Layer
              |
              v
Pancake / Interaction Backbone
Conversation / Customer / Agent / Evidence
              |
              v
    Commercial Event Compiler
              |
      +-------+--------+
      |                |
      v                v
Continuity          Execution
Identity            Owner
Handoff             Next action
Channel             Commitment
Context             SLA
      |                |
      +-------+--------+
              v
       Commercial State
        CRM-lite / CRM
              |
              v
        Outcome / Revenue
              |
              v
 Revenue Intelligence Layer
Attribution / Leakage / Data Health
              |
              v
Marketing + Sales + Management Learning
              |
              +------------------> Acquisition
```

---

## 31. Immediate continuation tasks for the next AI
Do not restart from generic ideation. Recommended next workstreams:
1. Build 6-10 concrete vertical operating scenarios and score each step Green/Yellow/Red for Pancake-only operation.
2. Define the canonical data model: Customer, Identity, Lead/Acquisition Episode, Interaction, Handoff, Commercial Event, Activity, Commitment, State, Outcome, Revenue, Source lineage.
3. Define the Marketing/Sales measurement contract and attribution rules.
4. Design the minimum "Pancake Optimization Playbook" that lets a business operate without CRM as long as appropriate.
5. Design MVP sequencing and identify the first paid wedge.
6. Validate Pancake API/commercial constraints for lead-scoped conversation reading/sending.
7. Interview target businesses using behavior-first research; collect concrete failure cases and workarounds.
8. Quantify ROI: missed leads, manual handoff time, follow-up leakage, manager reporting time, measurement blind spots.

---

## 32. Public references used during the session
Reverify before relying on current product behavior:
- Pancake Developer API: https://developer.pancake.biz/
- Pancake Docs intro: https://docs.pancake.biz/pancake/intro?lang=vi
- Pancake reporting/docs tree: https://docs.pancake.biz/pancake/
- Pancake CRM docs (used only to understand the boundary between Chat and CRM): https://docs.pancake.biz/crm/intro?lang=vi

End of handoff context.
