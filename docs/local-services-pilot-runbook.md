# Local Services Pilot Runbook

Use this runbook after the 7-minute local-services demo is ready and before
doing real outreach. It is an operating checklist for founder/operator
validation, not an automation spec and not a solo-only product scope.

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
5. Open `Agent setup / training state` and `Open setup checklist` for the
   selected lane. Confirm `Business profile`, `Knowledge sources`,
   `Agent behavior`, `Test call/message`, and `Ready for test call/message`.
   Treat `Copy setup brief` as internal setup evidence only; it does not
   activate phone, Telegram, WhatsApp, CRM, analytics, or billing.
6. Open `Test call/message panel`, review `Sample inbound`,
   `Expected extracted fields`, and the `Pass/fail checklist`, then use
   `Mark check passed` and `Record test passed` before any live channel is
   connected.
7. Open `Open intake evidence` or `Transcript + evidence` and confirm
   `Saved intake evidence`, `Intake transcript + evidence link`,
   `Transcript preview`, `Evidence export mode`, `Copy intake evidence`,
   `local_services_intake_evidence`, and `transcript_evidence_link`. Treat it
   as proof-only; it does not write Telegram, CRM, phone storage, or scorecards.
8. Use `Outreach list filters` and `Column settings` in the
   `Pilot funnel summary` to narrow by `Service filter` or `Status filter`,
   review `Filtered candidates`, and select from the `Filtered outreach list`.
   The list is `View only, no send`; it does not send outreach or write CRM.
   The first-10-contact workspace also shows `Category pilot score`,
   `Leading category`, and `No category expansion without proof`; use that
   proof-based ranking before deepening AC, plumbing, cleaning, or measurement.
   `Leading category action layer` then gives `Next manual batch`,
   `Discovery questions`, `Pilot setup checklist`, `Integration hold`, and
   `Focus leading category`.
   `Pilot setup readiness` shows the `Paid pilot gate`; do not move past
   `Not ready for paid pilot` until proof, setup, dry-run, owner-conversation,
   metric, and `Week-one owner decision` gates are complete. Only `Continue`
   can unlock `Paid pilot proposal`; `Pause`, `Stop`, or no recorded decision
   keeps the proposal path blocked.
   `Proposal approval state` then records the operator handoff decision through
   `Approve proposal handoff`, `Needs changes`, or `Block proposal` in
   `proposalApprovalByService`; day-one kickoff remains blocked until it is
   approved.
   `Kickoff decision state` then records `Mark kickoff ready`,
   `Needs more prep`, or `Block kickoff` in `kickoffDecisionByService`; the
   day-one run sheet stays blocked until kickoff is ready.
9. Review `Pilot execution checklist`: `Pass test call/message`,
   `Needs test call passed`, `Prepare first manual batch`,
   `Ready for first manual batch`, `Record ready drafts`, `Log manual contact`,
   `Book discovery call`, `Start metric capture`, `Founder/operator validation`,
   `No autonomous send`, `Open pilot runbook`, `Pilot checklist progress`,
   `Dry run required`, `Dry run passed`, `Manual launch blocked`, and
   `Manual launch ready`. Treat it as the manual 14-day operating loop; it does
   not send outreach or mutate docs.
10. Before first manual contact, use `Open launch packet` to review `Pilot launch
   packet`, `Launch packet preview`, `First manual contact checklist`,
   `Launch readiness`, `Dry-run gate`, `Selected company`, `Draft status`,
   `Next action`, `Copy launch packet`, and
   `local_services_pilot_launch_packet`. It is manual-only and does not send
   outreach, create calendar events, write CRM, or mutate docs.
11. Review `Manual activity log`, `Last manual action`, `Copy activity log`,
   and `local_services_manual_activity_log` after recording scorecard or metric
   status changes. It is browser-local proof only and has `No external side
   effects`: no outreach send, calendar event, CRM write, analytics sync,
   billing action, or Markdown mutation.
12. Use `Pilot ops today` before each live manual attempt. `Copy pilot ops
   handoff` exports `local_services_pilot_ops_today` with the current account,
   next manual action, and proof marker to update after the real action. Use
   `Open ops confirmation` / `local_services_pilot_ops_confirmation` before
   that proof marker is used for a continue, revise, or stop decision. Use
   `Open communication preview` / `local_services_pilot_communication_preview`
   to review the phone script, Telegram draft, WhatsApp-style draft, and
   approval gate before any manual contact. Use `Current account picker` /
   `local_services_current_account_picker` when the operator needs to override
   the auto-selected account; `Auto next account` returns to the default queue.
   Check `Current account prep checklist` /
   `local_services_current_account_prep_checklist` for `Prep status`,
   `Channel verified`, `Message preview reviewed`, `Proof marker selected`, and
   `Manual-only guardrail` before touching the action path. Use `Mark preview
   reviewed` after the communication preview is inspected; `Reset preview
   review`, `Prep complete`, and `messagePreviewReviewedByProspectKey` remain
   browser-local prep state, not external delivery proof. `Prep gate` /
   `local_services_current_account_prep_gate` should show `Blocked by prep`
   until the checklist is complete. Use `Current account contact packet` /
   `local_services_current_account_contact_packet` and `Copy contact packet`
   only after it shows `Ready for manual contact`; `Packet copied`,
   `Reset packet review`, `contactPacketCopiedByProspectKey`, and
   `Packet needed` keep manual-send proof blocked until the packet is copied.
   The copy is a human handoff, not an outbound send.
   Check `Current account action path`
   / `local_services_current_account_action_path` to keep the account ->
   preview -> manual contact -> proof -> continue gate order visible. Use
   `Current account outcome capture` /
   `local_services_current_account_outcome_capture` to update only
   `firstRequestOutcomeByProspectKey` after the manual contact. Use
   `Current account scorecard sync preview` /
   `local_services_current_account_scorecard_sync_preview` and
   `Copy scorecard row` to copy only the private scorecard row before batch
   review or weekly sync. `Scorecard row copied`, `Reset scorecard row review`,
   `scorecardRowCopiedByProspectKey`, and
   `scorecard_row_copy_required_for_batch_review` are browser-local review
   proof only; batch review and weekly sync stay blocked until it is recorded.
   Use `Current account batch review handoff` /
   `local_services_current_account_batch_review_handoff` and
   `Copy batch handoff` to prepare the current account packet before opening
   the first-contact batch review. `Batch handoff copied`,
   `Reset batch handoff review`, and
   `batchReviewHandoffCopiedByProspectKey` are browser-local proof only, and
   `Open batch review` stays blocked until the copy is recorded. In the review
   drawer, `First-contact batch review rows` show
   `Account -> Lane -> Scorecard row -> Batch handoff -> Proof -> Decision`,
   with `review_decision`, `scorecard_row_copied`, and
   `batch_handoff_copied` in JSON. Use
   `Pilot proof update rail` / `local_services_pilot_proof_update_rail` only
   after the real action happens outside the shell. Check `Current account
   mini-audit` / `local_services_current_account_mini_audit` before batch
   review so the account's latest browser-local events are visible. Use
   `Open account history` / `local_services_account_history_drawer` when the
   operator needs the full current-account proof markers, recent activity, next
   manual action, and manual-only guardrails before continuing.
13. After a company is marked `Reply received`, use `Open discovery prep` to
   review `Discovery call prep`, `Questions to ask`, `Pilot success criteria`,
   `Copy discovery call prep`, and `local_services_discovery_call_prep`. Treat
   it as a founder call brief only; it does not book calendars, send follow-up,
   write CRM, sync analytics, or mutate docs.
14. After the discovery call, use `Open day-one setup` to review
    `Day-one setup brief`, `Business profile lock`, `Setup tasks`,
    `Test call plan`, `Copy day-one setup brief`, and
    `local_services_day_one_setup_brief`. Treat it as setup handoff only; it
    does not activate phone, Telegram, WhatsApp, billing, CRM, calendar,
    analytics, or customer sends.
15. Use the shell `Pilot outreach wizard` and `Preview / Test message modal` to
   inspect the exact message. Review `Channel variants`, `Telegram variant`,
   `WhatsApp variant`, `Phone script variant`, `Copy Telegram variant`,
   `Copy WhatsApp variant`, and `Copy phone script`; these are copy-only drafts
   and must not trigger channel sends or calls. Set `Selected outreach channel`
   with `Select Telegram`, `Select WhatsApp`, or `Select phone script` until
   `Channel selected` is saved in `selectedChannelByProspectKey`. Open
   `Operator confirmation summary`
   and confirm `Ready for manual outreach`. Click `Record ready for manual outreach`
   to set the browser-local status to `Draft ready`, then keep
   real outreach outside the shell until a human sends the message manually.
   Use `Ask AI about pilot` only as an internal deterministic analyst brief for
   `Suggested questions`, `Best candidate`, `Bottleneck`, and `Next message`;
   it does not call an external LLM, send outreach, or write CRM.
16. Open `Open metrics tracker` for the selected lane and mark `Baseline
   captured` only after real baseline data or owner estimates are collected.
17. Open `Open daily log` at the end of the first pilot day, review
    `Daily capture fields`, `Daily operating loop`, and `Copy pilot daily log`,
    then copy `local_services_pilot_daily_log` into the private scorecard or
    spreadsheet manually. Confirm `Weekly scorecard sync gate` /
    `manual_weekly_scorecard_sync_gate` remains blocked until
    `firstRequestOutcomeByProspectKey` is recorded and metrics are review-ready.
    When the gate is ready, open `Open weekly sync checklist`, review
    `Weekly scorecard sync checklist`, and copy
    `local_services_weekly_scorecard_sync_checklist` into the private tracker
    manually. Click `Record weekly sync reviewed` only after the private
    tracker is updated; it writes only browser-local
    `weeklyScorecardSyncReviewedByService` proof. Use
    `Reset weekly sync review` if the outcome or metrics changed before the
    next manual copy. Confirm `Pilot week-one review` and
    `Pilot evidence pack` show `Weekly sync reviewed`; `Evidence readiness`
    should stay blocked until the manual private scorecard sync is reviewed.
18. Open `Open week-one review` only after real week-one activity exists. Review
    `Pilot week-one review`, `Continue / stop decision`, and
    `Copy week-one review`, confirm `First request outcome` /
    `firstRequestOutcomeByProspectKey`, then copy
    `local_services_pilot_week_one_review` into the private scorecard or
    spreadsheet manually. Confirm `Owner-ready summary`, `Decision readiness`,
    `Weekly scorecard sync gate`, `manual_weekly_scorecard_sync_gate`,
    `Latest manual signal`, and `day_one_recap_to_week_one_review` before the
    owner makes a continue, pause, or stop decision. Use `Week-one owner
    decision state`, `Record continue`, `Record pause`, or `Record stop` to
    write only `weekOneOwnerDecisionByProspectKey`.
19. Check `Outcome chain summary` before owner review; it should connect
    `Scorecard draft`, `Daily log`, `Week-one review`, and `Evidence pack` to
    the same browser-local first request outcome and owner decision handoff.
20. After the first real day-one run, open `Open day-one recap`. Review
    `Day-one recap`, `Copy day-one recap`, `local_services_day_one_recap`, and
    `day_one_recap_to_week_one_review`, then copy the reviewed recap into the
    private scorecard before week-one review.
21. Open `Open evidence pack` at day 14 for serious pilots. Review
    `Pilot evidence pack`, `Week-two evidence pack`, and `Copy evidence pack`,
    confirm `First request outcome` / `firstRequestOutcomeByProspectKey`, then
    copy `local_services_pilot_evidence_pack` into the private scorecard or
    owner-facing proof pack manually after redaction. Confirm `Week-one owner
    decision` and `week_one_owner_decision_to_evidence_pack` are present before
    paid-pilot readiness review.

## Day Zero: Outreach

Send messages manually. The shell must not send messages.
Use `docs/local-services-outreach-execution-pack.md` as the first-contact
source for service-specific messages, Discovery Call Template, Manual Execution
Table, and Do-Not-Send Rules.
Use `docs/local-services-founder-execution-log.md` or `Open founder execution
log` as the redacted first-10-contact worksheet. Keep real names, phone
numbers, screenshots, and raw chat data in a private tracker unless the company
explicitly approves sharing.

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

For the public walkthrough, use
`docs/local-services-demo-recording-checklist.md` before recording. It keeps the
90-second video tied to visible product proof and prevents unsupported claims
about live phone, Telegram, CRM, calendar, billing, or revenue lift.

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
Use `Pilot daily log` as the daily operating-loop note before the weekly
metrics review. It is manual-only: no analytics sync, CRM write, calendar
booking, customer message, or Markdown mutation.
Use `Pilot week-one review` after the first real week to prepare the
continue/pause/stop discussion. `Week-one owner decision state`,
`weekOneOwnerDecisionByProspectKey`, and the `Record continue` / `Record pause`
/ `Record stop` actions keep that decision browser-local. It is manual-only: no
autonomous pilot decision, CRM write, billing change, customer message, or
Markdown mutation.
Use `Pilot evidence pack` at day 14 to assemble redacted proof for paid-pilot
readiness or a clean stop. It carries `Week-one owner decision` through
`week_one_owner_decision_to_evidence_pack`. It is manual-only: no private
customer data in public docs, no autonomous pilot decision, CRM write, billing
change, customer message, or Markdown mutation.

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
