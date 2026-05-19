# Local Services Pilot Scorecard

Use this document to score the first outreach conversations and early pilots.
Use `docs/local-services-pilot-runbook.md` for the operating sequence that
decides when to create rows, when to contact manually, and when to continue or
stop the pilot.
Use `docs/local-services-outreach-execution-pack.md` for the first four manual
messages, Discovery Call Template, Manual Execution Table, and Do-Not-Send
Rules before updating real outreach status.
Use `docs/local-services-founder-execution-log.md` as the redacted first-10
contact worksheet before copying safe summaries into this scorecard.

The point is not to collect vanity notes. The point is to decide quickly:

1. who is worth a live demo
2. who is worth a 14-day pilot
3. who should be dropped

## Account Qualification Score

Score each account from 0 to 2 on each line.

| Criterion | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Missed-call pain | no clear pain | some delays | obvious lost jobs from delayed response |
| Phone-first workflow | mostly web forms | mixed channels | phone is primary inbound path |
| Telegram dependence | not used | occasional | core follow-up / media / quote channel |
| Urgency or same-day demand | low urgency | moderate | strong same-day or emergency demand |
| Operator approval need | fully manual but unclear | some review steps | explicit owner/dispatcher approval gate |
| Repeatable service scope | very custom | partly repeatable | standardized intake and dispatch pattern |
| Measurement or media intake | not relevant | useful sometimes | photos, sizes, or visit details are required |
| Pilot owner availability | no owner found | partial access | clear decision-maker available |
| Tooling maturity | already automated | mixed | mostly phone/chat/manual today |

### Interpretation

1. `14-18`: strong pilot candidate
2. `9-13`: demo candidate, pilot only if urgency is real
3. `0-8`: do not spend the next cycle here

## Outreach Tracker

| Company | Segment | Contact owner | Qualification score | Last contact | Next step | Status |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |
|  |  |  |  |  |  | Not started |

### Shell Draft Flow

The `/app?demo=local-services-dispatch&service=ac-repair-dispatch` shell now
has a `Pilot scorecard action` inside the `Pilot outreach wizard`.

Use it to:

1. select a company from the repo-owned outreach list
2. use `Outreach list filters` and `Column settings` in the
   `Pilot funnel summary`
3. narrow with `Service filter` or `Status filter`, review
   `Filtered candidates`, and pick from the `Filtered outreach list`
4. open `Agent setup / training state` and `Open setup checklist`
5. confirm `Business profile`, `Knowledge sources`, `Agent behavior`,
   `Test call/message`, and `Ready for test call/message`
6. open `Test call/message panel`, confirm `Sample inbound`,
   `Expected extracted fields`, `Pass/fail checklist`, `Mark check passed`,
   `Record test passed`, and `Test call passed`
7. open `Open intake evidence` / `Transcript + evidence` and confirm
   `Saved intake evidence`, `Intake transcript + evidence link`,
   `Transcript preview`, `Copy intake evidence`,
   `local_services_intake_evidence`, and `transcript_evidence_link`
8. review `Pilot execution checklist`, `Pass test call/message`,
   `Needs test call passed`, `Prepare first manual batch`,
   `Ready for first manual batch`, `Record ready drafts`, `Log manual contact`,
   `Book discovery call`, `Start metric capture`, `Founder/operator validation`,
   `No autonomous send`, `Open pilot runbook`, `Pilot checklist progress`,
   `Dry run required`, `Dry run passed`, `Manual launch blocked`, and
   `Manual launch ready`
9. use `Open launch packet` before first manual contact to review
   `Pilot launch packet`, `Launch packet preview`,
   `First manual contact checklist`, `Launch readiness`, `Dry-run gate`,
   `Selected company`, `Draft status`, `Next action`, `Copy launch packet`,
   and `local_services_pilot_launch_packet`
10. review `Manual activity log`, `Last manual action`, `Copy activity log`,
   `local_services_manual_activity_log`, and `No external side effects` after
   scorecard or metric status changes; it is browser-local proof only and does
   not send outreach, write CRM, create calendar events, sync analytics, bill,
   or mutate Markdown docs
11. use `Open discovery prep` after `Reply received` to review
   `Discovery call prep`, `Questions to ask`, `Pilot success criteria`,
   `Copy discovery call prep`, and `local_services_discovery_call_prep`
12. use `Open day-one setup` after the discovery call to review
   `Day-one setup brief`, `Business profile lock`, `Setup tasks`,
   `Test call plan`, `Copy day-one setup brief`, and
   `local_services_day_one_setup_brief`
13. review the `Test message preview`
14. open `Operator confirmation summary`
15. click `Record ready for manual outreach` to mark `Draft ready` locally
16. open `Ask AI about pilot` if the operator needs `Suggested questions`,
   `Best candidate`, `Bottleneck`, or `Next message`
17. record `First request outcome` after the first operator-supervised request:
   `Qualified`, `Needs follow-up`, `Rejected`, or `Booked manually`
18. check `Outcome chain summary` to see the same outcome move through
   `Scorecard draft`, `Daily log`, `Week-one review`, and `Evidence pack`
19. keep real outreach manual-only until a human sends the message outside the shell
20. open `Open founder execution log` when the operator needs the redacted
    first-10-contact worksheet before updating private pilot evidence

This shell action is intentionally local to the demo session. It does not send a
message, activate phone or Telegram, update CRM, call an external LLM, or change
this Markdown file automatically. The filtered list is `View only, no send`;
`All services`, `All statuses`, and `Clear filters` only change the browser
view.

The current shell persists this browser-local workspace state under
`liveDesk:localServicesPilotWorkspace:v1`.

Stored status values:

1. `Not contacted`
2. `Draft ready`
3. `Contacted manually`
4. `Reply received`
5. `Rejected for now`

These are operator notes only. `Contacted manually` means the operator says they
contacted the company outside the shell; it is not evidence that the product sent
anything.

Stored first-request outcome values:

1. `Qualified`
2. `Needs follow-up`
3. `Rejected`
4. `Booked manually`

The shell labels this as `Manual outcome state` and stores it in
`firstRequestOutcomeByProspectKey`. It is only a browser-local note for the
operator. It does not create a booking, write CRM, send a customer message, or
mutate this Markdown scorecard.

The shell also shows a `Pilot funnel summary` for all candidates in the
outreach list. Use it to see:

1. `All candidates`
2. count by status
3. `Next manual batch`
4. `Outreach list filters`
5. `Column settings`
6. `Filtered outreach list`
7. the current manual execution rule

`Open pilot export` opens the `Pilot workspace export drawer`. Use
`Human-readable` when manually updating this scorecard and `JSON` when pasting
into CRM or a spreadsheet. It includes the latest `Manual activity log` /
`Last manual action`. `Copy pilot workspace export` copies the reviewed
snapshot only; it does not send a message, update CRM, or mutate this Markdown
file automatically.
`Open workspace API export` opens `Workspace API export drawer` for the
repo-owned workspace boundary. It exposes `Copy workspace API export`,
`local_services_workspace_api`, `browser_local_preview`, and
`workspace API + local fallback`; use it for inspection only, not as durable
production storage or an automated CRM sync.

The first-10-contact workspace also shows `Category pilot score`,
`Leading category`, and `No category expansion without proof`. Use that ranking
before changing this scorecard into a category-specific integration plan; AC,
plumbing, cleaning, and measurement must compete on manual proof markers.
`Pilot ops today`, `Copy pilot ops handoff`, `Open ops confirmation`,
`Open communication preview`, `local_services_pilot_ops_today`,
`local_services_pilot_ops_confirmation`,
`local_services_pilot_communication_preview`,
`Current account picker`, `local_services_current_account_picker`,
`Auto next account`, `Select account`,
`Current account prep checklist`,
`local_services_current_account_prep_checklist`, `Prep status`,
`Channel verified`, `Message preview reviewed`, `Proof marker selected`,
`Manual-only guardrail`, `Mark preview reviewed`, `Reset preview review`,
`Prep complete`, `messagePreviewReviewedByProspectKey`,
`Prep gate`, `local_services_current_account_prep_gate`, `Blocked by prep`,
`Current account contact packet`,
`local_services_current_account_contact_packet`, `Ready for manual contact`,
`Copy contact packet`, `Packet copied`, `Reset packet review`,
`contactPacketCopiedByProspectKey`, `Packet needed`,
`Current account action path`, `local_services_current_account_action_path`,
`Current account outcome capture`,
`local_services_current_account_outcome_capture`,
`firstRequestOutcomeByProspectKey`,
`Current account scorecard sync preview`,
`local_services_current_account_scorecard_sync_preview`,
`Copy scorecard row`, `Scorecard row copied`,
`Reset scorecard row review`, `scorecardRowCopiedByProspectKey`,
`scorecard_row_copy_required_for_batch_review`,
`Current account batch review handoff`,
`local_services_current_account_batch_review_handoff`,
`Copy batch handoff`, `Batch handoff copied`,
`Reset batch handoff review`, `batchReviewHandoffCopiedByProspectKey`,
`Pilot proof update rail`, `local_services_pilot_proof_update_rail`,
`Current account mini-audit`, `local_services_current_account_mini_audit`,
`Open account history`, and `local_services_account_history_drawer` show the
current account, next manual action, browser-local account override,
phone/Telegram/WhatsApp preview, `Channel variants`, `Telegram variant`,
`WhatsApp variant`, `Phone script variant`, `Copy Telegram variant`,
`Copy WhatsApp variant`, `Copy phone script`, `Selected outreach channel`,
`Select Telegram`, `Select WhatsApp`, `Select phone script`, `Channel selected`,
`selectedChannelByProspectKey`, channel/message/proof/guardrail prep checklist,
account -> preview -> manual contact -> proof -> continue gate
path, latest account-local proof events, and browser-local proof marker to
update after the real action.
`Leading category action layer` then provides the `Next manual batch`,
`Discovery questions`, `Pilot setup checklist`, `Integration hold`, and
`Focus leading category` action that should guide the next scorecard update.
`Pilot setup readiness` is the scorecard gate for a first paid pilot: it should
show `Ready for first paid pilot` only after proof, setup, dry-run,
owner-conversation, metric, and `Week-one owner decision` gates are complete.
Only `Continue` can unlock `Paid pilot proposal`; `Pause`, `Stop`, or no
recorded decision keep the proposal path blocked.
`Proposal approval state` records the operator handoff decision in
`proposalApprovalByService`; `Approve proposal handoff` is required before
`Pilot kickoff gate` can move to day-one setup, while `Needs changes`,
`Block proposal`, or reset keep kickoff blocked.
`Kickoff decision state` then records `Mark kickoff ready`, `Needs more prep`,
or `Block kickoff` in `kickoffDecisionByService`; the day-one run sheet remains
blocked until kickoff is ready.

`Open metrics tracker` opens the `Pilot metrics tracker` for the selected
service lane. Use `Human-readable` for weekly operator review and `JSON` when
pasting reviewed numbers into a spreadsheet. `Copy pilot metrics tracker`
copies the reviewed metric plan only; it does not sync analytics, update CRM, or
mutate this Markdown file automatically.

`Open daily log` opens the `Pilot daily log` for the selected service lane.
Use it at the end of each pilot day to review `Daily capture fields`,
`Daily operating loop`, and `Copy pilot daily log`. The payload is
`local_services_pilot_daily_log`; it now carries the selected company, pilot
status, `First request outcome`, and `firstRequestOutcomeByProspectKey` before
weekly scorecard sync. It also exposes `Weekly scorecard sync gate` /
`manual_weekly_scorecard_sync_gate`, which stays blocked until the first outcome
is recorded and metrics are review-ready. `Open weekly sync checklist` opens
the reviewed manual copy packet; `Copy weekly sync checklist` exports
`local_services_weekly_scorecard_sync_checklist` before the human updates the
private tracker. It does not sync analytics, update CRM, create calendar
bookings, send customer messages, or mutate this Markdown file automatically.
After the private tracker is updated, `Record weekly sync reviewed` writes only
the browser-local `weeklyScorecardSyncReviewedByService` proof. Use
`Reset weekly sync review` if the outcome or metrics changed before the next
manual copy. `Pilot week-one review` and `Pilot evidence pack` read this as
`Weekly sync reviewed`; `Evidence readiness` remains blocked until the manual
private scorecard sync has been reviewed.

`Open week-one review` opens the `Pilot week-one review` drawer for the selected
service lane and company. Use it after real week-one activity exists to review
`Continue / stop decision` and `Copy week-one review`. The payload is
`local_services_pilot_week_one_review`; it now carries `First request outcome`
and `firstRequestOutcomeByProspectKey` into the owner-reviewed continue, pause,
or stop packet. It also shows `Owner-ready summary`, `Decision readiness`,
`Weekly scorecard sync gate`, `manual_weekly_scorecard_sync_gate`,
`Latest manual signal`, and `day_one_recap_to_week_one_review` so the owner can
read the week-one packet without opening raw activity logs. `Week-one owner
decision state`, `Record continue`, `Record pause`, `Record stop`, and
`weekOneOwnerDecisionByProspectKey` record the owner decision locally before the
evidence pack. It does not decide
autonomously, update CRM, change billing, send customer messages, or mutate this
Markdown file automatically.

`Open evidence pack` opens the `Pilot evidence pack` drawer for day-14 owner
review. Use it to collect `Week-two evidence pack`, `Copy evidence pack`,
redacted before/after intake proof, one anonymized job card, scorecard rows,
owner quote, and the stop/continue decision. The payload is
`local_services_pilot_evidence_pack`; it now carries `First request outcome`
and `firstRequestOutcomeByProspectKey` into the redacted paid-pilot readiness
proof pack, plus `Week-one owner decision` through
`week_one_owner_decision_to_evidence_pack`. It does not store private customer
data in public docs, decide
autonomously, update CRM, change billing, send customer messages, or mutate this
Markdown file automatically.

`Open day-one recap` opens the `Day-one recap` drawer after a real first-day
run. `Copy day-one recap` exports `local_services_day_one_recap` /
`manual_day_one_recap`; `day_one_recap_to_week_one_review` is the handoff into
week-one review. It does not create bookings, send customer messages, write CRM,
sync analytics, bill, activate channels, or mutate this Markdown file
automatically.

`Open discovery prep` opens the `Discovery call prep` drawer for a replied
company. Use `Human-readable` for the founder call, `JSON` for structured
handoff notes, and `Copy discovery call prep` only after the selected company
and status are current. The payload is `local_services_discovery_call_prep` and
does not create calendar bookings, send follow-up, write CRM, sync analytics, or
mutate this Markdown file automatically.

`Open day-one setup` opens the `Day-one setup brief` drawer after discovery.
Use it to lock the business profile, setup tasks, and test call plan before the
first real pilot day. `Copy day-one setup brief` copies
`local_services_day_one_setup_brief` only; it does not activate phone,
Telegram, WhatsApp, billing, CRM, calendar, analytics, or customer sends.

## Discovery Call Notes

Copy this block per company.

### Company

- Name:
- Segment:
- Website:
- Decision-maker:
- Date:

### Current Workflow

1. inbound channels:
2. who answers first:
3. how they estimate price:
4. how they confirm slot:
5. how they hand off to the master or crew:
6. where they lose requests today:

### Fit Signals

1. emergency or same-day work:
2. Telegram or media proof needed:
3. repeat questions asked on every call:
4. manual rewriting of handoff messages:
5. missed-call recovery problem:

### Risks

1. no single approval owner
2. pricing too custom for a first pilot
3. no willingness to test with real requests
4. too much enterprise complexity for a founder/operator validation rollout

### Decision

- Demo?
- Pilot?
- Reject?
- Why:

## 14-Day Pilot Scorecard

Use this only after a company agrees to test.

| Metric | Baseline | Week 1 | Week 2 | Target | Notes |
| --- | --- | --- | --- | --- | --- |
| Inbound requests captured |  |  |  | all tracked |  |
| Missed-call recovery |  |  |  | same-day callback |  |
| First reply time |  |  |  | agreed SLA |  |
| Quotes or slots prepared |  |  |  | operator-approved output |  |
| Manual operator edits per job |  |  |  | under 3 |  |
| Confirmed bookings / dispatches |  |  |  | rising trend |  |
| No-shows / cancellations |  |  |  | explicit tracking |  |

## Pilot Exit Rules

Continue only if at least one of these becomes true:

1. the operator says the handoff is materially faster than before
2. missed-call or delayed-request recovery is visible
3. the company wants to keep using the dispatcher after the test

Stop if these are true:

1. no one owns approvals
2. no real inbound requests are routed through the pilot
3. every quote still has to be rewritten from scratch
4. the business likes the demo but refuses operational testing
