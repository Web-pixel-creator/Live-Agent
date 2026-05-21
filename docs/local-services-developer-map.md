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

Launch packet route:

`/app?demo=local-services-dispatch&service=ac-repair-dispatch&path=7min&view=requests&packet=launch`

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
10. `/workspace-docs/local-services-agent-handoff.md`

Use `docs/local-services-agent-handoff.md` when onboarding a new agent or
developer. It captures the product direction, the design-workbench review, the
backend adapter plan, and the current do-not-build boundaries in one file.

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
`path=7min&view=requests&packet=launch` additionally opens the `Pilot launch
packet` drawer through `launchPacketDeepLink`, so issues, docs, and QA links can
land on the exact handoff surface. `Copy 7-minute launch path` copies a manual
summary only; it must not create external side effects. `Record current step
reviewed`, `Reset launch path progress`, and the `Recorded N/5` badge persist
only `launchPathStepCompletionByService` for the selected service. `Launch packet
bridge` reads the same state plus request outcome, dispatch approval, customer
confirmation, setup/dry-run, and founder-review labels, then copies a manual
`local_services_pilot_launch_packet` summary through `Copy launch packet` or
opens the existing packet drawer through `Open launch packet`. The drawer uses
`pilotLaunchPacketWithBridge`, adds `7-minute gate`, and emits the structured
`operator_approved_manual_contact_packet_with_7_minute_bridge` JSON payload.
The visible path view keeps the bridge product-first with a `Launch packet
readiness card`, `Manual launch checklist`, `Manual execution guardrails`, and
collapsed `Launch support details`; use the collapsed details for source-key
debugging instead of making the primary scan JSON-heavy. The actual
`Pilot launch packet` drawer uses the same rule: `Pilot launch packet readiness
rail`, `First manual contact packet`, `Manual contact copy preview`,
`First manual contact checklist`, and `Launch packet guardrails` are primary;
`Launch packet support details` keeps Human/JSON and source-key rows secondary.
Its checklist exposes `Open Preview / Test message`, which opens the existing
copy-only `Preview / Test message modal`; the launch-readiness drawer and
channel preview are connected without adding a second message-preview
implementation.

Implementation records live in three places: runtime behavior in
`apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`, product
and operator contract in `README.md` plus `docs/local-development.md`,
`docs/operator-guide.md`, and `docs/local-services-action-desk-spec.md`, and
source-level guardrails in
`tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`.

`view=dispatcher` is the primary operator workbench. It now renders a
`Main dispatcher compact queue` beside a
`Main dispatcher full-height decision rail`. The queue is click-to-preview
only, has no scroll-spy selection, uses the fixed
`48px minmax(0, 1fr) 192-204px` two-line row grid, and keeps
`No row action overlap` plus `Two-line compact row` as source-level regression
markers. The selected-case rail separates the AI recommendation from the
customer request and ends in the RU-first sticky footer:
`Контроль · оператор · автоотправка выкл.` This is still a manual approval
surface: it must not send, book, dispatch, write CRM, bill, or activate a
channel.
The same rail carries `Decision rail compact stack`: dense L1 `bg-card` shell,
accent-only AI recommendation, separate customer request, collapsed details by
default, and quieter edit/reject footer actions.

`view=requests` has the first secondary actionable panel contract. It renders a
`Dispatcher compact request queue` beside a `Selected request decision rail`.
The queue is click-to-preview only, with no scroll-spy selection; explicit open
actions stay in the rail. The rail separates `AI recommendation packet` from the
`Customer request card` and keeps the `Sticky operator action footer` under the
decision content. `Operator action rail` renders local request status,
first-request outcome, and next approved action for the selected pilot account.
Its buttons may update only `statusByProspectKey` and
`firstRequestOutcomeByProspectKey`; they must not add external side effects.
The rail carries `Request rail compact stack`: dense rail chrome, accent AI
packet, separate customer card, collapsed status/outcome controls, and a
dominant explicit open action.

`view=schedule` has the second actionable panel contract. It renders
`Approval-ready slot planner` and `Schedule compact slot planner`: KPI cards for
confirmed slots, ready-for-approval slots, same-day/ASAP routes, and conflicts,
plus slot rows where click selects the preview only. `Open schedule drawer` and
`Open in Dispatcher` are the explicit full actions. `Schedule approval rail`
renders slot window, dispatch owner, approval gate, next approved action,
`Customer confirmation draft`, `Master handoff draft`, `Booking handoff
preview`, and `Workspace record`. It carries `Schedule rail compact stack`:
bounded rail chrome, accent approval card, separate customer/master drafts, and
collapsed schedule support details for `Workspace record` plus the handoff
preview. Its buttons may update only `dispatchApprovalByService`; the handoff
preview is a manual note, not a live appointment, customer send, technician
dispatch, CRM write, payment, or channel activation.

`view=customers` has the third actionable panel contract. `Customer confirmation
rail` renders contact status, consent posture, dispatch dependency, and next
approved action. The surrounding `Customer compact directory` shows contactable
customers, active 30-day demo cases, honest request-value estimates under
`Сумма заявок`, district coverage, and `LAST = service + ref`. Row click must
select the preview only; `Open customer drawer` is the explicit full action.
Its buttons may update only `customerConfirmationByService`;
`Consent-safe confirmation preview` is a manual note, not SMS, Telegram,
WhatsApp, email, CRM, payment, booking, dispatch, or channel activation. The
rail carries `Customer rail compact stack`: bounded rail chrome, accent consent
action, separate request/preview cards, and collapsed `Customer support details`
for `Workspace record` plus the confirmation payload.

`view=reviews` has the fourth actionable panel contract. `Review queue decision
rail` renders selected account, owner decision, weekly scorecard sync, and
continue gate. It carries `Review rail compact stack`: bounded rail chrome,
accent scorecard packet, sticky review actions, and collapsed `Review support details`
for decision keys and scorecard sync proof. Its buttons may update
only `weekOneOwnerDecisionByProspectKey` and
`weeklyScorecardSyncReviewedByService`; `Copy review queue summary` is a manual
founder note, not CRM, billing, customer messaging, channel activation,
paid-pilot launch, or autonomous Continue/Pause/Stop.

## Main Source Files

UI implementation:

`apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`

Local-services workspace adapter boundary:

`apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`

Local-services backend workspace boundary:

`apps/api-backend/src/local-services-workspace.ts`

Local-services scenario store:

`apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts`

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

## Workspace Persistence

Storage key:

`liveDesk:localServicesPilotWorkspace:v1`

The shared key and future adapter contract live in
`apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`.
The adapter now has static, browser-local, API, and hybrid constructors. The
hybrid path reads/writes `/v1/local-services/workspace` through
`fetchRuntimeApi` and keeps browser-local fallback so the demo still works when
the backend is down.

The first backend implementation lives in
`apps/api-backend/src/local-services-workspace.ts` and is mounted by
`apps/api-backend/src/index.ts`. It is in-memory per tenant for the pilot slice:
workspace snapshot, scenario overrides, setup events, operator decisions, and
pilot export. It is not final database persistence.

The fixed four-lane scenario packet and zod validation live in
`apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts`.
`Scenario modal` / `local_services_scenario_modal` in `LiveDesk.tsx` is the
current UI for inspecting and workspace-backed editing those fixed scenarios:
`Chat dialogue`, `Structured job card`, `Final handoff and approval state`,
`Export scenarios JSON`, `Import scenario JSON`, and `Reset overrides`.
It is not full CRUD and must remain bounded to the four scenario IDs until real
pilot evidence says otherwise.
`LiveDesk.tsx` still owns the current UI state and drawers, but backend or
scenario persistence work must connect through that adapter boundary instead of
adding more direct storage/API calls to the component.

Current `LiveDesk.tsx` actions that must go through the adapter:

1. `saveLocalServiceScenarioJsonDraft` / `resetLocalServiceScenarioOverrides`
   call `saveScenarioOverrides`.
2. `updateDispatchApprovalDecision` and
   `updateCustomerConfirmationDecision` call `updateCaseDecision` and mirror
   the latest operator action into `operatorDecisionByCaseRef`.
3. setup wizard and test-call buttons call `recordSetupStep` and mirror bounded
   `setupEvents` into the same workspace snapshot so full snapshot sync cannot
   wipe endpoint-recorded events.
4. the Schedule and Customer rails render a compact `Workspace record` signal
   with `operatorDecisionByCaseRef`, `API + local fallback`, the latest surface,
   and timestamp. The Setup view renders `Latest setup record` from
   `setupEvents`. Keep these as status signals only; do not add live sends or
   production-storage claims here.

State is intentionally pilot workspace state. It is not CRM, not analytics, not
billing, not public customer storage, and not proof that an external action
happened.

Important state fields:

| Field | Purpose | External effect |
| --- | --- | --- |
| `selectedProspectByService` | Selected outreach account per service lane. | None |
| `currentOpsAccountKey` | Manual override for the current account in Pilot ops today. | None |
| `statusByProspectKey` | Local funnel status such as draft ready, contacted manually, reply received, rejected. | None |
| `firstRequestOutcomeByProspectKey` | Operator-entered first request outcome. | None |
| `messagePreviewReviewedByProspectKey` | Confirms the operator opened/reviewed the message preview. | None |
| `selectedChannelByProspectKey` | Stores the `Selected outreach channel` after `Select Telegram`, `Select WhatsApp`, or `Select phone script` shows `Channel selected`; copied into manual activity, workspace export, and evidence pack surfaces. | None |
| `contactPacketCopiedByProspectKey` | Confirms the manual-only contact packet was copied. | None |
| `scorecardRowCopiedByProspectKey` | Confirms the private scorecard row was reviewed/copied. | None |
| `batchReviewHandoffCopiedByProspectKey` | Confirms the current account batch-review handoff was copied. | None |
| `contactProofByProspectKey` | Browser-local proof markers for channel check, manual send, discovery call, demo, pilot candidate. | None |
| `weeklyScorecardSyncReviewedByService` | Confirms manual private weekly scorecard sync review. | None |
| `setupStepCompletionByService` | Workspace-backed setup checklist progress. | No channel activation |
| `setupReadyByService` | Workspace-backed ready-for-test state. | No channel activation |
| `testCallChecklistByService` | Workspace-backed dry-run checklist. | No channel activation |
| `testCallPassedByService` | Workspace-backed dry-run pass marker. | No channel activation |
| `setupEvents` | Bounded setup/test-call event trail mirrored through `recordSetupStep`. | No channel activation |
| `operatorDecisionByCaseRef` | Latest dispatch/customer operator decision mirrored through `updateCaseDecision`. | No send / dispatch / CRM write |
| `metricStatusByService` | Browser-local pilot metric readiness. | None |
| `activityLog` | Recent browser-local operator events. | None |
| `scenarioOverrides` | Workspace-backed validated overrides for the four fixed scenario lanes. | None |

## Operator Surfaces

Core dispatcher detail surfaces:

1. `Open dispatch drawer`
2. `Open customer drawer`
3. `Open handoff drawer`
4. `Telegram intake prototype`
5. `Open intake evidence`
6. `Scenario modal` / `local_services_scenario_modal`

Pilot setup surfaces:

1. `Agent setup / training state`
2. `Open setup checklist`
3. `Open day-one setup`
4. `Test call/message panel`
5. `Record test passed`
6. `Next setup action`
7. `Setup validation checklist`

The setup wizard step model includes `requiredInputs`, `validationRule`,
`operatorAction`, `owner`, and `minute`. Those fields feed both `?setup=7min`
and the normal `view=setup` page so the operator sees the next step and the
manual validation contract before any ready/test gate is recorded.

Pilot outreach surfaces:

1. `Pilot outreach wizard`
2. `Outreach readiness rail`
3. `Next outreach action`
4. `Mark preview reviewed`
5. `Preview / Test message modal`
6. `Channel variants`
7. `Telegram variant`
8. `WhatsApp variant`
9. `Phone script variant`
10. `Copy Telegram variant`
11. `Copy WhatsApp variant`
12. `Copy phone script`
13. `Operator confirmation summary`
14. `AI analyst` / `Ask AI about pilot`
15. `Pilot scorecard action`
16. `Pilot funnel summary`
17. `Outreach list filters`
18. `Column settings`

The readiness rail reads the selected company, `messagePreviewReviewedByProspectKey`,
and the current pilot status to show the next blocker. It is a manual-only prep
surface: no outbound send, no CRM write, no scorecard mutation, and no calendar
event.
The `Channel variants` section lives inside `Preview / Test message modal` and
adds `manual_channel_variant_preview_only` proof for Telegram/WhatsApp/phone
copy drafts without activating channels.
The same modal owns the `Selected outreach channel` contract:
`Select Telegram`, `Select WhatsApp`, or `Select phone script` writes
`Channel selected` to `selectedChannelByProspectKey`. Confirmation and launch
packet builders read that key so the exported exact message follows the
operator-approved channel. The manual activity log, pilot workspace export, and
pilot evidence pack also include `selected_channel_id`, `selected_channel`, and
`selected_channel_state_key` so later review sees the approved manual channel
without inspecting the modal again.

`Manual outreach boundary` is the visible operator contract for that rail: the
shell may prepare the message, preview, and confirmation summary, but the human
operator performs any real outreach outside the app.

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
| `local_services_workspace_api` | Repo-owned workspace API export boundary with browser-local preview fallback. |
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
