# Local Services Outreach Execution Pack

Use this pack for the first manual outreach wave for `AI Dispatcher for Local
Services`. It is a founder/operator worksheet, not a CRM, not an outbound
automation feature, and not a replacement for the pilot runbook.

The goal is simple: contact four real Tashkent service companies manually, get
one or two discovery calls, and decide whether the local-services wedge deserves
more engineering.

## Success Criteria

The first outreach wave is useful only if it produces at least one of these:

1. a live demo booked,
2. a clear rejection reason,
3. a named workflow owner who describes missed calls, Telegram chaos, or slow
   quote follow-up,
4. a decision to drop one segment before more code is written.

Do not measure success by how many messages were drafted in the shell. Measure
real replies, calls, pilot fit, and willingness to test.

## Source Route And Documents

1. Demo route:
   `/app?demo=local-services-dispatch&service=ac-repair-dispatch`
2. Pilot runbook: `docs/local-services-pilot-runbook.md`
3. Outreach queue: `docs/local-services-outreach-list.md`
4. Scorecard: `docs/local-services-pilot-scorecard.md`
5. Offer: `docs/local-services-pilot-offer.md`
6. Demo script: `docs/local-services-demo-script.md`

## First Manual Batch

| Priority | Company | Segment | Service lane | Manual message | Next action | Scorecard status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | AC MASTER | AC repair | `AC repair dispatch` | AC repair message | Verify contact channel, send manually, ask for 7-minute demo. | `Not contacted` |
| 2 | Aircold | AC repair | `AC repair dispatch` | AC repair message | Verify contact channel, send manually, ask who handles after-hours requests. | `Not contacted` |
| 3 | Santexniki.uz | Plumbing | `Plumbing emergency` | Plumbing message | Verify Telegram/phone path, send manually, ask about urgent leak triage. | `Not contacted` |
| 4 | Service-Pro | Cleaning | `Cleaning quote and booking` | Cleaning message | Verify contact channel, send manually, ask how quote requests are handled today. | `Not contacted` |

## Measurement Visit Fallback

Use this only if the first wave is weak or a prospect is clearly
construction-adjacent.

| Company | Segment | Service lane | Why later |
| --- | --- | --- | --- |
| IMZO | Windows / doors | `Measurement visit booking` | Strong benchmark, but likely more mature and harder to pilot first. |
| Modern Systems | Windows / sliding systems | `Measurement visit booking` | Good callback and showroom flow, but not the fastest first call. |
| BRIX.UZ | Ceilings / fit-out | `Measurement visit booking` | Useful for measurement-led quote flows, but material and fit-out scope can sprawl. |

## Message Templates

### Universal Short Message

Hi. I am testing a dispatcher assistant for Tashkent service teams. It answers
phone/Telegram requests, collects district, problem details, photos, estimate
inputs, and prepares an operator-approved job card. Can I show a 7-minute demo
using your service type?

### AC Repair Message

Hi. I am testing an AI dispatcher for AC repair teams in Tashkent. The goal is
to catch missed summer calls and Telegram videos, collect district, issue,
model/photo, urgency, and prepare a same-day visit card for manager approval.
Can I show a 7-minute demo using an AC repair request?

### Plumbing Message

Hi. I am testing an AI dispatcher for plumbing teams in Tashkent. It handles
urgent leak or clog intake, collects district, safety notes, photos, access
details, and prepares a dispatcher-approved visit card before a master is sent.
Can I show a 7-minute demo using your plumbing workflow?

### Cleaning Message

Hi. I am testing an AI dispatcher for cleaning companies in Tashkent. It
collects apartment/office size, room count, timing, service type, photo notes,
and prepares an operator-approved quote and booking draft. Can I show a
7-minute demo using your cleaning request flow?

### Measurement Visit Message

Hi. I am testing an AI dispatcher for measurement-led installation companies in
Tashkent. It collects district, photos, approximate sizes, product type, and
preferred time, then prepares a manager-approved measurer visit request without
promising final price. Can I show a 7-minute demo?

### Follow-Up After No Reply

Hi, quick follow-up. I am not offering a marketplace or ad service. The demo is
only about reducing missed calls and turning phone/Telegram requests into a
clean job card that your manager approves. Worth 7 minutes this week?

### Reply When Interested

Good. I will keep it short. I will show one customer request, the collected
fields, the approval gate, the customer confirmation draft, and the
master/operator handoff. What time works for a 7-minute screen share?

### Reply When They Ask Price

For the first test I am not selling a long custom project. The goal is to see
whether this saves real missed requests or manager time during a 14-day pilot.
If the demo fits, we can discuss a small paid pilot after the workflow is clear.

### Reply When They Already Have Manager Or CRM

That is fine. The assistant is not meant to replace your manager or CRM. It
prepares the request before the manager reviews it: district, problem, photos,
estimate inputs, slot preference, approval notes, and handoff text. The manager
still approves the customer message and dispatch.

## Discovery Call Template

### Opener

I am not trying to automate your whole business. I want to understand whether a
phone/Telegram dispatcher that prepares approval-ready job cards would save
missed requests or manager time.

### Questions

1. Where do requests arrive today: phone, Telegram, Instagram, website, ads, or
   referrals?
2. Who answers first when the owner or manager is busy?
3. What information do you ask every customer before giving a quote or booking?
4. Which details require manager approval before the customer hears a final
   answer?
5. Do customers send photos, videos, room counts, sizes, or location pins?
6. How do you decide whether a request is urgent or can wait?
7. How do you assign a master, cleaner, or measurer?
8. Where do requests get lost today: missed calls, late Telegram replies,
   unclear photos, slow price approval, or no slot confirmation?
9. What would make a 14-day pilot clearly useful?

### Decision Criteria

Continue only if the company has:

1. real phone or Telegram inbound,
2. repeatable intake questions,
3. a named owner or dispatcher who can approve customer-facing output,
4. a painful delay, missed-call, or quote-follow-up problem,
5. willingness to test with real requests for 14 days.

Drop the account if they want a marketplace, full CRM replacement, autonomous
dispatch, final price automation, or a custom software project before the first
pilot.

## Manual Execution Table

Copy this table into a private working doc or spreadsheet before real outreach.
Do not put private phone numbers, names, chats, or customer data into public
repo docs.

| Account | Contact channel verified | Sent by human | Sent date | Reply status | Next action | Scorecard row updated | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC MASTER |  |  |  | `Not contacted` | Verify channel |  |  |
| Aircold |  |  |  | `Not contacted` | Verify channel |  |  |
| Santexniki.uz |  |  |  | `Not contacted` | Verify channel |  |  |
| Service-Pro |  |  |  | `Not contacted` | Verify channel |  |  |

Allowed reply statuses:

1. `Not contacted`
2. `Contacted manually`
3. `Reply received`
4. `Demo booked`
5. `Rejected for now`
6. `Bad fit`

## Do-Not-Send Rules

1. The shell must not send messages.
2. Verify the company contact channel manually before outreach.
3. Send only from a human-owned account.
4. Do not store private customer data in this repo.
5. Do not promise final pricing, autonomous booking, autonomous dispatch,
   payments, material stock, or delivery.
6. Do not continue if there is no named approval owner.
7. Do not mark `Contacted manually` until a human actually sends the message.
8. Do not mark `Reply received` until the company actually replies.

## 7-Minute Demo Handoff Script

1. Open the local-services route.
2. Select the matching lane:
   - AC repair: `AC repair dispatch`
   - plumbing: `Plumbing emergency`
   - cleaning: `Cleaning quote and booking`
   - measurement: `Measurement visit booking`
3. Show the intake summary and explain that the assistant collects details
   before the manager approves anything.
4. Open `Dispatch payload preview`.
5. Open the relevant drawer:
   - `Open dispatch drawer` for dispatcher review,
   - `Open customer drawer` for customer confirmation,
   - `Open handoff drawer` for master/operator handoff.
6. Show `Human-readable` first, then `JSON` only if the prospect asks about CRM
   or spreadsheet export.
7. Show `Pilot readiness`, open the `Preview / Test message modal`, and explain
   that `Copy test message` is still manual-only and sends nothing.
8. Open `Agent setup / training state` and `Open setup checklist`, then show
   `Business profile`, `Knowledge sources`, `Agent behavior`,
   `Test call/message`, `Ready for test call/message`, `Training cards`, and
   `Copy setup brief`. Explain that it is setup evidence only and makes
   `No channel activation`.
9. Open `Test call/message panel`, show `Sample inbound`,
   `Expected extracted fields`, `Pass/fail checklist`, `Mark check passed`,
   `Record test passed`, and `Test call passed`. Explain that it is a dry run
   only and still does not connect live channels.
10. Open `Operator confirmation summary`, show `Ready for manual outreach`, and
   explain that it is a final human approval state, not an autonomous send.
11. Click `Record ready for manual outreach` only to mark `Draft ready` locally;
   explain that it does not send outreach or write CRM.
12. Open `Ask AI about pilot` to show `Suggested questions`, `Best candidate`,
   `Bottleneck`, `Next message`, and `Copy analyst brief`; explain that this is
   deterministic internal planning and makes `No external LLM call`.
12. Show `Outreach list filters`, `Column settings`, `Service filter`,
   `Status filter`, `Filtered candidates`, `Filtered outreach list`,
   `All services`, `All statuses`, `Clear filters`, and `View only, no send`;
   explain that this is a browser-local list view, not outreach automation.
13. Open `Open intake evidence` / `Transcript + evidence` and show
   `Saved intake evidence`, `Intake transcript + evidence link`,
   `Transcript preview`, `Evidence export mode`, `Copy intake evidence`,
   `local_services_intake_evidence`, and `transcript_evidence_link`; explain
   that it is proof-only and does not write Telegram, CRM, phone storage, or
   scorecards.
14. Show `Pilot execution checklist`, `Prepare first manual batch`,
   `Ready for first manual batch`, `Record ready drafts`, `Log manual contact`,
   `Book discovery call`, `Start metric capture`, `Founder-only execution`,
   `No autonomous send`, and `Open pilot runbook`; explain that this is the
   manual 14-day operating loop, not autonomous outreach.
15. Show `Open discovery prep`, `Discovery call prep`, `Questions to ask`,
   `Pilot success criteria`, `Copy discovery call prep`, and
   `local_services_discovery_call_prep`; explain that this prepares the first
   replied-company call only and does not book a calendar slot or write CRM.
16. Show `Open day-one setup`, `Day-one setup brief`, `Business profile lock`,
   `Setup tasks`, `Test call plan`, `Copy day-one setup brief`, and
   `local_services_day_one_setup_brief`; explain that this prepares the first
   pilot day only and does not activate channels, billing, CRM, calendar, or
   customer sends.
17. Show `Pilot metrics` and `Open metrics tracker`.
18. Show `Open daily log`, `Pilot daily log`, `Daily capture fields`,
   `Daily operating loop`, `Copy pilot daily log`, and
   `local_services_pilot_daily_log`; explain that this is a manual daily note,
   not analytics sync, CRM write, calendar booking, or customer send.
19. Show `Open week-one review`, `Pilot week-one review`,
   `Continue / stop decision`, `Copy week-one review`, and
   `local_services_pilot_week_one_review`; explain that this is a manual owner
   review, not an autonomous pilot decision, CRM write, billing change, or
   customer send.
20. Show `Open evidence pack`, `Pilot evidence pack`,
   `Week-two evidence pack`, `Copy evidence pack`, and
   `local_services_pilot_evidence_pack`; explain that this is a redacted manual
   proof pack, not public customer-data storage, CRM, billing, or customer-send
   automation.
21. Show `Open recording checklist` if the prospect or partner needs a short
   product walkthrough. Explain that it is a 90-second recording checklist with
   required on-screen proof and do-not-claim rules, not a live automation
   claim.
22. End with one question: "Would this save missed requests or manager time if we
   tested it for 14 days?"

## After Each Contact

1. Update `docs/local-services-pilot-scorecard.md` manually or keep the private
   spreadsheet updated.
2. If the company replies, write the rejection reason or discovery-call notes.
3. If a demo is booked, rehearse with the service lane that matches that
   company.
4. Use the shell status only as local operator state. It is not evidence that
   outreach happened.
5. Update pilot metrics only after real baseline numbers or owner estimates are
   collected.
6. Copy the daily operating-loop note from `Pilot daily log` only after a real
   pilot day; do not treat it as proof that analytics, CRM, calendar, or
   customer-message systems were updated.
7. Copy the week-one review only after real week-one activity; do not treat it
   as proof that the pilot decision, CRM, billing, or customer-message systems
   were updated.
8. Copy the evidence pack only after redaction; do not store names, phone
   numbers, exact addresses, or private media in public docs.
