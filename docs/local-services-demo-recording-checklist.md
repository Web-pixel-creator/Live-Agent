# Local Services Demo Recording Checklist

## Purpose

Record one clear 90-second walkthrough that makes the local-services dispatcher
understandable before any real pilot data exists.

The recording should prove three things:

1. the product answers inbound requests first,
2. the operator controls risky actions,
3. the output is an approval-ready dispatch payload and pilot workflow.

## Recording Route

Open:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch`

Keep the route focused on `AC repair dispatch` unless the prospect specifically
asks about cleaning or measurement visit booking.

## Pre-Recording Setup

Before pressing record:

1. open the local shell at `http://localhost:3000/app?demo=local-services-dispatch&service=ac-repair-dispatch`,
2. confirm `http://localhost:3000/healthz` returns `200`,
3. close unrelated browser tabs and private notes,
4. reset the local pilot workspace state if old statuses make the story noisy,
5. keep the browser zoom at 100 percent,
6. prepare the one-line close: `This is not a chatbot; it is operator-approved dispatch for fewer missed requests.`

## Shot List

### 0-10 Seconds - Product Promise

Show the first fold and say:

`This is an AI dispatcher for local service companies. It answers first, but booking and dispatch remain operator-approved.`

Point at:

1. `AI Dispatcher for Local Services`,
2. `Phone AI intake`,
3. `Operator-approved booking`,
4. `AC repair dispatch`.

### 10-25 Seconds - Structured Job Card

Open or point at `AC repair dispatch`.

Show:

1. `Outcome`,
2. `Approval`,
3. `Evidence`,
4. `Deliverable`.

Say:

`Every inbound request becomes a job card with outcome, approval, evidence, and a deliverable.`

### 25-45 Seconds - Operator-Approved Intake

Show:

1. `Pricing and slot inputs`,
2. `Telegram intake prototype`,
3. `Customer confirmation draft`,
4. `Master/operator handoff`,
5. `Dispatch payload preview`.

Say:

`The assistant collects the right details, but the operator reviews the customer message, master handoff, and payload before anything is sent.`

### 45-65 Seconds - Proof

Open `Open intake evidence`.

Show:

1. `Transcript + evidence`,
2. `Saved intake evidence`,
3. `Copy intake evidence`.

Say:

`Every demo path has replayable proof. We do not ask an owner to trust a black-box chat answer.`

### 65-85 Seconds - Pilot Readiness

Show `Pilot readiness`.

Point at:

1. `Open demo script`,
2. `Open recording checklist`,
3. `Open outreach execution pack`,
4. `Agent setup / training state`,
5. `Pilot execution checklist`,
6. `Open evidence pack`.

Say:

`For a first pilot, the founder can use the script, recording checklist, outreach pack, setup checklist, daily log, and evidence pack without enabling autonomous sends, CRM writes, billing, or calendar actions.`

### 85-90 Seconds - Close

Say:

`The point is not a chatbot. The point is fewer missed requests, faster replies, and operator-approved dispatch.`

## Required On-Screen Proof

The final recording must visibly include:

1. `/app?demo=local-services-dispatch&service=ac-repair-dispatch`,
2. `AI Dispatcher for Local Services`,
3. `AC repair dispatch`,
4. `Operator-approved booking`,
5. `Dispatch payload preview`,
6. `Open intake evidence`,
7. `Pilot readiness`,
8. `Open recording checklist`,
9. `Open outreach execution pack`,
10. `Open evidence pack`,
11. `No autonomous send`.

## Do-Not-Claim Rules

Do not claim:

1. live phone numbers are provisioned,
2. Telegram or WhatsApp sends are automated,
3. CRM writes are live,
4. calendar bookings are created automatically,
5. billing or payment is connected,
6. revenue lift is proven,
7. pilot evidence contains private customer data,
8. construction-material availability or final pricing is automated.

## Delivery

Produce one short file:

`local-services-dispatch-90s-demo.mp4`

Optional supporting cuts:

1. `local-services-dispatch-30s-hook.mp4`,
2. `local-services-dispatch-proof-cut.mp4`,
3. `local-services-dispatch-pilot-kit-cut.mp4`.

Store private prospect-specific recordings outside the public repo if they
include names, phone numbers, addresses, customer media, or owner quotes.
