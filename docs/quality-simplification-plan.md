# Quality Simplification Plan

This document records the implementation plan for making `AI Action Desk`
understandable and useful within seven minutes.

Use it together with `AGENTS.md`, `README.md`, and
`docs/product-master-plan.md`. If this document conflicts with the master plan,
follow the master plan.

## Goal

A new immigration operator, agency owner, or evaluator should understand the
product and see a complete case outcome in seven minutes:

1. open the Action Desk,
2. start the visa-intake demo path,
3. review lead qualification,
4. review missing-document follow-up,
5. review consultation readiness,
6. review CRM or human handoff,
7. open the evidence bundle.

The product promise is not a general multimodal agent platform. The product
promise is:

`AI Action Desk for immigration teams`

The next commercial-expansion plan is intentionally separate:
`docs/local-services-action-desk-spec.md`. That document is the source of truth
for the local-services dispatcher wedge and should prevent scattered notes about
HVAC, plumbing, cleaning, restaurants, hotels, and dentistry from cluttering the
seven-minute immigration path.

The first implementation path for that expansion is
`/app?demo=local-services-dispatch&service=ac-repair-dispatch`. It should stay
phone-first and operator-approved: the AI assistant collects the request,
prepares estimate and slot inputs, drafts confirmation, and produces a
master/operator handoff without autonomous dispatch. The detail panel also opens
`Open dispatch drawer`, `Open customer drawer`, and `Open handoff drawer`, where
the operator can switch between `Human-readable` and `JSON` exports before
copying the dispatch, customer-confirmation, or master handoff payload. The same
detail panel includes `Telegram intake prototype` to prove message intake uses
the same job-card contract as phone intake. It now opens `Open intake evidence`
and `Transcript + evidence` into a `Saved intake evidence` drawer with
`Intake transcript + evidence link`, `Transcript preview`,
`Evidence export mode`, `Copy intake evidence`, `local_services_intake_evidence`,
and `transcript_evidence_link`, so the demo can prove the saved transcript and
evidence link without adding live channel storage. It now also includes `Pilot readiness`,
`One-page offer`, `90-second demo script`, `Outreach focus`, a `Launch checklist`,
and tracked `Pilot metrics` so the first Tashkent pilot can be explained
without leaving `/app`.
The same block now includes `Agent setup / training state`, a 7-minute setup
path for `Business profile`, `Knowledge sources`, `Agent behavior`,
`Test call/message`, and `Ready for test call/message`. `Open setup checklist`
opens `Training cards`, `Copy setup brief`, and
`local_services_agent_setup_training` as a deterministic setup artifact; it
does not activate phone, Telegram, WhatsApp, CRM, analytics, or billing.
This setup path should now be deep-linkable through `?setup=7min`: show
`7-minute setup wizard` and `Setup path`, expose `Open setup checklist`,
`Open day-one setup`, and `Copy setup brief`, then hide outreach tables and
scorecard controls so the first seven-minute explanation stays focused.
It should also behave like a real onboarding checklist: store
`setupStepCompletionByService` and `setupReadyByService` in
`liveDesk:localServicesPilotWorkspace:v1`, expose `Setup progress`,
`Saved setup state`, `Mark complete`, `Mark ready for pilot test`, and
`Ready for pilot test`, and keep the whole flow browser-local.
The shell now includes a fourth P0 demo card, `Measurement visit booking`, for
windows, doors, ceilings, blinds, and fit-out requests. This is the approved
construction-adjacent expansion because it is still a dispatcher workflow:
collect scope, district, photos, approximate sizes, and a manager-approved
measurer slot. Construction-material stock, delivery, payment, and substitution
rules remain outside P0.
The same block now includes a 4-step `Pilot outreach wizard` with
`Offer preview`, `Audience from outreach list`, `Message/test preview`, and
`Operator confirmation`, keeping first outreach preparation inside the shell
while real sends remain outside the autonomous path.
The `Message/test preview` step now opens a `Preview / Test message modal` with
`Human-readable` / `JSON` modes, `Copy test message`, and
`Copy test message preview`, so the operator can inspect the exact text without
creating an external send.
The `Operator confirmation` step now opens an `Operator confirmation summary`
with `Ready for manual outreach`, selected company, channel, exact message,
approval checklist, and `Copy confirmation summary`.
The wizard now includes `Wizard progress` and `Record ready for manual outreach`;
that action sets the selected company to `Draft ready` in browser-local state
and shows `Ready for manual outreach recorded`, still with no outbound send.
The wizard now also includes `AI analyst` / `Ask AI about pilot`: a
deterministic operator-assist sheet with `Suggested questions`, `Best candidate`,
`Bottleneck`, `Next message`, `Copy analyst brief`, and
`local_services_pilot_ai_analyst`. This keeps the useful "Ask AI" dashboard
pattern without adding an external LLM dependency or autonomous outreach.
It now continues into `Pilot scorecard action`: select a company from the
repo-owned outreach list, review the message, and `Record scorecard draft` as a
demo-session `Not contacted` entry. This gives the operator a real next action
without creating an external send or CRM write.
That state is now persisted in browser `localStorage` with
`liveDesk:localServicesPilotWorkspace:v1`, covering the selected outreach
candidate and the operator-only statuses `Draft ready`, `Contacted manually`,
`Reply received`, and `Rejected for now`.
The same shell now adds `Pilot funnel summary` with `All candidates`,
per-status counts, and `Next manual batch`, which turns the first pilot from a
single selected account into a small visible funnel without adding CRM scope.
The same funnel now adds `Outreach list filters` and `Column settings`:
`Service filter`, `Status filter`, `Filtered candidates`,
`Filtered outreach list`, `All services`, `All statuses`, `Clear filters`, and
`View only, no send`. This brings the useful table/filter pattern into the
pilot shell while keeping the action manual-only.
That same funnel now adds `Pilot execution checklist`: `Prepare first manual
batch`, `Ready for first manual batch`, `Record ready drafts`,
`Log manual contact`, `Book discovery call`, `Start metric capture`,
`Founder-only execution`, `No autonomous send`, and `Open pilot runbook`.
This turns the 14-day pilot runbook into a visible operating loop without
adding autonomous outreach or CRM scope.
The next small operating layer is now `Open discovery prep`: it opens
`Discovery call prep` with `Questions to ask`, `Pilot success criteria`,
`Copy discovery call prep`, and the structured
`local_services_discovery_call_prep` payload. This keeps the first replied
company call inside the operator workflow without adding calendar, CRM,
analytics, or outbound-message scope.
The next linked setup layer is now `Open day-one setup`: it opens
`Day-one setup brief` with `Business profile lock`, `Setup tasks`,
`Test call plan`, `Copy day-one setup brief`, and the structured
`local_services_day_one_setup_brief` payload. This turns the discovery call into
pilot setup work without adding live channel activation, billing, CRM,
analytics, calendar, or customer-message scope.
That funnel now has `Open pilot export`, which opens a `Pilot workspace export
drawer` with `Human-readable` / `JSON` modes and `Copy pilot workspace export`.
The export is intentionally manual-only: no outbound message, no CRM write, and
no Markdown scorecard mutation.
The same browser-local state now has `Open metrics tracker`, which opens a
`Pilot metrics tracker` with `Human-readable` / `JSON` modes and
`Copy pilot metrics tracker`. This closes the first pilot measurement loop while
remaining manual-only: no analytics sync, no CRM write, and no Markdown
scorecard mutation.
The same measurement area now has `Open daily log`, which opens `Pilot daily
log` with `Daily capture fields`, `Daily operating loop`,
`Copy pilot daily log`, and the structured `local_services_pilot_daily_log`
payload. This creates a reviewed daily operating-loop note without analytics
sync, CRM write, calendar booking, customer send, or Markdown mutation.
The same pilot area now has `Open week-one review`, which opens `Pilot week-one
review` with `Continue / stop decision`, `Copy week-one review`, and the
structured `local_services_pilot_week_one_review` payload. This keeps the first
continue/pause/stop decision owner-reviewed and manual-only, with no CRM write,
billing change, customer send, or Markdown mutation.
The final manual proof layer is now `Open evidence pack`: it opens
`Pilot evidence pack` with `Week-two evidence pack`, `Copy evidence pack`, and
the structured `local_services_pilot_evidence_pack` payload. This gives the
founder a redacted day-14 proof pack for paid-pilot readiness or a clean stop
decision without private customer data in public docs, CRM write, billing
change, customer send, or Markdown mutation.
That same block should link to repo-owned pilot artifacts through
`/workspace-docs/local-services-pilot-offer.md` and
`/workspace-docs/local-services-demo-script.md`.
The same artifact layer should now include `Open recording checklist` and
`/workspace-docs/local-services-demo-recording-checklist.md`, so the first
90-second video can be recorded from one bounded shot list with explicit
do-not-claim rules.
The shell should also support `?recording=90s` as a narrow recording posture:
show `90-second recording mode` and `Recording path`, then hide outreach tables
and scorecard controls while keeping proof, pilot readiness, and evidence pack
visible.
The next execution layer should also stay repo-owned through
`/workspace-docs/local-services-outreach-list.md` and
`/workspace-docs/local-services-pilot-scorecard.md`.
The real execution checklist now lives in `docs/local-services-pilot-runbook.md`
and is served at `/workspace-docs/local-services-pilot-runbook.md`. It should
remain outside the app shell until real pilots prove which actions deserve
product UI.
The first-contact execution pack now lives in
`docs/local-services-outreach-execution-pack.md` and is served at
`/workspace-docs/local-services-outreach-execution-pack.md`. It stays as a
manual founder worksheet with message templates, discovery-call questions, a
Manual Execution Table, and Do-Not-Send Rules.
The shell now exposes that document through `Open outreach execution pack`
beside the outreach list and scorecard, so the pilot UI can open the first
manual messages without creating an autonomous send path.

## Success Criteria

The seven-minute path is successful when:

1. the first screen reads as an immigration operator desk,
2. one primary case path is visible without runtime setup,
3. lead qualification, document chase, booking, CRM handoff, approval, and
   evidence are visible as one workflow,
4. runtime, replay, signing, diagnostics, and raw artifacts stay available in
   support surfaces instead of dominating the first scan,
5. the demo can be completed without provider credentials,
6. docs explain the product before release machinery.

## Implementation Order

### P0 - Seven-Minute Product Path

Add a dedicated demo posture:

`/app?demo=visa-intake`

It should use the existing workspace case model and show one guided immigration
case path:

1. `Lead qualification`
2. `Missing documents`
3. `Consultation`
4. `CRM handoff`
5. `Human approval`
6. `Evidence bundle`

The path should avoid creating a separate mock universe when existing case,
console, bundle, evidence, and Case Vault surfaces can be reused.

### P0 - First-Screen Simplification

Keep `/app` product-first:

1. active cases,
2. next operator action,
3. document and approval status,
4. clear links to console, bundle, evidence, and Case Vault.

Move deeper runtime details to:

1. `/app/console`,
2. `/app/console/runtime`,
3. `/bundle/:id`,
4. `/evidence/:id`.

### P0 - Outcome Summary

Every product demo should end with a compact `Case Outcome Summary`:

1. qualified lead,
2. missing documents requested,
3. consultation ready,
4. CRM handoff prepared,
5. approval required or completed,
6. evidence bundle available.

### P0 - Docs Simplification

Create or update:

1. `README.md` product-first introduction,
2. `docs/getting-started-7-min.md`,
3. `docs/operator-guide.md` seven-minute demo note,
4. `docs/evidence-and-trust.md` for replay, signing, and release detail.

### P1 - Templates

Add reusable immigration playbook templates:

1. `Visa Lead Qualification`,
2. `Missing Document Follow-up`,
3. `Consultation Booking Prep`,
4. `CRM Handoff Summary`.

Each template should include:

1. sample input,
2. expected outcome,
3. approval policy,
4. evidence output,
5. CRM fields.

Current shell note:

The first pass should live in the main `/app` shell as productized launch cards,
not as a separate builder. Use existing runtime cases and support surfaces so
the templates stay grounded in the same case, approval, bundle, evidence, and
Case Vault flows. Each card should preview `Outcome`, `Approval`, `Evidence`,
and `Deliverable` before the operator opens the lane. The selected lane should
also expose `Sample input`, `Approval policy`, `Evidence output`, and `CRM
fields` inline, with a deep-linkable `?playbook=` state. The same panel should
show a repo-owned `Payload preview`, the canonical `Surface path`, and a
`Copy payload` action derived from the active case and available Case Wiki.
It should also provide an `Open export drawer` action so the CRM and
consultation lanes have an integration-ready review surface before any external
connector exists: `CRM payload drawer` for the Case Vault route and
`Consultation handoff drawer` for the Presentation Bundle route. Both drawers
should expose `Human-readable` and `JSON` modes plus an operator checklist.

### P1 - Integrations

Prioritize integrations that close the current wedge:

1. Google Calendar or Calendly,
2. HubSpot or Airtable CRM,
3. Gmail draft or send with approval,
4. document upload,
5. Telegram or WhatsApp intake.

## Non-Goals For This Cycle

Do not move these into the critical path:

1. disconnected vertical products before the local-services dispatcher spec has
   a complete seven-minute path and pilot signal,
2. broad model-portfolio work,
3. Storyteller as the main product surface,
4. generic browser-agent positioning,
5. marketplace work before first repeatable playbooks,
6. autonomous legal advice or filing.

## Validation

For UI and docs changes:

```bash
npm run test:unit
npm run build
```

For release-impacting evidence or artifact changes:

```bash
npm run verify:release
```
