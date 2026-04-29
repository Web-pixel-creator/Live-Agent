# Local Services Founder Execution Log

Use this as a redacted worksheet for the first real Tashkent local-services
pilot attempts. Do not store private customer names, phone numbers, chat
screenshots, or unredacted business data in this public repo. Keep raw notes in
a private spreadsheet or CRM, then copy only safe summaries here.

This log is not a CRM, not an outreach sender, not a booking system, and not a
customer-data store.

The product shell mirrors this worksheet in `First 10 contacts workspace` on
`/app?demo=local-services-dispatch&service=ac-repair-dispatch`. That in-app
workspace stores only browser-local proof markers in
`liveDesk:localServicesPilotWorkspace:v1`; it does not send outreach, create
bookings, write CRM, sync analytics, bill, or mutate this Markdown file.
Use `Open batch review` in that workspace to open the `First contact batch
review drawer` and `Copy batch review` only after the browser-local markers
match the private founder notes.
Use `Pilot ops today` before each real manual action. `Copy pilot ops handoff`
exports `local_services_pilot_ops_today`: current account, service lane, next
manual action, and proof marker to update afterward. `Open ops confirmation`
opens `local_services_pilot_ops_confirmation` before any proof marker is used
for a continue/stop decision. `Pilot proof update rail` /
`local_services_pilot_proof_update_rail` is the browser-local shortcut for the
current account after the real manual action happens. `Current account
mini-audit` / `local_services_current_account_mini_audit` shows the latest
account-local browser events before the batch review. It is still a handoff
note, not an outbound send.
Use the `Stop / Continue decision gate` as the category expansion rule: continue
only when the first batch proves real service-operator pain. The broader product
direction remains a NEWO-style AI employee platform for selected local-service
categories, not a solo-only tool.
Use `Category pilot score` and `Leading category` as the tie-breaker across AC,
plumbing, cleaning, and measurement. The rule is
`No category expansion without proof`: do not deepen a lane until its score is
backed by manual sends, replies, discovery calls, demos, or pilot willingness.
`Leading category action layer` should then drive the `Next manual batch`,
`Discovery questions`, `Pilot setup checklist`, and `Integration hold` before
any lane gets more engineering.
`Pilot setup readiness` is the paid-pilot gate: do not treat a lane as
`Ready for first paid pilot` until proof, setup, dry-run, owner conversation,
and metric gates are complete.

## Goal

Contact 10 real companies manually and decide whether `AI Dispatcher for Local
Services` deserves more engineering.

The decision is useful only if it is based on real evidence:

1. replies,
2. demo bookings,
3. discovery-call pain,
4. pilot willingness,
5. rejection reasons.

## Operating Rule

Every row must keep the same proof posture:

`Manual contact only. No external side effects.`

The shell can help prepare the message, launch packet, activity log, daily log,
week-one review, and evidence pack. It must not send outreach, create calendar
events, write CRM, sync analytics, bill, or mutate this document.

## First 10 Manual Contacts

| # | Company | Segment | Lane | Contact channel checked | Manual message sent | Reply | Demo booked | Next action | Proof status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | AC MASTER | AC repair | `AC repair dispatch` | pending | no | no | no | verify channel and send manually | no proof yet |
| 2 | Aircold | AC repair | `AC repair dispatch` | pending | no | no | no | verify channel and send manually | no proof yet |
| 3 | Santexniki.uz | Plumbing | `Plumbing emergency` | pending | no | no | no | verify Telegram/phone path | no proof yet |
| 4 | Service-Pro | Cleaning | `Cleaning quote and booking` | pending | no | no | no | verify quote request channel | no proof yet |
| 5 | IMZO | Measurement | `Measurement visit booking` | pending | no | no | no | use only if first wave is weak | no proof yet |
| 6 | Modern Systems | Measurement | `Measurement visit booking` | pending | no | no | no | use only if construction-adjacent pain is clear | no proof yet |
| 7 | BRIX.UZ | Measurement | `Measurement visit booking` | pending | no | no | no | use only if measurement flow is clear | no proof yet |
| 8 | TBD | TBD | TBD | pending | no | no | no | choose after first replies | no proof yet |
| 9 | TBD | TBD | TBD | pending | no | no | no | choose after first replies | no proof yet |
| 10 | TBD | TBD | TBD | pending | no | no | no | choose after first replies | no proof yet |

## Discovery Evidence

Use this table only after a real owner or dispatcher replies.

| Company | Pain signal | Current workflow | Who approves customer message? | Would test 14 days? | Price sensitivity | Evidence summary |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

## Pilot Proof Capture

Capture proof as short, redacted summaries. Keep raw recordings and screenshots
private unless the company explicitly approves sharing.

| Proof item | Required before marking done | Status |
| --- | --- | --- |
| 90-second demo recorded | Demo uses no fake revenue or customer claims | pending |
| 10 manual contacts attempted | Each row has channel checked and manual status | pending |
| 3 replies or clear rejections | Each reply has a short reason or pain note | pending |
| 1 discovery call completed | Notes identify workflow owner and approval gate | pending |
| 1 pilot candidate found | Owner agrees to test phone/Telegram intake manually | pending |
| Week-one review prepared | `Pilot week-one review` copied after real activity | pending |
| Week-two evidence pack prepared | `Pilot evidence pack` copied after redaction | pending |

## Stop Rules

Stop adding code if:

1. no one replies after 10 targeted manual contacts,
2. replies only ask for marketplace demand or ads,
3. owners do not have phone or Telegram intake pain,
4. every company already has a mature dispatcher/CRM workflow,
5. no one agrees to a 7-minute demo.

## Continue Rules

Continue only if at least one company shows:

1. missed-call or delayed-response pain,
2. manual Telegram/photo chaos,
3. owner or dispatcher approval gate,
4. willingness to test a 14-day manual pilot,
5. willingness to pay after proof.

## Source Links

1. Demo route: `/app?demo=local-services-dispatch&service=ac-repair-dispatch`
2. Recording checklist: `docs/local-services-demo-recording-checklist.md`
3. Outreach execution pack: `docs/local-services-outreach-execution-pack.md`
4. Pilot runbook: `docs/local-services-pilot-runbook.md`
5. Pilot scorecard: `docs/local-services-pilot-scorecard.md`
6. Evidence and trust guide: `docs/evidence-and-trust.md`
