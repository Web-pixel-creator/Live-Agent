# Current Local Services Agent Handoff

Last assembled: 2026-05-23.

This is the short operational handoff for the next agent. Use it before making
any changes to the dispatcher dashboard, local-services backend adapter, setup
flow, outreach flow, scenario modal, or pilot/export surfaces.

## Current State

Branch:

`codex/runtime-case-wiki-signed-proof`

Latest pushed commit:

`4ea59d35 fix: stabilize dispatcher workbench layout`

Tracked git tree was clean after that commit and push.

Current local health at the moment of this note:

1. `http://localhost:3000/healthz` timed out.
2. `http://localhost:8080/healthz` timed out.
3. `http://localhost:8081/healthz` timed out.
4. `http://localhost:8082/healthz` timed out.

So the next agent should start the local stack before visual/browser testing.
The last completed validation before the commit was green:

1. targeted app-shell alignment test: pass.
2. `npm run test:unit`: pass, `1150/1150`.
3. `npm run build`: pass.
4. `npm run verify:release`: pass.
5. browser sanity: no horizontal overflow at `1280px`; dispatcher rail stacks
   below `1600px`; row action buttons stayed inside the row.

## Product Direction

Current product wedge:

`AI Dispatcher for local service businesses in Tashkent`

Do not treat this as a generic AI platform, a Claude/OpenAI competitor, a
consumer super-app, or a multi-vertical marketplace.

The product should solve one concrete workflow:

1. customer calls or writes through phone, Telegram, WhatsApp, or site chat;
2. AI collects service, district, address/access, urgency, photo/details, slot,
   and price inputs;
3. AI prepares an operator-ready job card;
4. operator approves, edits, or rejects;
5. customer confirmation and master/operator handoff are prepared;
6. evidence, transcript, and decision trail are retained.

Hard rule:

No customer send, master dispatch, booking, CRM write, analytics sync, billing,
or channel activation without explicit human approval.

## P0 Market Scope

P0 lanes:

1. AC / HVAC / conditioner repair and diagnostics.
2. Plumbing / emergency сантехника.
3. Cleaning quote and booking, especially after renovation.
4. Measurement visits for windows, doors, ceilings, blinds, kitchens, furniture,
   and fit-out.

Adjacent but not P0:

1. electrical and small repair;
2. construction-material quote/delivery desk;
3. restaurants;
4. hotels;
5. dentistry/private clinics.

Construction materials are relevant later, but not first. They require stock,
quantity, substitutions, delivery, unloading, payment, invoices, and changing
prices. The current product is field-service dispatch, not commerce automation.

## Source Of Truth

Read in this order:

1. `AGENTS.md`
2. `README.md`
3. `docs/product-master-plan.md`
4. `docs/local-services-agent-handoff.md`
5. `docs/local-services-action-desk-spec.md`
6. `docs/local-services-developer-map.md`
7. this file

The large durable handoff is:

`docs/local-services-agent-handoff.md`

This short file is only the current operational summary.

## What Was Ported From The Design Workbench

The design workbench / Lovable prototype is a reference, not a replacement app.

Reference sources:

1. archive: `C:/Users/user/Downloads/design-workbench-main.zip`
2. intended upstream repo: `git@github.com:Web-pixel-creator/design-workbench.git`
3. reviewed local copy:
   `.tmp/design-workbench-review-20260514/design-workbench-main`

Important workbench files reviewed:

1. `src/pages/Dashboard.tsx`
2. `src/components/dashboard/InboxView.tsx`
3. `src/components/dashboard/RequestsView.tsx`
4. `src/components/dashboard/ScheduleView.tsx`
5. `src/components/dashboard/ClientsView.tsx`
6. `src/components/dashboard/SetupView.tsx`
7. `src/components/dashboard/ReviewView.tsx`
8. `src/components/dashboard/LaunchPacketView.tsx`
9. `src/components/dashboard/data.ts`
10. `src/lib/scenarios/schema.ts`
11. `src/lib/scenarios/store.ts`
12. `src/integrations/supabase/client.ts`

What was adopted into this repo:

1. dispatcher inbox layout: compact queue plus right decision rail;
2. Requests, Schedule, Customers, Setup, Reviews, Launch packet product views;
3. scenario modal idea: chat dialogue plus structured job card plus final
   handoff/approval state;
4. manual launch packet and outreach execution pack patterns;
5. compact filters, tabs, drawers, and support details;
6. RU-first operator wording for the dispatcher workspace;
7. role of `/dev` as internal lab only.

What was not copied:

1. Lovable Cloud as backend;
2. Supabase auth/admin experiments as product dependency;
3. public `/dev` navigation;
4. full scenario CRUD;
5. marketplace, billing, payments, login-heavy SaaS shell;
6. autonomous sends or dispatches.

## Backend Reality

Current backend boundary:

`apps/api-backend/src/local-services-workspace.ts`

It is mounted from:

`apps/api-backend/src/index.ts`

Current frontend adapter:

`apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`

Current storage key:

`liveDesk:localServicesPilotWorkspace:v1`

Adapter modes:

1. static fallback;
2. browser-local fallback;
3. API mode;
4. hybrid API plus local fallback.

Current API routes referenced by the adapter:

1. `/v1/local-services/workspace`
2. `/v1/local-services/cases`
3. `/v1/local-services/cases/:ref/decision`
4. `/v1/local-services/setup/events`
5. `/v1/local-services/pilot/export`

This is pilot persistence only. It stores setup events, operator decisions,
scenario overrides, and pilot export state. It is not final durable production
storage. Later, after real pilot signal, move this boundary to durable storage
owned by this product, not Lovable Cloud.

## Main Files Already Changed Or Added

Core frontend:

1. `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`
2. `apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`
3. `apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts`
4. `apps/demo-frontend/public/app-shell/index.js`
5. `apps/demo-frontend/public/app-shell/style.css`

Backend:

1. `apps/api-backend/src/local-services-workspace.ts`
2. `apps/api-backend/src/index.ts`

Tests:

1. `tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`

Docs and product specs:

1. `AGENTS.md`
2. `README.md`
3. `docs/product-master-plan.md`
4. `docs/local-services-action-desk-spec.md`
5. `docs/local-services-agent-handoff.md`
6. `docs/local-services-developer-map.md`
7. `docs/operator-guide.md`
8. `docs/local-development.md`
9. `docs/getting-started-7-min.md`
10. `docs/quality-simplification-plan.md`
11. `docs/local-services-pilot-offer.md`
12. `docs/local-services-demo-script.md`
13. `docs/local-services-demo-recording-checklist.md`
14. `docs/local-services-outreach-list.md`
15. `docs/local-services-pilot-scorecard.md`
16. `docs/local-services-pilot-runbook.md`
17. `docs/local-services-outreach-execution-pack.md`
18. `docs/local-services-founder-execution-log.md`

Release artifacts commonly updated by validation:

1. `public/demo-e2e/badge.json`
2. `public/demo-e2e/badge-details.json`

Do not manually edit generated app-shell bundles unless rebuilding the shell
from source or matching the current project pattern.

## Current Product Surfaces

Primary route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch`

Service lane query values:

1. `ac-repair-dispatch`
2. `plumbing-emergency`
3. `cleaning-quote-booking`
4. `measurement-visit-booking`

Product view query values:

1. `view=dispatcher`
2. `view=requests`
3. `view=schedule`
4. `view=customers`
5. `view=reviews`
6. `setup=7min&view=setup`
7. `path=7min&view=requests`
8. `path=7min&view=requests&packet=launch`
9. `recording=90s`

Frontend markers to preserve:

1. `Main dispatcher compact queue`
2. `Main dispatcher full-height decision rail`
3. `Decision rail compact stack`
4. `Dispatcher compact request queue`
5. `Selected request decision rail`
6. `Schedule rail compact stack`
7. `Customer rail compact stack`
8. `Review rail compact stack`
9. `Scenario modal`
10. `Launch packet bridge`
11. `Launch packet readiness card`
12. `Pilot workspace export drawer`
13. `Open outreach execution pack`

The unit alignment test searches for many of these exact strings. If a label is
renamed, update the docs and tests in the same change.

## Latest Completed Slice

The latest completed slice stabilized the dispatcher workbench layout.

Implemented:

1. main dispatcher two-column queue/rail layout now starts only at
   `min-width: 1600px`;
2. below `1600px`, the rail stacks instead of clipping off-canvas;
3. right rail reserves `520-540px`;
4. row action lane reserves `188-204px`;
5. queue and rail are viewport-locked on wide screens with independent scroll;
6. row action buttons no longer collide with inline metadata;
7. docs/tests/build artifacts were synchronized.

Commit:

`4ea59d35 fix: stabilize dispatcher workbench layout`

## Current Open Work

The next code slice should not be another broad redesign. The layout is now
stable enough. Continue by making the product flow clearer and more useful.

Recommended next slice:

Connect the stable dispatcher workbench to the `7-minute launch path` and
`outreach execution pack` in a way that a new operator can understand without
reading docs.

Concrete next step:

1. Start local services.
2. Open
   `/app?demo=local-services-dispatch&service=ac-repair-dispatch`.
3. Verify the dispatcher queue and right rail are still readable in dark and
   light themes.
4. Add or refine the most direct CTA path from the dispatcher/workbench into:
   `7-minute launch path` -> `launch packet` -> `outreach execution pack`.
5. Keep every action manual-only and operator-approved.
6. Update source-level tests and docs in the same slice.

Possible implementation target:

1. make `Open outreach execution pack` and `Open launch packet` easier to find
   from the main dispatcher/pilot surface;
2. ensure `path=7min&view=requests&packet=launch` opens the exact state an
   operator expects;
3. make the handoff copy explain what was selected, what was reviewed, and what
   still blocks real outreach;
4. avoid adding autonomous send, CRM write, calendar event, or billing.

## Still To Do Later

Do not do these before the next product-flow slice unless the founder
explicitly redirects:

1. durable DB migration for local-services workspace state;
2. real Telegram integration;
3. telephony/SIP integration;
4. Google Sheets or CRM export;
5. calendar/schedule sync;
6. MCP connector/server;
7. admin/dev role gating for `/dev`;
8. richer analytics page;
9. marketplace/integration tiles;
10. login/billing/security-heavy SaaS shell.

## External References And What To Take

Use external references only as product patterns, not dependencies.

Useful now:

1. `design-workbench` - dashboard IA, compact queue/rail, setup/review/launch
   packet screens, scenario modal structure.
2. `NEWO.ai` - category-based AI employee positioning and enterprise feel, but
   not consumer super-app behavior.
3. Anthropic connectors announcement - action cards, confirmation gates, and
   future connector direction. Do not compete as a consumer super-app.
4. `Rowboat`-style ideas - inspectable Case Wiki / Case Vault memory.
5. `Euphony` - structured replay/session inspection for evidence.
6. `CubeSandbox` / `OpenSandbox` - future secure execution backend spike.
7. `karpathy/autoresearch` and harness-engineering references - research,
   evidence, eval, and runbook discipline.
8. skill repos such as MCP builder, fact-checker, humanizer, SEO/CRO skills -
   future bounded skill packaging ideas, not current runtime dependencies.

Not useful on the current critical path:

1. OpenMythos;
2. broad model portfolio work;
3. MiniMax or local-model experiments on the live customer path;
4. generic marketplace;
5. restaurants/hotels/dentistry as first market;
6. construction-material commerce automation before field dispatch works.

## Design Rules For The Next Agent

Use the current Lovable/design-workbench look as visual direction, but implement
inside this repo's app shell and contracts.

Keep:

1. compact operator dashboard;
2. left nav plus dispatcher workspace;
3. center queue;
4. right decision rail;
5. explicit preview vs open behavior;
6. collapsed support details for developer-only payload/evidence;
7. dominant primary approval action;
8. quiet secondary edit/reject actions;
9. RU-first operator labels where the current screen is for Tashkent dispatch.

Avoid:

1. scroll-spy changing selected card;
2. footer covering content;
3. row actions overlapping inline chips;
4. public `/dev`;
5. huge generic SaaS pages;
6. raw runtime/judge/dev details in the first operator scan;
7. hidden side effects.

## Validation Required

For any code change:

```bash
npm run test:unit
npm run build
```

For release-impacting changes:

```bash
npm run verify:release
```

For layout changes, also verify in browser:

1. `1280px` or similar medium desktop: no horizontal overflow; rail stacks if
   below the wide breakpoint.
2. `1600px+`: queue and rail sit side by side; right rail stays inside viewport.
3. row action buttons stay inside the row.
4. sticky/footer actions do not cover content.
5. no console errors.
6. dark and light themes if touched.

Health endpoints to check after starting the stack:

1. `http://localhost:3000/healthz`
2. `http://localhost:8080/healthz`
3. `http://localhost:8081/healthz`
4. `http://localhost:8082/healthz`

## What To Tell The Next Agent In One Paragraph

We are building `AI Dispatcher for local service businesses in Tashkent`, not a
generic AI platform. The current product is a manual, operator-approved
dispatcher workflow for AC/HVAC, plumbing, cleaning, and measurement visits:
intake -> job card -> price/slot/master handoff -> approval -> evidence/export.
The Lovable/design-workbench UI is a reference only; its useful dashboard
patterns are being ported into `apps/demo-frontend`, while the backend boundary
is this repo's `local-services-workspace` API plus browser fallback, not
Lovable Cloud. The latest slice stabilized the main dispatcher layout. The next
step is to connect that stable dashboard more clearly to the 7-minute launch
path and outreach execution pack, without adding autonomous send, CRM write,
booking, billing, or marketplace features.
