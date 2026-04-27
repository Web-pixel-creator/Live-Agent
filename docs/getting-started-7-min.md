# Getting Started In 7 Minutes

This path is for a first operator, evaluator, or design partner who needs to
understand the product quickly.

The target product is:

`AI Action Desk for immigration teams`

## Hosted Or Local Entry

Open the Action Desk:

```text
http://localhost:3000/app?demo=visa-intake
```

Or open `http://localhost:3000/app` and click `Start 7-minute demo`.

The demo posture uses the existing `VS-2841` immigration case and keeps the
primary app shell intact.

## Local Services Expansion Path

Open:

```text
http://localhost:3000/app?demo=local-services-dispatch&service=ac-repair-dispatch
```

Or open `http://localhost:3000/app` and click `Local services demo`.

This is the P0 market-test path for Tashkent service businesses. It shows
`AI Dispatcher for Local Services` with four cards:

1. `AC repair dispatch`
2. `Plumbing emergency`
3. `Cleaning quote and booking`
4. `Measurement visit booking`

Each card previews `Outcome`, `Approval`, `Evidence`, and `Deliverable`. The
detail panel shows phone intake, pricing and slot inputs, approval policy,
evidence output, customer confirmation draft, master/operator handoff, and
`Dispatch payload preview`. Use `Open dispatch drawer`, `Open customer drawer`,
or `Open handoff drawer` to review the job-card, customer confirmation, or
master handoff export in `Human-readable` or `JSON` mode before copying it.
The same panel includes a `Telegram intake prototype`: a customer message,
normalized fields, and a reply draft that reuse the same approval-gated job-card
payload.
It now also includes `Pilot readiness` with a `One-page offer`, `90-second demo script`,
`Outreach focus`, a `Launch checklist`, and tracked `Pilot metrics` for the
first Tashkent pilot.
`Pilot readiness` now includes `Agent setup / training state`: a 7-minute setup
path for `Business profile`, `Knowledge sources`, `Agent behavior`,
`Test call/message`, and `Ready for test call/message`. `Open setup checklist`
opens a reviewed setup sheet with `Training cards`, `Copy setup brief`, and
`local_services_agent_setup_training`; it does not activate phone, Telegram,
WhatsApp, CRM, analytics, or billing integrations.
The same block now includes a 4-step `Pilot outreach wizard` that walks the
operator through `Offer preview`, `Audience from outreach list`,
`Message/test preview`, and `Operator confirmation` before any real outreach
happens.
`Message/test preview` now opens a `Preview / Test message modal` with
`Human-readable` / `JSON` modes, the exact `Copy test message` action, and
`Copy test message preview`; the preview does not send outreach.
`Operator confirmation` now opens an `Operator confirmation summary` with
`Ready for manual outreach`, selected company, channel, exact message, approval
checklist, and `Copy confirmation summary`.
The wizard also shows `Wizard progress`; `Record ready for manual outreach`
sets the selected company to `Draft ready` in browser-local state and displays
`Ready for manual outreach recorded` without sending anything.
The same wizard includes `AI analyst` / `Ask AI about pilot`, a deterministic
operator-assist sheet with `Suggested questions`, `Best candidate`,
`Bottleneck`, `Next message`, `Copy analyst brief`, and
`local_services_pilot_ai_analyst`; it makes no external LLM call and does not
send outreach.
The selected local-services panel also has `Open intake evidence` and
`Transcript + evidence`, opening a `Saved intake evidence` drawer with
`Intake transcript + evidence link`, `Transcript preview`, `Evidence export
mode`, `Copy intake evidence`, `local_services_intake_evidence`, and
`transcript_evidence_link`. Use it to show saved proof before handoff without
claiming live Telegram, CRM, phone storage, or scorecard persistence.
The `Pilot funnel summary` now also has `Outreach list filters` and
`Column settings`: `Service filter`, `Status filter`, `Filtered candidates`,
`Filtered outreach list`, `All services`, `All statuses`, `Clear filters`, and
`View only, no send`. Use this to pick a pilot company from the shell without
claiming the product sent outreach or wrote CRM.
The same funnel now has `Pilot execution checklist`: `Pass test call/message`,
`Needs test call passed`, `Prepare first manual batch`,
`Ready for first manual batch`, `Record ready drafts`, `Log manual contact`,
`Book discovery call`, `Start metric capture`, `Founder-only execution`,
`No autonomous send`, and `Open pilot runbook`. Its header shows
`Pilot checklist progress`, `Dry run required` / `Dry run passed`, and
`Manual launch blocked` / `Manual launch ready`, so first contact stays gated
on the dry run and a ready draft. `Open launch packet` opens `Pilot launch
packet` / `Launch packet preview` with `First manual contact checklist`,
`Launch readiness`, `Dry-run gate`, `Selected company`, `Draft status`,
`Next action`, `Copy launch packet`, and
`local_services_pilot_launch_packet`. It
shows the 14-day pilot operating loop without sending anything automatically.
Use `Open discovery prep` after a company is marked `Reply received`. The
`Discovery call prep` drawer gives `Questions to ask`, `Pilot success criteria`,
`Human-readable` / `JSON` modes, and `Copy discovery call prep`; the structured
payload is `local_services_discovery_call_prep`. It does not book a calendar
slot, send follow-up, write CRM, sync analytics, or mutate docs.
Use `Open day-one setup` after the discovery call is real. The
`Day-one setup brief` drawer gives `Business profile lock`, `Setup tasks`,
`Test call plan`, `Human-readable` / `JSON` modes, and
`Copy day-one setup brief`; the structured payload is
`local_services_day_one_setup_brief`. It does not activate phone, Telegram,
WhatsApp, CRM, analytics, billing, calendar, or customer sends.
That wizard now includes a `Pilot scorecard action`: select `AC MASTER`,
`Santexniki.uz`, `Service-Pro`, or another lane-specific candidate from the
repo-owned outreach list, review the test message, and `Record scorecard draft`
as `Not contacted` demo-session evidence.
The pilot workspace state is persisted in browser `localStorage` as
`liveDesk:localServicesPilotWorkspace:v1`, so reloads keep `Draft ready`,
`Contacted manually`, `Reply received`, or `Rejected for now` statuses.
The same demo now includes a `Pilot funnel summary` with `All candidates`,
per-status counts, and a `Next manual batch` list for jumping back to the right
service/company pair.
Use `Open pilot export` to open the `Pilot workspace export drawer`. It provides
`Human-readable` and `JSON` modes plus `Copy pilot workspace export` for manual
scorecard or CRM sync. It does not send messages or write CRM.
Use `Open metrics tracker` to open the `Pilot metrics tracker`. It provides
`Human-readable` and `JSON` modes plus `Copy pilot metrics tracker` for manual
weekly scorecard sync. It does not sync analytics or write CRM.
Use `Open daily log` to open `Pilot daily log` for the current operating day.
It provides `Daily capture fields`, `Daily operating loop`, and
`Copy pilot daily log` with the structured `local_services_pilot_daily_log`
payload. It is a manual note only: no analytics sync, CRM write, calendar
booking, customer send, or Markdown scorecard mutation.
Use `Open week-one review` after real week-one activity exists. It opens
`Pilot week-one review` with `Continue / stop decision`,
`Copy week-one review`, and `local_services_pilot_week_one_review`. It does not
decide autonomously, write CRM, change billing, send customer messages, or
mutate Markdown docs.
Use `Open evidence pack` after the pilot has real proof. It opens
`Pilot evidence pack` with `Week-two evidence pack`, `Copy evidence pack`, and
`local_services_pilot_evidence_pack`. It is a redacted manual proof pack only:
no private customer data in public docs, no autonomous pilot decision, no CRM
write, no billing change, and no customer send.
Use `Open offer doc`, `Open demo script`, and `Open recording checklist` to
open the repo-owned pilot artifacts without leaving the local frontend server.
The recording checklist is the safe 90-second walkthrough plan; it avoids claims
about live phone provisioning, Telegram/WhatsApp sends, CRM writes, calendar
bookings, billing, or proven revenue lift.
For recording, open
`/app?demo=local-services-dispatch&service=ac-repair-dispatch&recording=90s`.
The shell shows `90-second recording mode` and `Recording path`, while outreach
tables and scorecard controls stay hidden during recording.
For setup-first demos, open
`/app?demo=local-services-dispatch&service=ac-repair-dispatch&setup=7min`.
The shell shows `7-minute setup wizard`, `Setup path`,
`Open setup checklist`, `Open day-one setup`, and `Copy setup brief`, while
outreach tables and scorecard controls stay hidden until setup mode is exited.
Use the setup toggles to mark `Business profile`, `Knowledge sources`,
`Agent behavior`, and `Test call/message` complete. After those four are done,
click `Mark ready for pilot test`; the shell then shows `Ready for pilot test`.
The state is saved under `setupStepCompletionByService` and `setupReadyByService`
inside `liveDesk:localServicesPilotWorkspace:v1`, so refreshes keep the setup
progress.
Then review `Test call/message panel`: compare `Sample inbound` with
`Expected extracted fields`, mark every `Pass/fail checklist` item with
`Mark check passed`, and click `Record test passed`. The shell should show
`Test call passed`; `Reset test call` clears only the browser-local
`testCallChecklistByService` and `testCallPassedByService` fields.
Use `Open outreach list`, `Open outreach execution pack`, and
`Open pilot scorecard` when you move from demo story to actual pilot execution.
Use `docs/local-services-pilot-runbook.md` for the manual 14-day pilot sequence
after a company agrees to test. It covers outreach, discovery, setup, daily
metrics, reviews, and the evidence pack.
Use `docs/local-services-outreach-execution-pack.md` before first contact. It
contains the four-company first batch, service-specific messages, Discovery
Call Template, Manual Execution Table, and Do-Not-Send Rules.

The AI assistant can talk to the customer by phone, but P0 booking and dispatch
remain operator-approved.
Construction-material commerce is intentionally not in this first path. The
measurement lane covers construction-adjacent demand without promising stock,
delivery, payment, or final price before human review.

## Seven-Minute Path

1. Review the case header: client, owner, SLA, visa type, and country.
2. Use the `Playbook templates` strip if you want to branch into one workflow lane directly:
   `Visa lead qualification`, `Missing-document follow-up`, `Consultation booking prep`, or `CRM handoff summary`.
   Each card previews `Outcome`, `Approval`, `Evidence`, and `Deliverable`.
   Selecting a card opens the inline detail panel with `Sample input`, `Approval policy`,
   `Evidence output`, and `CRM fields`.
   The same panel also exposes `Payload preview`, `Surface path`, and `Copy payload`.
   Use `Open export drawer` for the integration-ready view: the CRM lane opens
   `CRM payload drawer`, the consultation lane opens `Consultation handoff
   drawer`, and both offer `Human-readable` and `JSON` modes before the
   canonical `Case Vault` or `Presentation bundle` jump.
3. Read `Case Outcome Summary`.
4. Confirm the lead is qualified.
5. Check the missing-document count and requested documents.
6. Check consultation readiness.
7. Open `Review approval` to inspect the protected follow-up.
8. Open `Evidence bundle` or `Presentation bundle` for proof.

## Expected Outcome

By the end, the operator should see:

1. lead qualification is visible,
2. missing documents are visible,
3. consultation path is ready,
4. CRM handoff is prepared in the console,
5. human approval is required before external follow-up,
6. evidence is available without opening raw runtime artifacts first.

## Product Boundary

The demo does not provide legal advice, final eligibility decisions, or
autonomous filing. It demonstrates intake, document chase, booking prep, CRM
handoff, approval, and evidence for an immigration operations team.

## Validation

For changes to this path:

```bash
npm run test:unit
npm run build
```
