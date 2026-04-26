# Local Services Pilot Runbook

Use this runbook after the 7-minute local-services demo is ready and before
doing real outreach. It is an operating checklist for a solo founder, not an
automation spec.

## Goal

Run a 14-day manual pilot for `AI Dispatcher for Local Services` and decide
whether the wedge deserves more engineering.

The pilot must answer four questions:

1. Does the business lose requests because phone, Telegram, or owner response is
   too slow?
2. Can the assistant produce a useful job card before any risky customer or
   master action?
3. Does the operator accept the approval-gated flow without rewriting every
   handoff?
4. Would the company pay for this as a dispatcher service, not as a custom
   software project?

## Non-Goals

Do not use the pilot to build:

1. autonomous dispatch,
2. final pricing automation,
3. payments,
4. construction-material stock or delivery flows,
5. restaurant booking flows,
6. broad CRM integration,
7. a marketplace.

## Source Documents

1. Offer: `docs/local-services-pilot-offer.md`
2. Demo script: `docs/local-services-demo-script.md`
3. Outreach queue: `docs/local-services-outreach-list.md`
4. Scorecard: `docs/local-services-pilot-scorecard.md`
5. Outreach execution pack: `docs/local-services-outreach-execution-pack.md`
6. Demo route: `/app?demo=local-services-dispatch&service=ac-repair-dispatch`

## Day Minus One: Prepare

1. Open the local-services demo route.
2. Record or rehearse the 90-second demo.
3. Open the outreach list and pick four first-wave accounts:
   - AC MASTER
   - Aircold
   - Santexniki.uz
   - Service-Pro
4. For each account, create a scorecard row before outreach.
5. Use the shell `Pilot outreach wizard` and `Preview / Test message modal` to
   inspect the exact message. Open `Operator confirmation summary` and confirm
   `Ready for manual outreach`. Click `Record ready for manual outreach` to set
   the browser-local status to `Draft ready`, then keep real outreach outside
   the shell until a human sends the message manually.
   Use `Ask AI about pilot` only as an internal deterministic analyst brief for
   `Suggested questions`, `Best candidate`, `Bottleneck`, and `Next message`;
   it does not call an external LLM, send outreach, or write CRM.
6. Open `Open metrics tracker` for the selected lane and mark `Baseline
   captured` only after real baseline data or owner estimates are collected.

## Day Zero: Outreach

Send messages manually. The shell must not send messages.
Use `docs/local-services-outreach-execution-pack.md` as the first-contact
source for service-specific messages, Discovery Call Template, Manual Execution
Table, and Do-Not-Send Rules.

Use this base message:

`Hi. We help local service teams answer missed phone and Telegram requests,
collect district, issue, photos, estimate inputs, and prepare an
operator-approved job card. Can I show a 7-minute demo using your service type?`

Use service-specific openings:

1. AC repair: `same-day AC repair calls and after-hours Telegram videos`
2. Plumbing: `urgent leak calls, safety triage, and dispatcher-approved visits`
3. Cleaning: `quote requests, room counts, timing, and booking confirmation`
4. Measurement visits: `photos, approximate sizes, district, and manager-approved
   measurer visits`

After sending manually:

1. set status to `Contacted manually` in the shell,
2. update the Markdown scorecard manually,
3. never mark `Reply received` until the company actually replies.

## Discovery Call

Keep the first call under 20 minutes.

Ask:

1. Where do requests arrive today: phone, Telegram, Instagram, website, or ads?
2. Who answers first when the owner is busy?
3. What information is repeated on every request?
4. When does price require owner or manager approval?
5. How are photos, videos, sizes, and addresses collected?
6. How are masters, cleaners, or measurers assigned?
7. What happens to missed calls after work hours?
8. What would make the pilot clearly useful after 14 days?

Score the account immediately after the call using
`Account Qualification Score` in the pilot scorecard.

## Pilot Setup

Start only if there is one named approval owner.

Required setup:

1. one phone or Telegram intake path,
2. district coverage,
3. service types allowed in the pilot,
4. estimate floor and ceiling language,
5. what the assistant may say without approval,
6. what only the operator may confirm,
7. where the job card is copied after review,
8. daily check-in time.

If these are not clear, do not start the pilot.

## Daily Operating Loop

Do this once per day during the pilot:

1. count inbound requests captured,
2. count missed calls or delayed requests recovered,
3. record first reply time,
4. count quotes, slots, or dispatch cards prepared,
5. count manual operator edits per job card,
6. count confirmed bookings or dispatches,
7. count no-shows and cancellations,
8. write one operator note: what still had to be rewritten?

Use the shell `Pilot metrics tracker` as the reviewed snapshot, then copy the
final numbers manually into the Markdown scorecard or spreadsheet.

## Week One Review

Continue only if at least two are true:

1. the operator used the job-card output without rewriting it from scratch,
2. at least one missed or delayed request was recovered,
3. first reply time improved,
4. the owner asks to keep the flow running,
5. there is a clear paid use case.

Stop early if:

1. no real requests are routed through the pilot,
2. no one owns approvals,
3. the company wants a custom marketplace or CRM project,
4. every request is too custom for the P0 dispatcher flow.

## Week Two Review

At day 14, decide:

1. Continue as a paid pilot.
2. Continue free for one more week only if data is incomplete but demand is real.
3. Stop and move to the next account.

Paid-pilot readiness means:

1. a named owner wants the flow,
2. at least one job was saved, recovered, or made faster,
3. the operator trusts the approval gate,
4. the scope stays inside phone, Telegram, job cards, and handoff.

## Evidence Pack

For every serious pilot, keep:

1. before/after intake screenshots or notes,
2. one anonymized job card,
3. one operator-approved customer confirmation,
4. one operator/master handoff,
5. week-one and week-two scorecard rows,
6. a short quote from the owner or operator,
7. a clear stop or continue decision.

Do not store private customer data in public docs. Redact names, phone numbers,
addresses, and payment details before copying anything into the repo.
