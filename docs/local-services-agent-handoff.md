# Local Services Agent Handoff

Last assembled: 2026-05-19.

Use this file when another agent, developer, or product reviewer needs to
understand the current direction without reading the whole conversation history.
It captures the working plan discussed with the founder, the current repo
context, the local-services product strategy, the UI decisions, and the external
ideas that are allowed to influence the product.

## First Read This

`AGENTS.md`, `README.md`, and `docs/product-master-plan.md` now recognize the
active local-services product-mode work. The current working direction is:

`AI Dispatcher for local service businesses in Tashkent`

The older immigration Action Desk remains a trust-heavy proof surface for
approval, evidence, replay, and operator-safe handoff. It should not override
the local-services product-mode plan when changing dispatcher IA, setup,
outreach, scenario behavior, or persistence.

The current strategic decision is not to build a generic multimodal platform,
not to build a Claude/OpenAI competitor, and not to build a consumer super-app.
The current product should be a narrow, operator-approved dispatcher for local
service companies.

## Product In One Sentence

AI Dispatcher answers calls and Telegram/WhatsApp/site requests for local
service teams, collects the job details, prepares an operator-ready job card,
suggests price/slot/master handoff, and keeps all customer-facing actions behind
human approval.

Short positioning:

`AI dispatcher for Tashkent service companies: captures calls and Telegram requests, prepares a job card, recommends the next action, and helps the operator approve the customer and master handoff.`

Do not position it as:

1. `AI for everything`.
2. `Local Claude`.
3. `AI employee marketplace`.
4. `Autonomous booking system`.
5. `Restaurant/hotel/dentist super-app`.

## Core Pain

The first buyer pain is simple and concrete:

1. Missed calls after hours or while masters are on site.
2. Telegram/Instagram/phone leads scattered across chats.
3. Admins rewriting the same handoff messages manually.
4. No clean CRM, no clear owner, no proof of what happened.
5. Urgent leads lost because the team does not respond fast enough.

The project wins only if a buyer can understand the value in about seven
minutes:

1. Customer calls or writes.
2. AI collects service, district, address, urgency, photos/details, slot, and
   price inputs.
3. AI creates a ready job card.
4. Operator approves or edits.
5. Customer confirmation and master handoff are prepared.
6. Evidence, transcript, and decision trail are retained.

## First ICP

The first ICP is local service companies in Tashkent.

Best first customers:

1. 3-20 masters, technicians, cleaners, or brigades.
2. Many requests through phone, Telegram, Instagram, 2GIS, Google Maps, or ads.
3. No strong CRM or only spreadsheets/chats.
4. Services require address, time, urgency, price range, photos, and a visit.
5. The owner understands the value of one qualified lead or urgent booking.

Avoid first:

1. Solo masters with no repeatable process.
2. Restaurants that only need simple table booking.
3. Hotels with PMS/payment/OTA complexity.
4. Dental/medical clinics until privacy and compliance packaging are stronger.
5. Construction-material suppliers until dispatch is proven.
6. Textile/export/wholesale workflows with many SKUs, samples, documents, and
   logistics.

## P0 Vertical Scope

Build one dispatcher product with several service lanes, not separate products.

P0 lanes:

1. AC / HVAC / conditioner repair and diagnostics.
2. Plumbing / emergency сантехника.
3. Cleaning quote and booking, especially after renovation.
4. Measurement visits for windows, doors, ceilings, blinds, kitchens, furniture,
   and fit-out.

Compatible but not first:

1. Electrical and small repairs.
2. Construction-material quote or delivery desk.
3. Restaurant reservation.
4. Hotel concierge.
5. Dentistry booking.

Construction materials are adjacent but not P0. They require stock, quantity,
substitutions, delivery, unloading, payment, invoices, and changing prices.
Current P0 is the field-service dispatch workflow, not commerce automation.

## Current Product Routes

Primary local-services demo route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch`

Other service lanes:

1. `service=plumbing-emergency`
2. `service=cleaning-quote-booking`
3. `service=measurement-visit-booking`

Focused routes:

1. `/app?demo=local-services-dispatch&service=ac-repair-dispatch&setup=7min`
2. `/app?demo=local-services-dispatch&service=ac-repair-dispatch&recording=90s`
3. `/app?demo=local-services-dispatch&service=ac-repair-dispatch&path=7min&view=requests&packet=launch`

Workspace docs served by the frontend:

1. `/workspace-docs/local-services-pilot-offer.md`
2. `/workspace-docs/local-services-demo-script.md`
3. `/workspace-docs/local-services-demo-recording-checklist.md`
4. `/workspace-docs/local-services-outreach-list.md`
5. `/workspace-docs/local-services-pilot-scorecard.md`
6. `/workspace-docs/local-services-pilot-runbook.md`
7. `/workspace-docs/local-services-outreach-execution-pack.md`
8. `/workspace-docs/local-services-founder-execution-log.md`
9. `/workspace-docs/local-services-developer-map.md`
10. `/workspace-docs/local-services-agent-handoff.md`

## Design Workbench Review

Reviewed source:

1. Attached archive: `C:/Users/user/Downloads/design-workbench-main.zip`
2. Intended upstream repo: `git@github.com:Web-pixel-creator/design-workbench.git`
3. Local review copy: `.tmp/design-workbench-review-20260514/design-workbench-main`

The design workbench is valuable, but it is not currently backend-integrated
with this repository. Treat it as a design/product prototype and implementation
reference, not as a drop-in replacement for `apps/demo-frontend`.

Important design-workbench files:

1. `src/pages/Dashboard.tsx` - top-level dashboard view state.
2. `src/components/dashboard/InboxView.tsx` - dispatcher queue and right rail.
3. `src/components/dashboard/RequestsView.tsx` - all requests table.
4. `src/components/dashboard/ScheduleView.tsx` - schedule/calendar surface.
5. `src/components/dashboard/ClientsView.tsx` - customer table.
6. `src/components/dashboard/SetupView.tsx` - dispatcher setup/onboarding.
7. `src/components/dashboard/ReviewView.tsx` - founder/operator review.
8. `src/components/dashboard/LaunchPacketView.tsx` - launch packet.
9. `src/components/dashboard/data.ts` - static workspace case data and
   browser-local persistence.
10. `src/lib/scenarios/schema.ts` - zod scenario schema.
11. `src/lib/scenarios/store.ts` - static/local scenario store abstraction.
12. `src/integrations/supabase/client.ts` - optional Supabase client with a
    safe no-op stub when env vars are missing.

Backend reality:

1. The workbench does not call this repo's `apps/api-backend`.
2. Workbench dashboard cases are static data from
   `src/components/dashboard/data.ts`.
3. Workbench scenario content loads from `public/scenarios.json`.
4. Workbench edits persist to browser `localStorage`.
5. Supabase is present for auth/admin experiments, but if Lovable/Supabase env
   vars are absent it becomes a no-op stub.
6. `src/server.ts` is a TanStack Start / Cloudflare-style server entry, not our
   current demo frontend server.

Current repo backend reality:

1. `apps/demo-frontend/src/server.ts` serves `/config.json`, `/healthz`,
   `/debug-artifacts/*`, and `/workspace-docs/*`.
2. `apps/demo-frontend/app-shell/src/lib/runtime-api.ts` resolves API calls
   through `/config.json`.
3. `apps/demo-frontend/app-shell/src/hooks/useWorkspaceRuntime.tsx` already
   talks to runtime/operator endpoints such as `/v1/operator/summary`,
   `/v1/sessions`, `/v1/runtime/case-wiki`, and governance endpoints.
4. `apps/api-backend/src/index.ts` has runtime, sessions, approvals,
   governance, channels, device-node, skills, and operator routes.
5. The first repo-owned local-services workspace API now exists in
   `apps/api-backend/src/local-services-workspace.ts` and is mounted from
   `apps/api-backend/src/index.ts` at `/v1/local-services/*`.
6. The current API is an in-memory pilot boundary, not final production
   storage. It exists to remove the Lovable Cloud dependency from the product
   plan while keeping browser-local fallback for offline demos.

Stack mismatch:

1. Current repo app shell: React 18, Vite 5, Tailwind 3, React Router.
2. Design workbench: React 19, Vite 7, Tailwind 4, TanStack Router/Start,
   Cloudflare plugin, Supabase client.
3. Because of that mismatch, do not copy the workbench wholesale into the repo.
   Port product ideas and component behavior slice by slice.

What to take from the design workbench now:

1. Dashboard IA: sidebar, topbar, dispatcher queue, right detail rail.
2. Operator pages: Requests, Schedule, Customers, Setup, Reviews, Launch packet.
3. Queue behavior: click selects preview; explicit open goes to full task page.
4. Right rail behavior: sticky header, scrollable body, sticky action footer.
5. Scenario store pattern: zod schema plus static/local/backend-swappable store.
6. Admin scenario editor idea, but only for four fixed scenarios at first.
7. Visual regression fixture mindset from the workbench e2e tests.

Current repo-owned porting state:

1. Dispatcher now follows the workbench contract: compact queue, right decision
   rail, click-for-preview, and explicit full open.
2. Requests and Schedule have their own actionable rails that write only
   browser-local/workspace-API review state.
2a. Schedule is now an `Approval-ready slot planner`: KPI cards show confirmed
    slots, approval-ready slot cards, same-day/ASAP routes, and conflicts;
    `Schedule compact slot planner` rows select only the slot preview; `Open
    schedule drawer` and `Open in Dispatcher` are the explicit full actions.
    The `Schedule approval rail` shows `Customer confirmation draft`, `Master
    handoff draft`, `Booking handoff preview`, and `Workspace record` while
    preserving the no booking / no send / no dispatch / no CRM / no payment
    guardrail.
3. Customers now has a `Customer compact directory` with contactable customers,
   active 30-day demo cases, honest `Сумма заявок` midpoint estimates, district
   coverage, and `LAST = service + ref`. Row click selects only the preview
   rail; `Open customer drawer` is the explicit full action.
4. The customer right rail is `Customer confirmation rail` plus
   `Consent-safe confirmation preview`; it can update
   `customerConfirmationByService` and mirror to `operatorDecisionByCaseRef`,
   but it does not send SMS, Telegram, WhatsApp, email, CRM updates, payments,
   bookings, or dispatches.
5. The pilot outreach wizard now has an `Outreach readiness rail` with
   step-count `Wizard progress`, `Next outreach action`, `Mark preview
   reviewed`, and `Manual outreach boundary`. It records
   `messagePreviewReviewedByProspectKey` for the selected company only and does
   not send outreach, write CRM, mutate the scorecard, or create calendar
   events.
6. The selected outreach channel is now treated as export proof, not only UI
   state. `selectedChannelByProspectKey` feeds confirmation, launch packet,
   `Manual activity log`, pilot workspace export, and `Pilot evidence pack` via
   `selected_channel_id`, `selected_channel`, and
   `selected_channel_state_key`.
7. The pilot metric/export buttons live in one bounded action rail:
   `Pilot metric and evidence export actions`. Keep `Open metrics tracker`,
   `Open daily log`, `Open week-one review`, and `Open evidence pack` inside
   that rail so they wrap within the pilot column and cannot overlap the
   adjacent handoff/export surface.

What not to take now:

1. Lovable Cloud as the long-term backend.
2. Direct Supabase client as the product source of truth unless explicitly
   chosen later.
3. TanStack Start / Cloudflare runtime as a forced replacement for the current
   demo frontend.
4. Full admin analytics before real pilot data exists.
5. Full scenario CRUD before four fixed scenarios prove useful.

Backend adapter contract:

```ts
type LocalServicesWorkspaceAdapter = {
  listCases(): Promise<WorkspaceCase[]>;
  getCase(ref: string): Promise<WorkspaceCase | null>;
  readSnapshot(): Promise<Record<string, unknown>>;
  writeSnapshot(snapshot: Record<string, unknown>): Promise<void>;
  updateCaseDecision(ref: string, decision: OperatorDecision): Promise<void>;
  listScenarios(): Promise<Scenario[]>;
  saveScenarioOverrides(scenarios: Scenario[]): Promise<void>;
  recordSetupStep(stepId: string, payload: unknown): Promise<void>;
  exportPilotPacket(): Promise<PilotExport>;
};
```

Implemented first boundary:

1. `apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`
   owns `LOCAL_SERVICES_WORKSPACE_STORAGE_KEY`, the `/v1/local-services/*`
   endpoint names, and the `LocalServicesWorkspaceAdapter` type.
2. `apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts` owns the
   zod-validated four-lane scenario packet through
   `DEFAULT_LOCAL_SERVICES_SCENARIOS`, plus the bounded `scenarioOverrides`
   merge helper used by the adapter.
3. `apps/api-backend/src/local-services-workspace.ts` owns the first
   repo-side workspace record, scenario override validation, setup event
   recording, operator decision recording, and pilot export JSON/human text.
4. `LiveDesk.tsx` now hydrates from the hybrid adapter and writes state back to
   the workspace API after hydration, while keeping browser-local fallback.
5. The adapter has static, browser-local, API, and hybrid constructors. It still
   has no external sends: no outreach, dispatch, CRM write, billing, or customer
   notification happens through this boundary.
6. `LiveDesk.tsx` action handlers now also mirror the key operator actions to
   the adapter endpoints: scenario save/reset uses `saveScenarioOverrides`,
   dispatch/customer approval rails use `updateCaseDecision`, and setup/test
   call actions use `recordSetupStep`. The same actions also write
   `operatorDecisionByCaseRef` and bounded `setupEvents` into the workspace
   snapshot so the recovery sync cannot erase endpoint-recorded state.
7. `LiveDesk.tsx` now exposes that persistence contract in the UI through
   compact `Workspace record` / `Latest setup record` signals. These labels are
   intentionally honest: `API + local fallback` means repo-owned pilot
   workspace persistence with browser fallback, not durable production storage.
8. `Open workspace API export` opens `Workspace API export drawer` and calls
   `exportPilotPacket()`. It exposes `workspace API + local fallback`,
   `Copy workspace API export`, `local_services_workspace_api`, and
   `browser_local_preview`. This is inspection only, not durable production
   storage or an integration side effect.

Recommended adapter sequence:

1. `StaticLocalServicesAdapter` - current demo/static data.
2. `BrowserLocalServicesAdapter` - static data plus `localStorage` edits.
3. `ApiLocalServicesAdapter` - repo-owned `/v1/local-services/*` pilot
   persistence with browser-local fallback through the hybrid adapter.
4. `RuntimeLocalServicesAdapter` - read-only mapping from existing
   `/v1/operator/summary` and runtime Case Wiki where possible.

Current local-services endpoints:

1. `GET /v1/local-services/workspace`
2. `PUT /v1/local-services/workspace`
3. `GET /v1/local-services/cases`
4. `GET /v1/local-services/cases/:ref`
5. `POST /v1/local-services/cases/:ref/decision`
6. `GET /v1/local-services/scenarios`
7. `PUT /v1/local-services/scenarios`
8. `GET /v1/local-services/pilot/export`
9. `POST /v1/local-services/setup/events`

Until this moves to durable database storage, all local-services workspace
changes must remain manual-only and clearly labeled as no external side
effects.

## Important Repo Files

Primary product docs:

1. `docs/local-services-action-desk-spec.md`
2. `docs/local-services-developer-map.md`
3. `docs/local-services-pilot-runbook.md`
4. `docs/local-services-outreach-execution-pack.md`
5. `docs/local-services-pilot-scorecard.md`
6. `docs/local-services-outreach-list.md`
7. `docs/local-services-pilot-offer.md`
8. `docs/local-services-demo-script.md`
9. `docs/local-services-demo-recording-checklist.md`
10. `docs/local-services-agent-handoff.md`

Shared/product docs that must stay synchronized:

1. `README.md`
2. `AGENTS.md`
3. `docs/product-master-plan.md`
4. `docs/operator-guide.md`
5. `docs/local-development.md`
6. `docs/quality-simplification-plan.md`

Frontend implementation areas:

1. `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
2. `apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`
3. `apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts`
4. `apps/demo-frontend/app-shell/src/components/workspace/AppSidebar.tsx`
5. `apps/demo-frontend/app-shell/src/components/workspace/Topbar.tsx`
6. `apps/demo-frontend/app-shell/src/pages/Workspace.tsx`
7. `apps/demo-frontend/src/server.ts`

Tests:

1. `tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`

Generated frontend bundle, when build updates it:

1. `apps/demo-frontend/public/app-shell/index.js`
2. `apps/demo-frontend/public/app-shell/style.css`

## Current Workflow Contract

The product workflow is:

1. Inbound request from phone, Telegram, WhatsApp, site chat, or form.
2. Intake normalization into service, district, slot, urgency, access, photos,
   price inputs, and contact.
3. Job card assembly.
4. AI recommendation with action and 2-3 reasons.
5. Operator approval or edit.
6. Customer confirmation draft.
7. Master/operator handoff draft.
8. Evidence, transcript, timeline, and review trail.

P0 safety contract:

1. No autonomous customer send.
2. No autonomous master dispatch.
3. No final price promise without operator review.
4. No payment collection.
5. No CRM write unless explicitly approved.
6. No stock, delivery, substitution, or marketplace automation.

Every UI feature must preserve this sentence:

`Nothing is sent, booked, dispatched, billed, or written to CRM without explicit operator approval.`

## Dashboard IA

The primary dashboard is the operator workspace.

Recommended structure:

1. Left full-height sidebar for navigation.
2. Top bar with search, approval mode, language, theme, notifications, profile.
3. Center workspace with KPI cards, filters, and compact dispatcher queue.
4. Right full-height selected-case detail rail.

The right rail should behave like a real app panel, not a floating card:

1. Fixed width around 520-560px on wide screens.
2. Full height from under the top bar to bottom.
3. Own scroll body.
4. Sticky case header.
5. Sticky action footer.
6. Center queue scroll independent from the right rail.
7. On smaller screens, collapse the rail into a drawer.

The center content should not stretch forever. Keep it compact and readable.

## Queue Row Design

The dispatcher queue row should be compact and operator-readable.

Do not make each row a vertical form with labels like:

`CLIENT / SERVICE / DISTRICT / SLOT / PRICE / SLA / NEXT`

That becomes too tall and destroys scan speed.

Use a 2-3 line row:

1. `#AD-2421 · P0 · Дильноза К. · Сантехника · аварийная · Юнусабад`
2. `сейчас · в течение часа · 180 000 -> 900 000 UZS · SLA 42m`
3. `Подтвердить вызов`

Recommended row grid:

`grid-template-columns: 48px minmax(0, 1fr) 192-204px`

Rules:

1. Left column: channel icon and urgency dot.
2. Middle column: all text and SLA/value chips.
3. Right column: status + explicit open button + action buttons.
4. No absolute positioning for row actions.
5. No negative margins.
6. No overlap between inline metadata and right-side buttons.
7. Normal row height: about 86-96px.
8. Selected urgent row can reach about 104px, but not much more.

Right row actions:

1. Primary visible action: `Подтвердить`.
2. Secondary icon: reschedule/wait.
3. Secondary icon: reject/close.
4. Open chevron means open full task page.

Button visibility:

1. For urgent rows, actions are fully visible.
2. For non-critical rows, keep actions visible but muted.
3. Tooltips explain icon-only actions.

## Case Selection Behavior

Selection and navigation must not fight each other.

Correct behavior:

1. Clicking a row selects it and updates the right preview.
2. Clicking `Открыть`, chevron, double-click, or pressing Enter opens the full
   `/tasks/:id` style detail page.
3. Scrolling the center queue must not automatically change the selected case.
4. If the selected row scrolls away, show a small control like
   `Выбрана #AD-2421 · Показать`.

Avoid scroll-spy that swaps the right panel while the operator scrolls. It feels
surprising because hover does not do the same thing.

## Right Detail Rail

The right panel should show the selected case. It is not a debug console.

Recommended order:

1. Header: ref, status, priority, SLA, service, district, client.
2. AI recommendation: action plus top 2-3 reasons.
3. Customer request: separate card with source text and contact.
4. Slot / price / district cards.
5. Customer response draft preview.
6. Collapsed case details: overview, checklist, events, evidence, payload/dev.
7. Sticky footer: approve/edit/reject.

Separate the visual tones:

1. AI recommendation: accent/glass panel.
2. Customer request: normal `bg-card` panel.
3. Evidence/payload/raw events: collapsed by default.

Footer action hierarchy:

1. Primary: `Отправить мастера` or `Подтвердить`.
2. Secondary: `Править`.
3. Ghost/destructive: `Отклонить`.

Primary action must be visually dominant. Edit and reject should not have equal
weight.

The footer must not cover content. Add bottom padding in the scroll body equal
to footer height plus comfortable spacing.

Operator-facing footer text:

`Контроль · оператор · автоотправка выкл.`

Avoid mixed operator/developer wording like:

`APPROVAL-ON · autosend disabled`

## Details Accordion

The `Подробности кейса` block is useful and should stay collapsed by default.

Recommended tabs:

1. `Обзор`
2. `Чеклист`
3. `События`
4. `Evidence`
5. `Payload`
6. `Dev`

For normal operators, keep developer tabs collapsed or hidden behind a
`Developer view` toggle. Evidence is useful, but raw payload and raw events
should not be first-scan content.

## Today Events Button

The small button in the right rail such as `Сегодня 2/3` is useful only if it is
operator-facing.

Meaning:

1. Green dot: something is active now.
2. Number: relevant events or slots today.
3. Click: opens a compact schedule/events popover.

Popover should show:

1. `Сейчас`
2. `Сегодня`
3. `По этой заявке`
4. simple event rows with time, service, district, status.

Do not show technical fields like `ref`, `lane`, `gate/state` as the primary UI.

## Color And Surface Rules

Do not make the dashboard all translucent glass. It becomes blurry and loses
hierarchy.

Use two levels:

1. L1 working surfaces: dense `bg-card`, clear border, no blur.
2. L2 nested surfaces: subtle glass/accent inside L1 only.

Semantic color:

1. `P0` and `needs_action` should be stronger than neutral rows.
2. Use amber/orange for urgent attention.
3. Use green only for approved/resolved/safe actions.
4. Use blue for in-flight/in-progress.
5. Use red only for destructive/rejected/critical failure.

Increase contrast for tiny mono labels. Avoid `text-muted-foreground/80` on
glass backgrounds when the label is important.

## Language Rules

Operator UI should be RU-first because the initial market is Tashkent.

Translate or simplify:

1. `Dispatcher` -> `Диспетчер`
2. `Requests` -> `Заявки`
3. `Schedule` -> `Расписание`
4. `Customers` -> `Клиенты`
5. `Setup` -> `Настройка`
6. `Reviews` -> `Ревью`
7. `Launch packet` -> `Пакет запуска`
8. `Approval-on` -> `Подтверждение: вкл`
9. `Approve` -> `Подтвердить`
10. `Edit` -> `Править`
11. `Reject` -> `Отклонить`

English can remain in developer-only pages or code identifiers.

## Public Landing And Dev Page

`/dev` is useful as an internal lab, not as the public product.

Keep it for:

1. Lanes.
2. Dispatcher demo.
3. 7-minute path.
4. Pilot packet.
5. Architecture.
6. Docs.
7. Gates/logs.

But:

1. Hide `/dev` from public top navigation.
2. Move it under profile menu or admin/developer settings.
3. Show it only for admin/developer roles.
4. Remove branch hashes, `.tmp/dev-logs`, internal file names, judge artifacts,
   and visa/runtime jargon from public scans.

Public landing should sell the dispatcher, not the engineering lab.

## Setup Page Direction

Setup is onboarding for the service business.

Recommended steps:

1. Connect phone or forwarding.
2. Configure service lanes.
3. Configure price ranges and districts.
4. Configure master schedule.
5. Configure approval policies.
6. Configure CRM/table export.

Current storage decision:

1. Demo/prototype: localStorage and JSON export/import.
2. Production: database plus auth, roles, and audit logs.

Do not depend on Lovable Cloud as a long-term product backend. If Lovable is
used, treat it as a UI prototyping environment only.

Future backend options:

1. Postgres on Railway, Supabase, Neon, or GCP Cloud SQL.
2. Supabase Auth, Clerk, Auth.js, or Firebase Auth.
3. API layer in `apps/api-backend`.

Roles:

1. `admin`
2. `operator`
3. `viewer`

Scenario setup should start with four fixed scenarios, not full CRUD:

1. AC repair.
2. Plumbing emergency.
3. Cleaning quote.
4. Measurement visit.

Allow editing text, fields, handoff, and labels. Add create/delete only after
real users ask for it.

Current setup wizard contract:

1. `?setup=7min` and `view=setup` must both show `Next setup action`.
2. The setup step model carries `requiredInputs`, `validationRule`,
   `operatorAction`, `owner`, and `minute`.
3. `Setup validation checklist` must show the current step, required inputs,
   validation rule, and side-effect boundary before a ready/test gate is
   recorded.
4. `Complete current step` records only setup state through the workspace
   adapter and browser fallback.
5. Setup remains manual-only: no phone activation, Telegram send, CRM write,
   dispatch, booking, billing, or analytics sync.

## Scenario Modal Direction

For lane scenario cards, use a hybrid modal:

1. Left: chat-style customer/bot dialogue.
2. Right: structured job card that fills as the scenario progresses.
3. Bottom: final operator handoff and approval state.

This is better than pure chat because the buyer sees the actual product output:
a job card, not just messages.

AI can draft initial scenario text for all four lanes. The founder can edit
later.

Scenario storage for now:

1. Static JSON or TypeScript seed data.
2. Browser-local edits in localStorage.
3. Export/import JSON.
4. Later: database-backed scenario table with auth and audit.

Implemented repo slice:

1. `apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts` owns the
   four fixed lanes and zod validation.
2. `LiveDesk.tsx` exposes `Scenario modal` /
   `local_services_scenario_modal` from each service card.
3. The modal shows `Chat dialogue`, `Structured job card`, and `Final handoff
   and approval state`.
4. `Export scenarios JSON`, `Import scenario JSON`, and `Reset overrides`
   write only browser-local `scenarioOverrides`.
5. The modal is intentionally not full CRUD: no create/delete, no outbound
   send, no booking, no dispatch, no CRM write, no doc mutation.

## Outreach Execution Plan

The outreach feature is manual-first. It should help the founder contact real
companies, not send messages automatically.

Near-term UI slice:

`Offer preview -> Audience -> Message/test preview -> Operator confirmation`

Rules:

1. No autosend.
2. No external CRM write.
3. No fake status that implies a real message was sent.
4. Copy/test/preview only.
5. Operator manually records status.

Useful states:

1. `Draft ready`
2. `Contacted manually`
3. `Reply received`
4. `Discovery call booked`
5. `Rejected for now`
6. `Pilot candidate`

`Preview / Test message` modal:

1. Human-readable message.
2. JSON payload.
3. Copy message.
4. Copy test preview.
5. `Channel variants`.
6. `Telegram variant`, `WhatsApp variant`, and `Phone script variant`.
7. Copy actions: `Copy Telegram variant`, `Copy WhatsApp variant`,
   `Copy phone script`.
8. Selected channel proof: `Selected outreach channel`, `Select Telegram`,
   `Select WhatsApp`, `Select phone script`, `Channel selected`,
   `selectedChannelByProspectKey`.
9. Export proof: `Manual activity log`, pilot workspace export, and
   `Pilot evidence pack` must show the selected channel before any operator
   copy action.
10. Guardrail marker: `manual_channel_variant_preview_only`; no Telegram send,
   WhatsApp send, phone call, CRM write, scorecard mutation, or calendar event.

Add `Ask AI about pilot` later:

1. `Кто лучший кандидат?`
2. `Где bottleneck?`
3. `Кому писать следующим?`
4. `Какой сегмент слабый?`

This should be an analyst layer over scorecard data, not a generic chat window.

## 14-Day Pilot Plan

Goal: get real signal from Tashkent local service companies before expanding.

Sequence:

1. Finish the 7-minute demo path.
2. Record a 90-second demo video.
3. Prepare outreach pack and scorecard.
4. Contact 10-30 companies manually.
5. Book 1-3 discovery calls.
6. Run one 14-day pilot with AC/HVAC or plumbing first if possible.
7. Track response time, requests captured, approvals, manual edits, and saved
   bookings.
8. Only after pilot signal, add real integrations.

First outreach candidates should be construction-adjacent service companies,
AC/HVAC, plumbing, cleaning, and measurement/fit-out businesses in Tashkent.

## External References And What To Take

Use external projects as inspiration, not dependencies, unless explicitly
approved.

### Newo.ai

Take:

1. Clear AI employee / AI receptionist positioning.
2. Vertical pages and simple use-case demos.
3. Setup/training flow: business profile, knowledge, behavior, test, ready.
4. Dashboard proof: calls, transcripts, bookings, revenue, missed-call recovery.

Do not copy:

1. Generic “AI employee for every business” claim.
2. Broad industry spread before one working pilot.

### Anthropic Connectors

Take:

1. Action cards, not just chat responses.
2. Confirmation before booking/purchase/send.
3. Connector mindset for future integrations.

Do not compete directly:

1. Consumer super-app.
2. One chat for hotels, food, music, taxi, flights, and shopping.

Our chance is supply-side operations: job cards, dispatch workflow, approval,
evidence, and owner review for local businesses.

### walkinglabs/awesome-harness-engineering

Take:

1. Harness mindset.
2. Replay/evidence discipline.
3. Deterministic test fixtures.

Do not turn it into product UI.

### anthropics/skills/mcp-builder

Take later:

1. MCP connector/server pattern.
2. Make the dispatcher callable from Claude, ChatGPT, CRM, or internal tools.

Not P0.

### Shubhamsaboo fact-checker skill

Take:

1. Evidence-backed AI recommendations.
2. `AI recommends + reasons` pattern.

### softaworks humanizer

Take:

1. Natural, non-robotic RU/UZ customer messages.
2. Tone polishing for confirmation and handoff drafts.

### coreyhaines page-cro and seo-audit

Take:

1. Landing clarity.
2. Offer-first copy.
3. CTA discipline.
4. “Show value in 7 minutes” framing.

### mattpocock grill-me

Take:

1. Hard self-review prompts.
2. Challenge assumptions before building.

### karpathy/autoresearch and A-EVO-Lab/a-evolve

Take:

1. Research loop.
2. Hypothesis -> evidence -> scorecard -> next action.

Not runtime dependencies.

### Rowboat-style memory ideas

Take:

1. Inspectable case wiki.
2. Case vault.
3. Operator-visible memory with evidence.

### OpenAI CUA sample app

Take:

1. Safe action previews.
2. Human approval before external actions.
3. Clear action boundary.

### Google Workspace CLI

Take later:

1. Google Sheets export.
2. Docs/Sheets as lightweight CRM bridge.

### OpenSandbox and CubeSandbox

Take later:

1. Secure execution backend for untrusted browser/tool actions.

Not P0.

### Memento-Skills, sleekdotdesign/agent-skills, superpowers

Take:

1. Skill/playbook packaging.
2. Reusable workflow templates.

### Claude-code, opencode, instructkr/claude-code, everything-claude-code

Take:

1. Developer workflow ideas only.
2. No product dependency.

### Unsloth, MiniMax, Lyra, Google AI Edge, Netflix void-model

Take later:

1. Cost/local/offline model experiments.

Not live customer path now.

### Game/3D repos

Do not use for current product unless a very specific demo needs it. They are
not on the dispatcher critical path.

## What Not To Build Now

Do not build:

1. Marketplace.
2. Billing.
3. Payments.
4. Login-heavy SaaS shell.
5. Full CRM.
6. Full scenario CRUD.
7. Big admin pages.
8. Autonomous send/dispatch.
9. Restaurant/hotel/dentist flows as first market.
10. Construction material stock/delivery automation.
11. Generic chat assistant.
12. Visible runtime/judge/dev panels in the operator first scan.

These are distractions before the first real pilot.

## Immediate Build Order

Work in this order unless the founder explicitly changes priorities.

### Step 1: Reconcile Source Of Truth

Update or clearly annotate:

1. `AGENTS.md`
2. `README.md`
3. `docs/product-master-plan.md`
4. `docs/local-services-action-desk-spec.md`
5. `docs/local-services-developer-map.md`

Goal: another agent must not think the only commercial wedge is immigration.

### Step 2: Clean Main Dispatcher UI

Implement:

1. Full-height right detail rail.
2. Compact center queue rows.
3. Click selects preview; explicit open navigates.
4. No scroll-spy changing selected card.
5. Stronger P0/needs-action color.
6. Separate AI recommendation from customer request.
7. Sticky footer that does not cover content.
8. RU-first labels.
9. Hide developer-only internals.

Current implementation slice:

1. `view=dispatcher` now starts with a `Main dispatcher workbench`: a
   `Main dispatcher compact queue` beside a
   `Main dispatcher full-height decision rail`.
2. The main queue uses the approved row contract:
   `grid-template-columns: 48px minmax(0, 1fr) 192-204px`, click selects the
   dispatcher preview, and `Explicit full task open` stays on the row action
   button/drawer path. It also carries the `No row action overlap` and
   `Two-line compact row` markers for regression checks.
3. The main right rail keeps AI recommendation, customer request, slot/price,
   details, and a dominant sticky operator footer separated. Its operator text
   is `Контроль · оператор · автоотправка выкл.` instead of developer-facing
   mixed English status.
4. `view=requests` now starts with a `Dispatcher compact request queue`
   contract in `LiveDesk.tsx`: row click selects the preview only, and the
   explicit open action stays in the right rail.
5. The right rail is labelled `Selected request decision rail`; it separates
   `AI recommendation packet` from the `Customer request card`.
6. The footer is a `Sticky operator action footer` and repeats the guardrail:
   no autonomous dispatch, no send, and no booking.
7. The request rail now mirrors the main dispatcher viewport contract:
   `Selected request decision rail` is a bounded flex column with its own
   scroll body, and the footer stays outside that scroll body so action buttons
   do not cover preview content.
8. Remaining Step 2 work: keep polishing full-height behavior across
   breakpoints and move developer-only payload/evidence detail behind collapsed
   support surfaces.

### Step 3: Fix `/dev`

Keep `/dev` as internal lab, but:

1. Hide it from public nav.
2. Gate it behind admin/dev role.
3. Move entry to profile menu.
4. Remove public branch/hash/dev-log clutter.

### Step 4: Scenario Modal

Build hybrid scenario modal:

1. Chat dialogue left.
2. Live job card right.
3. Final handoff and approval state.
4. Four fixed lanes.
5. localStorage edits and JSON export/import.

Status: implemented as `local_services_scenario_modal` in `LiveDesk.tsx`.
Keep future work to polish and backend-adapter migration; do not expand into
full scenario CRUD before pilot signal.

### Step 5: Outreach Wizard

Build:

`Offer preview -> Audience -> Message/test preview -> Operator confirmation`

Keep it manual-only.

### Step 6: Pilot Export

Add one export drawer:

1. Human-readable pilot summary.
2. JSON export.
3. Copy actions.
4. No CRM write.

### Step 7: Ask AI About Pilot

Add compact analyst questions over scorecard data.

### Step 8: Real Integrations After Signal

Only after pilot:

1. Telegram.
2. Telephony.
3. Google Sheets export.
4. CRM export.
5. Calendar/schedule sync.
6. MCP connector/server.

## Validation

For code changes, run at minimum:

```bash
npm run test:unit
npm run build
```

For release-impacting changes:

```bash
npm run verify:release
```

For local route sanity:

1. `http://localhost:3000/healthz`
2. `http://localhost:8080/healthz`
3. `http://localhost:8081/healthz`
4. `http://localhost:3000/app?demo=local-services-dispatch&service=ac-repair-dispatch`

When frontend layout changes, verify visually in browser:

1. Wide desktop.
2. Medium desktop.
3. Mobile/drawer behavior if touched.
4. Dark and light theme if touched.
5. No overlapping text/buttons.
6. No footer covering content.
7. No accidental navigation when selecting a row.

## Working Style For The Next Agent

Be strict about scope.

Good change:

1. Makes the 7-minute demo clearer.
2. Helps a Tashkent service owner understand the product.
3. Reduces operator manual work.
4. Preserves approval and evidence.
5. Moves toward a real pilot.

Bad change:

1. Adds a broad platform feature with no pilot payoff.
2. Makes the dashboard more impressive but less usable.
3. Adds autonomous send or dispatch.
4. Adds marketplace/billing/login before the first pilot.
5. Mixes visa, judge, runtime, and local-services surfaces in the first scan.

When in doubt, ship the smallest reversible slice and document it.
