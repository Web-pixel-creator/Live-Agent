# Local Services Outreach List

Checked against public sources on 2026-04-26.

Use this as a working outreach queue, not as a final CRM. Before sending any
pitch, verify that the company is still active, still serving Tashkent, and
still using the same contact channel shown on its public website.

## Selection Rules

Prioritize companies that:

1. clearly sell AC repair, plumbing, cleaning, or measurement-led installation in Tashkent
2. publish fast-response, same-day, or emergency service promises
3. appear to rely on phone or Telegram intake
4. would feel pain from missed or delayed inbound requests

## First-Wave Accounts

| Priority | Company | Segment | Public site | Why it fits the wedge | Best outreach angle | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | AC MASTER | AC repair | [acmaster.uz](https://acmaster.uz/) | Directly sells installation, repair, and servicing for homes, offices, and commercial sites in Tashkent. | Reduce missed summer calls and hand operators an approval-ready same-day visit card. | Not contacted |
| 2 | Aircold | AC repair | [aircold.uz](https://aircold.uz/) | Focused on AC repair, монтаж, and maintenance with a warranty promise. | Turn repair requests into structured same-day dispatch intake instead of callback chaos. | Not contacted |
| 3 | Server Service | AC repair / installation | [server-service.uz](https://server-service.uz/en/installation-of-air-conditioners/) | Promises quick installation and repair across Tashkent with same-day positioning. | Protect after-hours demand and standardize estimate + slot capture before operator approval. | Not contacted |
| 4 | Santexniki.uz | Plumbing | [santexniki.uz](https://santexniki.uz/) | Emergency-oriented plumbing offer, 24/7 posture, Telegram CTA, and broad household jobs. | Convert urgent leak and clog calls into one operator-approved dispatch card with safety script. | Not contacted |
| 5 | Ibrat Qurilish Servis | Plumbing / инженерные сети | [santexnika.uz](https://santexnika.uz/) | Established plumbing and water/heating contractor with repair, installation, and emergency call posture. | Use AI intake to separate emergency versus routine work before sending jobs to a master. | Not contacted |
| 6 | Service-Pro | Cleaning | [service-pro.uz](https://service-pro.uz/) | Local cleaning team focused on apartments, homes, and offices with transparent pricing language. | Reduce quote back-and-forth and push every inquiry into one reviewed booking draft. | Not contacted |
| 7 | Eco Fresh | Cleaning | [eco-fresh.uz](https://eco-fresh.uz/) | Covers offices, apartments, factories, and sites in Tashkent with eco-positioning. | Show how phone + Telegram requests can land in one quote queue instead of fragmented chats. | Not contacted |
| 8 | CleanTime | Cleaning | [clean-time.uz](https://clean-time.uz/) | Simple performance marketing posture with fast price calculation and broad cleaning categories. | Shorten time-to-quote and stop losing leads that arrive outside manager hours. | Not contacted |
| 9 | Chistoluxe | Cleaning | [chistoluxe.uz](https://chistoluxe.uz/) | Consumer-friendly cleaning offer with office/home positioning and first-order incentive. | Use operator-approved quote and confirmation drafts to improve first-response quality. | Not contacted |
| 10 | Nazif Cleaning | Cleaning | [nazifclean.uz](https://www.nazifclean.uz/) | Young B2B-oriented cleaning company for offices and companies, still small enough for pilot adoption. | Position the pilot as a way to capture every office lead and standardize follow-up. | Not contacted |
| 11 | IMZO | Windows / doors | [imzo.uz](https://imzo.uz/en/) | Public site offers free measurement and product/order flows for windows, doors, and sliding systems. | Capture photos, approximate sizes, district, and a manager-approved measurer visit without promising final price. | Not contacted |
| 12 | Modern Systems | Windows / sliding systems | [modernsystems.uz](https://modernsystems.uz/en/) | Publishes manager callback, showroom, installation, and broad window/door system categories. | Turn showroom and phone requests into structured measurement cards before manager callback. | Not contacted |
| 13 | BRIX.UZ | Ceilings / fit-out | [brix.uz](https://brix.uz/en/product/stretch-ceiling-installation-for-house-in-tashkent) | Lists product-plus-service ceiling and fit-out offers where quote questions can start as measurement visits. | Separate measurement visit capture from material stock and final quote approval. | Not contacted |

## Benchmarks, Not First Calls

These companies are useful to study, but they look less attractive for the
first pilot wave because they appear larger, more enterprise-oriented, or more
operationally mature already:

1. [Climat Plus](https://en.climatplus.uz/) - larger HVAC and engineering posture
2. [FUSE HVAC ENGINEERING](https://fuse.uz/en/) - B2B engineering service center
3. [166 Cleaning](https://166cleaning.uz/en) - scaled, process-heavy cleaning player
4. [Profuborka](https://profuborka.uz/) - mature B2B cleaning operator with large-team signals
5. [IMZO](https://imzo.uz/en/) - strong benchmark for measurement-led windows/doors demand
6. [Modern Systems](https://modernsystems.uz/en/) - useful benchmark for showroom-led installation requests
7. [BRIX.UZ](https://brix.uz/en/product/stretch-ceiling-installation-for-house-in-tashkent) - useful benchmark for product-plus-service quote flows

## Outreach Sequencing

The demo shell can now select these accounts in the `Pilot outreach wizard`,
open `Agent setup / training state`, confirm `Business profile`,
`Knowledge sources`, `Agent behavior`, `Test call/message`, and
`Ready for test call/message`, open `Test call/message panel`, confirm
`Sample inbound`, `Expected extracted fields`, `Pass/fail checklist`,
`Mark check passed`, `Record test passed`, and `Test call passed`, open the
`Preview / Test message modal`, review
`Operator confirmation summary`, click `Record ready for manual outreach`, open
`Ask AI about pilot` for
`Suggested questions`, `Best candidate`, `Bottleneck`, and `Next message`, and
produce a local `Scorecard draft`.
Treat that as preparation only: no real message is sent and the company remains
manual-only until a human operator performs outreach.
Use `docs/local-services-outreach-execution-pack.md` before first contact for
the first four manual messages, Discovery Call Template, Manual Execution Table,
and Do-Not-Send Rules.
The selected company and status are saved in browser `localStorage` as
`liveDesk:localServicesPilotWorkspace:v1`, so the demo can survive refreshes
without pretending to be CRM.
The `Pilot funnel summary` in the shell counts every candidate here by status
and keeps a `Next manual batch` visible for the operator. It now also includes
`Outreach list filters`, `Column settings`, `Service filter`, `Status filter`,
`Filtered candidates`, `Filtered outreach list`, `All services`,
`All statuses`, `Clear filters`, and `View only, no send` so the operator can
narrow the list without creating an autonomous outreach or CRM workflow.
The selected service panel also exposes `Open intake evidence` and
`Transcript + evidence`; the `Saved intake evidence` drawer shows
`Intake transcript + evidence link`, `Transcript preview`, `Copy intake
evidence`, `local_services_intake_evidence`, and `transcript_evidence_link` as
proof-only context before handoff.
The same funnel now shows `Pilot execution checklist` with
`Pass test call/message`, `Needs test call passed`,
`Prepare first manual batch`, `Ready for first manual batch`,
`Record ready drafts`, `Log manual contact`, `Book discovery call`,
`Start metric capture`, `Founder-only execution`, `No autonomous send`, and
`Open pilot runbook`, plus `Pilot checklist progress`, `Dry run required` /
`Dry run passed`, and `Manual launch blocked` / `Manual launch ready`, so the
first 14-day pilot has a visible manual loop gated on the dry run and a ready
draft. `Open launch packet` opens `Pilot launch packet` / `Launch packet
preview` with `First manual contact checklist`, `Launch readiness`,
`Dry-run gate`, `Selected company`, `Draft status`, `Next action`,
`Copy launch packet`, and `local_services_pilot_launch_packet` before the
operator sends anything manually.
When a company replies, use `Open discovery prep` to review `Discovery call
prep`, `Questions to ask`, `Pilot success criteria`, and
`Copy discovery call prep`. The structured payload is
`local_services_discovery_call_prep`; it remains manual-only and does not book
calendar slots, send follow-up, write CRM, sync analytics, or mutate this list.
After that call, use `Open day-one setup` to review `Day-one setup brief`,
`Business profile lock`, `Setup tasks`, `Test call plan`, and
`Copy day-one setup brief`. The structured payload is
`local_services_day_one_setup_brief`; it remains setup handoff only and does not
activate channels, billing, CRM, calendar, analytics, or customer sends.
During each pilot day, use `Open daily log` to review `Pilot daily log`,
`Daily capture fields`, `Daily operating loop`, and `Copy pilot daily log`.
The structured payload is `local_services_pilot_daily_log`; it remains a manual
operating-loop note only and does not sync analytics, write CRM, create
calendar bookings, send customer messages, or mutate this list.
After the first real week, use `Open week-one review` to review `Pilot week-one
review`, `Continue / stop decision`, and `Copy week-one review`. The structured
payload is `local_services_pilot_week_one_review`; it remains owner/operator
review only and does not decide autonomously, write CRM, change billing, send
customer messages, or mutate this list.
At day 14, use `Open evidence pack` to review `Pilot evidence pack`,
`Week-two evidence pack`, and `Copy evidence pack`. The structured payload is
`local_services_pilot_evidence_pack`; it remains a redacted manual proof pack
only and does not store private customer data in public docs, decide
autonomously, write CRM, change billing, send customer messages, or mutate this
list.

### Week 1

1. AC MASTER
2. Aircold
3. Santexniki.uz
4. Service-Pro

### Week 2

1. Server Service
2. Ibrat Qurilish Servis
3. Eco Fresh
4. CleanTime
5. Chistoluxe
6. Nazif Cleaning

### Week 3

Use only after the first service pilots show real demand:

1. IMZO
2. Modern Systems
3. BRIX.UZ

## Contact Script Direction

Lead with the business problem, not the AI story.

Bad opening:

`We built an AI agent platform for local businesses.`

Good opening:

`You probably lose some requests when the owner is busy, offline, or answering too late. We built a dispatcher that captures the job, prepares the estimate inputs, and still leaves final booking and dispatch under human approval.`

## Minimum Data To Capture During Outreach

For each company, record:

1. who answers first today
2. whether Telegram is part of the booking flow
3. whether they promise same-day or urgent response
4. whether price is fixed, estimated, or always manual
5. who approves the final slot or dispatch
6. whether they already use CRM, spreadsheet, or just chat + phone
