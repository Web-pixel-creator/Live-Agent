# Local Services Developer Map

This is the implementation map for the local-services expansion layer.
Use it when a developer needs to understand what is integrated, which state is
browser-local, which exports exist, and which actions are intentionally blocked
behind a human operator.

Primary product source of truth remains `docs/product-master-plan.md`.
Commercial local-services scope is defined in
`docs/local-services-action-desk-spec.md`.

## Product Boundary

The local-services layer is one product:

`AI Dispatcher for local service businesses`

Current P0 lanes:

1. AC repair dispatch.
2. Plumbing emergency.
3. Cleaning quote and booking.
4. Measurement visit booking for windows, doors, ceilings, blinds, and fit-out.

Restaurants, hotels, dentistry, broad construction material stock, delivery,
payment, substitution logic, marketplace work, and autonomous dispatch are not
current P0 scope.

## Runtime Entry Points

Primary shell route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch`

Focused setup route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch&setup=7min`

Recording route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch&recording=90s`

Local workspace docs served by the demo frontend:

1. `/workspace-docs/local-services-pilot-offer.md`
2. `/workspace-docs/local-services-demo-script.md`
3. `/workspace-docs/local-services-demo-recording-checklist.md`
4. `/workspace-docs/local-services-outreach-list.md`
5. `/workspace-docs/local-services-pilot-scorecard.md`
6. `/workspace-docs/local-services-pilot-runbook.md`
7. `/workspace-docs/local-services-outreach-execution-pack.md`
8. `/workspace-docs/local-services-founder-execution-log.md`
9. `/workspace-docs/local-services-developer-map.md`

## Product-Mode Sidebar

When `/app` runs with `demo=local-services-dispatch`, `AppSidebar.tsx` switches
from the judge/runtime IA into the local-services product mode. The header reads
`AI Dispatcher`, the primary group label reads `Service workspace`, and the
visible primary navigation becomes:

1. `Dispatcher`
2. `Requests`
3. `Schedule / Dispatch`
4. `Customers`
5. `Knowledge & Setup`
6. `Reviews`

The old runtime surfaces are not deleted. `Operator Console`, `Simulation Lab`,
`Device Nodes`, and `Visual Evidence` move under `Advanced / Runtime` for this
mode. `VIP cases`, `Judge artifacts`, `Presentation Bundle`, visa case refs,
and the console subnav labels (`Live activity`, `Connections`, `Action queue`,
`Safety rules`, `Health check`) stay out of the first local-services scan so a
design partner sees the product workflow before internal proof tooling.

Decision note: this is a product simplification layer, not a source-of-truth
change. The runtime/judge pages remain available for development, evidence,
release proof, and operator diagnostics.

The same product-mode check is used by `pages/Workspace.tsx` and `Topbar.tsx`.
For the local-services route, the top bar reads `AI Dispatcher`, hides the
runtime/live badge, degraded-node alert, SLA-burning strip, visa demo button,
case filters, case search, and `New case` action from the first scan. Those
controls remain available in the normal `Live Desk` route.

## Product View Routes

`LiveDesk.tsx` resolves `view=` through `resolveLocalServiceProductView` and
passes the result into `LocalServicesDispatchDemoPanel` as
`activeView: LocalServiceProductView`.

Current product view contract:

1. `view=requests` opens `Requests inbox`.
2. `view=schedule` opens `Schedule / Dispatch board`.
3. `view=customers` opens `Customer directory`.
4. `view=setup` / `setup=7min&view=setup` opens `Knowledge setup state`.
5. `view=reviews` opens `Review queue`.

These views are safe product navigation states. They only change the visible
operator panel over the existing local-services demo data and browser-local
state. They must not send, book, dispatch, bill, write CRM, activate a channel,
or mutate the Markdown docs.

`path=7min&view=requests` enables the `7-minute launch path` guide. The guide is
implemented from `LOCAL_SERVICE_SEVEN_MINUTE_LAUNCH_PATH`, renders the five
operator steps, and calls the same query-backed view opener used by the sidebar.
`Copy 7-minute launch path` copies a manual summary only; it must not create
external side effects. `Record current step reviewed`, `Reset launch path
progress`, and the `Recorded N/5` badge persist only
`launchPathStepCompletionByService` for the selected service. `Launch packet
bridge` reads the same state plus request outcome, dispatch approval, customer
confirmation, setup/dry-run, and founder-review labels, then copies a manual
`local_services_pilot_launch_packet` summary through `Copy launch packet` or
opens the existing packet drawer through `Open launch packet`. The drawer uses
`pilotLaunchPacketWithBridge`, adds `7-minute gate`, and emits the structured
`operator_approved_manual_contact_packet_with_7_minute_bridge` JSON payload.

`view=requests` has the first actionable panel contract. `Operator action rail`
renders local request status, first-request outcome, and next approved action
for the selected pilot account. Its buttons may update only
`statusByProspectKey` and `firstRequestOutcomeByProspectKey`; they must not add
external side effects.

`view=schedule` has the second actionable panel contract. `Schedule approval
rail` renders slot window, dispatch owner, approval gate, and next approved
action. Its buttons may update only `dispatchApprovalByService`; `Booking
handoff preview` is a manual note, not a live appointment, customer send,
technician dispatch, CRM write, payment, or channel activation.

`view=customers` has the third actionable panel contract. `Customer confirmation
rail` renders contact status, consent posture, dispatch dependency, and next
approved action. Its buttons may update only `customerConfirmationByService`;
`Consent-safe confirmation preview` is a manual note, not SMS, Telegram,
WhatsApp, email, CRM, payment, booking, dispatch, or channel activation.

`view=reviews` has the fourth actionable panel contract. `Review queue decision
rail` renders selected account, owner decision, weekly scorecard sync, and
continue gate. Its buttons may update only `weekOneOwnerDecisionByProspectKey`
and `weeklyScorecardSyncReviewedByService`; `Copy review queue summary` is a
manual founder note, not CRM, billing, customer messaging, channel activation,
paid-pilot launch, or autonomous Continue/Pause/Stop.

## Main Source Files

UI implementation:

`apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`

Product-mode top chrome:

`apps/demo-frontend/app-shell/src/pages/Workspace.tsx`

`apps/demo-frontend/app-shell/src/components/workspace/Topbar.tsx`

Product-mode sidebar:

`apps/demo-frontend/app-shell/src/components/workspace/AppSidebar.tsx`

Local doc serving:

`apps/demo-frontend/src/server.ts`

Source-level alignment test:

`tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`

Generated app-shell bundle:

`apps/demo-frontend/public/app-shell/index.js`

Generated app-shell CSS:

`apps/demo-frontend/public/app-shell/style.css`

## Browser-Local State

Storage key:

`liveDesk:localServicesPilotWorkspace:v1`

State is intentionally browser-local. It is not CRM, not analytics, not billing,
not public customer storage, and not proof that an external action happened.

Important state fields:

| Field | Purpose | External effect |
| --- | --- | --- |
| `selectedProspectByService` | Selected outreach account per service lane. | None |
| `currentOpsAccountKey` | Manual override for the current account in Pilot ops today. | None |
| `statusByProspectKey` | Local funnel status such as draft ready, contacted manually, reply received, rejected. | None |
| `firstRequestOutcomeByProspectKey` | Operator-entered first request outcome. | None |
| `messagePreviewReviewedByProspectKey` | Confirms the operator opened/reviewed the message preview. | None |
| `contactPacketCopiedByProspectKey` | Confirms the manual-only contact packet was copied. | None |
| `scorecardRowCopiedByProspectKey` | Confirms the private scorecard row was reviewed/copied. | None |
| `batchReviewHandoffCopiedByProspectKey` | Confirms the current account batch-review handoff was copied. | None |
| `contactProofByProspectKey` | Browser-local proof markers for channel check, manual send, discovery call, demo, pilot candidate. | None |
| `weeklyScorecardSyncReviewedByService` | Confirms manual private weekly scorecard sync review. | None |
| `setupStepCompletionByService` | Browser-local setup checklist progress. | None |
| `setupReadyByService` | Browser-local ready-for-test state. | None |
| `testCallChecklistByService` | Browser-local dry-run checklist. | None |
| `testCallPassedByService` | Browser-local dry-run pass marker. | None |
| `metricStatusByService` | Browser-local pilot metric readiness. | None |
| `activityLog` | Recent browser-local operator events. | None |

## Operator Surfaces

Core dispatcher detail surfaces:

1. `Open dispatch drawer`
2. `Open customer drawer`
3. `Open handoff drawer`
4. `Telegram intake prototype`
5. `Open intake evidence`

Pilot setup surfaces:

1. `Agent setup / training state`
2. `Open setup checklist`
3. `Open day-one setup`
4. `Test call/message panel`
5. `Record test passed`

Pilot outreach surfaces:

1. `Pilot outreach wizard`
2. `Preview / Test message modal`
3. `Operator confirmation summary`
4. `AI analyst` / `Ask AI about pilot`
5. `Pilot scorecard action`
6. `Pilot funnel summary`
7. `Outreach list filters`
8. `Column settings`

Pilot execution surfaces:

1. `Pilot ops today`
2. `Current account picker`
3. `Current account prep checklist`
4. `Current account contact packet`
5. `Current account action path`
6. `Current account outcome capture`
7. `Current account scorecard sync preview`
8. `Current account batch review handoff`
9. `Daily pilot briefing`
10. `Current account mini-audit`
11. `Open account history`
12. `Pilot proof update rail`
13. `Open batch review`

Review and handoff surfaces:

1. `First 10 contacts workspace`
2. `Pilot proof checklist`
3. `Stop / Continue decision gate`
4. `First contact batch review drawer`
5. `First-contact batch review rows`
6. `Copy batch review`
7. `Copy founder workspace`
8. `Open founder execution log`

## Current Account Gate Chain

The current account path is intentionally sequential:

1. Select account or use auto next account.
2. Review prep checklist.
3. Copy contact packet.
4. Human contacts the account outside the shell.
5. Record browser-local proof after the real action.
6. Record first request outcome.
7. Copy scorecard row.
8. Copy batch handoff.
9. Copy or review `Daily pilot briefing` as a manual-only scheduled-task preview.
10. Open first-contact batch review.
11. Decide continue, pause, stop, CRM handoff, or weekly scorecard action.

Gate markers:

1. `messagePreviewReviewedByProspectKey`
2. `contactPacketCopiedByProspectKey`
3. `firstRequestOutcomeByProspectKey`
4. `scorecard_row_copy_required_for_batch_review`
5. `scorecardRowCopiedByProspectKey`
6. `batchReviewHandoffCopiedByProspectKey`

## Export Contracts

All exports are review artifacts. They do not send messages, create bookings,
write CRM, sync analytics, bill, or mutate Markdown docs.

`local_services_daily_pilot_briefing` is also only a review artifact. It is a
scheduled-task preview, not a real cron. It does not send Slack, Telegram,
WhatsApp, phone, CRM, analytics, billing, or Markdown side effects.

Important export surfaces:

| Export surface | Purpose |
| --- | --- |
| `local_services_dispatch_payload` | Operator dispatch payload preview. |
| `local_services_customer_confirmation` | Customer confirmation draft. |
| `local_services_master_handoff` | Master/operator handoff draft. |
| `local_services_intake_evidence` | Transcript and evidence-link export. |
| `local_services_agent_setup_training` | Setup/training state export. |
| `local_services_pilot_message_preview` | Test/manual outreach message preview. |
| `local_services_pilot_ops_today` | Current account handoff for the next manual action. |
| `local_services_pilot_ops_confirmation` | Manual proof confirmation drawer. |
| `local_services_current_account_contact_packet` | Manual-only current account contact packet. |
| `local_services_current_account_scorecard_sync_preview` | Private scorecard row preview. |
| `local_services_current_account_batch_review_handoff` | Current account batch-review handoff. |
| `local_services_daily_pilot_briefing` | Manual-only scheduled-task preview for founder/operator daily review. |
| `local_services_first_contact_batch_review` | First 10 contacts review export. |
| `local_services_account_history_drawer` | Current account browser-local history export. |
| `local_services_manual_weekly_scorecard_sync` | Private weekly scorecard sync packet. |
| `local_services_paid_pilot_proposal` | Paid pilot proposal preview. |

## First-Contact Batch Review Rows

The first-contact batch review drawer includes an operator-ready row table:

`Account -> Lane -> Scorecard row -> Batch handoff -> Proof -> Decision`

The JSON payload carries:

1. `review_decision`
2. `scorecard_row`
3. `batch_handoff`
4. `scorecard_row_copied`
5. `batch_handoff_copied`

Use this table before any continue, pause, stop, CRM handoff, or weekly
scorecard decision.

## Guardrails

The local-services layer must remain:

1. phone-first,
2. operator-approved,
3. browser-local for pilot state,
4. explicit about evidence,
5. explicit about what it does not do.

Do not add:

1. autonomous phone calls,
2. autonomous Telegram or WhatsApp sends,
3. autonomous booking,
4. CRM writes,
5. analytics sync,
6. billing,
7. public customer-data storage,
8. broad marketplace/integration tiles,
9. unscoped category expansion.

## How To Extend Safely

When adding a local-services feature:

1. Add the smallest UI surface in `LiveDesk.tsx`.
2. Keep external actions as manual/operator-approved.
3. Store pilot state only under `liveDesk:localServicesPilotWorkspace:v1`.
4. Add or update a deterministic export surface if the operator needs to copy.
5. Update `docs/local-services-action-desk-spec.md`.
6. Update this developer map when new state keys, exports, routes, or gates are added.
7. Update `tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`.
8. Rebuild `apps/demo-frontend/public/app-shell/index.js` and `style.css` when UI changes.
9. Run `npm run test:unit` and `npm run build`.

For release-impacting changes, also run `npm run verify:release`.
