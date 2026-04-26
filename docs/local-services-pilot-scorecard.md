# Local Services Pilot Scorecard

Use this document to score the first outreach conversations and early pilots.
Use `docs/local-services-pilot-runbook.md` for the operating sequence that
decides when to create rows, when to contact manually, and when to continue or
stop the pilot.
Use `docs/local-services-outreach-execution-pack.md` for the first four manual
messages, Discovery Call Template, Manual Execution Table, and Do-Not-Send
Rules before updating real outreach status.

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
2. review the `Test message preview`
3. open `Operator confirmation summary`
4. click `Record ready for manual outreach` to mark `Draft ready` locally
5. open `Ask AI about pilot` if the operator needs `Suggested questions`,
   `Best candidate`, `Bottleneck`, or `Next message`
6. keep real outreach manual-only until a human sends the message outside the shell

This shell action is intentionally local to the demo session. It does not send a
message, update CRM, call an external LLM, or change this Markdown file
automatically.

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

The shell also shows a `Pilot funnel summary` for all candidates in the
outreach list. Use it to see:

1. `All candidates`
2. count by status
3. `Next manual batch`
4. the current manual execution rule

`Open pilot export` opens the `Pilot workspace export drawer`. Use
`Human-readable` when manually updating this scorecard and `JSON` when pasting
into CRM or a spreadsheet. `Copy pilot workspace export` copies the reviewed
snapshot only; it does not send a message, update CRM, or mutate this Markdown
file automatically.

`Open metrics tracker` opens the `Pilot metrics tracker` for the selected
service lane. Use `Human-readable` for weekly operator review and `JSON` when
pasting reviewed numbers into a spreadsheet. `Copy pilot metrics tracker`
copies the reviewed metric plan only; it does not sync analytics, update CRM, or
mutate this Markdown file automatically.

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
4. too much enterprise complexity for a solo-founder rollout

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
