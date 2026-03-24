# AI Action Desk

Production-oriented AI Action Desk for visa and relocation agencies.

Primary product wedge:

- qualify inbound leads for visa and relocation services
- book consultations or appointments
- collect documents and form data safely
- execute safe UI actions with approvals and replay evidence

Supporting product surfaces:

- `Live Agent` for realtime conversation, translation, negotiation, and grounded research
- `Simulation Lab` for scenario rehearsal, story timelines, and multimodal training flows
- `UI Navigator` for safe browser actions with approvals and replay evidence

![PR Quality Gate](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/pr-quality.yml/badge.svg)
![Demo E2E](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/demo-e2e.yml/badge.svg)
![Release Strict Final Gate](https://github.com/Web-pixel-creator/Live-Agent/actions/workflows/release-strict-final.yml/badge.svg)
![Demo KPI Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Flive-agent-production.up.railway.app%2Fdemo-e2e%2Fbadge.json)

## Judge Snapshot

- Product framing:
  - `AI Action Desk` is the main product surface for visa and relocation agencies.
  - The core flow is lead qualification, consultation booking, document collection, then safe UI action.
  - `Simulation Lab` is the secondary rehearsal/training surface built from the storyteller stack.
  - `UI Navigator` is the action layer that safely executes work in browser-based systems.

- Challenge coverage:
  - `Live Agent`: realtime conversation, interruption, translation, negotiation, grounded research.
  - `Creative Storyteller`: text+audio+image+video timeline pipeline.
  - `UI Navigator`: Computer Use planning/execution with approval/damage-control.
- Primary submission platform:
  - `GCP Cloud Run` for `orchestrator`, `realtime-gateway`, and `api-backend`.
  - `Firestore` enabled for judged runtime state.
  - `BigQuery + Cloud Monitoring` proof emitted to repo-owned artifacts.
- Fastest judge flow:
  1. `docs/judge-quickstart.md`
  2. `npm run demo:epic`
  3. `artifacts/judge-visual-evidence/presentation.md`
  4. `artifacts/demo-e2e/badge-details.json`
- Public runtime status:
  - Cloud Run proof: `artifacts/deploy/gcp-cloud-run-summary.json`
  - Firestore proof: `artifacts/deploy/gcp-firestore-summary.json`
  - Runtime proof: `artifacts/release-evidence/gcp-runtime-proof.json`
  - Submission refresh status: `artifacts/release-evidence/submission-refresh-status.json`
  - Legacy Railway badge remains a fallback public mirror, not the primary judge proof.
- Submission-safe summary criteria:
  - `liveApiEnabled=true`
  - `translationProvider != fallback`
  - `storytellerMediaMode != simulated`
  - `uiExecutorForceSimulation=false`

## Documentation Index

- Architecture: `docs/architecture.md`
- Product Master Plan: `docs/product-master-plan.md`
- Product Backlog: `docs/product-backlog.md`
- Visa Sales Demo Package: `docs/visa-sales-demo-package.md`
- Visa Operator Walkthrough: `docs/visa-operator-walkthrough.md`
- Visa Client One-Pager: `docs/visa-client-one-pager.md`
- Visa Client Deck Outline: `docs/visa-client-deck-outline.md`
- Visa Client Deck Copy: `docs/visa-client-deck-copy.md`
- Visa Founder Pitch 60s: `docs/visa-founder-pitch-60s.md`
- Visa Sales Call Script 5min: `docs/visa-sales-call-script-5min.md`
- Visa Landing Page Copy: `docs/visa-landing-page-copy.md`
- Visa Client Packet: `artifacts/client-packet/README.md`
- Worker Roles: `docs/worker-roles.md`
- Eval Plane: `docs/evals.md`
- Operator Guide: `docs/operator-guide.md`
- Judge Quickstart: `docs/judge-quickstart.md`
- Judge Runbook (alias): `docs/judge-runbook.md`
- Canonical Challenge Runbook: `docs/challenge-demo-runbook.md`
- Local Development: `docs/local-development.md`
- Protocol Contract: `docs/ws-protocol.md`
- Local-First Profile: `docs/local-first-profile.md`
- Autoresearch Integration: `docs/autoresearch.md`
- WebRTC V2 Spike: `docs/webrtc-v2-spike.md`
- Assistive Router: `docs/assistive-router.md`
- Telemetry Split: `docs/telemetry-storage-split.md`
- Managed Skill Signing Example: `docs/managed-skill-signing-example.md`
- Design Theme Colors: `docs/design-theme-colors.md`
- Judge Visual Evidence Pack: `docs/judge-visual-evidence.md`
- Contribution Guide: `CONTRIBUTING.md`
- Agent Guide: `AGENTS.md`
- License: `LICENSE`

## Judge Quick Path

1. Read `docs/judge-quickstart.md` for a one-page evaluation flow.
2. For a local quick signal before the GCP path, run `npm run demo:e2e:fast && npm run demo:e2e:policy`.
   `demo:e2e:fast` now imports the repo-local `.env` before resolving runtime defaults, force-enables the demo analytics split required by the release gates, preserves the repo-local UI/Storyteller planner model selections instead of pinning them to a separate fast-lane model, restarts stale healthy `ui-executor` instances when their analytics or Playwright runtime flags drift from the submission-safe defaults, and when `storytellerVideoMode=default` it switches the automated Storyteller proof to a compact video-first footprint (`includeImages=false`, shorter scene count, longer timeout) so the fast lane stays reproducible. Story cache verification is run through a lightweight fallback lane to validate cache/purge behavior without embedding large inline media artifacts in the judged summary. Live image proof still comes from the dedicated Storyteller smoke artifacts.
3. For submission, deploy the GCP path with `pwsh ./infra/gcp/prepare-judge-runtime.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -FirestoreLocation "nam5" -DatasetId "agent_analytics" -ImageTag "<release-tag>"`. The wrapper now syncs runtime secrets from env / repo-local `.env` into Secret Manager, builds the three Cloud Run images through Cloud Build, and then deploys Cloud Run.
4. Rebuild the judged pack with `pwsh ./infra/gcp/refresh-submission-pack.ps1 -ProjectId "<your-project-id>" -Region "us-central1" -DatasetId "agent_analytics" -ImageTag "<release-tag>"`.
5. If `gcloud` is unavailable in the current shell, the wrapper can now read repo-local `.env`; if `.env` only contains Gemini-style keys it will reuse that key for `LIVE_API_API_KEY` and default `LIVE_API_AUTH_HEADER` to `x-goog-api-key`. You can still pass `-GoogleGenAiApiKey`, `-LiveApiApiKey`, and `-LiveApiAuthHeader` explicitly when needed.
6. Open `artifacts/release-evidence/submission-refresh-status.md` and `artifacts/demo-e2e/badge-details.json` for judge-facing evidence lanes.

## Autoresearch

This repo includes a repo-owned adaptation of `karpathy/autoresearch` for measurable runtime improvement work. Instead of importing the Python GPU training loop into production code, we reuse the useful operating model: one narrow target, fixed validation budget, one objective metric, explicit `keep/discard/crash` decision, and evidence written to artifacts.

The first included profile is `runtime-perf`:

```bash
npm run autoresearch:runtime-perf -- --description baseline
```

Reference docs and operating guide:

- `docs/autoresearch.md`
- `configs/autoresearch/runtime-perf.json`
- `configs/autoresearch/runtime-perf.program.md`

## Workspace Layout

- `apps/realtime-gateway` - realtime ingress/egress service
- `apps/api-backend` - management REST API
- `agents/orchestrator` - ADK orchestration boundary and intent routing
- `agents/live-agent` - live communication domain logic (conversation, translation, negotiation, grounded research)
- `agents/storyteller-agent` - storytelling pipeline (planner + branch + image/video/tts asset timeline)
- `agents/ui-navigator-agent` - UI planning/execution with approval gates and adapter-aware traces
- `shared/capabilities` - internal capability adapter contracts/profile helpers
- `shared/contracts` - shared event/session contracts
- `configs` - runtime configuration notes
- `infra` - infrastructure templates and deployment notes
- `.kiro/specs/multimodal-agents` - requirements/design/tasks/ADR documents

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run orchestrator:
```bash
npm run dev:orchestrator
```

3. Run gateway and API in separate terminals:
```bash
npm run dev:gateway
npm run dev:api
npm run dev:ui-executor
```

4. Run demo frontend:
```bash
npm run dev:frontend
```
Open `http://localhost:3000`.
Frontend `Intent Request -> Send Conversation Item` supports multimodal parts: text + optional image + optional audio attachment.
Frontend `Live Controls -> Apply Live Setup` can send runtime `live.setup` overrides (`model`, `voice`, `activityHandling`, `systemInstruction`).
Frontend `Intent Request` also supports `intent=research` for citation-bearing answers; runtime and artifact outputs preserve `answer`, `citations`, and `sourceUrls`.
Translation and research responses now also expose display-safe `payload.output.text` for the reading rail; research keeps provenance in debug summary events and asks a clarification question before grounding very short ambiguous key-like queries.
Translation result meta now resolves the selected speech-language label correctly as well, so the live rail shows the chosen spoken-language name instead of leaking a raw browser select element.
UI task responses now also expose display-safe `payload.output.text`; simulated runs explicitly say when no real browser actions were performed, while real executor runs explain that they happened in an isolated automation browser, summarize the executed steps and target page, and when available include short observed UI evidence plus one inferred safe next action from the verified page controls. Ungrounded requests now stay in generic verification mode instead of inventing a submit click from button-label wording alone. Rule-based UI checks now also understand common form-gating prompts such as `Submit stays disabled until email is filled` when a real page URL or grounding is provided. Stable local fixture pages for UI-task validation also ship at `/ui-task-billing-demo.html`, `/ui-task-profile-settings-demo.html`, `/ui-task-visa-intake-demo.html`, `/ui-task-visa-follow-up-demo.html`, `/ui-task-visa-reminder-demo.html`, `/ui-task-visa-escalation-demo.html`, and `/ui-task-visa-handoff-demo.html`, and the live first fold plus the active-task queue now include one-click `Start New Visa Case`, `See Intake Summary`, `Request Missing Documents`, `See Follow-up Summary`, `Prepare Consultation Reminder`, `See Reminder Summary`, `Escalate to Specialist`, `See Escalation Summary`, `Prepare CRM Update`, `See CRM Summary`, and `Start Over` controls with a visible draft-vs-result explainer, a deterministic completion snapshot in the live rail, a short operator handoff note, and a one-click `Copy operator summary` action once the approved result path lands. When the demo frontend is hosted, all visa presets now target the current frontend origin instead of hard-coding `127.0.0.1`, so the public Railway flow can open the hosted fixtures directly.
The live reading rail now also hard-wraps long URLs and evidence text, so the right-hand result pane does not expand over the center compose CTA cluster after a seeded visa demo run.
The visa CTA cluster now uses a two-column desktop layout, so `See Intake Summary` and `Start Over` stay clickable after the live rail fills with result text.
The demo frontend now also ships a public static route at `/ai-action-desk.html`, so the visa/relocation wedge can be shared as a lightweight product page without opening the full operator dashboard first.
Visible user-facing turns in the live reading rail are now scoped to the currently selected intent, so prior translation/research turns do not bleed into dialogue or negotiation history.
The primary live submit button now switches into a pending state with waiting copy while an agent reply is in flight, so operators can tell the request was accepted and is still being processed.
Transport failures now keep websocket/gateway technical details in the debug-only system log, while the main live result card shows a calmer retry message for the active user-facing lane.
Workflow Story launches in Live now send storyteller-shaped input (`prompt`, inferred scene count, story language, media defaults) instead of leaking translation/negotiation fields into the storyteller route.
Those Live story launches now recover requested scene counts from both Russian and English briefs before dispatching the storyteller input.
Ready Live story launch cards now also expose a direct `Open Storyteller` CTA instead of leaving the operator with only a passive hint pill.
Opening Storyteller after a Live story launch now hydrates the composer from the latest live story request instead of dropping back to the default 4-scene template.
Stray non-JSON websocket frames now stay debug-only in the system log instead of overwriting an already completed live result with a protocol error card.
Late protocol noise after a completed live result now stays debug-only as well, so post-response websocket glitches do not replace a finished Story/Live answer card.
Live Story launches now keep the successful storyteller response visible instead of dropping back to the idle placeholder when the first ready scene lands in the timeline preview.
If a Story launch payload ever arrives without a usable `message/text`, the frontend now synthesizes a visible summary from the structured story data, and gateway handler failures now log the real processing error instead of being mislabeled as non-JSON frames.
Storyteller fallback runs are now prompt-aware as well, so a structured brief like `AI product launch / startup founder / 4 scenes` no longer collapses into the unrelated static `Transit Accord` pack scenario when Gemini planner keys are missing.
Storyteller fallback runs now pad scene plans up to the requested `segmentCount` instead of stopping at the fallback pack's default 3-scene length.
Frontend `Intent Request` also supports optional `ui_task` grounding overrides (`url`, `deviceNodeId`, `deviceNodeKind`, `deviceNodePlatform`, `deviceNodeCapabilities`, `deviceNodeMinTrustLevel`, `screenshotRef`, `domSnapshot`, `accessibilityTree`, `markHints`).
Frontend is grouped into tabs (`Live Negotiator`, `Storyteller`, `Operator Console`, `Device Nodes`) with `Live Negotiator` opened by default for faster demo entry.
Frontend remembers the last active tab (`mla.demoFrontend.activeTab`) and restores it on reload for faster multi-panel iteration.
Frontend tab state is also deep-linkable via URL hash (`#tab=live-negotiator|storyteller|operator|device-nodes`) and reacts to `hashchange` so reviewers can share direct tab links.
file pickers stay isolated from Storyteller output rendering, so first-load bootstrap cannot fail and leave the page stuck without working tab switches.
Tabs stay sticky while scrolling and active tab switches use a short panel fade/slide transition (with `prefers-reduced-motion` fallback) so navigation context is preserved in long judge sessions.
Tabs also support keyboard-first navigation (`ArrowLeft/ArrowRight/Home/End` with `Enter/Space` activation) for faster judge/operator walkthroughs without pointer input.
Header now includes a persisted `RU/EN` interface selector (`mla.demoFrontend.languageMode`) so the top navigation and judge-facing live controls can be switched between English and Russian without reloading the page.
The frontend now uses a left dashboard rail plus a compact active-workspace shell at the top of the page, so users can switch surfaces from one stable place without facing a second competing action deck. On desktop, that rail now also keeps a small top tag above the full title, so labels stay readable without shortening and hover does not change button size.
`Live Negotiator` is now task-first and translation-first on first load: the primary composer sits above the fold with a visual mode switcher, intent-aware labels, placeholders, and CTA copy; the translation setup now uses a plain `From language -> Translate to` model with real language pickers instead of technical fields or free-text target input, and it appears only for translation; the first fold stays focused on mode, input, and result; and the live first fold now opens with a dedicated `Case Workspace` shell that keeps `Current case`, `Next step`, and `Completed work` visible above grouped `Main / Case actions / Utility` controls. That first fold now also adds a guided flow layer with a five-step case bar (`Case -> Documents -> Consultation -> CRM -> Handoff`) plus one recommended CTA, so the workspace explains where the case sits in the overall process instead of showing only isolated shortcuts. The support dock now sits directly below the main composer so opening `Voice` or `Control` does not push the language picker and message box out of the first scan; and realtime connection/voice controls plus workflow support sit in collapsed panels below the main workspace instead of above it. That dock now explicitly separates `Product support` (`Workflow`, `Voice`) from one `Operator lane` (`Control`), while rare `Operator extras` stay nested inside `Control`, the live lane keeps only approvals plus a compact queue snapshot, and deeper operator surfaces open through `Operator Console`, so the workspace reads as one product surface on top with service/governance layers below it instead of one mixed action wall. That approval/queue shell now opens only inside the `Control` tray, so the static live page no longer prints a second operator block under the composer before hydration. The same tray now owns low-frequency operator extras and diagnostics as well, so the static live page no longer renders those deeper control surfaces below the composer before hydration. Those lower-frequency surfaces now sit behind one collapsed `Advanced operator tools` shell, so the first scan inside `Control` stays focused on approvals, queue state, and the handoff into `Operator Console`. The right rail still switches copy by intent, keeps a latest-result card plus clean conversation history visible for user-facing flows, now reads as one calmer reading rail (`latest result -> visible history -> debug-only system events`) that stays sticky on wide screens, shows `KPI Constraints` only for negotiation, and tucks the full technical timeline under a collapsible details block. That reading rail now also distinguishes empty, waiting, streaming, ready, and error states with quieter copy so the user can tell whether the lane is idle, actively working, or needs debugging without opening the full log. The hero no longer duplicates task choice: it now acts as a compact active-workspace shell with human-readable information rows (`Focus`, `Voice`, `Next`), while the actual live action chooser lives only inside the main composer. Story and `UI task` stay available inside a quieter follow-up drawer instead of competing with the first action choice. The left rail now reads as short uppercase labels over full tab names for easier scanning. On tablet widths, Live now drops the narrow sidebar-plus-rail contest earlier: navigation becomes a horizontal strip, the summary compresses into a tighter glance row, and the main workspace reads as one calmer column before the phone layout begins. Connection, voice, and approval areas now behave like quiet utility trays with flatter status tiles, one calmer action row, and less nested chrome. The live utility layer is now grouped under one collapsible `Voice Mode & Session` shell with two plain-language subsections (`Connection & Export` and `Microphone & Hold-to-talk`) and compact toolbar-style actions so the user sees one service layer instead of two competing tech panels. That connection tray now also keeps `Export current session` inside its own session-export surface, so Markdown/JSON/WAV downloads read as evidence for the active live session instead of a floating mid-row action; the export menu shows a calmer summary, more spacious format rows, and recent exports in the same surface. `Advanced Session Settings` and `Live Setup` also now use wider grouped fields and calmer status rows instead of cramped three-column forms. Secondary service lanes also use plain-language section names (`Operator approvals`, `Queue snapshot`, `Operator diagnostics`) so they read like product surfaces instead of internal workflow jargon. Those contextual tools now surface through a support dock directly below the main composer (`Workflow`, `Voice`, `Control`) and the same shared utility tray instead of staying buried at the bottom of the lane, and that tray now behaves like a status-aware utility dock with live chips, an explicit tray header, and one visible service layer at a time. Operator-only support surfaces that depend on control-plane runtime routes (`Workflow Control`, `Browser Worker Control`) are now loaded on demand when those panels are opened, and if the backing routes are unavailable the UI keeps a calm `temporarily unavailable / stale snapshot` state instead of pushing background error noise into the Live lane at startup. Those backend routes now also return structured degraded snapshots instead of raw `502` errors, so the operator surfaces can stay readable even when `orchestrator` or `ui-executor` are offline in a partial local stack. ArrowLeft/ArrowRight/Home/End now move across the Live dock, Enter on the active dock button hands focus into the first actionable control, and Escape now closes open live trays, export menus, or advanced panels while returning focus to the exact trigger.

`Operator Console` now starts with one explicit `Operator handoff` entry card (`Approvals`, `Runtime`, `Audit`, `Refresh Summary`), so live-to-operator transitions land in a clearer operator-first route before the deeper board surfaces.
That same first fold now includes a state-aware `Refresh -> Inspect -> Recover` onboarding path, so first-time operators see one guided sequence instead of a static brief before they touch the deeper console.
That same operator-first entry layer now adds a dedicated `Choose workspace` strip (`Overview`, `Approvals`, `Runtime`, `Audit`), so deeper operator work starts from one explicit work area instead of from the full board toolbar.
That chooser now feeds a route-aware workspace header inside `Operator Console`, so `Overview`, `Approvals`, `Runtime`, and `Audit` each explain their current focus, next action, and posture mode before the operator reaches deeper board chrome.
Those same workspace chooser cards now also surface their own live state and next-step copy, so operators can see which lane needs hydration, review, or attention before opening a focused workspace.
That same first `Operator brief` block now adds a workspace-aware `Focus / Open / Recover` preview row, so the first content surface below the toolbar becomes specific to `Overview`, `Approvals`, `Runtime`, or `Audit` instead of reading like one generic console banner.
That same right-side rail now also adds a workspace-aware `Focused Evidence` context row that shows `Workspace / View / Next`, so operators can confirm which posture and proof path they are reviewing before opening deeper facts.
That same right-side rail now also makes the first `Focused Evidence` summary sentence reorient to the active workspace, so `Approvals`, `Runtime`, and `Audit` immediately read like focused proof paths instead of one generic evidence sentence.
That same right-side rail now also prioritizes the first visible `Focused Evidence` facts and origins by the active workspace, so `Approvals`, `Runtime`, and `Audit` bring their posture to the top before the deeper proof rail opens.
That same right-side rail now also prioritizes the first visible `Focused Evidence` CTAs by the active workspace, so `Approvals`, `Runtime`, and `Audit` surface the most relevant saved-view or recovery action before one generic utility row.
That same right-side rail now also means the first-open `Focused Evidence` tab now follows the active workspace posture, so `Runtime` opens into `Trace` or `Recovery`, `Approvals` stays in `Latest` unless recovery is needed, and `Audit` lands directly in audit proof.
Those same visible `Focused Evidence` tabs now also follow the active workspace posture, so the tab strip itself reorders toward `Trace`, `Recovery`, or `Audit` when those lanes are the operator's current working context.
That same right-side rail now also compacts `Focused Evidence` panel meta and checkpoint copy by the active workspace posture, so `Approvals`, `Runtime`, and `Audit` open with shorter, lane-specific helper text instead of one generic secondary rail.
That same right-side rail now also compacts `Focused Evidence` provenance copy by the active workspace posture, so `Route / Verify` and the strip label read like `Approval`, `Runtime`, or `Audit` work instead of one generic action rail.
That same right-side rail now also reorders and compacts `Focused Evidence` timeline and checkpoint cues by the active workspace posture, so `Approvals`, `Runtime`, and `Audit` open with a shorter first narrative instead of one generic mini-log.
That same right-side rail now also tunes `Focused Evidence` fact and origin tones by the active workspace posture, so supporting context reads more like `decision`, `runtime`, or `audit` work instead of one generic muted strip.
That same right-side rail now also swaps in workspace-specific dormant packets inside `Focused Evidence`, so empty `Approvals`, `Runtime`, and `Audit` states explain what to hydrate next instead of falling back to one generic placeholder.
That same right-side rail now also swaps in workspace-specific dormant CTAs inside `Focused Evidence`, so empty `Approvals`, `Runtime`, and `Audit` states steer operators toward the right first action instead of one generic button row.
Those same dormant `Focused Evidence` CTAs now also flip their primary emphasis after the first refresh, so empty `Approvals`, `Runtime`, and `Audit` workspaces move from `hydrate/seed first` into `open workspace first` instead of keeping one fixed CTA order.
That same dormant `Focused Evidence` summary sentence now also changes by workspace, so empty `Approvals`, `Runtime`, and `Audit` explain whether the operator needs to seed decisions, hydrate trace anchors, or hydrate governance proof before deeper review opens.
That same dormant `Focused Evidence` hint and panel meta now also change by workspace, so empty `Approvals`, `Runtime`, and `Audit` explain the right proof path before the drawer has any real evidence to show.
That same dormant `Focused Evidence` tab strip now also changes its visible labels by workspace, so empty `Approvals`, `Runtime`, and `Audit` read like task-specific proof paths instead of one generic `Latest / Trace / Recovery / Audit` set.
That same dormant `Focused Evidence` drawer head now also shifts its visible kicker by workspace view, so empty `Approvals`, `Runtime`, and `Audit` read with a task-specific top line before any real evidence is hydrated.
That same dormant `Focused Evidence` drawer title now also follows the active workspace posture, so empty `Approvals`, `Runtime`, and `Audit` swap in the right hydrate title instead of keeping one generic waiting line.
That same dormant `Focused Evidence` context strip now also swaps to workspace-aware `Lane / Source / Next` copy, so empty `Approvals`, `Runtime`, and `Audit` expose the right lane and proof source before any real evidence is hydrated.
That same dormant `Focused Evidence` status pill now also changes by workspace, so empty `Approvals`, `Runtime`, and `Audit` expose the right hydrate or seed posture before any real evidence is refreshed.
Those same dormant `Focused Evidence` CTAs now also carry workspace-specific secondary meta, so empty `Approvals`, `Runtime`, and `Audit` explain why to seed, hydrate, or open that area instead of showing button labels alone.
Those same dormant `Focused Evidence` CTA meta lines now also flip with refresh posture, so empty `Approvals`, `Runtime`, and `Audit` explain `hydrate/seed first` before the first refresh and `reopen/recheck` after the board has already been hydrated.
Those same dormant `Focused Evidence` CTA rows now also shift their visual emphasis by workspace and refresh posture, so the dominant action reads clearer in `Approvals`, `Runtime`, and `Audit` before the operator opens the deeper proof rail.
That same dormant primary CTA now also shifts its accent tone by workspace posture, so `Approvals`, `Runtime`, and `Audit` no longer share one generic primary color when their first empty-state action is the recommended next move.
That same `Workspace / View / Next` context row now also carries a workspace-specific accent tone, so dormant `Approvals`, `Runtime`, and `Audit` remain visually distinct before the operator opens deeper proof.
That same dormant `Focused Evidence` proof rail now also collapses its timeline, checkpoints, and provenance behind one `Proof path` disclosure, so empty `Approvals`, `Runtime`, and `Audit` stay quieter before the first refresh.
When `Approvals`, `Runtime`, or `Audit` is active, the top operator toolbar now compresses automatically and keeps broad `Board` / `Filters` chrome behind one explicit `Advanced board controls` disclosure instead of leaving those controls mixed into the focused workspace path.
That workspace strip now also exposes a visible `Back to Overview` action whenever a focused workspace is active, so operators do not have to infer the return path from the compressed toolbar alone.
That same workspace posture now also rewrites `Refresh` and `Advanced board controls` copy from the active workspace state, so `Overview`, `Approvals`, `Runtime`, and `Audit` each carry their own hydrate/review/recover hints instead of reusing one generic toolbar sentence.
In negotiation mode, `Current Offer` tracks the client offer and `Final Offer` reflects the latest structured agent proposal so KPI guardrails are evaluated against the proposed compliant offer instead of the first `price=` token in the transcript. If a negotiation response arrives without the structured KPI block, the frontend now falls back to labeled `Client offer` / `Counter-offer` text so `Final Offer` does not stay blank or mirror the wrong offer.
The live chooser now reads as four user-facing action cards, while gateway URL, image-frame tools, and identity details sit deeper in `Advanced Settings` instead of competing with the first request.
Voice runtime now stays manual on first paint: `Connect` does not auto-open the websocket anymore, transient `live_forwarded` bridge pulses stay in debug events instead of replacing the main `Session` pill, and `translation` can capture spoken mic input via browser speech recognition and submit it as a real translation request on mic stop or PTT release. For translation specifically, `Start mic` stays available even before `Connect`, because that capture path remains browser-side until the recognized phrase is dispatched; live conversation/PTT still requires an open websocket session. In translation mode, a short speech pause now auto-submits the spoken phrase and stops the mic, while `Stop mic` remains the manual fallback; `Enter` still applies only to manual text submission. The frontend also applies a light readability pass to the recognized phrase before sending it, so the visible transcript keeps a capitalized first word plus basic end punctuation instead of raw lower-case fragments. The translation setup now reads directly as `From language -> Translate to` instead of `Speech language -> Result language`, so the direction is carried by the two pickers themselves instead of a second explanatory banner below them. On desktop that setup follows the same visual direction as common translators: the source picker stays on the left and the target picker stays on the right. The compose field also shows an explicit mic-status row (`Mic ready -> Listening -> Recognized -> Sending -> Sent/Error`) so the operator can tell whether voice capture was heard, staged, and dispatched. On desktop, the two language pickers still share one compact row, stay together in one row, and keep `14px` picker text so the translation controls read as one lighter setup line instead of two tall blocks. The `Voice` card itself is a utility tray for mic/session/export controls, not a standalone business intent.
Inside `Approvals & Tasks`, the live support lane now uses a single-column stack (`Approval & Resume` over `Queue snapshot`) so long labels, hints, and empty-state recovery actions read at full width instead of collapsing into narrow side-by-side cards. The approval half now behaves like a summary-led approval card with one clear reference lane, one visible state card, calmer advanced fields, and one deliberate decision row instead of a cramped bank-style form. The queue half now keeps only a compact active-count signal plus one inline `Open Operator Console` CTA in the live lane, while the full task list stays behind a collapsed `Queue snapshot` disclosure. When the queue is empty, those quick-start actions remain available only after expanding that disclosure, so the default scan path stays product-first instead of landing on a mini queue launcher. When tasks exist, they still render as title-first queue cards with a clear stage, route, progress, and calmer run/session references instead of a raw technical list.
`More tools` now reads as two calmer support cards (`Audio input` and `Service actions`) instead of one technical cluster, and the right rail now presents empty, pending, and error result states as quieter message surfaces instead of bare text inside large cards.
The composerР В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РЎС›s low-frequency controls now live in a rare-use drawer for audio and service actions, while the right railР В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РЎС›s full system timeline is framed as a debug-only block so user-facing result/history stay visually dominant.
Live control toolbars are separated into `primary` and `secondary` action lanes to reduce button/input ambiguity and keep destructive/secondary actions visually distinct.
The lower workflow tray now reads as `Workflow tools`, the control lane now keeps `Operator approvals & queue snapshot` plus `Operator diagnostics`, and the right rail stays focused on the latest result plus visible turns, so product-first language stays separate from governance and troubleshooting copy.
Technical controls are collapsed into `Advanced Settings` blocks (`Advanced Session Settings`, `Live Setup`, `Advanced Approval Settings`, and `Advanced UI Task Settings`) to reduce default screen density.
`Operator Console` uses grouped accordion lanes; before the first manual `Refresh Summary`, only `Live Bridge & Turn Safety` stays expanded by default.
That same pre-refresh preset now also ships directly in the static HTML shell, so desktop first paint already opens only `Live Bridge & Turn Safety` while Audit, Runtime, and Decisions start as quiet `Open lane` rows.
That expanded desktop bridge lane now also cold-starts as a compact empty shell: only `Bridge`, `Gateway`, and `UI safety` stay visible, while turn-cut and turn-delete cards stay out of first paint until refresh or a broader view.
`Operator Console` hides placeholder cards (`no_data` / `summary_error`) until the first manual `Refresh Summary`, so judges/operators see only populated evidence by default.
When placeholder states are visible, the UI renders judge-friendly labels (`awaiting_refresh` / `refresh_failed`) while preserving internal placeholder codes for board filtering.
`Operator Console` includes explicit mode toggles: `Demo View` (default, critical-first) and `Full Ops View` (full board expansion for deep diagnostics).
Operator board mode selection is persisted (`mla.demoFrontend.operatorBoardMode`) so the last `Demo/Full Ops` choice is restored after reload.
`Operator Console` now shows a mode banner (`Demo view` / `Full ops`) with inline guidance folded into the same compact status shell as `Last refresh`, so active triage scope and evidence recency read as one tighter ops header.
On desktop, that same status shell now flattens further into a shorter incident line: the hint drops out, the mode pill uses human labels, and refresh + board posture fit on one calmer row.
On mobile, that same mode banner collapses to the status badge so the first fold stays focused on summary, evidence, and operator actions instead of repeating explanatory copy.
`Operator Console` still shows the inline `Last refresh` indicator (`waiting` / `ok` / `failed`) so operators can immediately confirm evidence recency without opening deeper evidence.
`Operator Console` now includes a `Demo Summary` strip in `Demo View` (Realtime Gateway, Queue, Approvals, Startup, UI Executor, Device Nodes) with large mirrored status pills, per-lane mini-KPI (`F/N/O`), and one-click jump-to-card navigation.
Those overview tiles now use icon-led status headers, shorter operator copy, and action-oriented dormant notes (`Awaiting signal. Refresh after the next live or UI run.`) so empty lanes still read like inspectable control surfaces instead of dead placeholders.
That same `Demo Summary` now behaves more like a short health ledger than a second card wall: each tile keeps the jump target, one compact operator note, and a quieter inline KPI row so the left first fold stays readable.
On desktop, those `Demo Summary` tiles now replace the generic category copy with a live operator note and keep only the compact KPI row beside it, so healthy/watch lanes stop wasting vertical space on repeated explanatory text.
On desktop, when all six `Demo Summary` tiles are still stale/awaiting, that same strip collapses again into a quieter six-tile ledger (`title + status + F/N/O`) until a real fail/watch signal appears, so the first fold does not spend another full row on dormant copy.
That same `Demo Summary` strip now also ships in that quieter desktop ledger posture from first paint, so the static shell does not flash a full card wall before runtime sync or the first manual refresh.
On desktop, when `Demo Summary` mixes one hot lane with several nominal or awaiting lanes, those quieter tiles now collapse on their own into mini ledger cards while the hot tiles stay full-height, so the strip reads like incident-first overview instead of a second equal-weight card wall.
On desktop, those remaining hot `Demo Summary` tiles now also shorten their mirrored status pills (`blocking 1`, `request wait`, `approval wait`) and use a tighter incident-strip shell, so active lanes stay dominant without reopening a second chunky card row.
`Operator Console` first fold now uses a split operator layout: the left column starts with one compact ops header (`Last refresh` + mode guidance), then moves into `Demo Summary` and the compact signal strip, while the right column keeps a persistent `Operator brief` with live status, compact focus chips, and next-step guidance even after refresh.
On desktop, the shared workspace shell above `Operator Console` now collapses into a quieter ops header with a shorter title, one-line guidance, and compact glance pills, so the page starts with orientation instead of another full summary block.
On desktop, the global dashboard hero above it now also flattens into a thinner control bar for `Operator`, with smaller title copy, quieter language/theme controls, and less decorative glow, so the eye reaches the console sooner.
On desktop, that same ops header now retreats one step further into a ribbon: the workspace eyebrow and description drop out, the nested shell loses its card chrome, and the remaining refresh/workflow/signal glances read as one quiet ledger instead of a second panel.
On desktop, that same ops ribbon now keeps the title/status pair and glance ledger on one row, so the global shell reads more like a thin preflight strip than a second stacked header above the console.
`Operator Console` toolbar now groups `Board`, `Filters`, `Views`, and `Sync`, so mode switches and visibility filters read as secondary controls while `Refresh Summary` stays the single primary action.
The low-frequency `Show/Hide Setup Panels` toggle now lives inside the `Advanced Controls` summary instead of the top toolbar, so the first fold stays incident-first.
That toolbar now also carries saved operator views (`Incidents`, `Runtime`, `Approvals`, `Audit`) so common triage postures can be restored in one click instead of rebuilding filters and lane expansion manually; `Incidents` returns the operator to the first-fold brief/action shell, while `Runtime` / `Approvals` / `Audit` jump to the top of the matching lane instead of the middle of a deep card, retune the operator brief/evidence drawer to that posture, and swap in quieter lane-empty guidance for the active lane.
On wider desktop widths, that same toolbar now compresses into a quieter incident header: saved views sit on one row, helper copy drops out of the toolbar itself, and the top strip uses slimmer controls so summary/evidence surfaces arrive sooner.
On desktop, that same toolbar now flattens further into a utility strip: visible group labels retreat, buttons shrink into one calmer row, and saved views read as a compact chip rail instead of a second header.
On desktop, that same utility strip now also uses shorter button labels (`Demo`, `Full Ops`, `Critical`, `Issues`, `Refresh`) while keeping full hover titles, so control chrome reads like a quiet operator rail instead of a sentence row.
On desktop, the global dashboard nav also retreats into a quieter left rail for `Operator`: the sidebar narrows, tab hints disappear, inactive tabs flatten into lighter rows, and only the active tab keeps a thin guide line.
On desktop, the lower support rails now retreat further into near single-line toggles: collapsed `Quick Start`, `Recovery Playbook`, and `Advanced Controls` hide helper sentences, tighten pills and chevrons, and hold only the short route label until opened.
On desktop, the `Lane focus rail` now retreats further into a chip-only reopen row, so parked lanes stay reachable without adding another titled block between the first fold and deep board.
`Operator Console` keeps `Event Log` under a collapsed `Debug Event Stream` block by default, so low-level tracing stays available without overloading the primary board.
`Operator Console` shows a guided pre-refresh banner before the first manual refresh, with a one-click `Refresh Summary` action and shorter overview-first hinting (`Demo` vs `Full Ops`).
That `Operator brief` now keeps only one primary refresh CTA plus calmer handoff buttons (`Open Quick Start`, `Recovery Playbook`), so reseed and recovery stay reachable without competing with the `Active Queue`.
Operator Console keeps a collapsible `Quick Start` rail (`Run Negotiation`, `Run Story`, `Run UI Task`, `Open Device Nodes`, `Refresh Summary`) so empty lanes can be repopulated without hunting controls, but it now retreats again after refresh whenever active or stale lanes already exist.
Operator Console includes collapsible `Recovery Playbook` cards (Realtime/Story/UI Safety/Device Nodes), each with direct run + refresh actions to recover `awaiting_refresh` evidence lanes faster.
On desktop, those two support rails now collapse into quieter utility toggles with small purpose pills (`Idle lanes`, `Hot lane`) and shorter summary copy, so the presentation-first board keeps them reachable without turning them into a second content band.
`Operator Console` keeps triage counters and low-frequency recovery rails visually below the brief so risk reads before setup chrome, and the compact signal strip now behaves like a lighter jump/navigation layer instead of a second equal-weight summary grid.
That `Lane Radar` surface now carries a live hint, fail-first ordering, and a calmer stale posture when summary fetch fails, so one transport error does not repaint every tile as an equal critical alarm.
Inside that radar, healthy and dormant lanes now collapse into a quieter `Stable systems` rail, so large tiles stay reserved for fail/watch/stale lanes while nominal jump-links remain available without competing in the first scan.
On desktop, that same `Lane Radar` now shifts into a quieter density mode whenever no lane is actively failing: header copy drops out, nominal/stale jump cards shrink into shorter rows, and the stable shelf reduces to quieter chips so the strip reads more like navigation than another summary band.
That same `Lane Radar` also ships in that shelf posture from first paint, so the desktop shell starts without the extra helper copy or stable header before runtime sync catches up.
On desktop, that quiet `Lane Radar` state now keeps only the top three jump chips plus a quiet `More` toggle by default, so the left first fold stays readable without losing access to the rest of the watch lanes.
On desktop, when fail/watch lanes stack up, that same `Lane Radar` now also keeps only the top four active jump cards plus `More` and uses the same collapsed quiet shell, so active incidents do not reopen a second mini-board above the deep lanes.
On desktop, that same compact `Lane Radar` state now also shortens visible jump-status pills (`blocking 2`, `request wait`, `proof`) and drops the secondary stable-count/meta line in collapsed fail posture, so the strip reads like a jump rail instead of another compressed board.
`Triage Summary` now behaves like an `Active Queue`: the top of that surface lists the next operator actions, while live counters move into a quieter `Board Visibility` footer so filter scope stays visible without competing with incident signals.
That `Board Visibility` footer now behaves more like a compact chip ledger than a second mini-dashboard, so scope stays legible without adding another stacked row of counters; the queue and recovery helper copy were shortened in the same pass.
On desktop, that same `Board Visibility` footer now drops its heading, hides the redundant `Total` chip, and relabels `Neutral` as `Watch`, so the lower triage meta reads as a short `Visible / Fail / Watch / Ok / Hidden` ledger instead of another summary block.
That `Active Queue` now stamps next actions as `P1/P2/P3`, and each lane header renders chip-based visibility counters instead of one long inline string, so the first scan looks more like a real observability console than a stacked admin list.
On desktop, that same `Active Queue` now keeps only the first two queued actions in the visible stack and rolls any remainder into one quiet overflow line, so the right rail stays presentation-first instead of stretching into a second report column.
That same triage shell now carries a contextual `Action Center`: a single compact `Recovery Rail` sits inside the same surface as the priority queue, while `Quick Start` and `Recovery Playbook` stay lower as calmer secondary rails.
That same shell now includes a compact `Focused Evidence` drawer, so the selected lane exposes its latest facts and next actions before the operator opens the deeper board.
That same shell now also includes a tabbed compact `Focused Evidence` drawer (`Latest event`, `Trace`, `Recovery`, `Audit`), so operators can switch between fresh facts, inspectable trace anchors, recovery paths, and audit posture without scrolling the deep board.
That same `Focused Evidence` drawer now carries a compact three-step evidence timeline, so operators can confirm current state, freshest anchor, and next move without opening the full lane.
That same `Focused Evidence` drawer now also carries a compact checkpoint rail, so each tab exposes a few raw anchors (`State`, `Refresh`, `Path`, `Trace`, `Review`) without reopening the deep board.
That same timeline now behaves like a lane mini-log with tighter timestamp chips, so chronology and freshness read in one scan instead of being inferred from scattered facts.
That same drawer now also surfaces quiet context chips (`Lane`, `View`, `Source`) above the facts grid, so operators can confirm scope and provenance before reading the deeper mini-log.
That same drawer now also surfaces an `Action provenance` strip (`Actor`, `Route`, `Verify`), so the next step reads as a traced control-path instead of an isolated button.
That provenance strip is now tab-aware, so `Latest`, `Trace`, `Recovery`, and `Audit` identify different control owners like `Active queue`, `Trace review`, `Action center`, or `Saved view` instead of collapsing every path into one generic operator label.
That `Route` value is now workflow-intent aware per lane, so generic CTAs like `Run UI Task` or `Run Negotiation` stay paired with the real operator objective (`Approval decisions`, `Bridge recovery`, `Workflow override`, `Node health`) instead of repeating button text.
That same drawer now also reorders `Latest` and `Trace` facts by lane, so approvals show backlog and SLA context first, runtime surfaces show workflow or executor posture first, and bridge lanes keep the freshest incident evidence in the first three facts. The first fact now renders as the lead evidence card while the other two stay quieter supporting context, so one signal wins the first glance instead of three equal tiles competing.
That same drawer now also adds one concise view summary sentence and prunes duplicated lower sections in `Recovery` / `Audit`, so the drawer reads like a compact decision aid instead of a second full dashboard nested inside the first fold.
That same drawer now compresses `Latest`, `Recovery`, and `Audit` further into a shorter `issue sentence + route / verify lockup`: panel meta is hidden, context chips retreat from those views, provenance collapses to `Route` and `Verify`, and only `Trace` keeps the fuller context/origin posture.
That same compact-first pass now hides the `Operator brief` focus row until real watch items exist, shortens the brief copy, and keeps the long lane path visible only in `Trace`, so the right rail reads more like `problem -> next action -> verify` than a stacked report.
That same triage shell now also moves `Focused Evidence` above the `Recovery Rail` and caps that rail to one compact kit, so the first scan hits `queue -> evidence -> recovery` instead of reading multiple stacked support cards.
When only one compact recovery kit is present, the extra `Recovery Rail` heading collapses and the triage shell removes that spacer row entirely.
On desktop, that same single calm `Recovery Rail` kit now drops into a shorter utility strip with hidden meta copy, one quiet tag, and inline actions, so reseed controls stay reachable without reading like a fourth card in the right rail.
That same utility strip now also shortens the visible title/action labels (`Hydrate evidence`, `Refresh`, `Negotiate`) and sheds the extra card chrome, so the lower right rail reads more like a footer handoff than another content block.
`Focused Evidence` now also removes the inner panel label from compact `Latest` / `Recovery` / `Audit` views, and only `Trace` keeps the mini-log layer visible by default.
Those same compact `Latest` / `Recovery` / `Audit` views now cap themselves at two CTA buttons, so route and verify stay visible without turning the drawer into a button stack.
On desktop, those same compact `Focused Evidence` views now hide the header hint, keep only two visible evidence facts, and collapse the `Route / Verify` lockup into a tighter no-label strip, so the right rail reads faster as a decision packet instead of a second report.
On desktop, those same compact `Focused Evidence` views now also trim the drawer head and turn `Route / Verify` into single-line provenance chips with shorter route/refresh copy, so the right rail loses another stacked mini-report layer without weakening the verify loop.
On desktop, `Latest` now also drops into the same compact fact mode outside fail-state and shortens stale placeholder values (`Awaiting`, `No signal yet`, `Refresh failed`), so that tab no longer reopens a second mini-dashboard when the lane is merely quiet or stale.
On desktop, those same compact `Focused Evidence` CTAs now shorten visible labels (`Approvals`, `UI Task`, `Refresh`) and use a smaller utility-row shell, because route and verify already carry the longer intent copy above them.
On desktop, the lower `Board Visibility` footer now retreats another step into a quieter chip ledger with lighter pills and a softer divider, so scope stays visible without rebuilding a second summary strip under the triage shell.
On desktop, the whole right triage rail now tightens into a shorter `brief -> queue -> evidence` lockup: all three `Operator brief` actions sit on one row, the saved-view context retreats to its posture pill, queue/support helper copy drops out, and compact evidence tabs/facts/provenance use denser spacing so the presentation-first first fold lands on the issue instead of the chrome.
On desktop, visible `Active Queue` items now also collapse into shorter action shells: the kicker drops out, meta shrinks to a one-line action cue with the full guidance kept in the tooltip, and the action column tightens into smaller utility buttons so the queue stops reading like another stacked card column.
On desktop, those same compact `Active Queue` items now also shorten visible titles and CTA labels (`Hydrate board`, `Refresh`, `Quick Start`, `Lane`) while keeping the longer operator phrasing in hover labels, so the right rail scans more like triage controls than card prose.
Operator status pills and mirrored summary/radar chips now normalize internal operator codes into short human labels like `queue empty`, `no approvals`, `watch x2`, and `coverage gap`, so raw strings such as `idle_queue=0`, `awaiting_signal`, or `critical signals=2` do not leak into the first scan path.
On mobile, `Operator Console` now adds a compact sticky action dock (`Refresh`, `Incidents`, `Runtime`, `Approvals`, `Audit`) mounted at the viewport layer, so saved views remain reachable after the user scrolls beyond the first fold instead of getting trapped inside the long board layout.
That mobile posture now also hides the duplicated top `Views` cluster and the long board-mode hint, so saved-view switching stays in the sticky dock and the first fold reaches live operator state faster.
That same mobile toolbar now collapses into a shorter operator strip: `Board` and `Filters` keep two compact side-by-side controls, while `Sync` drops into one smaller full-width refresh lane instead of a tall third block.
Operator Console groups deeper setup surfaces under one collapsible `Advanced Controls` drawer, so runtime controls stay available without overloading the first fold.
Inside that drawer, a collapsible `Scope & Access` panel keeps `Operator Role`, `Task ID`, and `Target Service` out of the first fold until a deeper operator action actually needs them.
Inside that drawer, the collapsible `Runtime Drill Runner` panel loads `GET /v1/runtime/fault-profiles`, lets admins plan or execute `POST /v1/runtime/fault-profiles/execute`, captures `followUpContext`, auto-prepares chained recovery in the UI, and refreshes operator summary after live execution.
Inside that drawer, the collapsible `Workflow Control Panel` loads `GET /v1/runtime/workflow-config`, applies `POST /v1/runtime/workflow-control-plane-override`, exposes redacted workflow/store snapshots, and reports assistive-router posture as `provider/model/budgetPolicy/promptCaching/watchlistEnabled` plus `apiKeyConfigured` instead of returning the raw key.
Inside that drawer, the collapsible `Bootstrap Doctor & Auth Profiles` panel loads `GET /v1/runtime/bootstrap-status` plus `GET /v1/runtime/auth-profiles`, shows provider/device/fallback posture, and lets admins rotate repo-owned runtime credentials through `POST /v1/runtime/auth-profiles/rotate` without leaving the console.
Inside that drawer, the collapsible `Browser Worker Control` panel loads `GET /v1/runtime/browser-jobs`, inspects `GET /v1/runtime/browser-jobs/:jobId`, and lets operator/admin roles resume or cancel repo-owned checkpointed background browser worker jobs through `POST /v1/runtime/browser-jobs/:jobId/resume|cancel`.
Inside that drawer, the collapsible `Operator Session Ops` panel stores a repo-owned purpose declaration for high-risk actions, refreshes session replay from `GET /v1/sessions` plus `GET /v1/events`, and refreshes cross-agent discovery from `GET /v1/skills/personas` plus `GET /v1/skills/recipes`.
High-risk operator POSTs can carry optional `operatorPurpose` metadata; the frontend purpose gate applies it before auth-profile rotation, workflow overrides, runtime drill execution, browser-worker resume/cancel, and `POST /v1/operator/actions`, and the same purpose/replay/discovery snapshots are included in Markdown/JSON session exports.
Operator summary also surfaces that control-plane posture directly in a `Workflow Runtime` card plus a mirrored `Workflow` signal-strip tile, so override state, assistive-router provider selection, readiness, and the current workflow stage/active role are visible without opening setup panels.
Operator summary also surfaces `bootstrap doctor` posture directly in a `Bootstrap Doctor` card, so provider readiness, auth-profile rotation state, device-node bootstrap readiness, and fallback-path coverage are visible without opening setup panels.
Operator summary also surfaces `background browser worker` posture directly in a `Browser Workers` card, so queued/running/paused/failed counts, latest job, and checkpoint-ready backlog are visible without opening the support panel.
Operator summary also surfaces consolidated `runtimeDiagnostics` in a `Runtime Guardrails` card plus a mirrored `Guardrails` signal-strip tile, so active degradation signals, service coverage, sandbox posture, and skills/runtime warnings are visible without reading raw summary JSON.
When active runtime signals map to repo-owned recovery paths, the `Runtime Guardrails` card also exposes direct CTA buttons such as `Plan Recovery Drill` or `Open Workflow Clear Path` and now renders a `Signal Paths` list so multiple recovery or triage routes can be staged without hunting through support panels. Each path also carries frontend-owned lifecycle state (`active`, `staged`, `planned`, `executed`, `cleared`, `failed`), and that path history is persisted locally across reloads with a `Clear Path History` reset control.
Top operator toolbar keeps only primary triage controls visible (`Demo/Full`, `Refresh`, `Focus Critical`, `Issues Only`); reset/collapse/cancel controls are moved into a collapsed `Board Actions` block.
Operator Console secondary copy (mode hints, quick-start helper text, lane playbook notes, and health metadata labels) now uses elevated contrast for judge-facing readability over gradient/video backgrounds.
Operator empty-state hints are action-oriented (which scenario/action to run next, then `Refresh Summary`) to avoid dead-looking `Waiting for ...` states.
Operator status cards now render demo-friendly placeholders directly in static HTML (`awaiting_refresh` / `pending`) before JS hydration.
In `Demo View`, the board keeps eight judge-facing cards visible by default (`Live Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Workflow Runtime`, `Runtime Guardrails`, `Device Nodes`), keeps `Live Bridge & Turn Safety` lane expanded by default, and still surfaces any new `fail` cards outside that set.
After refresh, `Demo View` now also floats `fail` / `watch` / `stale` lanes above nominal ones and auto-expands only the top triage lanes, so deeper evidence does not reopen as a long neutral wall.
That triage surface now mirrors the Browserbase/Stagehand-style operator rhythm more closely: a compact action queue appears before visibility counts, so the first scan answers which lane to open, which recovery path to run, or whether refresh is the only safe next move.
`Demo View` now auto-hides uninitialized neutral noise cards (`unknown` / `pending` / `n/a` / `awaiting_refresh`) outside the eight-card lane, so `Show All Cards` stays readable while keeping failures visible.
For remaining demo-essential cards that are still neutral/uninitialized, `Demo View` now uses a compact render (`title + status + hint`) until live evidence arrives.
Compact neutral cards now also expose inline next-step CTAs (`Run Negotiation` / `Run UI Task` / `Open Device Nodes` + `Refresh Summary`) so judges can recover empty lanes directly from each card.
Compact neutral cards now include short contextual recovery copy (what to run next and why) to reduce `unknown/pending` ambiguity during judge walkthroughs.
`Demo View + Focus Critical` further auto-hides uninitialized neutral cards inside the eight-card lane, so judges land on actionable states first.
`Operator Console` starts in `Focus Critical` mode with a top signal strip (`Bridge`, `Queue`, `Approvals`, `Startup`, `UI Executor`, `Workflow`, `Guardrails`, `Device Nodes`); use `Show All Cards` to inspect broader evidence without demo-noise placeholders.
`Issues Only` toggle hides cards already in `ok` state, so triage stays focused on neutral/fail evidence.
`Reset View` returns Operator Console to default triage layout (`Focus Critical` on, `Issues Only` off, default group visibility).
`Triage Summary` shows live counters (`total`, `visible`, `fail`, `neutral`, `ok`, `hidden`) that update with filters/status changes.
Each operator lane header now includes live mini-counters, a lane-type label, one short scope line, and a live preview line (`visible/fail/neutral/ok/hidden`) for instant group-level triage.
Those same deep-board lane headers now use plainer category labels (`Live Health`, `Runtime Health`, `Decisions`, `Audit Trail`) and action-first preview copy (`Act first`, `Refresh first`, `Check next`) so expanded groups read like an operator console instead of internal diagnostics buckets.
Each deep-board lane header now also exposes compact subdomain summary chips (`Bridge/Gateway/Recovery/Turns`, `Governance/Skills/Plugins/Cost`, `Workflow/Guardrails/Executor/Devices`, `Approvals/Queue/Lifecycle/Startup`) so the board reads like an inspectable control plane instead of a long stack of cards.
Collapsed nominal lanes now reduce to compact lane previews with `Status`, `Focus`, and `Coverage` pills plus an `Open lane` affordance, and on desktop those pills collapse into one short inline row so deeper board sections stop reading like a long technical wall. Internal phrases like `coverage gap` were also simplified to calmer operator copy such as `needs proof`.
On desktop, those same collapsed steady lanes now also drop the kicker and extra summary strip, and dormant/ok lanes hide the extra coverage pill so lower-board reopen state reads almost like a one-line lockup.
Those collapsed lanes now also surface in a compact `Lane focus rail`, so operators can reopen a specific lane and sync the evidence drawer without hunting through the full board.
When only one collapsed lane remains, that `Lane focus rail` drops into a quieter inline mode so a single parked lane does not read like a second board.
In `Demo View`, expanded operator lanes now keep one lead card at full weight while the remaining visible cards compact into quieter supporting summaries, so the lower board reads as one dominant issue plus inspectable context instead of several equal tiles.
Those supporting summaries now also act as quiet drawer selectors, so operators can retarget `Focused Evidence` from the lane itself without reopening more detail surfaces.
Explicit supporting-card selection now stays pinned until the operator changes posture or saved view, so manual inspection does not snap back to the lane's auto-selected top issue.
Expanded demo lanes now also collect those supporting summaries into a quiet `Other evidence` ledger, so the deep board reads as one lead issue plus an inspectable signal list instead of a wider wall of mini-cards.
On desktop, that same `Other evidence` ledger now behaves like a row-based signal list: helper copy drops out, single-signal lanes collapse extra header chrome, and supporting items read as compact status/title/hint rows instead of mini-cards.
On desktop, expanded lanes that already use that ledger now also drop the extra lane-copy and `Observe:` preview line, so the board header reads as `lane summary -> counters -> lead issue` instead of repeating the same context twice.
On desktop, those same expanded ledger lanes now trim the remaining shell again: `Ok` / `Hidden` counter pills drop out, header chips tighten, the lead issue shell shrinks, and the ledger rail gets a denser row layout so the lower board reads closer to `one lead issue + compact evidence list` than a control surface.
On desktop, those expanded ledger lanes now also drop the header summary-chip strip entirely once the lane is open, so the header stops repeating the same subdomain labels that already appear in the lead card and `Other evidence`.
On desktop, that same `Other evidence` rail now also drops its helper header entirely once the lane is open and tightens the supporting rows again, so the ledger reads like a plain signal list instead of a nested subpanel.
On desktop, lanes that collapse to a single visible lead signal now use the same quieter header rule even without a ledger, so `Live Bridge & Turn Safety` reads as `summary chips -> counters -> one incident` instead of repeating header copy above the card.
That same single-lead desktop lane now also drops into the compact lead shell, so `Bridge` uses the same short inline fact chips and a direct `Run Negotiation first.` hint instead of another full stale card.
That lead card now collapses its raw metric rows into a compact 2-3 fact incident summary while the full rows stay available to `Focused Evidence`, so the deep board reads as one dominant issue instead of a long technical card.
On desktop in `Demo View`, those same compact lower-board cards now also switch to shorter operator-facing titles like `Gateway errors`, `Policy changes`, `Queue load`, `Node updates`, `Recovery`, and `Probes`, while the full source title stays in the tooltip for precision.
That same desktop pass now also normalizes deep-board placeholders and runtime hints into operator-facing copy like `Awaiting signal`, `UI fallback`, `workflow path`, and `time limits`, so expanded cards stop leaking raw repo tokens such as `awaiting_signal`, `workflow-store`, or `assistive-router` into presentation scans.
Those same desktop supporting cards now also swap their longer hint paragraph for one or two compact evidence chips, so `Other evidence` reads like a quiet signal ledger instead of a stack of mini-explanations.
That same desktop ledger now also shortens long supporting chip labels/values (`Recovery Path` -> `Path`, `Awaiting signal` -> `Awaiting`, `Refresh summary...` -> `Refresh needed`) and reduces the footer note to `Inspect`, so stale utility cards stop stretching the deep board.
Desktop lead cards now also compress calm placeholder/healthy hint copy into a shorter `Next:` row, while fail/warn cards keep the fuller incident guidance.
That same desktop lead pass now caps calm/stale lead summaries at two facts and keeps the third fact only for fail-state cards.
Those calm two-fact lead cards now also tighten their shell spacing, so the title, pill, summary, and `Next:` row read as one shorter desktop block.
When a desktop lead card has only two calm facts left, that summary now stays on one row instead of keeping the old double-width primary block.
Inside desktop expanded ledger lanes, those same lead summaries now flatten into short inline chips like `Event`, `Health`, `Awaiting`, and `OK`, while stale action copy drops to `Refresh first.` and the full text stays in the tooltip.
Those same compact lead shells now also swap generic empty-state hints like `Refresh summary to inspect ...` for direct action-first cues such as `Run UI Task first.` or `Run Negotiation first.` when the lane is simply waiting for evidence.
Inside desktop expanded ledger lanes, those same compact lead shells now pin `status + title` onto one top row and strip the extra top spacing, so calm lanes read closer to an incident strip than a standalone card.
That same compact lead shell now stays in place even when the hint stays full, shortens the visible action cue to tighter verbs like `UI Task first.`, and clamps the incident title onto one line so expanded lanes stop re-inflating on desktop.
`Focused Evidence` now also refuses to collapse `Latest` summary down to a bare counter like `0.`; when the lead fact is only a thin count, it falls back to the action-first sentence instead.
Secondary operator controls (`Retry Task`, `Failover Drain`, `Failover Warmup`) are grouped under collapsed `Advanced Actions` to keep the default toolbar focused.
On desktop, collapsed `Advanced Actions` now uses the same quiet utility-toggle shell as the other rare-use rails, and its open helper copy is shorter so it does not re-inflate the lower fold.
Signal strip cards are clickable and jump to the corresponding evidence widget, auto-expanding its group and flashing the target card.
`KPI Constraints` includes per-metric delta badges (`price/delivery/sla`) plus explicit source attribution (`final_offer/current_offer/mixed_offer`) for quick judge scan.
Frontend `Intent Request` shows `ui_task` grounding fields only when `intent=ui_task`.
Frontend `Connection` panel uses a single `Export Session` dropdown with `Markdown` / `JSON` / `Audio (WAV)` evidence exports.
`Export Session` dropdown keeps a live `Last export` line, format icon badges (`MD/JS/WAV`), and a rolling `Recent exports` history (last 3 items); audio export is enabled only when assistant audio evidence is available.
Session Markdown/JSON exports now also carry structured `runtimeGuardrailsSignalPaths` evidence from the operator board, including current guardrail status, path lifecycle counts, primary recovery path, and the visible `Signal Paths` trail.
Session Markdown/JSON exports also carry `operatorPurpose`, `operatorSessionReplay`, and `operatorDiscovery` snapshots from `Operator Session Ops` for operator audit/replay provenance.
Custom dropdown controls support keyboard navigation (`ArrowUp/ArrowDown/Home/End`, `Enter/Space`, `Escape`) and combobox/listbox ARIA semantics (`aria-controls`, `aria-expanded`, `aria-activedescendant`) for judge/operator accessibility; once enhanced, native `<select>` chrome is suppressed to prevent OS-level fallback popups, and dynamically injected selects are auto-upgraded by a DOM observer.
Image/audio uploads use themed file pickers (`Choose image` / `Choose audio` with inline selected filename) so Live Controls and Intent Request avoid native browser file-input chrome.
Live status strip renders a concise export pill label (`exported markdown/json/audio`, `no audio`) while preserving the full export status in dropdown metadata/history.
Connection status metadata is rendered as a compact `4-column` status matrix (`Status`, `Assistant`, `Run ID`, `User ID`, `Session State`, `Mode`, `PTT`, `Export`) so all session signals stay visible without overflow; on smaller breakpoints it degrades to `2-column`/`1-column`.
Status strip readability is tuned for judge demos with higher neutral-text contrast, pill-state color mapping for `Status`, `Session State`, `Mode`, `PTT`, and `Export`, dedicated value chips for `Run ID`/`User ID`, and lane-level `ok/neutral/fail` accents; on narrower screens items wrap to `2-column`/`1-column` without horizontal overflow.
KPI secondary metrics (`labels`, `status notes`, `delta context`) are rendered with stronger contrast so values remain legible over the animated background.
Frontend header includes a persisted `dark/light` theme toggle for judge/operator readability.
Frontend supports a subtle animated background video (`apps/demo-frontend/public/bg-video.mp4`) with loop-transition smoothing and `prefers-reduced-motion` fallback.
Frontend visual system uses `Violet Bloom` dashboard tokens (colors/radius/shadows/typography) in `apps/demo-frontend/public/styles.css`.
Frontend includes a prompt-first `Story Studio` workspace with a top mode rail, one primary story canvas, and grouped trays for story ingredients, media direction, and editorial notes instead of a long technical form.
The shared Storyteller workspace strip now also retreats into a title-first line plus a couple of flat glance facts, and before the first run it hides the third fact entirely so the shell reads like context, not a second dashboard row.
Those grouped trays now read as summary-driven editorial drawers with plain-language summary lines and quiet meta chips, so secondary settings stay visible without leaving the page looking like a form.
When opened, the story and media drawers now expand into roomier two-column editors instead of squeezing three controls into a cramped row.
`Story Studio` also keeps a compact direction strip (`lead / world / delivery / scope`) above the canvas so the current brief reads at a glance before opening any trays.
That direction strip now reads as low-profile cue chips instead of another full row of cards, so the story canvas keeps its visual priority.
The upper `Story Studio` rails now read as one stronger scenario row plus a quieter cue line, so the prompt arrives without a permanent helper stepper in front of it. That hidden helper stepper now also stays out of the accessibility tree, so dormant `>` separators do not leak into desktop scan paths.
The scenario rail now behaves like one featured active brief card plus quieter secondary chips, so mode switching stays visible without adding another blocky dashboard row.
In focused Storyteller, that scenario rail now lands before the cue strip, so the first scan reads `mode -> cues -> prompt` instead of `cues -> mode -> prompt`.
On larger screens that rail now tightens into a one-row scenario lockup, and the prompt meta below the textarea now reads as a shorter brief preview instead of a long payload string.
The grouped trays now also stay below the prompt canvas instead of surfacing ahead of the first action, so Storyteller opens as `scenario -> prompt -> generate` and only then secondary editing.
The compose canvas itself now has more room around the active mode lockup, prompt heading, textarea, and CTA row, so the first fold reads like one editorial surface instead of a compact control card.
Before the first run, that compose shell now uses the full Story Studio width on larger screens while keeping the same internal `24px` breathing room, so the desktop presentation matches the post-run shell instead of shrinking into a separate narrow card.
That same desktop tray shelf now also regains a restrained chrome sheen and a fixed summary/meta stack, so longer collapsed-tray copy keeps three aligned cards instead of drifting into uneven blocks.
The shared Storyteller chrome now also steps back further: the left rail becomes a slimmer quiet nav and the top controls shrink into a lighter utility strip, so `Story Studio` wins the first glance instead of competing with dashboard framing.
On larger screens before the first run, the active mode lockup now reads like a quieter editorial brief card while the cue line flattens into inline facts and the secondary scenario pills step back.
That same desktop pre-run canvas now keeps a calmer title/status lockup and a cleaner CTA zone, so `Generate from brief` anchors the canvas while the utility actions retreat into a quieter row.
On those same larger screens, the shared shell above Story Studio now behaves more like a transparent context strip than a second hero card: the dashboard title becomes a small uppercase label, the controls flatten, and the workspace facts tighten into one quieter line.
That same desktop presentation pass now makes the left rail read more like a quiet label strip than a boxed sidebar, while the `Story Studio` heading tightens into an editorial title lockup with a smaller badge and shorter intro line.
Inside the desktop compose shell, the `Creative Brief` tag now steps back into a quiet label, the title block tightens, and a single divider hands off into the prompt lane so the canvas reads more like one editorial write surface than a stack of rows.
The active scenario card and cue line now also sit inside one calmer brief header on desktop: the mode row gets a thin frame, secondary scenario chips get lighter, and the cue facts tuck in tighter under that lockup instead of reading like a second row of controls.
The collapsed trays below the canvas now behave more like one quiet settings shelf on desktop: flatter summary rows, shorter hint lines, lighter inline summaries, and quiet fact-style meta instead of chip chrome competing with the prompt and CTA.
After a run on desktop, `Latest output` and `Current scene` now stay inside one calmer reading lane: a flatter dossier rail on the output side and a lighter inline support strip under the scene instead of stacked mini-cards.
That same desktop `Current scene` now also reads as a title-first preview surface: the repeated section intro drops away once a scene is ready, the copy block loses its inner label chrome, and the support rail collapses to the asset strip instead of a second summary card.
That same desktop `Latest output` main card now reads more like one editorial narrative surface: the inner narrative card drops away, cue facts sit as quiet inline metadata, and the story copy starts under one light divider instead of another boxed panel.
That same desktop ready-state output header now also collapses into a title-first editorial preview: the repeated intro/meta chrome disappears, short response headers condense into one compact fact line, and duplicated status copy no longer repeats across heading, summary, and body.
That same ready-state `Latest output` now also behaves more like an editorial proof: the outer body shell recedes, the status kicker drops to a quiet overline, and the story copy sits in a narrower reading measure instead of a generic content card.
That same desktop post-run reading lane now breathes more like an editorial proof as well: `Latest output` widens its narrative measure, dossier notes get more space, and `Current scene` drops the last inner-card density so the two surfaces still read like one calm story lane.
That same desktop approval pass also settles `Run status` into a flatter run brief and turns `Recent passes` into a short revision ledger, so post-run context stays supportive instead of rebuilding a second dashboard lane.
Live desktop runs now also keep the shared `Output` glance and `Run status` guidance aligned with the real `pending / updating / ready` state instead of staying on idle copy after a successful story run.
That same desktop interaction pass now also changes the compose CTA contract by state: the primary button locks and renames during first-pass or rerun rendering, the utility rail switches to live-follow wording, and run guidance stops pretending every state is the same idle launch moment.
After that same desktop run, the right side now reads as one quieter production column: `Run status` behaves like a flat summary rail and `Story atlas` behaves like a flatter switcher with one active editorial panel instead of stacked KPI cards.
That same active `Story atlas` panel now reads more like a quiet editorial side note: the inner eyebrow disappears, summary and meta lines tighten into one calm factual stack, and media counts step back from pill-like metrics into a lighter ledger.
That same desktop lower lane now reads as one calmer filmstrip lane: `Navigator` becomes a quiet utility strip and `Storyboard shelf` becomes a lighter editorial shelf instead of two neighboring dashboard cards.
On the tightest mobile widths, `Story Studio` now keeps one highlighted mode card with a compact secondary mode row, trims the intro line, and shortens the cue chips so the prompt arrives faster without losing scenario choice.
On those same mobile widths, the cue line now tucks under the active mode lockup as one quieter brief header and trims the `scope` cue before the prompt.
On the smallest mobile widths, the quieter secondary mode choices now drop below that cue line as their own scenario row instead of sitting between the lockup and the prompt.
That smallest-width scenario row now also uses lighter chrome, while the cue line sits against a subtle guide rule so the whole mobile brief-header reads as one calm lockup instead of stacked pills.
At that same breakpoint, inactive mode titles and cue summaries now switch to shorter mobile copy, so the first fold scans faster instead of reading like four full desktop labels squeezed into one column.
At that same breakpoint, the prompt field drops its helper line and the character counter flattens into quiet text, so the textarea reaches the eye faster instead of carrying extra pill chrome.
On those same mobile widths, collapsed trays now read as compact shelf rows: the drawer title plus live summary stay visible, while static tray hints disappear and meta chips flatten into quiet inline notes.
On larger screens those trays also stay in a calmer editorial shelf instead of widening into three equal dashboard columns.
The compose footer now reads as one dominant generate action plus a quieter utility row, and the trays below behave like a shelf that opens one drawer full-width instead of stacking three equal cards.
Expanded drawers now group controls into small editorial sections, so the open state still reads like guided composition instead of a flat form.
Those drawers now also use shorter tray hints, a quiet action divider, and calmer section dividers inside the open state, so the compose block stays readable while editing instead of turning back into a dense settings stack.
The middle `Latest output` and `Current scene` surfaces now use calmer narrative rhythm too: quieter support cards, lighter summaries, and tighter supporting chrome so the main story text reads first. In focused Storyteller they now sit inside a single calmer reading lane instead of behaving like two equal dashboard cards.
Before the first Storyteller run, the right-side `Run status` rail and the lower result surfaces stay off the page entirely; `Latest output`, `Story atlas`, and the storyboard lane wake up only when a run actually starts, so the first screen stays compose-first instead of preloading empty dashboards.
`Story Studio` now separates `latest output`, `current scene`, a segmented `Story atlas` (`world / character / media`), and `scene controls / scene cards` into distinct surfaces, so the reading order is `compose -> run status -> output -> scenes` instead of a flattened stack.
`Current scene` now renders as a storyboard-style preview panel with a beat headline, one compact fact line, and an asset-first support rail, while `Scene Cards` surface the same run as editorial tiles instead of plain text blocks.
Ready-state `Current scene` is now quieter too: the cue strip and full scene text live in one narrative block, while media and status fold into one split support card instead of three equal mini-panels.
`Latest output` now behaves like a result dossier instead of a plain transcript block: the newest response sits beside a quieter side dossier, where `brief lockup`, `delivery stack`, and direction notes are grouped into one quieter dossier stack before `production status` and `recent passes`.
Idle `Latest output` and idle `Current scene` now stay shorter on desktop: `Latest output` folds brief/delivery/production into one compact support strip, while `Current scene` uses one left-aligned support row and one calmer unlock card instead of a centered vertical placeholder stack plus an extra teaching panel.
Active `Latest output` is also calmer during a live run: story cues now sit inside the main narrative card, while `production status` folds into the same quiet dossier stack instead of becoming a second equal-weight side card.
The ready-state `Latest output` dossier is now shorter too: direction folds into the delivery context, so the side surface reads as `brief -> delivery -> production` instead of four equal subcards, and the smallest breakpoints hide extra dossier labels while keeping metrics in a compact two-column strip.
`Story Studio` empty states now stay calmer below the fold: the primary `Generate from brief` path lives in the compose canvas, while lower preview/timeline surfaces avoid repeating the same CTA cluster and keep `Open Live` as a controlled secondary action in the main toolbar.
`Run status` now reads as a quieter production rail with a title-first lockup, flatter metric cards, and a calmer next-step card, so the right side behaves more like a quieter production sidebar than a second dashboard; the `Story atlas` now uses a segmented switcher with a flatter tab strip and softer active panel so `world / character / media` read as one calmer creative surface instead of three equally loud cards.
The lower Storyteller lane now also reads as a compact navigator bar plus a storyboard shelf, so scene switching feels like lightweight browsing instead of another technical control panel.
That lower lane now sits inside one grouped storyboard lane with a subtle divider, so navigator context and the storyboard shelf scan as one calm strip instead of two neighboring cards.
That storyboard shelf now behaves like a calmer horizontal filmstrip in ready state, keeps left-to-right story order, uses a single footer meta line instead of an asset-chip row, and lets the selected scene widen slightly instead of breaking the shelf into a tall grid wall.
The right Storyteller rail now reads as a quiet snapshot stack with a lighter title card, slimmer state chips, and one calmer next-step note instead of another mini dashboard.
When the run is already ready, the right rail also drops the whole ready-state chip row and standalone progress bar so the sidebar resolves to title, scene count, and state instead of another KPI strip.
That same desktop runtime pass now also gives `Run status` one short action-first rail (`Generate/Retry` plus `Live`) and trims storyboard cards to a denser filmstrip with one primary cue chip, so the lower half stays readable without losing the next obvious action.
The ready-state `Current scene` panel now keeps one dominant narrative card with a quiet support strip underneath, so media/status/context stay visible without recreating a second side rail inside the preview.
That same desktop pass now also keeps tray chevrons and scene-jump arrows pinned inside their rails, tightens the navigator column, and widens the storyboard/output lanes enough to stop avoidable second-line wraps when the desktop shelf already has the room.
That same post-run desktop pass now also leans the reading lane a little further left and stacks current-scene asset refs full width, so `Latest output`, `Current scene`, and `Story atlas` feel ordered instead of padded out by empty side space.
That same desktop pass now also locks the top brief trays into a clean three-up shelf, moves tray chevrons out of the text flow, and keeps the post-run columns biased toward the narrative lane so avoidable desktop wraps stop happening when the width is already there.
That same desktop cleanup now also stacks the `Current scene` heading rail instead of forcing title and fact line to fight side-by-side, so the preview keeps a longer narrative title measure before it ever needs a second line.
`Current scene` support summaries are now quieter as well: duplicate hint lines step back, so the preview reads as one scene block plus a short factual strip instead of a nested stack of explainer cards.
Live desktop Storyteller failures now also resolve into an explicit review state instead of falling back to idle chrome: `Run status` switches to failed guidance, `Latest output` compresses raw gateway failures into a calmer `code / trace / latency` dossier, and empty preview/timeline lanes stay in retry language until the next run.
That same desktop lower lane now also compresses into a lighter control rail: the navigator keeps a full-width scrubber, tighter selector/position boxes, shorter ready copy, and a slightly wider storyboard shelf so the bottom row reads as one ordered strip instead of cramped control tiles plus cards.
That same desktop pass now also rebalances Latest output, Story atlas, and the storyboard lane into a tighter left-heavy reading grid, flattens production metrics into one inline ledger, and clamps storyboard titles to two steadier lines so long copy stops scattering the fold. That same desktop runtime pass now also trims the collapsed tray label rail, keeps summary rows on longer one-line locks, narrows the atlas support lane, and gives the navigator selector a fuller aligned row so chevrons stay pinned and the lower shelf stops feeling scattered.
That same desktop runtime cleanup now also targets the real compose-shell trays instead of the old prerun wrapper, so the top shelf finally stays three-up, helper copy holds one line, and the error/ready reading lanes stop wasting width on atlas chrome or selector wrap.
That same desktop Storyteller pass now also keeps the Russian title, subtitle, compose heading, and tray helper lines readable on one honest line where width already exists, while post-run atlas/dossier text wraps cleanly instead of collapsing into misleading ellipses.
That same desktop cleanup now also keeps the Russian creative-brief headline and deck on one line at `1440px`, shortens the first tray summary into an honest `lead • world` shorthand, and holds the atlas/dossier split behind a real EOF authority layer so later cascade blocks do not pull Storyteller back into broken wraps.
The middle Storyteller surfaces now also suppress helper intros in focused mode, so `Latest output`, `Current scene`, `Story atlas`, and `Storyboard shelf` read from heading + live state instead of stacking one more explainer line above every panel.
The `Story atlas` media surface now renders counts as a lighter inline strip, with zero-value badges visually stepping back so the right-middle area reads as one calmer editorial panel instead of a tiny dashboard.
On the smallest Storyteller breakpoints, `Run status` and `Story atlas` now retreat further: ready-state guidance hides repeated actions/hints, the rail strips off extra eyebrow chrome, and atlas tabs/cards drop secondary hints so the mobile middle stack stays lighter.
When `Storyteller` is active, the shared shell now compresses into a compact story strip with inline glance pills, so the page reaches `Story Studio` faster instead of spending the first fold on another summary block.
That desktop shared context strip now compresses further into a thinner editorial ledger: the dashboard title, language/theme controls, and workspace facts step back into one tighter line so the eye reaches Story Studio almost immediately. That desktop shared strip now recedes into an even quieter control ledger: the toolbar shrinks, the workspace title shortens, and the inline facts read like small references instead of a header block. That desktop direction strip now also reads more like inline reference notes: `lead / world / delivery / scope` sit on one calmer baseline with shorter dividers and quieter labels instead of feeling like four mini cards. That desktop `Story prompt` header now reads more like a write-title lockup: the helper note tucks under the label, and the count line drops into a quieter footnote below the textarea. That desktop textarea shell now reads more like a calm writing surface: the field loses harsher inset chrome, the paper gradient flattens, and focus settles into a softer editorial edge instead of a form-box ring. That desktop first fold now also behaves more like a calm studio page: the outer Story Studio shell sheds extra glow, the pre-run compose surface uses tighter paper-like spacing, and the brief canvas sits inside softer nested surfaces instead of stacked gradient cards. That desktop Story Studio title band now steps back further as well: the heading tightens, the badge shrinks, and the intro line tucks under the title like a short deck instead of holding a full second row above the brief. That desktop `Creative Brief` heading block now reads tighter as well: the label gets quieter, the story title shortens into a denser lockup, and the supporting line narrows so the brief opens like one composed heading rather than a loose title-plus-body stack.
That desktop mode row now steps back into a quieter scenario header too: the active scenario card flattens and tightens, while the secondary chips recede so the brief header reads as one composed editorial cluster instead of a featured card plus three peers.
That desktop cue line now also reads like a tucked editorial ledger: a subtle guide rule, shorter labels, and narrower values keep the reference facts attached to the active scenario lockup instead of feeling like a second settings row.
That desktop write surface now tucks closer to that brief header: the canvas edge softens, the prompt heading compresses, and the textarea enters a beat sooner so the handoff from cues into writing reads as one continuous narrative surface.
That desktop tray shelf now settles even lower as a quiet after-note ledger: row height drops, summaries shorten, and meta facts recede so the fold ends like a soft reference shelf instead of a second settings block.
That desktop outer Story Studio shell now recedes further into a lighter paper frame: padding tightens, the title deck shortens, and the surrounding chrome steps back so the inner compose surface stays dominant.
That desktop shared workspace strip now compresses into an even quieter micro-ledger: the workspace title, separators, and glance values all shorten so the eye reaches `Story Studio` almost immediately.
That desktop top utility rail now settles into an even quieter baseline: language and theme controls slim into smaller utility chips, the workspace line shortens again, and the preface above `Story Studio` behaves more like a whisper rail than a header block.
That same visible desktop Storyteller fold now keeps a readable type floor as well: microcopy stays at `11px+`, line-height opens up, and narrow title/summary measures stop forcing avoidable second lines when the lane already has room. That same post-run Storyteller reading lane now keeps that floor too: run labels, atlas facts, output dossier metadata, and navigator/storyboard support notes stay at `11px+` with a little more air and fewer needless wraps after a run. That same desktop cleanup now also keeps collapsed tray titles, hints, and facts on steadier one-line rows, pins tray chevrons to a stable right edge, shortens the scene-jump selector, and widens `Latest output`, `Current scene`, and the storyboard shelf so the lower half stops breaking into tetris-like blocks. The same desktop polish now also equalizes the top tray grid, settles production metrics into a calmer two-column ledger, and turns the storyboard shelf into aligned equal-width cards so the post-run half reads like one ordered layout instead of scattered blocks. That same desktop cleanup now also preserves one-line title/deck lines where width allows, falls back to honest wrap instead of fake ellipses for tray/atlas/output support copy, and hides native tray markers so the custom chevrons stay aligned and intentional.
That desktop left nav rail now recedes further into a thinner reference rail: rows shorten, active marking softens, and labels/icons step back so the sidebar behaves more like orientation than control chrome.
That same desktop CTA row now resolves into one cleaner handoff: `Generate from brief` keeps the visual weight, while `Use scenario draft` and `Open live dialog` retreat into a quieter utility rail instead of reading like peer CTAs. That desktop CTA handoff now sits closer to that writing surface as well: the divider softens, the action row tightens, and the secondary rail reads even more like utility support than a second control band. That collapsed tray shelf now also sits as a quieter after-CTA note row, with shorter rows and lighter inline facts instead of reading like a second block of mini-cards. That same collapsed tray shelf now recedes further into an inline reference ledger: repeated helper hints disappear in collapsed state, label columns narrow, and the remaining meta facts sit behind a softer divider instead of reading like separate tray cards.
That same desktop tray pass now also quiets sibling drawers while one is open and turns `Editorial notes` into a cleaner full-width editor lane, so the open state reads like one focused form instead of a broken row of tiny cards.
That same desktop Storyteller pass now also steps the inner brief heading down beneath `Story Studio`, softens the compose status rail, and stacks tray controls into one clean editor column with aligned select chevrons so the three brief drawers stop opening into cramped split forms.
That same desktop Storyteller pass now also turns `Story atlas` into a quieter note rail: the intro drops out of the desktop scan path, tabs compress into a short three-up switcher with preserved hover/ARIA labels, and the active panel resolves into one calmer editorial card with a lighter media metric strip.
That same desktop post-run cleanup now also resolves `Current scene` into a truer scene rail: the hidden media/status summary returns as a compact utility row, `Latest output` sheds more card chrome, and both section heads quiet down so the eye stays on the story copy.
That same desktop cleanup now also turns `Recent passes` into a quieter revision ledger and tightens `Scene cards` into a denser filmstrip, so the lower half keeps one scan path instead of reopening into mini-articles.
That same desktop post-run pass now also turns `Latest output` into a tighter narrative lane, compresses `Story atlas` into a quieter side note, and lays `Scene cards` out as a steadier four-up shelf so the lower half reads in one scan.
That same desktop runtime pass now also flattens `Run snapshot` into a shorter continuity strip, turns `Scene controls` into a quieter utility shelf, and compresses the `Latest output` dossier into a narrower companion rail so the post-run scan path stays cleaner.
That same desktop cleanup now also resolves `Scene controls` into a truer utility shelf: the visible labels shorten to `Scrub / Scene / At`, the live position collapses to a tighter cue, and the whole navigator sits on one steadier row once scenes exist.
That same desktop runtime pass now also makes `Run snapshot` and `Story atlas` more contextual: the run rail switches to short state-led labels (`Latest run`, `Run in flight`, `Queue`), while atlas headings pivot to the active panel (`World notes`, `Lead notes`, `Media queue`) so the right side reads faster without losing full hover labels.
That same desktop runtime rail now also resolves `Run snapshot` into a truer support strip in ready-state: `Story / Scenes / State` share one row, the next cue shortens to a tooltip-backed compact cue, and the remaining guidance collapses into one lighter utility line instead of reopening a mini-dashboard.
That same desktop runtime cleanup now also tightens `Latest output` and `Current scene` into a shorter reading lane: the output dossier narrows, preview copy/cards shed padding, and extra scene assets collapse behind a compact overflow pill so the middle column keeps its narrative scan path.
On smaller screens, the `Latest output` dossier side cards, `Current scene` support rail, and empty preview cues now collapse into short horizontal summary lanes instead of building one tall middle stack.
On smaller screens, the top of `Story Studio` also compresses into an inline compose-status row, a horizontal direction strip, and shorter numbered flow chips so the prompt canvas arrives sooner.
When `Storyteller` is the active tab, the shared workspace summary intentionally compresses into a quieter header so the page reads from the story canvas first instead of feeling like a second dashboard before the studio.
`Scene controls` now stay collapsed until the first scene arrives, so Storyteller does not show disabled scrubber/selector chrome before the timeline is actually usable.
When storyteller jobs are queued but scenes have not arrived yet, the same empty states switch to a `pending` variant so the lane reads as active work in progress instead of misleading `idle` placeholders.
On smaller screens, Storyteller now also collapses the shared shell into a compact workspace line and horizontal tab switcher, while mode/flow rails and the atlas switcher become lighter horizontal scrollers so the prompt canvas appears earlier.
On desktop those compose trays now keep a readable two-tier closed shelf and open into full-width editor drawers, so summaries stay scannable and the form controls stop collapsing into narrow one-column cards.
On desktop the scenario rail now recedes into one compact active mode plus quieter text-like alternates, so switching modes no longer competes with the writing canvas.
That same desktop scenario lockup now uses a smaller active marker and a shorter support cue, so the featured mode reads like part of the brief header instead of a second hero card.
That same desktop brief header now also trims inactive mode labels and tightens cue values with full tooltip context, so the top cluster stays readable without turning into another control row.
On desktop the prerun compose brief now drops the redundant eyebrow, shortens the support and status lines, and compacts idle utility actions so the prompt canvas reads first.
That same desktop compose-status rail now also stays inside the brief header for longer localized copy, so the support line wraps cleanly instead of pushing past the compose shell.
That same desktop prerun header now also compresses the mode badge and support cue into a quieter side note, while the draft/live actions hug their content as a small utility rail instead of stretching into a second control band.
That same desktop Storyteller pass now also turns the prompt lane into a calmer writing editor before and after `Generate`: the prompt label and footer text shorten, the preview/count row becomes a quiet ledger, and the textarea sits in a softer paper field instead of a heavier form box.
That same desktop tray editor now also drops the redundant open-summary strip and keeps Storyteller dropdowns pinned to their trigger width, so the open drawer reads like one clean editor column instead of a floating mix of summary pills and form controls.
On wide desktop, that same Storyteller shared chrome now behaves more like an atmospheric editorial frame: the transparent hero keeps a guided baseline, workspace facts compress into a cleaner ledger, and the left rail uses softer marked navigation rows so the background stays visible without losing orientation.
That same desktop hero now also uses a clearer lockup: the workspace title gets a stronger measure, the fact row stays on one line, and a faint accent rail ties the top preface back into the background instead of reading like floating loose text.
That same desktop `Story Studio` title band now continues that hero hierarchy instead of restarting it: the brief heading picks up a quieter left accent, the chip softens, and the mode/status lockup on the right becomes one aligned support column.
That same desktop `Story Studio` shell now also softens into one continuous studio surface: the outer panel sheds heavy card chrome, the compose shell reads more like a paper layer, and the inner canvas sits quieter so the hero and studio feel connected instead of stacked.
That same desktop top shell now also steps back one more notch: the shared story strip shortens to a quieter `Brief and scenes` ledger, the studio deck collapses into one tighter line, and the compose heading now reads like a smaller section title beneath `Story Studio` instead of restarting the page hierarchy.
That same desktop tray shelf now also reads more like a quiet reference ledger in collapsed state: helper hints drop away, card chrome softens, and only title plus concise summary/meta stay visible until a drawer is opened.
That same desktop hero/nav contract now also favors readability: the workspace summary sits on a darker glass rail with more breathing room, while the left nav uses equal-width tabs with one-line titles so video motion and long labels no longer distort the shell.
That same desktop hero/nav now also uses a clearer structure: the hero summary splits into a calmer title-plus-ledger stack, and the left rail adds quiet icon chips so navigation reads cleaner without changing tab size.
That same desktop hero/nav now also lands as a calmer foreground layer: the workspace summary uses a denser smoke-glass panel with a wider measure, and the left rail locks every tab to the same footprint over a darker backdrop so video motion cannot distort the text.
That same desktop first fold now also stretches more evenly across the page: the hero summary runs full-width inside the top rail, and the `Story Studio` title band widens into a more balanced header so the transition into the canvas feels continuous instead of stepped.
That same desktop brief header now also reads more cleanly under that wider header: the active mode card gets calmer chrome, secondary modes become a tighter utility row, and the cue strip resolves into one inline fact ledger instead of a loose second control band.
That same desktop writing surface now also reads as one calmer paper lane: the prompt hint stays on one line, the textarea gets roomier paper spacing, the counter resolves into a quiet 11px footnote, and the CTA row widens into a cleaner handoff instead of a cramped button strip.
That same desktop collapsed tray shelf now also resolves into a tighter three-up reference row: titles stay one-line, summaries shorten, and meta tags sit quieter so the bottom of the first fold reads like one shelf instead of three mini-cards.
That same desktop upper fold now also lands on a denser foreground layer: the hero gets a darker smoke-glass rail, `Story Studio` bridges upward into it, and the title band reads as one calmer continuation instead of a second heavy slab over the video.
That same desktop hero lockup now also reads more cleanly: the title and summary form one wider editorial stack, while the mode/status ledger moves into a compact right-aligned utility rail and the empty third slot disappears instead of leaving dead space.
That same desktop top microcopy now also carries a calmer rhythm: `Студия истории` and `Кинематографичный бриф` use shorter title/deck measures, softer spacing, and less headline weight so the first fold reads like one polished narrative preface instead of stacked headers.
That same desktop brief header now also gives the right mode/status block a real utility-rail footprint: the status track shrinks to text-fit width, badges stay compact, and runtime states use shorter copy so the header no longer reserves a wide empty pocket.
That same desktop first fold now also sits on a 95% foreground readability plate: the hero rail, Story Studio shell, and compose shell all use near-opaque smoke-glass surfaces so background video keeps atmosphere without compromising text legibility.
That same desktop post-run view now also reads as one calmer editorial lane: `Latest output` gets a wider reading column, `Atlas` resolves into an equal-width tab rail with tighter cards, and the storyboard shelf locks into a cleaner three-card board instead of uneven floating panels.
That same desktop post-run pass now also sharpens action clarity: `Atlas` tabs hold calmer hover/active states, storyboard cards show a clearer selected state without layout jumps, and the support copy under `Latest output`, `Preview`, and `Navigator` reads in fuller 11px+ lines instead of ambiguous clipped fragments.
That same desktop top shell now also gets a cleaner header and left rail: the workspace summary tightens into a denser split lockup with a restored eyebrow and a fuller one-line deck, while the sidebar tabs move to one fixed footprint with calmer chrome and steadier active emphasis.
That same desktop header and left rail now also breathe more evenly: the workspace summary becomes a taller two-zone split with compact utility cards on the right, while the sidebar shifts to a wider rail with calmer row spacing and steadier one-line tabs.
That same desktop Story Studio band now carries more air as well: the title lockup aligns under the badge, the intro deck holds one calmer line, and the `Cinematic brief` compose header resolves into a wider copy lane plus tighter status utility rail.
That same desktop compose header now also gives the mode rail and cue ledger more room to breathe: inactive modes keep fuller one-line labels in calmer chips, while `Lead / World / Delivery / Scope` hold longer readable values before truncating.
That same desktop prompt lane now also reads as one calmer writing surface: the helper line stays on one quieter baseline, the textarea opens with more paper-like room, the count holds a readable `11px`, and the CTA handoff resolves into one dominant generate action plus a tidier utility rail.
That same desktop prompt lane now also locks the text rhythm more cleanly: the helper stacks beneath the label instead of fighting it inline, the meta row resolves into a quieter preview-plus-count ledger, and the action divider gives the writing surface a calmer handoff into CTA space.
That same desktop collapsed tray shelf now also holds a calmer editorial rhythm: titles and undertext stay on one steadier line where they fit, summary copy carries more signal before truncating, and the right-side meta chips step back into a quieter aligned note column instead of pulling the trays off balance.
That same desktop header and left rail now also land more evenly: the workspace summary tightens into a cleaner editorial copy lane with a smaller right utility block, while every sidebar tab keeps the same fixed 62px row and no longer drifts in size on hover.
That same desktop `Story Studio` shell now also carries cleaner depth and rhythm: the outer panel gets a softer foreground plate, the space under the studio title opens up, and the compose surface resolves into a clearer paper layer inside the shell instead of reading like one flat slab.
That same desktop `Cinematic brief` header now also reads as a calmer lockup: the title/support copy gets more air and a wider measure, while the right status rail shrinks into a tighter utility note instead of a thin technical strip.
That same desktop mode rail now also reads like a real narrative selector: the active mode card carries calmer premium chrome, while the secondary chips gain steadier width and height so the whole row stops looking like a compressed control strip.
That same desktop cue ledger now also reads more like a quiet reference line: the fact row uses a steadier grid, longer runtime values survive before truncating, and the labels step back so the strip stops feeling like a second control band.
That same desktop tray/runtime pass now also resolves the remaining overflow traps: `Narrative anchor` and `Delivery stack` open into even full-width two-column rows, tray chevrons stay pinned beside the title, the top header cards plus `Run status` absorb longer EN/RU strings without breaking, and the storyboard selector can flip upward instead of dropping off-screen.
That same desktop tray/header pass now also cleans the first-fold details: the three collapsed trays use taller stacked cards with two-line readable summaries instead of clipped one-line fragments, `Story Studio` intro sits directly under the title instead of drifting sideways, the sidebar lifts into a steadier fixed rail, and the `Live` nav entry gets a clearer accent without changing the shared tab footprint.
That same desktop tray/utility polish now also recenters the tray chevrons inside cleaner circular shells and returns the `Live` utility action to the same rounded pill geometry as the other Storyteller actions, so neither element breaks the first-fold rhythm.
That same desktop pre-run shelf now also behaves better at first open: the three lower trays keep the chevron centered inside its circle before any run starts, reset the old rotated border contour so only the centered icon remains, and opening a tray restores top padding in the summary header so the title and supporting line no longer stick to the container edge.
That same desktop left rail now also lands on a cleaner late-authority grid: the sidebar lifts up to the top fold, every nav row keeps the same 62px footprint, `Консоль оператора` fits without awkward clipping, and `Live` gets a subtle accent while staying inside the same pill geometry as the rest of the rail.
That same desktop rail pass now also fixes the actual parent layout around it: the Storyteller body grid widens to the new sidebar width so the rail no longer overlaps the studio column, and the `Live / Story / Ops / Nodes` icon chips now use fixed overflow-safe boxes instead of letting span text escape the pill.
That same desktop rail pass now also finishes the geometry cleanup: the sidebar gets a final wider column and larger icon pills so `Story` and `Nodes` fit honestly, the rail lifts onto the same top baseline as `Story Studio`, and the intro line now sits directly under the title without the old internal offset.
Storyteller visual calibration for this surface was benchmarked against [Lore Machine](https://www.loremachine.world/), [Luma Dream Machine](https://lumalabs.ai/dream-machine), [Krea](https://www.krea.ai/), [Kling AI](https://app.klingai.com/global/), [Runway](https://runwayml.com/), and the panelized media workflow ideas visible in [VisoMaster-Fusion](https://github.com/VisoMasterFusion/VisoMaster-Fusion).
`Device Nodes` tab now reads as a fleet-first workspace: `Quick Start` still stays on the first fold, but `Fleet` now owns the main scan path with a human-readable context strip (`Form mode / Current target / Registry state`), compact health summary, a `Quick node picker`, and a dedicated `Fleet cards` shell for deeper per-node inspection before any write action is needed. That `Quick node picker` now behaves like a calmer target switcher instead of a mini table, so it does not compete with the detailed cards below. The tab also keeps a quieter top summary, a lower-noise hero, a compact workspace glance shell, and a smaller role split rail (`Write: admin` / `Checks: operator`), while the fleet strip lets the current target lead and pushes secondary metrics into lighter cards, so it reads like a fleet console instead of a stack of launch cards. Once the fleet is populated, the top onboarding hero compresses into a short `Fleet ready` header and small permissions note instead of staying a full tutorial banner. On desktop, that populated first fold now drops the old context strip, resolves into a slimmer `Fleet ready / Permissions` pair, and lets the current target strip lead before the quieter fleet KPI band. On that same desktop pass, the shared workspace shell above the tab also switches to `Target / Role / Next`, so the top chrome orients the reviewer without repeating fleet counters that are already visible below. The wide desktop top fold is quieter now as well: the current-node meta folds version into the identity line, the duplicate `Version` tile disappears, the redundant `Total` KPI card drops out of the summary band, and `Quick target` compresses into a denser switcher so the first scan lands on target, health, and the next retarget action. When four or fewer nodes are visible on wide desktop, that switcher now flips into a compact multi-column target picker instead of a horizontal mini-table, so the first fold keeps one calm board shape instead of another scrolling control rail. The `Fleet cards` header is quieter too: the heading is shorter, the helper note retreats into a small muted aside, and `Add node` behaves like a utility chip instead of another launch button. When only one or two nodes are visible, the `Fleet cards` lane now collapses to content height instead of pretending to be a long scrolling list; once three or more nodes are visible on wide desktop, that same lane now expands into a denser three-card fleet board with shorter ready hints, compact route labels, and overflow caps pills so the page reads like a calm fleet overview instead of three tall launch cards. Those detailed fleet cards now summarize route/trust/recency/capabilities in one calmer scan path instead of six equal technical rows, and the selected card now exposes one quiet `Checks` action so diagnostics open from the chosen fleet target instead of dragging the user straight into the admin form. Snapshot rows now retarget the selected node without auto-opening editing, so targeting and diagnostics stay separate. In populated state, the lower support shells stay hidden until an operator explicitly uses `Add node`, `Edit`, or `Checks`, so the fleet board keeps the whole scan path until deeper work is requested. The lower support rail is now state-aware as well: the open panel owns the wider lower-fold lane while the collapsed sibling stays compact, so operators no longer get one long empty diagnostics strip fighting a squeezed editor. The admin editor itself now behaves more like a quiet drawer-form: one summary header, a compact role-aware write guard, and a denser two-column form only when it owns the wider lane. In desktop primary-focus, that drawer now sits on a single right-aligned lane instead of reserving an empty left column. In that same primary-focus state, the write guard and support actions compress into a compact control row, so the editor reads like a drawer instead of a second launch panel. `Targeted checks` now opens as a short diagnostics drawer: one visible `Run checks` card first, then nested `Heartbeat payload` and `Fleet view` panels only when extra context is actually needed. A collapsible admin editor still holds the role-aware write guard, local role switch (`viewer / operator / admin`), and the save form so registry writes no longer dominate the first fold. Guided empty-state actions (`Use Demo Template` / `Show All Nodes`) remain available for fast recovery, and the whole lane continues to follow the persisted `RU/EN` selector end-to-end. When the registry is still empty, that same desktop lane now suppresses `Targeted checks` entirely, lets the empty fleet state stretch across the full board, restores the first-node editor to a compact two-column create form instead of a long single-column stack, drops the summary chips, and reframes the write/access strip around the first save instead of generic admin console language. That empty desktop first fold now also compresses the top `First node / Access and checks` block into a calmer first-save header, so the screen reads like one registration flow instead of a tutorial wall above the fleet surface.
`Device Nodes` also follows the persisted `RU/EN` selector end-to-end, including field labels, filters, snapshot headers, empty states, and selection cards.

Judge-facing visual evidence pack:
```bash
npm run demo:e2e:visual-capture
npm run demo:e2e:visual-pack
```
Strict mode (non-zero exit when required screenshots or critical badge lanes are missing):
```bash
npm run demo:e2e:visual-pack:strict
```
Combined shortcut:
```bash
npm run demo:e2e:visual:auto
```
Generate judge-facing gallery markdown with embedded screenshots:
```bash
npm run demo:e2e:visual:gallery
```
Presentation shortcut (capture + strict pack + gallery):
```bash
npm run demo:e2e:visual:present
```
Build one-page judge presentation bundle from demo/policy/badge/visual artifacts:
```bash
npm run demo:e2e:visual:bundle
```
One-command judge bundle flow:
```bash
npm run demo:e2e:visual:judge
```
One-command epic judge flow (e2e + policy + badge + visual judge + artifact validation):
```bash
npm run demo:epic
```
Offline deterministic capture (no running frontend):
```bash
npm run demo:e2e:visual-capture -- --mockAll
```
Artifacts:
- `artifacts/judge-visual-evidence/manifest.json`
- `artifacts/judge-visual-evidence/manifest.md`
- `artifacts/judge-visual-evidence/screenshots/_capture-manifest.json`
- `artifacts/judge-visual-evidence/gallery.md`
- `artifacts/judge-visual-evidence/presentation.md`
- `artifacts/demo-e2e/epic-summary.json`
- `presentation.md` now also surfaces optional deploy provenance from `artifacts/deploy/railway-deploy-summary.json` and `artifacts/deploy/repo-publish-summary.json` when those artifacts exist.

5. Optional runtime integrations:
- Firestore adapter (orchestrator): set `FIRESTORE_ENABLED=true` and `GOOGLE_CLOUD_PROJECT`.
- Live API bridge (gateway): set `LIVE_API_ENABLED=true`; when `LIVE_API_PROTOCOL=gemini`, the gateway can derive the official Gemini Live websocket URL and reuse `GEMINI_API_KEY` for `x-goog-api-key` if `LIVE_API_API_KEY` is omitted.
- Live API protocol profile (gateway): set `LIVE_API_PROTOCOL=gemini` (default), `LIVE_API_AUTO_SETUP=true`, and tune `LIVE_AUDIO_MIME_TYPE` if needed.
- Live gateway resilience tuning: configure `LIVE_CONNECT_ATTEMPT_TIMEOUT_MS`, `LIVE_CONNECT_RETRY_MS`, `LIVE_CONNECT_MAX_ATTEMPTS`, `LIVE_MAX_STALE_CHUNK_MS`.
- Live gateway failover/health tuning: `LIVE_MODEL_FALLBACK_IDS`, `LIVE_API_FALLBACK_KEYS`, `LIVE_API_AUTH_PROFILES_JSON`, `LIVE_FAILOVER_COOLDOWN_MS`, `LIVE_FAILOVER_RATE_LIMIT_COOLDOWN_MS`, `LIVE_FAILOVER_AUTH_DISABLE_MS`, `LIVE_FAILOVER_BILLING_DISABLE_MS`, `LIVE_HEALTH_CHECK_INTERVAL_MS`, `LIVE_HEALTH_SILENCE_MS`, `LIVE_HEALTH_PING_ENABLED`, `LIVE_HEALTH_PROBE_GRACE_MS`.
- `LIVE_API_AUTH_PROFILES_JSON` supports direct `apiKey` / `authHeader` values plus repo-owned references (`apiKeyCredential`, `apiKeyProfileId`, `authHeaderCredential`, `authHeaderProfileId`) so live gateway failover auth can resolve from the encrypted credential store and auth-profile rotation instead of ad hoc env duplication.
- Live setup tuning: `LIVE_SETUP_VOICE_NAME`, `LIVE_SYSTEM_INSTRUCTION`, `LIVE_REALTIME_ACTIVITY_HANDLING`, `LIVE_ENABLE_INPUT_AUDIO_TRANSCRIPTION`, `LIVE_ENABLE_OUTPUT_AUDIO_TRANSCRIPTION`, `LIVE_SETUP_PATCH_JSON` (JSON object merged into setup for tools/toolConfig overrides).
- Live transcript normalization tuning: `LIVE_TRANSCRIPT_REPLACEMENTS_JSON` (JSON object or array of `{source,target}` rules applied to outgoing transcript delta/completed text).
- Live function auto-dispatch tuning: `LIVE_FUNCTION_AUTO_INVOKE`, `LIVE_FUNCTION_ALLOWLIST`, `LIVE_FUNCTION_ARGUMENT_MAX_BYTES`, `LIVE_FUNCTION_UI_SANDBOX_MODE`, `LIVE_FUNCTION_DEDUPE_TTL_MS`.
- Gateway websocket binding guardrails: each message carries correlation context (`userId/sessionId/runId`), and gateway rejects bound-socket mismatch (`GATEWAY_SESSION_MISMATCH`, `GATEWAY_USER_MISMATCH`).
- WebSocket integration contract and error taxonomy: `docs/ws-protocol.md`.
- WebRTC V2 transport spike plan (no MVP switch): `docs/webrtc-v2-spike.md`.
- WebRTC rollout telemetry controls (status-only, no transport cutover): `GATEWAY_WEBRTC_ROLLOUT_STAGE=disabled|spike|shadow|canary`, `GATEWAY_WEBRTC_CANARY_PERCENT=0..100`, `GATEWAY_WEBRTC_ROLLBACK_READY=true|false`.
- Gateway -> orchestrator request resilience: configure `GATEWAY_ORCHESTRATOR_TIMEOUT_MS`, `GATEWAY_ORCHESTRATOR_STORY_TIMEOUT_MS`, `GATEWAY_ORCHESTRATOR_MAX_RETRIES`, `GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS`. Default timeout stays `35000ms` for interactive live turns, while `story` requests get a longer `90000ms` budget so Storyteller handoffs do not fail prematurely during manual testing.
- Gateway orchestrator replay-dedupe tuning: `GATEWAY_ORCHESTRATOR_DEDUPE_TTL_MS` (idempotent response replay window for duplicate websocket requests).
- API -> orchestrator request resilience: configure `API_ORCHESTRATOR_TIMEOUT_MS`, `API_ORCHESTRATOR_MAX_RETRIES`, `API_ORCHESTRATOR_RETRY_BACKOFF_MS`.
- Orchestrator workflow runtime defaults are repo-owned in `configs/orchestrator.workflow.json`; override via `ORCHESTRATOR_WORKFLOW_CONFIG_PATH`, `ORCHESTRATOR_WORKFLOW_CONFIG_JSON`, and hot-reload cadence `ORCHESTRATOR_WORKFLOW_REFRESH_MS`.
- Orchestrator idempotency cache tuning: `ORCHESTRATOR_IDEMPOTENCY_TTL_MS` (still supported as an override for the workflow-config dedupe window).
- Orchestrator assistive LLM router (feature-flagged): `ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED`, `ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER`, `ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL`, `ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY`, `ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL`, `ORCHESTRATOR_ASSISTIVE_ROUTER_TIMEOUT_MS`, `ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE`, `ORCHESTRATOR_ASSISTIVE_ROUTER_ALLOW_INTENTS`, `ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY`, `ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING`, `ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED`; supported providers are `gemini_api`, `openai`, `anthropic`, `deepseek`, and watchlist `moonshot` (details: `docs/assistive-router.md`).
- Operator-facing workflow control proxy: `GET /v1/runtime/workflow-config` and `POST /v1/runtime/workflow-control-plane-override` expose the workflow-store/assistive-router runtime contract through `api-backend`, but redact `assistiveRouter.apiKey` into `apiKeyConfigured` for UI/audit safety.
- Orchestrator retry classification overrides: `ORCHESTRATOR_CONTINUATION_STATUS_CODE`, `ORCHESTRATOR_CONTINUATION_RETRY_BACKOFF_MS`, `ORCHESTRATOR_TRANSIENT_ERROR_CODES`, `ORCHESTRATOR_TRANSIENT_ERROR_PATTERNS`, `ORCHESTRATOR_TERMINAL_ERROR_CODES`, `ORCHESTRATOR_TERMINAL_ERROR_PATTERNS`.
- Live-agent text features (translation/conversation): Gemini remains the default path via `GEMINI_API_KEY` (or `LIVE_AGENT_GEMINI_API_KEY`) and now runs through the official Google `@google/genai` SDK in the judged reasoning path; Moonshot/Kimi 2.5 can still be enabled additively with `LIVE_AGENT_TEXT_PROVIDER=moonshot`, `LIVE_AGENT_MOONSHOT_API_KEY` (or `MOONSHOT_API_KEY`), `LIVE_AGENT_MOONSHOT_BASE_URL`, and optional `LIVE_AGENT_MOONSHOT_TRANSLATION_MODEL` / `LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL` (default `kimi-k2.5`). For `kimi-k2.5`, the adapter pins `temperature=1` and you can raise latency budget with `LIVE_AGENT_MOONSHOT_TIMEOUT_MS` when you want live API responses instead of fallback.
- Live-agent grounded research adapter: set `LIVE_AGENT_RESEARCH_API_KEY` (or `PERPLEXITY_API_KEY`) and optionally tune `LIVE_AGENT_RESEARCH_BASE_URL` / `LIVE_AGENT_RESEARCH_MODEL`; `LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON` keeps demo/release research evidence deterministic.
- Live-agent context compaction tuning: `LIVE_AGENT_CONTEXT_COMPACTION_ENABLED`, `LIVE_AGENT_CONTEXT_MAX_TOKENS`, `LIVE_AGENT_CONTEXT_TARGET_TOKENS`, `LIVE_AGENT_CONTEXT_KEEP_RECENT_TURNS`, `LIVE_AGENT_CONTEXT_MAX_SESSIONS`, `LIVE_AGENT_CONTEXT_SUMMARY_MODEL`.
- Storyteller pipeline config: set `STORYTELLER_*` envs for planner models and media mode (`STORYTELLER_MEDIA_MODE=default|fallback|simulated`). `default` enables the Google GenAI SDK-backed primary image/video/TTS lanes when Gemini credentials are present; `STORYTELLER_IMAGE_MODEL=gemini-3.1-flash-image-preview` selects `Nano Banana 2` on the Gemini image lane; `STORYTELLER_GEMINI_TIMEOUT_MS` should be raised for live Gemini image/video runs because `Nano Banana 2` can exceed the repo's old `12s` default; `STORYTELLER_VIDEO_POLL_MS` and `STORYTELLER_VIDEO_MAX_WAIT_MS` tune synchronous Veo polling for the live video lane; `fallback` keeps deterministic repo-owned assets; `simulated` keeps async drill posture.
- Storyteller live-media smoke: `npm run storyteller:smoke:live -- --mediaMode=default --includeImages=false --includeVideo=true --segmentCount=1` writes `artifacts/storyteller-live-media-smoke/latest.json`, auto-loads repo-local `.env` when present, and fails fast when a requested live image/video lane does not activate. For the `Nano Banana` continuity pass, run the same command with `--includeImages=true --includeVideo=false --imageEditRequested=true`.
- UI Navigator planner config: set `UI_NAVIGATOR_*` envs for Computer Use-style planning, max steps, and approval keyword policy.
- UI Navigator executor modes: `UI_NAVIGATOR_EXECUTOR_MODE=simulated|playwright_preview|remote_http`, optional `UI_NAVIGATOR_EXECUTOR_URL`, remote fallback behavior `UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE=simulated|failed`, and timeout/retry controls `UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS`, `UI_NAVIGATOR_EXECUTOR_MAX_RETRIES`, `UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS`.
- UI Navigator device-node routing: `UI_NAVIGATOR_DEVICE_NODE_INDEX_URL`, `UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_TOKEN`, `UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_CREDENTIAL`, `UI_NAVIGATOR_DEVICE_NODE_INDEX_TIMEOUT_MS`, `UI_NAVIGATOR_DEVICE_NODES_JSON`.
- UI Navigator loop guard tuning: `UI_NAVIGATOR_LOOP_DETECTION_ENABLED`, `UI_NAVIGATOR_LOOP_WINDOW_SIZE`, `UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD`, `UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD`.
- UI Navigator sandbox policy tuning: `UI_NAVIGATOR_SANDBOX_POLICY_MODE=off|non-main|all`, `UI_NAVIGATOR_SANDBOX_MAIN_SESSION_IDS`, `UI_NAVIGATOR_SANDBOX_MAX_STEPS`, `UI_NAVIGATOR_SANDBOX_ALLOWED_ACTIONS`, `UI_NAVIGATOR_SANDBOX_BLOCKED_CATEGORIES`, `UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE`.
- UI Navigator damage-control policy: `UI_NAVIGATOR_DAMAGE_CONTROL_ENABLED`, `UI_NAVIGATOR_DAMAGE_CONTROL_RULES_PATH` (default `.kiro/policies/ui-damage-control.rules.json`), optional inline override `UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON`.
- Skills runtime tuning: `SKILLS_RUNTIME_ENABLED`, `SKILLS_SOURCE_PRECEDENCE=workspace,bundled,managed`, `SKILLS_ALLOWED_SOURCES`, `SKILLS_WORKSPACE_DIR`, `SKILLS_BUNDLED_DIR`, `SKILLS_MANAGED_INDEX_JSON`, `SKILLS_MANAGED_INDEX_URL`, `SKILLS_MANAGED_INDEX_AUTH_TOKEN`, `SKILLS_MANAGED_INDEX_AUTH_CREDENTIAL`, `SKILLS_MANAGED_INDEX_TIMEOUT_MS`, `SKILLS_ENABLED_IDS`, `SKILLS_DISABLED_IDS`, `SKILLS_SECURITY_MODE=off|warn|enforce`, `SKILLS_MIN_TRUST_LEVEL=untrusted|reviewed|trusted`.
- Skills catalog tuning: repo-owned catalog defaults to `configs/skills.catalog.json`; override with `SKILLS_CATALOG_PATH` or inline `SKILLS_CATALOG_JSON` to publish curated `personas` + `recipes` without touching Firestore registry storage, while repo-owned convergence warnings are generated from local `SKILL.md` metadata plus managed-skill sample payloads instead of a second hand-maintained registry list.
- Playbook skills live in `skills/bundled/lead-qualification`, `skills/bundled/consultation-booking`, and `skills/bundled/document-collection`; the matching personas and recipes in `configs/skills.catalog.json` keep the demo and API aligned around the first commercial wedge.
- Promptfoo eval suites live in `configs/evals/promptfoo` and can be run with `npm run eval:promptfoo`, `npm run eval:promptfoo:red-team`, or `npm run eval:promptfoo:gate`. The runner mirrors `GEMINI_API_KEY` into `GOOGLE_API_KEY` for the Google provider and writes run metadata to `artifacts/evals/latest-run.json`. `npm run verify:release` now requires a non-dry-run red-team summary in that artifact (or reruns the red-team suite when a Gemini API key is available).
- Runtime fault profiles: repo-owned controlled degradation catalog defaults to `configs/runtime.fault-profiles.json`; override with `RUNTIME_FAULT_PROFILES_PATH` or inline `RUNTIME_FAULT_PROFILES_JSON` to publish reproducible drain/fallback/sandbox/approval drills for operators and judges.
- Storyteller runtime control surface (via orchestrator): `GET /story/runtime/config` and `POST /story/runtime/control-plane-override` expose repo-owned media-mode drills plus `ttsProvider` override (`gemini_api|deepgram`) and `imageEditEnabled` toggle without env restarts; env knobs also support Gemini-first TTS with Deepgram Aura-2 fallback via `STORYTELLER_TTS_PROVIDER_OVERRIDE`, `STORYTELLER_TTS_SECONDARY_ENABLED`, `STORYTELLER_TTS_SECONDARY_MODEL`, and `STORYTELLER_TTS_SECONDARY_LOCALES`, plus optional fal continuity pass via `STORYTELLER_IMAGE_EDIT_ENABLED` and `STORYTELLER_IMAGE_EDIT_MODEL`.
- Plugin marketplace signing for managed skills: `SKILL_PLUGIN_REQUIRE_SIGNATURE=true|false`, `SKILL_PLUGIN_SIGNING_KEYS_JSON` (JSON map `{ "<keyId>": "<hmacSecret>" }`), optional `SKILL_PLUGIN_SIGNING_KEYS_CREDENTIAL`.
- Shared local credential store for managed integrations: `CREDENTIAL_STORE_FILE`, `CREDENTIAL_STORE_MASTER_KEY`; direct env values still work, but `*_AUTH_CREDENTIAL` / `*_SIGNING_KEYS_CREDENTIAL` lets runtime resolve secrets from the encrypted local store with atomic file writes and separated metadata.
- Repo-owned auth-profile rotation for runtime indexes: `AUTH_PROFILE_STORE_FILE` stores active profile selection, while `SKILLS_MANAGED_INDEX_AUTH_PROFILE` and `UI_NAVIGATOR_DEVICE_NODE_INDEX_AUTH_PROFILE` let managed-skills and device-node index auth resolve through stable profile IDs instead of ad hoc env switching.
- Managed-skill signature helper: `npm run skills:plugin:sign -- --input skills/workspace/calendar-assistant/managed-skill-signing-input.sample.json --secret <secret>`.
- Remote UI executor service: run `npm run dev:ui-executor`; endpoint `/execute` is used when `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`, repo-owned runtime control surface is exposed via `GET /runtime/config` + `POST /runtime/control-plane-override` for force-simulation/sandbox drills, and long-horizon background browser worker execution is exposed via `POST /browser-jobs` plus `GET /browser-jobs/:jobId` and `POST /browser-jobs/:jobId/resume|cancel` for repo-owned resume/cancel actions.
- UI Executor device-node registry knobs: `UI_EXECUTOR_DEFAULT_DEVICE_NODE_ID`, `UI_EXECUTOR_DEVICE_NODES_JSON`.
- UI Executor sandbox/runtime guardrails: `UI_EXECUTOR_SANDBOX_MODE=off|audit|enforce`, `UI_EXECUTOR_SANDBOX_NETWORK_POLICY=allow_all|allow_list|same_origin`, `UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS`, `UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS`, `UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS`, `UI_EXECUTOR_SANDBOX_BLOCK_FILE_URLS`, `UI_EXECUTOR_SANDBOX_ALLOW_LOOPBACK_HOSTS`, `UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH`, `UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION`.
- UI Executor background browser worker runtime: `UI_EXECUTOR_BROWSER_WORKER_ENABLED`, `UI_EXECUTOR_BROWSER_WORKER_CONCURRENCY`, `UI_EXECUTOR_BROWSER_WORKER_POLL_MS`, `UI_EXECUTOR_BROWSER_WORKER_RETENTION_MS`.
- Approval SLA tuning in API backend: `APPROVAL_SOFT_TIMEOUT_MS`, `APPROVAL_HARD_TIMEOUT_MS`, `APPROVAL_SWEEP_LIMIT`.
- Local-first profile for offline iteration: set `LOCAL_FIRST_PROFILE=true` and `APP_ENV=dev` (guardrail blocks local-first in `staging/prod`). Profile details: `docs/local-first-profile.md`.
- Telemetry storage split profile (`T-221`): `ANALYTICS_EXPORT_ENABLED`, `ANALYTICS_EXPORT_METRICS_TARGET`, `ANALYTICS_EXPORT_EVENTS_TARGET`, `ANALYTICS_EXPORT_SAMPLE_RATE`, `ANALYTICS_BIGQUERY_DATASET`, `ANALYTICS_BIGQUERY_TABLE`; policy docs: `docs/telemetry-storage-split.md`.
- GCP provisioning helper for telemetry split: `pwsh ./infra/gcp/setup-analytics-sinks.ps1 -ProjectId "<project-id>" -Location "US" -DatasetId "agent_analytics"`.
- GCP monitoring baseline helper (dashboard + alerts): `pwsh ./infra/gcp/setup-monitoring-baseline.ps1 -ProjectId "<project-id>" -NotificationChannels "projects/<project-id>/notificationChannels/<channel-id>"`.
- One-shot observability setup wrapper: `pwsh ./infra/gcp/setup-observability.ps1 -ProjectId "<project-id>" -Region "us-central1" -Location "US" -DatasetId "agent_analytics"`.
- Monitoring template validation (local/CI): `npm run infra:monitoring:validate`.
- Observability evidence collector for judges: `pwsh ./infra/gcp/collect-observability-evidence.ps1 -ProjectId "<project-id>" -DatasetId "agent_analytics" -LookbackHours 24`.
- Judge-ready observability report generation: `npm run infra:observability:report`.
- Observability artifact integrity check (required files + summary shape): `npm run infra:observability:check`.
- GitHub Actions workflow for observability evidence: `.github/workflows/observability-evidence.yml` (manual dispatch; set `collect_live=true`, `project_id`, and repository secret `GCP_CREDENTIALS_JSON`).

6. Optional delegation demo commands (in demo frontend message box with `intent=conversation`):
- `delegate story: <prompt>` -> Live Agent delegates to Storyteller.
- Story delegation also supports lightweight directives in the same message, for example: `delegate story: <prompt>. text only. no images. no video. 2 scenes.`
- `delegate ui: <goal>` -> Live Agent delegates to UI Navigator.

7. Approval/resume API flow for sensitive UI actions:
- `GET /v1/approvals?sessionId=<id>&limit=50` -> list approval decisions.
- `POST /v1/approvals/resume` with `intent=ui_task` + `decision=approved|rejected` -> persist decision and optionally resume execution through orchestrator.

Session mutation concurrency controls:
- `PATCH /v1/sessions/{sessionId}` accepts optional `expectedVersion` in body for optimistic concurrency.
- `PATCH /v1/sessions/{sessionId}` accepts optional idempotency key via body `idempotencyKey` or header `x-idempotency-key`.
- On stale version, API returns `409 API_SESSION_VERSION_CONFLICT`.
- Tenant scope baseline:
  - Set request tenant via header `x-tenant-id` (or query `tenantId`).
  - Session list/create are tenant-scoped (`tenantId` returned in session payload).
  - Configure defaults with `API_DEFAULT_TENANT_ID` and `API_COMPLIANCE_TEMPLATE`.

8. Managed skills registry APIs:
- `GET /v1/skills/index` -> public managed skills index for agent runtime (`managed` source).
- `GET /v1/skills/catalog` -> repo-owned `personas + recipes` catalog, optionally resolved against runtime-active skills via `agentId`.
- `GET /v1/skills/personas` -> curated personas view from `configs/skills.catalog.json` (optional `agentId` for runtime readiness overlay).
- `GET /v1/skills/recipes` -> curated recipes view from `configs/skills.catalog.json` (`agentId`, `personaId`, `intent` filters supported).
- `GET /v1/skills/registry` with `x-operator-role` -> operator catalog view (`limit`, `scope`, `includeDisabled`).
- `GET /v1/skills/registry/{skillId}` with `x-operator-role` -> managed skill detail (`404 API_SKILL_REGISTRY_NOT_FOUND` when absent).
- `GET /v1/skills/registry/{skillId}/updates` with `x-operator-role` -> tenant-scoped upsert audit history for this skill (`limit`, optional `tenantId` for admin).
- `POST /v1/skills/registry` with `x-operator-role: admin` -> versioned upsert (`expectedVersion` for optimistic locking).
- `GET /v1/skills/plugins` with `x-operator-role` -> plugin marketplace view (`limit`, `scope`, `includeDisabled`, `permissions`, `signingStatus=verified|unsigned|none`).
- `GET /v1/skills/plugins/{pluginId}` with `x-operator-role` -> plugin marketplace detail (`404 API_SKILL_PLUGIN_NOT_FOUND` when plugin manifest is missing).
- `GET /v1/skills/plugins/{pluginId}/updates` with `x-operator-role` -> tenant-scoped plugin update history (`skills_registry_upsert`, `limit`, optional `tenantId` for admin).
- `GET /v1/skills/installations` with `x-operator-role` -> tenant-scoped installation workflow view (`agentId`, `includeDisabled`, `limit`, optional `tenantId` for admin).
- `GET /v1/skills/installations/resolve` with `x-operator-role` -> resolved installation state per `agentId` (`ready|skill_not_found|skill_disabled|scope_mismatch|trust_blocked|pinned_version_unavailable`).
- `GET /v1/skills/installations/{agentId}/{skillId}` with `x-operator-role` -> installation detail for one agent/skill pair.
- `GET /v1/skills/installations/{agentId}/{skillId}/updates` with `x-operator-role` -> tenant-scoped installation audit history (`skills_installation_upsert`).
- `POST /v1/skills/installations` with `x-operator-role: admin` -> versioned/idempotent install-update mutation (`expectedVersion`, `idempotencyKey`, `installPolicy=track_latest|pinned`, `pinnedVersion`).
  - Supports plugin marketplace manifest:
    - `pluginManifest.permissions[]` (validated against allowlist).
    - `pluginManifest.signing.{algorithm,keyId,signature}` for `hmac-sha256` verification.
  - Signature validation error contracts: `API_SKILL_PLUGIN_PERMISSION_INVALID`, `API_SKILL_PLUGIN_SIGNATURE_REQUIRED`, `API_SKILL_PLUGIN_SIGNATURE_INVALID`, `API_SKILL_PLUGIN_SIGNING_KEY_NOT_FOUND`.

9. Device node registry APIs:
- `GET /v1/device-nodes/index` -> public device-node index for runtime routing (`limit`, `kind`, `includeOffline`).
- `GET /v1/device-nodes/resolve` -> deterministic node resolver for runtime execution (`nodeId`, `kind`, `platform`, `capabilities`, `minTrustLevel`, `includeOffline`, `includeDegraded`, `limit`).
- `GET /v1/device-nodes` with `x-operator-role` -> operator registry view.
- `GET /v1/device-nodes/{nodeId}` with `x-operator-role` -> device-node detail (`404 API_DEVICE_NODE_NOT_FOUND` when absent).
- `GET /v1/device-nodes/{nodeId}/updates` with `x-operator-role` -> tenant-scoped upsert/heartbeat audit history for this node (`limit`, optional `tenantId` for admin).
- `POST /v1/device-nodes` with `x-operator-role: admin` -> versioned upsert (`expectedVersion` supported).
- `POST /v1/device-nodes/heartbeat` with `x-operator-role: operator|admin` -> update node liveness/status.

9.5 Multi-channel session binding APIs (`T-301` baseline):
- `GET /v1/channels/adapters` -> enabled channel adapters from env (`API_CHANNEL_ADAPTERS`).
- `GET /v1/channels/sessions/index` -> compact index (`adapterId`, `sessionId`, `userId`, `externalUserId`, `limit` filters).
- `GET /v1/channels/sessions` -> full binding records with same filters.
- `GET /v1/channels/sessions/resolve?adapterId=<id>&externalSessionId=<id>` -> resolve external channel session to internal session/user.
- `POST /v1/channels/sessions/bind` -> create/update adapter binding with optimistic versioning (`expectedVersion`) and idempotency key (`idempotencyKey` or `x-idempotency-key`).
- Optional env:
  - `API_CHANNEL_ADAPTERS=webchat,telegram,slack`
  - `API_CHANNEL_ADAPTERS_ALLOW_CUSTOM=true|false`

10. Operator console APIs (RBAC via `x-operator-role: viewer|operator|admin`):
- `GET /v1/operator/summary` -> active tasks, approvals snapshot, service runtime/health summary, execution trace rollup with per-run verification fields (`verificationState`, `verificationFailureClass`, `verificationSummary`, `verifySteps`) on UI runs, judge-facing lifecycle evidence lanes (`skillsRegistryLifecycle`, `pluginMarketplaceLifecycle`, `governancePolicyLifecycle`, `deviceNodeUpdates`, `agentUsage`, `costEstimate`), and consolidated `runtimeDiagnostics` (transport/workflow/sandbox/catalog guardrails + active degradation signals).
- `GET /v1/runtime/diagnostics` (`x-operator-role`) -> standalone consolidated runtime diagnostics snapshot (service coverage, startup probe issues, transport fallback, workflow-store/assistive-router state, ui-executor sandbox posture, and skills-catalog warnings). Optional `agentId` overlays skills runtime readiness for that agent.
- `GET /v1/runtime/workflow-config` (`x-operator-role`) -> operator-facing redacted workflow-store/assistive-router snapshot proxied from orchestrator, with `summary` fields for source, `fingerprint`, last-known-good status, control-plane override state, and `apiKeyConfigured` instead of the raw assistive-router key.
- `POST /v1/runtime/workflow-control-plane-override` (`x-operator-role: admin`) -> apply or clear repo-owned orchestrator workflow overrides through `api-backend`; accepts `workflow`, `rawJson`, or `clear=true`, records redacted audit previews, and returns the same redacted snapshot contract.
- `GET /v1/runtime/bootstrap-status` (`x-operator-role`) -> repo-owned bootstrap doctor snapshot for provider readiness, auth-profile posture, device-node bootstrap readiness, and safe fallback coverage.
- `GET /v1/runtime/auth-profiles` (`x-operator-role`) -> repo-owned auth-profile catalog for runtime-managed credentials, including effective source, active credential, available credential metadata, rotation metadata, and warnings.
- `POST /v1/runtime/auth-profiles/rotate` (`x-operator-role: admin`) -> rotate the active credential for a repo-owned auth profile; records operator audit metadata, persists rotation metadata, and returns the updated profile snapshot.
- `GET /v1/runtime/browser-jobs` (`x-operator-role`) -> operator-facing proxy for repo-owned `ui-executor` background browser worker runtime, including queue counters, workers, and recent jobs for checkpoint/backlog inspection.
- `GET /v1/runtime/browser-jobs/:jobId` (`x-operator-role`) -> load the latest repo-owned browser worker detail, including trace, checkpoints, artifacts, and runtime snapshot for the selected job.
- `POST /v1/runtime/browser-jobs/:jobId/resume|cancel` (`x-operator-role: operator|admin`) -> resume a checkpoint-ready background browser worker or cancel a queued/running job through the operator control plane; actions are audited in operator history.
- Browser worker snapshots also expose a compact replay bundle with target URL, verification posture, screenshot refs, and result/checkpoint artifacts so operators can inspect a UI run without opening raw logs first.
- `GET /v1/runtime/fault-profiles` (`x-operator-role`) -> repo-owned catalog of controlled fault-injection drills (`service`, `category` filters) with expected signals, scenarios, evidence artifacts, and per-profile execution metadata (`activation`, `recovery`, `apiExecutable`).
- `POST /v1/runtime/fault-profiles/execute` (`x-operator-role: admin`) -> plan (`dryRun=true`) or execute (`phase=activation|recovery`) a repo-owned fault profile. Control-plane drills call mapped services directly, request-scoped/operator drills expose repo-owned request or script templates, accept optional `context`, and can return `followUpContext` for chained recovery.
- Demo frontend operator console includes a `Runtime Drill Runner` panel for the same catalog/execute contract, including dry-run planning, live execute, auto-refresh of operator summary after live drills, and `followUpContext` reuse for chained recovery from the UI.
- Demo frontend operator console includes a `Workflow Control Panel` for the same runtime workflow contract, including `Refresh Runtime`, preset assistive-router overrides, JSON apply/clear actions, and redacted `apiKeyConfigured` visibility for operator-safe inspection.
- Demo frontend operator console includes a `Bootstrap Doctor & Auth Profiles` panel for the same runtime bootstrap contract, including `Refresh Doctor`, direct posture inspection, and admin-only auth-profile rotation against `/v1/runtime/bootstrap-status` + `/v1/runtime/auth-profiles`.
- Demo frontend operator console includes a `Browser Worker Control` panel for the same repo-owned browser-worker contract, including `Refresh Runtime`, `Inspect Job`, `Resume Job`, and `Cancel Job` against `/v1/runtime/browser-jobs`, plus raw runtime/job previews for trace and checkpoint review.
- Demo frontend operator summary board also includes a `Workflow Runtime` card and `Workflow` signal tile, mirroring workflow-store override state, fingerprint, last error, assistive-router posture, and the live workflow stage/active role from `summary.runtimeDiagnostics`, including provider/model/budget-policy metadata for non-judged routing adapters.
- Demo frontend operator summary board also includes a `Bootstrap Doctor` card, mirroring `summary.bootstrapDoctor` so provider posture, auth-profile readiness, device-node bootstrap coverage, fallback coverage, and the top blocking check are visible without opening setup panels.
- Demo frontend operator summary board also includes a `Browser Workers` card, mirroring `summary.browserWorkers` so paused checkpoint backlog and latest background job IDs are visible without opening setup panels.
- Demo frontend operator summary board also includes a `Runtime Guardrails` card and `Guardrails` signal tile, mirroring consolidated `runtimeDiagnostics` status, active signals, service coverage, ui-executor sandbox posture, and skills/runtime warnings.
- The `Runtime Guardrails` card now attaches direct recovery CTAs to actionable signals: `Plan Recovery Drill` stages repo-owned fault-profile recovery in `Runtime Drill Runner`, `Open Workflow Clear Path` jumps to `Workflow Control Panel` when the guardrail points at an active orchestrator override, and a `Signal Paths` list keeps multiple active recovery or triage routes visible at once with per-path lifecycle state (`staged`, `planned`, `executed`, `cleared`, `failed`). The same list also restores recent path history from local storage and exposes `Clear Path History` to reset staged/executed evidence on the operator workstation.
  - Session evidence exports now serialize that same trail as `runtimeGuardrailsSignalPaths`, so operator-side recovery history is captured in Markdown/JSON exports instead of living only in browser-local UI state.
  - Repo-generated demo/release artifacts now also serialize the current runtime snapshot as `evidence.runtimeGuardrailsSignalPaths`, so `badge-details.json` and unified release evidence report the active recovery paths without depending on browser-local history.
  - `POST /v1/operator/actions` with:
  - `action=cancel_task` + `taskId`
  - `action=retry_task` + `taskId`
  - `action=failover` + `targetService` + `operation` (`drain|warmup`, admin only)
- Summary response now includes `operatorActions.recent` audit trail for cancel/retry/failover operations (role, outcome, reason, target/task metadata).

10.5 Governance APIs (`T-304.1` + `T-304.2` baseline):
- `GET /v1/governance/tenant` -> resolved tenant context (`tenantId`, source, compliance template).
- `GET /v1/governance/compliance-template` -> active compliance template profile + available templates.
- `GET /v1/governance/retention-policy` -> effective retention policy (template + env overrides).
- `GET /v1/governance/policy` (`x-operator-role: viewer|operator|admin`) -> effective tenant policy; admin can query `tenantId=all` for overrides snapshot.
- `GET /v1/governance/policy/{tenantId}` (`x-operator-role: viewer|operator|admin`) -> tenant override detail (`404 API_GOVERNANCE_POLICY_NOT_FOUND` when override is absent).
- `GET /v1/governance/policy/{tenantId}/updates` (`x-operator-role: viewer|operator|admin`) -> tenant-scoped governance policy mutation history (`update_governance_policy` audit lane).
- `POST /v1/governance/policy` (`x-operator-role: admin`) -> mutate tenant compliance/retention policy with optimistic versioning (`expectedVersion`) + idempotency key (`idempotencyKey` or `x-idempotency-key`); all mutations are audited via `operator_actions`.
- `GET /v1/governance/audit/operator-actions` -> tenant-scoped operator audit stream (`viewer|operator|admin`); non-admin cross-tenant queries are rejected.
- `GET /v1/governance/audit/summary` -> centralized tenant audit dashboard snapshot (operator actions, approvals, sessions, channel bindings). Admin can query `tenantId=all`.

11. Demo frontend includes tabbed panels (`Live Negotiator`, `Storyteller`, `Operator Console`, `Device Nodes`) plus grouped Operator Console accordion lanes with `Collapse All/Expand All` controls.

12. Real Playwright remote-http run (no simulation fallback):
- Install runtime once: `npm i -D playwright && npx playwright install chromium`
- Set env:
  - `UI_NAVIGATOR_EXECUTOR_MODE=remote_http`
  - `UI_NAVIGATOR_EXECUTOR_URL=http://localhost:8090`
  - `UI_EXECUTOR_STRICT_PLAYWRIGHT=true`
  - `UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE=false`
  - Optional runtime sandbox hardening: `UI_EXECUTOR_SANDBOX_MODE=enforce`, `UI_EXECUTOR_SANDBOX_NETWORK_POLICY=allow_list`, `UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS=https://example.com;https://your-demo-host`, `UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH=.sandbox/ui-executor.marker`, `UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION=v1`
- Start services: `npm run dev:ui-executor`, `npm run dev:orchestrator`, `npm run dev:api`, `npm run dev:gateway`, `npm run dev:frontend`.

## Automated Demo E2E

Run a full judge-oriented smoke scenario (translation + negotiation + storyteller with async video jobs + UI approval/reject/approve + UI visual testing report + delegation + WebSocket gateway roundtrip + session/run/user binding checks + WebSocket task-progress contract check + WebSocket interruption signal contract check + WebSocket invalid-envelope error contract check + approvals resume invalid-intent REST contract check with normalized error `API_INVALID_INTENT` + `traceId` + lifecycle status/version/warmup/drain checks + runtime metrics endpoint checks):

```powershell
npm run demo:e2e
```

CI split:

- PR quick gate: `.github/workflows/pr-quality.yml` (`verify:deploy:railway:dry` + build + unit + profile smoke + monitoring validate + `demo:e2e:fast` + policy + badge artifact).
- Full gate on `main/master` + manual dispatch: `.github/workflows/demo-e2e.yml` (includes perf-load policy gate and best-effort badge publish to `gh-pages`).

Fast mode (skip workspace build):

```powershell
npm run demo:e2e:fast
```

`demo:e2e:fast` now follows the active Storyteller runtime media mode by default (`DEMO_E2E_STORYTELLER_MEDIA_MODE` still overrides it when needed) and keeps the UI executor in real Playwright remote-http mode unless you explicitly force simulation in the shell.

Fast mode with built-in full-run retry (demo-only, skips policy/badge/perf gates):

```powershell
npm run demo:e2e:fast:retry
```

Policy validation for generated report:

```powershell
npm run demo:e2e:policy
```

Badge artifact generation:

```powershell
npm run demo:e2e:badge
```

Runtime usage/cost behavior for `demo:e2e` summary:

- By default, `tokensUsed` and `costEstimate` are derived from real scenario request/response payloads (`source=runtime_estimate`).
- Optional explicit override (for accounting alignment in CI/release evidence):
  - `DEMO_E2E_COST_ESTIMATE_JSON`
  - `DEMO_E2E_TOKENS_USED_JSON`
- Runtime cost model knobs (used when JSON override is absent):
  - `DEMO_E2E_COST_INPUT_PER_1K_TOKENS_USD` (default `0.00045`)
  - `DEMO_E2E_COST_OUTPUT_PER_1K_TOKENS_USD` (default `0.00135`)
  - `DEMO_E2E_COST_IMAGEN_PER_ASSET_USD` (default `0.040`)
  - `DEMO_E2E_COST_VEO_PER_JOB_USD` (default `0.120`)
  - `DEMO_E2E_COST_TTS_PER_SEGMENT_USD` (default `0.008`)

Single-command local quality gate (build + unit tests + profile smoke + demo e2e + policy + badge + perf load policy):

```powershell
npm run verify:release
```

Note: `verify:release` reuses the prebuilt workspace and runs `demo:e2e:fast` with `RequestTimeoutSec=45` for stability of long approval-resume paths. The gate also syncs `artifacts/demo-e2e/badge*.json` into `public/demo-e2e/` for runtime badge endpoints.

Strict final pre-submission gate (zero scenario retries allowed):

```powershell
npm run verify:release:strict
```

Strict gate with existing perf artifacts (skip perf rerun):

```powershell
npm run verify:release:strict:skip-perf-run
```

Artifact-only revalidation (no build/test/demo reruns, validates existing artifacts):

```powershell
npm run verify:release:artifact-only
```
This gate requires `artifacts/release-artifact-revalidation/source-run.json` (provenance manifest). The recommended path is `npm run verify:release:artifact:revalidate` or workflow `.github/workflows/release-artifact-revalidation.yml`, both of which generate the manifest automatically. If GitHub API access is unavailable but local evidence was just refreshed, run `npm run verify:release:artifact:refresh-local-source` first.
`verify:release`, `verify:release:strict`, and artifact revalidation flows now also emit unified release evidence inventory files: `artifacts/release-evidence/manifest.json` and `artifacts/release-evidence/manifest.md`.

Local source-run refresh (rebuilds `source-run.json` from current local artifacts without GitHub API calls):

```powershell
npm run verify:release:artifact:refresh-local-source
```
This helper regenerates `artifacts/release-evidence/report.json` first, then writes `artifacts/release-artifact-revalidation/source-run.json` with the current branch guard plus runtime-guardrails/provider snapshots from the refreshed evidence set.

Local artifact-only smoke (self-contained, no GitHub API, generates temp perf + provenance artifacts and runs the real artifact-only gate):

```powershell
npm run verify:release:artifact-only:smoke
```
Strict final variant (enforces strict release policy inside smoke gate):

```powershell
npm run verify:release:artifact-only:smoke:strict
```
Debug variant (keeps generated temp artifacts for inspection):

```powershell
npm run verify:release:artifact-only:smoke:keep-temp
```

Optional CI equivalent for fast sanity (without artifact download): run workflow `.github/workflows/release-artifact-only-smoke.yml` with `strict_final_run=true|false`.
This workflow uploads debug artifacts as `release-artifact-only-smoke-artifacts` (`artifacts/release-artifact-only-smoke/summary.json`, `artifacts/release-artifact-only-smoke/smoke.log`).

Artifact bundle pull + local revalidation (downloads latest successful `demo-e2e`/`release-strict-final` bundle, restores `artifacts/`, then runs artifact-only gate):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-actions-read>"
npm run verify:release:artifact:revalidate
```

If `GITHUB_TOKEN`/`GH_TOKEN` is not set, the helper attempts `gh auth token` (GitHub CLI must be authenticated via `gh auth login`).

Optional local helper flags:
- `-- -SourceRunId <id>` - force specific workflow run.
- `-- -ArtifactName <name>` - force specific artifact bundle name.
- `-- -GithubApiMaxAttempts <n>` - max retry attempts for GitHub API + artifact download calls (default `3`).
- `-- -GithubApiRetryBackoffMs <ms>` - linear backoff base for GitHub API/download retries (default `1200`).
- `-- -MaxSourceRunAgeHours <n>` - maximum source-run age guard in hours (default `168`, `0` disables).
- `-- -AllowAnySourceBranch` - allow source runs outside `main/master` (disabled by default).
- `-- -StrictFinalRun` - enforce strict artifact gate (`scenarioRetriesUsedCount = 0`).
- `-- -PerfGateMode auto|with_perf|without_perf` - explicit local perf gate mode.
- `-- -SkipPerfLoadGate` - legacy alias for `-- -PerfGateMode without_perf` (deprecated).
- `-- -SkipArtifactOnlyGate` - restore artifacts without running release gate.
- Perf gate is auto-skipped when downloaded bundle has no `artifacts/perf-load/*` (for example `pr-quality-artifacts`).
- Helper writes source provenance manifest to `artifacts/release-artifact-revalidation/source-run.json`, including compact runtime-guardrails snapshot fields (`badgeEvidenceRuntimeGuardrailsSignalPathsStatus`, `badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus`, `badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths`, `badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath`), compact provider snapshot fields (`badgeEvidenceProviderUsageStatus`, `badgeEvidenceProviderUsageValidated`, `badgeEvidenceProviderUsageActiveSecondaryProviders`, `badgeEvidenceProviderUsageEntriesCount`, `badgeEvidenceProviderUsagePrimaryEntry`), and optional deploy/publish provenance snapshot fields (`railwayDeploySummary*`, `repoPublishSummary*`) when the downloaded source bundle carries `artifacts/deploy/railway-deploy-summary.json` and/or `artifacts/deploy/repo-publish-summary.json`.
- Local no-network fallback for stale provenance: `npm run verify:release:artifact:refresh-local-source`, then rerun `npm run verify:release:artifact-only`.

Optional faster local pass (skip build):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/release-readiness.ps1 -SkipBuild
```

Single-command local PR-equivalent gate (same checks as `pr-quality.yml`, without perf):

```powershell
npm run verify:pr
```

Note: `verify:pr` uses fast demo mode (`demo:e2e:fast`) with a slightly higher request timeout for CI stability.

Direct mode with explicit thresholds:

```powershell
node ./scripts/demo-e2e-policy-check.mjs --input ./artifacts/demo-e2e/summary.json --output ./artifacts/demo-e2e/policy-check.md --maxGatewayWsRoundTripMs 1800 --minApprovalsRecorded 1 --maxUiApprovalResumeElapsedMs 60000 --minUiApprovalResumeRequestAttempts 1 --maxUiApprovalResumeRequestAttempts 2 --expectedUiAdapterMode remote_http --allowedUiAdapterModes remote_http,simulated --allowedGatewayInterruptEvents live.interrupt.requested,live.bridge.unavailable --allowedTranslationProviders fallback,gemini --allowedVisualComparatorModes fallback_heuristic,gemini_reasoning --allowedStoryMediaModes simulated
```

The script writes a structured report to:

- `artifacts/demo-e2e/summary.json`
- `artifacts/demo-e2e/summary.md`
- `artifacts/demo-e2e/policy-check.md`
- `artifacts/demo-e2e/policy-check.json`
- `artifacts/demo-e2e/badge.json`
- `artifacts/demo-e2e/badge-details.json`

## Performance Load Suite

Run load profile for live-agent translation path, UI navigation execution, and gateway WebSocket replay/dedupe contract:

```powershell
npm run perf:load
```

Fast mode (skip build):

```powershell
npm run perf:load:fast
```

If services are already running, execute raw profile only:

```powershell
npm run perf:profile
```

Validate performance/error-budget policy on generated report:

```powershell
npm run perf:load:policy
```

Default artifacts:

- `artifacts/perf-load/summary.json`
- `artifacts/perf-load/summary.md`
- `artifacts/perf-load/policy-check.json`
- `artifacts/perf-load/policy-check.md`

Example with custom thresholds:

```powershell
node ./scripts/perf-load.mjs --liveIterations 30 --liveConcurrency 6 --uiIterations 30 --uiConcurrency 6 --gatewayReplayIterations 12 --gatewayReplayConcurrency 3 --maxLiveP95Ms 1800 --maxUiP95Ms 25000 --maxGatewayReplayP95Ms 9000 --maxGatewayReplayErrorRatePct 20 --maxAggregateErrorRatePct 10
node ./scripts/perf-load-policy-check.mjs --input ./artifacts/perf-load/summary.json --maxLiveP95Ms 1800 --maxUiP95Ms 25000 --maxGatewayReplayP95Ms 9000 --maxGatewayReplayErrorRatePct 20 --maxAggregateErrorRatePct 10 --requiredUiAdapterMode remote_http
```

## Story Media Worker Runtime

Long-running storyteller media jobs (Veo/Imagen profile) run through dedicated async worker slots with queue visibility, retry budget, and quota-aware scheduling.

- Queue snapshot in story responses: `payload.output.mediaJobs.queue`
- Queue operator endpoint: `GET http://localhost:8082/story/media-jobs/queue`
- Queue metrics are embedded into orchestrator metrics response: `GET http://localhost:8082/metrics` -> `storytellerMediaJobs`
- Story cache snapshot in story responses: `payload.output.generation.cache`
- Story cache endpoints: `GET http://localhost:8082/story/cache` and `POST http://localhost:8082/story/cache/purge?reason=<reason>`
- Story cache metrics are embedded into orchestrator metrics response: `GET http://localhost:8082/metrics` -> `storytellerCache`

Worker runtime knobs:

- `STORYTELLER_MEDIA_WORKER_ENABLED` (default: `true`)
- `STORYTELLER_MEDIA_WORKER_CONCURRENCY` (default: `2`)
- `STORYTELLER_MEDIA_WORKER_POLL_MS` (default: `120`)
- `STORYTELLER_MEDIA_JOB_MAX_ATTEMPTS` (default: `3`)
- `STORYTELLER_MEDIA_JOB_RETRY_BASE_MS` (default: `800`)
- `STORYTELLER_MEDIA_JOB_RETRY_MAX_MS` (default: `20000`)
- `STORYTELLER_MEDIA_QUOTA_RULES` (default: `veo-3.1=1/1000,imagen-4=2/1000,*=2/1000`)
- `STORYTELLER_CACHE_ENABLED` (default: `true`)
- `STORYTELLER_CACHE_MAX_ENTRIES` (default: `600`)
- `STORYTELLER_CACHE_TTL_MS` (default: `1800000`)
- `STORYTELLER_CACHE_VERSION` (default: `story-cache-v1`)
- `STORYTELLER_CACHE_PURGE_TOKEN` (default: unset; changing token invalidates cache policy)

## Runtime Profiles

Runtime guardrails use `APP_ENV` + profile flags:

- `APP_ENV=dev|staging|prod` (default resolves to `dev`)
- `RUNTIME_PROFILE=standard|local-first` or `LOCAL_FIRST_PROFILE=true`
- `local-first` is blocked outside `APP_ENV=dev`

Profile smoke checks:

```powershell
npm run profile:smoke
```

Full profile matrix and disabled features: `docs/local-first-profile.md`.

### Status Badge Template (Shields Endpoint)

When `badge.json` is published at a static URL (for example GitHub Pages or gist raw), use:

```text
https://img.shields.io/endpoint?url=<URL_TO_BADGE_JSON>
```

This repository workflow auto-publishes badge files to `gh-pages` on pushes to `main`/`master`:

```text
https://<OWNER>.github.io/<REPO>/demo-e2e/badge.json
```

Shields endpoint template for that path:

```text
https://img.shields.io/endpoint?url=https%3A%2F%2F<OWNER>.github.io%2F<REPO>%2Fdemo-e2e%2Fbadge.json
```

GitHub Pages setup (one-time):

1. Open repository `Settings -> Pages`.
2. Set `Build and deployment` to `Deploy from a branch`.
3. Select branch `gh-pages` and folder `/ (root)`.

Or via GitHub API (scripted):

```powershell
$env:GITHUB_OWNER="<owner>"
$env:GITHUB_REPO="<repo>"
$env:GITHUB_TOKEN="<token-with-repo-pages-permissions>"
npm run badge:pages:enable
```

Endpoint validation:

```powershell
$env:GITHUB_OWNER="<owner>"
$env:GITHUB_REPO="<repo>"
npm run badge:pages:check
```

Runtime public endpoint validation (GCP-first for submission, Railway mirror optional):

```powershell
npm run badge:public:check
```

By default, `badge:public:check` is strict and requires judge-facing evidence blocks to report `status=pass`.
Use `-- -AllowFailingEvidence` only for schema/debug checks when you intentionally do not want deployment gating.

Optional endpoint overrides:

```powershell
$env:PUBLIC_BADGE_ENDPOINT="https://<host>/demo-e2e/badge.json"
$env:PUBLIC_BADGE_DETAILS_ENDPOINT="https://<host>/demo-e2e/badge-details.json"
# or set base host only:
$env:RAILWAY_PUBLIC_URL="https://<host>"
# optional: expose demo frontend URL in gateway root descriptor (`GET /`)
$env:DEMO_FRONTEND_PUBLIC_URL="https://<demo-frontend-host>"
npm run badge:public:check
```

`badge-details.json` includes judge-facing operator evidence snapshots:
- `costEstimate` (`currency`, `geminiLiveUsd`, `imagenUsd`, `veoUsd`, `ttsUsd`, `totalUsd`, `source`)
- `tokensUsed` (`input`, `output`, `total`, `source`)
- `providerUsage` (`status`, `validated`, `activeSecondaryProviders`, `entries[]`) for adapter provenance such as storyteller `tts` provider/model selection, optional `image_edit` continuity passes, and live-agent `research` provenance with citation/source-url counts
- `evidence.operatorTurnTruncation`
- `evidence.operatorTurnDelete`
- `evidence.damageControl`
- `evidence.runtimeGuardrailsSignalPaths` (`summaryStatus`, `signalsSummary`, `coverageSummary`, `sandboxSummary`, `skillsSummary`, `topSignal`, `historyStatus`, `primaryPath`, `paths`)
- `evidence.operatorDamageControl`
- `evidence.governancePolicy`
- `evidence.skillsRegistry`
- `evidence.pluginMarketplace`
- `evidence.deviceNodes`
- `evidence.agentUsage`

## Repository Publish Automation

Publish flow script (git init/commit/push + optional Pages + optional badge polling):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:GITHUB_TOKEN="<token-with-repo-pages-permissions>"
npm run repo:publish
```

By default `repo:publish` runs pre-publish release verification (`npm run verify:release`). For strict final publishing, use `-StrictReleaseVerification`.
If `origin` already points to the same GitHub repository with a different URL format (SSH vs HTTPS), `repo:publish` now treats it as equivalent and continues without `-ForceRemoteUpdate`.
When `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` are present, repo publish also exports `repo_publish_summary_path`, verification/deploy flags, and a short publish provenance summary for automation consumers.

Publish + deploy to Railway in one command:

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
$env:RAILWAY_PROJECT_ID="bbca2889-fd0d-48fe-bded-79802230e5a6"
$env:RAILWAY_SERVICE_ID="b8c1a952-da24-4410-a53a-82b634b70f47"
$env:RAILWAY_ENVIRONMENT="production"
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck
```

Publish + deploy to Railway with explicit post-deploy badge check controls:

```powershell
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck -RailwayPublicUrl https://live-agent-production.up.railway.app -RailwayPublicBadgeCheckTimeoutSec 30
```

Trigger-only Railway deploy (no wait + no post-deploy badge check):

```powershell
npm run repo:publish -- -DeployRailway -SkipPages -SkipBadgeCheck -RailwayNoWait -RailwaySkipPublicBadgeCheck
```

Publish + deploy gateway and frontend Railway services in one command:

```powershell
npm run repo:publish -- -DeployRailway -DeployRailwayFrontend -SkipPages -SkipBadgeCheck -RailwayPublicUrl https://live-agent-production.up.railway.app -RailwayFrontendService "Live-Agent-Frontend"
```

When `-DeployRailwayFrontend` is enabled and frontend URLs are not passed explicitly, `repo:publish` derives:
- `FRONTEND_API_BASE_URL` from `-RailwayPublicUrl` (recommended override: `-RailwayFrontendApiBaseUrl <api-backend-url>`)
- `FRONTEND_WS_URL` as `<ws(s)://host>/realtime`

Safe dry-run style (no push/pages/badge):

```powershell
npm run repo:publish -- -Owner Web-pixel-creator -Repo Live-Agent -SkipPush -SkipPages -SkipBadgeCheck
```

Preflight validation without creating `.git`:

```powershell
npm run repo:publish -- -Owner Web-pixel-creator -Repo Live-Agent -SkipGitInit -SkipPush -SkipPages -SkipBadgeCheck
```

Workflow badge (GitHub Actions):

```text
https://github.com/<OWNER>/<REPO>/actions/workflows/demo-e2e.yml/badge.svg
```

Useful flags:

- `-SkipServiceStart` - do not start local services (use already running endpoints).
- `-IncludeFrontend` - also start `demo-frontend` and health-check it.
- `-KeepServices` - keep script-started services running after completion.
- `-OutputPath <path>` - custom report output path.
- `-SkipReleaseVerification` - skip pre-publish release verification (`verify:release`).
- `-StrictReleaseVerification` - use strict pre-publish gate (`verify:release:strict`).
- `-DeployRailway` - trigger Railway deploy after publish (calls `scripts/railway-deploy.ps1` with `-SkipReleaseVerification`).
- `-RailwayProjectId` / `-RailwayServiceId` / `-RailwayEnvironment` / `-RailwayWorkspace` - Railway target overrides.
- `-RailwaySkipLink` - skip `railway link` step and use existing linked service.
- `-RailwaySkipRootDescriptorCheck` - skip Railway post-deploy gateway root descriptor check (`GET /`).
- `-RailwaySkipPublicBadgeCheck` - skip Railway post-deploy public badge endpoint validation.
- `-RailwayPublicBadgeEndpoint` / `-RailwayPublicBadgeDetailsEndpoint` - override Railway public badge endpoints passed to deploy helper.
- `-RailwayPublicUrl` - Railway public base URL override passed to deploy helper (`/demo-e2e/badge*.json`).
- `-RailwayDemoFrontendPublicUrl` - expected frontend public URL passed to gateway root descriptor validation (`uiUrl`).
- `-RailwayRootDescriptorCheckMaxAttempts <n>` - max retry attempts for gateway root descriptor check inside `repo:publish -> railway-deploy`.
- `-RailwayRootDescriptorCheckRetryBackoffSec <n>` - retry backoff (seconds) for gateway root descriptor check inside `repo:publish -> railway-deploy`.
- `-RailwayPublicBadgeCheckTimeoutSec` - timeout (seconds) for Railway post-deploy public badge endpoint checks.
- `-RailwayNoWait` - return after deploy trigger without waiting for terminal Railway status.
- `-DeployRailwayFrontend` - trigger Railway frontend deploy after publish (calls `scripts/railway-deploy-frontend.ps1`).
- `-RailwayFrontendProjectId` / `-RailwayFrontendService` / `-RailwayFrontendEnvironment` / `-RailwayFrontendPath` - frontend deploy target/path overrides.
- `-RailwayFrontendWsUrl` / `-RailwayFrontendApiBaseUrl` - explicit frontend runtime endpoints (`FRONTEND_WS_URL` / `FRONTEND_API_BASE_URL`).
- `-RailwayFrontendNoWait` - trigger frontend deploy without waiting for terminal status.
- `-RailwayFrontendSkipHealthCheck` - skip frontend `/healthz` check after successful deploy.
- `-RailwayFrontendHealthCheckTimeoutSec` - frontend `/healthz` timeout override.

## Railway Deploy Automation

Deploy current workspace to a linked Railway service:

```powershell
$env:RAILWAY_PROJECT_ID="bbca2889-fd0d-48fe-bded-79802230e5a6"
$env:RAILWAY_SERVICE_ID="b8c1a952-da24-4410-a53a-82b634b70f47"
$env:RAILWAY_ENVIRONMENT="production"
npm run deploy:railway
```

Deploy gateway + frontend in one command:

```powershell
npm run deploy:railway:all -- -ProjectId "bbca2889-fd0d-48fe-bded-79802230e5a6" -GatewayServiceId "b8c1a952-da24-4410-a53a-82b634b70f47" -FrontendService "Live-Agent-Frontend" -Environment production -SkipReleaseVerification -GatewayPublicUrl https://live-agent-production.up.railway.app -FrontendApiBaseUrl https://live-agent-api-production.up.railway.app
```

Dispatch `railway-deploy-all.yml` workflow from local CLI (with optional wait for completion):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run deploy:railway:all:dispatch -- -Environment production -GatewayPublicUrl https://live-agent-production.up.railway.app -SkipReleaseVerification
```

`deploy:railway:all:dispatch` auth uses `-Token`, then `GITHUB_TOKEN`/`GH_TOKEN`, then fallback `gh auth token`.

Behavior:

- Runs release verification before deploy (`verify:release` by default).
- Railway deploy helper now stages uploads from a temporary clean git worktree, so local `.tmp/`, `output/`, `_external/`, and other untracked artifacts do not bloat or break the upload.
- When the target service resolves to `Live-Agent-Orchestrator`, the helper automatically applies the service-specific manifest template from `infra/railway/manifests/orchestrator.railway.json` so the service keeps the orchestrator start command instead of falling back to the root gateway manifest.
- repo publish surfaces local release-evidence report/manifest paths after pre-publish verification so the validated artifact set is explicit before any push/deploy step.
- repo publish also emits `artifacts/deploy/repo-publish-summary.json` with the verified artifact set and enabled publish/deploy steps.
- In automation contexts, repo publish also writes `repo_publish_summary_path` and related provenance flags to `GITHUB_OUTPUT`, and appends the same high-level state to `GITHUB_STEP_SUMMARY`.
- Runs auth preflight (`railway whoami`) before deploy; if `RAILWAY_API_TOKEN` is empty and `RAILWAY_TOKEN` is set, helper scripts mirror `RAILWAY_TOKEN -> RAILWAY_API_TOKEN` for CLI compatibility. If account-scope auth probe fails but `RAILWAY_TOKEN` is present, helper scripts continue in project-token mode for project-scoped Railway CLI commands.
- Links local directory to Railway project/service when both `-ProjectId` and `-ServiceId` are provided.
- If `-ProjectId/-ServiceId` are omitted, reuses existing Railway linked context for this workspace.
- Triggers deployment (`railway up`) and waits until terminal status.
- Uses `railway.json` config-as-code to pin Railway runtime start command (`node --import tsx apps/realtime-gateway/src/index.ts`) for workspace TypeScript imports.
- Prints effective runtime metadata after successful deploy (`start command`, `config-as-code source`, `effective public URL`).
- `GET /` on Railway returns gateway service descriptor JSON (health/status/metrics/ws/badge links). Interactive UI (`demo-frontend`) is deployed separately.
- Runs gateway root descriptor check (`GET /`) after successful deploy.
  - Root descriptor check retries automatically (`-RootDescriptorCheckMaxAttempts`, `-RootDescriptorCheckRetryBackoffSec`) to tolerate transient post-rollout warmup failures.
  - When `-DemoFrontendPublicUrl` is provided, deploy helper also updates Railway gateway variable `DEMO_FRONTEND_PUBLIC_URL` (`--skip-deploys`) before rollout so root descriptor returns `uiUrl`.
  - If `-DemoFrontendPublicUrl` is omitted and `FRONTEND_PUBLIC_URL` is set, combined helper auto-uses `FRONTEND_PUBLIC_URL` as gateway `uiUrl` contract target.
- Runs post-deploy public badge endpoint check (`badge:public:check` helper logic) after successful deploy.
- Railway deploy helper prints effective public badge and badge-details URLs after successful verification so the verified hosted evidence endpoints are explicit in the deploy log.
- Railway deploy helper also emits `artifacts/deploy/railway-deploy-summary.json` with deployment id, effective public URL, and root-descriptor/badge verification posture.
- In `-- -NoWait` mode, post-deploy gateway root descriptor and badge endpoint checks are not executed (trigger-only flow).

Fast contract-only dry gate for Railway deploy/repo-publish wiring:

```powershell
npm run verify:deploy:railway:dry
```

Common flags:

- `-- -StrictReleaseVerification` - use strict pre-deploy gate (`verify:release:strict`).
- `-- -SkipReleaseVerification` - skip local verification before deploy.
- `-- -ProjectId <id> -- -ServiceId <id>` - explicit Railway link target override for current run (must be provided as a pair).
- `-- -SkipRootDescriptorCheck` - skip post-deploy gateway root descriptor check.
- `-- -RootDescriptorCheckMaxAttempts <n>` - max retry attempts for root descriptor check (default `3`).
- `-- -RootDescriptorCheckRetryBackoffSec <n>` - retry backoff in seconds for root descriptor check (default `2`).
- `-- -SkipPublicBadgeCheck` - skip post-deploy public badge endpoint check.
- `-- -DemoFrontendPublicUrl <url>` - expected demo frontend URL for root descriptor validation (`uiUrl` contract) and auto-sync to gateway runtime variable `DEMO_FRONTEND_PUBLIC_URL`.
- `FRONTEND_PUBLIC_URL` env/variable can serve as fallback source for `-DemoFrontendPublicUrl` in combined helper/workflow dispatch.
- `-- -SkipFailureLogs` - do not auto-fetch Railway build/deployment logs when deploy fails or times out.
- `-- -SkipLink` - deploy using already linked Railway service.
- `-- -NoWait` - return immediately after deploy trigger.
- `-- -FailureLogLines <n>` - number of lines to fetch for failure diagnostics (`120` by default).
- `-- -PublicBadgeEndpoint <url>` / `-- -PublicBadgeDetailsEndpoint <url>` - override public badge endpoints.
- `-- -RailwayPublicUrl <url>` - set base URL used by badge checker (`/demo-e2e/badge*.json`).
- Combined helper (`deploy:railway:all`) forwards gateway flags (`-SkipReleaseVerification`, `-StrictReleaseVerification`, `-GatewaySkipLink`, `-GatewaySkipRootDescriptorCheck`, `-GatewaySkipPublicBadgeCheck`, `-GatewayNoWait`, `-GatewayDemoFrontendPublicUrl`, `-GatewayRootDescriptorCheckMaxAttempts`, `-GatewayRootDescriptorCheckRetryBackoffSec`) and frontend flags (`-FrontendNoWait`, `-FrontendSkipHealthCheck`), and derives frontend runtime URLs from `-GatewayPublicUrl` when explicit frontend URLs are not set.

## Railway Frontend Service

Public demo frontend URL:

```text
https://live-agent-frontend-production.up.railway.app
```

Deploy `apps/demo-frontend` as a standalone Railway service:

```powershell
railway up apps/demo-frontend --path-as-root -s "Live-Agent-Frontend" -e production -p "bbca2889-fd0d-48fe-bded-79802230e5a6" -d
```

Or deploy via helper script:

```powershell
npm run deploy:railway:frontend -- -Service "Live-Agent-Frontend" -Environment production -ProjectId "bbca2889-fd0d-48fe-bded-79802230e5a6"
```

Recommended frontend runtime variables for this project:

```powershell
railway variable set -s "Live-Agent-Frontend" -e production --skip-deploys "FRONTEND_WS_URL=wss://live-agent-production.up.railway.app/realtime"
railway variable set -s "Live-Agent-Frontend" -e production --skip-deploys "FRONTEND_API_BASE_URL=https://live-agent-api-production.up.railway.app"
```

Notes:

- Frontend serves `GET /config.json` and applies `FRONTEND_WS_URL` / `FRONTEND_API_BASE_URL` at bootstrap.
- Frontend service health endpoint: `GET /healthz`.
- Frontend service config-as-code is at `apps/demo-frontend/railway.json`.
- Helper flags: `-NoWait`, `-SkipHealthCheck`, `-StatusPollMaxAttempts`, `-StatusPollIntervalSec`.

## Railway API Backend Service

Deploy `apps/api-backend` as a standalone Railway service:

```powershell
railway up apps/api-backend --path-as-root -s "Live-Agent-API" -e production -p "bbca2889-fd0d-48fe-bded-79802230e5a6" -d
```

Recommended API runtime variables:

```powershell
railway variable set -s "Live-Agent-API" -e production --skip-deploys "API_CORS_ALLOWED_ORIGINS=https://live-agent-frontend-production.up.railway.app"
```

Notes:

- API service config-as-code is at `apps/api-backend/railway.json`.
- API service health endpoint: `GET /healthz`.
- Frontend should point `FRONTEND_API_BASE_URL` to this API service URL, not to gateway URL.

## CI Workflow

- PR workflow: `.github/workflows/pr-quality.yml`
- Triggered on pull requests.
- Runs `npm run verify:deploy:railway:dry` (deploy/repo-publish contract checks) before `npm run verify:pr` (build + unit + profile smoke + monitoring validate + demo policy/badge gate).
- Uploads demo artifacts for PR review.

- Railway combined deploy workflow: `.github/workflows/railway-deploy-all.yml`
- Triggered manually (`workflow_dispatch`) to deploy `gateway + frontend` via `npm run deploy:railway:all`.
- Required repository secrets:
  - `RAILWAY_API_TOKEN` (recommended: workspace/account token)
  - `RAILWAY_TOKEN` (legacy fallback; still supported)
  - optional `RAILWAY_PROJECT_TOKEN` (if you want explicit project-token auth path)
  - `RAILWAY_PROJECT_ID`
  - `RAILWAY_SERVICE_ID`
  - optional `RAILWAY_FRONTEND_SERVICE_ID` (if omitted, helper default service name is used).
- Auth-resilience: workflow probes `railway whoami` first; if auth fails and `verify_only_fallback_on_auth_failure=true` (default), it runs verify-only checks (`badge:public:check` + frontend `/healthz`) instead of hard-failing deploy stage.
- Optional repository variable: `FRONTEND_PUBLIC_URL` (used by verify-only fallback frontend health check; default fallback URL is `https://live-agent-frontend-production.up.railway.app`).
- Job summary also surfaces `artifacts/deploy/railway-deploy-summary.json` when a real gateway deploy emits it, and the workflow uploads the same file as artifact bundle `railway-deploy-all-artifacts`.

- Full workflow: `.github/workflows/demo-e2e.yml`
- Triggered on push to `main`/`master` and manual dispatch.
- Runs unit/profile/monitoring/demo policy gates plus perf-load policy gate.
- Publishes public badge endpoint files (`demo-e2e/badge.json`) to `gh-pages` on `main`/`master`.
- Publishes `summary.md` into GitHub Job Summary for quick review.
- Uploads:
  - `artifacts/demo-e2e/summary.json`
  - `artifacts/demo-e2e/summary.md`
  - `artifacts/demo-e2e/policy-check.md`
  - `artifacts/demo-e2e/policy-check.json`
  - `artifacts/demo-e2e/badge.json`
  - `artifacts/demo-e2e/badge-details.json`
  - `artifacts/demo-e2e/logs`
  - `artifacts/perf-load/summary.json`
  - `artifacts/perf-load/summary.md`
  - `artifacts/perf-load/policy-check.json`
  - `artifacts/perf-load/policy-check.md`
  - `artifacts/perf-load/logs`

- Strict final release workflow: `.github/workflows/release-strict-final.yml`
- Triggered on push to `main`/`master` and manual dispatch.
- Runs `npm run verify:release:strict` (`-StrictFinalRun`) and uploads consolidated release artifacts bundle.
- Manual dispatch supports optional deploy to Railway (`deploy_to_railway=true`) after strict gate passes using `npm run deploy:railway:all`.
- For release-triggered deploy, configure repository secrets: `RAILWAY_API_TOKEN` (recommended), `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID` (optional `RAILWAY_FRONTEND_SERVICE_ID`; legacy fallback `RAILWAY_TOKEN`; optional `RAILWAY_PROJECT_TOKEN`).
- Same auth-resilience path is enabled for strict manual deploys: `verify_only_fallback_on_auth_failure=true` triggers verify-only public endpoint checks when Railway auth probe fails.
- Job summary includes strict badge evidence statuses from unified report `artifacts/release-evidence/report.json`: `operatorTurnTruncation`, `operatorTurnDelete`, `operatorDamageControl`, `governancePolicy`, `skillsRegistry`, `pluginMarketplace`, `deviceNodes`, `agentUsage`, `runtimeGuardrailsSignalPaths`, `providerUsage`, and derived updates-lane signal `deviceNodeUpdatesStatus`.
- When the strict workflow also performs a real Railway deploy, job summary surfaces `artifacts/deploy/railway-deploy-summary.json` fields (`status`, `deploymentId`, `effectivePublicUrl`, `badgeEndpoint`, `badgeDetailsEndpoint`) and the uploaded bundle includes that artifact.
- Strict workflow also builds unified release evidence artifacts:
  - `artifacts/release-evidence/report.json`
  - `artifacts/release-evidence/report.md`

Local helper to dispatch the same strict workflow (and optionally wait for completion):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run release:strict:dispatch -- -DeployToRailway -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app
```

Helper auth uses `-Token`, then `GITHUB_TOKEN`/`GH_TOKEN`, then fallback `gh auth token`.

Unified local dispatch entrypoint (single command for both workflow families):

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run workflow:dispatch -- -Workflow railway_deploy_all -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app -SkipReleaseVerification
```

```powershell
$env:GITHUB_OWNER="Web-pixel-creator"
$env:GITHUB_REPO="Live-Agent"
npm run workflow:dispatch -- -Workflow release_strict -DeployToRailway -RailwayEnvironment production -GatewayPublicUrl https://live-agent-production.up.railway.app
```

Optional cross-workflow override: `-GatewayDemoFrontendPublicUrl https://live-agent-frontend-production.up.railway.app` (propagates to deploy helper root-descriptor `uiUrl` validation).
Optional root-descriptor retry overrides: `-GatewayRootDescriptorCheckMaxAttempts 5 -GatewayRootDescriptorCheckRetryBackoffSec 3` (propagates through dispatch helpers into workflow inputs and `deploy:railway:all` gateway checks).

Use `-DryRun` to validate argument routing without dispatching workflows:

```powershell
npm run workflow:dispatch -- -Workflow railway_deploy_all -DryRun
```

- Artifact-only release revalidation workflow: `.github/workflows/release-artifact-revalidation.yml`
- Triggered on manual dispatch.
- Resolves latest successful `demo-e2e`/`release-strict-final` run (or uses provided `source_run_id`), downloads artifact bundle, and runs artifact-only release gate.
- Supports manual `workflow_dispatch` inputs:
  - `perf_gate_mode=auto|with_perf|without_perf` for explicit operator control of perf validation behavior.
  - `strict_final_run=true|false` to enforce strict artifact gate (`-StrictFinalRun`).
  - `github_api_max_attempts=<int>=3` for bounded retry count on workflow GitHub API/download operations.
  - `github_api_retry_backoff_ms=<int>=1200` for linear retry backoff on workflow GitHub API/download operations.
  - `max_source_run_age_hours=<int>=168` to block stale source runs (`0` disables age guard).
  - `allow_any_source_branch=true|false` to allow non-`main/master` source runs (default `false`).
- Workflow auto-detects presence of `artifacts/perf-load/*`: with perf artifacts it runs `npm run verify:release:artifact-only`; without perf artifacts (for example `pr-quality-artifacts`) it runs `release-readiness.ps1` with `-SkipPerfLoad`.
- Workflow writes source provenance manifest to `artifacts/release-artifact-revalidation/source-run.json` and includes the path in job summary.
- Job summary includes badge evidence statuses for `operatorTurnTruncation`, `operatorTurnDelete`, `operatorDamageControl`, `governancePolicy`, `skillsRegistry`, `pluginMarketplace`, `deviceNodes`, `agentUsage`, `runtimeGuardrailsSignalPaths`, `providerUsage`, and derived updates-lane signal `deviceNodeUpdatesStatus` from unified report `artifacts/release-evidence/report.json`; the same summary also surfaces optional `railway-deploy-summary` / `repo-publish-summary` provenance when those files are present in the downloaded artifact bundle.
- Upload bundle now preserves optional deploy provenance artifacts `artifacts/deploy/railway-deploy-summary.json` and `artifacts/deploy/repo-publish-summary.json` alongside release evidence and `source-run.json`.
- Artifact revalidation also builds unified release evidence artifacts:
  - `artifacts/release-evidence/report.json`
  - `artifacts/release-evidence/report.md`
- Local equivalent helper: `npm run verify:release:artifact:revalidate` (uses `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN` or `GH_TOKEN`, then falls back to `gh auth token`; enforces `main/master` + source-run age guard by default, supports strict mode and auto-skip for missing perf artifacts).

## PR Gate

- PR template: `.github/pull_request_template.md`
- Includes a demo-readiness checklist aligned with e2e KPIs and artifacts.

## Challenge Runbook

- Walkthrough + interruption checkpoints + stage fallback steps:
  - `docs/challenge-demo-runbook.md`

## Lifecycle Endpoints

- Implemented on `realtime-gateway`, `api-backend`, and `orchestrator`:
  - `GET /healthz`
  - `GET /status`
  - `GET /version`
  - `POST /drain`
  - `POST /warmup`
- `POST /drain` switches service to draining mode (rejects new business requests).
- `POST /warmup` returns service back to ready mode.

## Metrics Endpoints

- Implemented on `realtime-gateway`, `api-backend`, and `orchestrator`:
  - `GET /metrics`
- Metrics include:
  - request counts and error rate
  - latency summary (`min/max/avg/p50/p95/p99`)
  - per-operation breakdown (top operations)

## Capability Adapter Boundary

- Capability contracts are centralized in `@mla/capabilities` (`shared/capabilities`):
  - `live`
  - `reasoning`
  - `tts`
  - `image`
  - `image_edit`
  - `video`
  - `computer_use`
  - `research`
- Default Gemini/Google adapters are wired in:
- `agents/live-agent` (`live` + `reasoning` + `research`)
- `agents/storyteller-agent` (`reasoning` + `image` + `image_edit` + `video` + `tts`)
  - `agents/ui-navigator-agent` (`reasoning` + `computer_use`)
- Secondary-provider lanes are adapter-ready: storyteller `tts` exposes Gemini-first selection with Deepgram fallback metadata, storyteller `image_edit` exposes repo-owned fal continuity-pass metadata, and live-agent `research` exposes repo-owned Perplexity Sonar-style answer/citation provenance.
- Each orchestrator response now carries adapter `capabilityProfile` for audit/debug, and demo policy checks enforce `kpi.capabilityAdaptersValidated=true`.

## Task Registry Endpoints

- Realtime gateway exposes active task state:
  - `GET /tasks/active?sessionId=<id>&limit=50`
  - `GET /tasks/<taskId>`
- Task lifecycle events are streamed in websocket channel:
  - `task.started`
  - `task.progress`
  - `task.completed`
  - `task.failed`

## Session State Transitions

- Realtime gateway streams explicit `session.state` events for frontend state visibility:
  - `socket_connected`
  - `session_bound`
  - `orchestrator_dispatching`
  - `orchestrator_pending_approval`
  - `orchestrator_completed`
  - `orchestrator_failed`
  - `text_fallback`
- Transition payload includes previous state and connection metadata, and envelopes include correlation context (`userId`, `sessionId`, `runId`).

## Error Contract

- REST errors are normalized as:
  - `{ "ok": false, "error": { "code": "...", "message": "...", "traceId": "...", "details": { ... } } }`
- WebSocket gateway errors use the same normalized payload in `gateway.error` envelopes.

## Day-1 Infra Bootstrap

1. Baseline GCP setup (APIs, IAM, service accounts, secrets):
```powershell
pwsh ./infra/gcp/bootstrap.ps1 -ProjectId "<your-project-id>"
```

2. Firestore indexes + TTL policies:
```powershell
pwsh ./infra/firestore/apply.ps1 -ProjectId "<your-project-id>"
```

## Notes

This scaffold is intentionally minimal and is designed to be expanded by implementing:

1. Live API integrations
2. Firestore persistence adapters
3. Vertex AI agent runtime wiring
4. Tool execution and approval workflows
