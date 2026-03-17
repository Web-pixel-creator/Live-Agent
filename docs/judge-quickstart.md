# Judge Quickstart

## Purpose

Fast, judge-facing entry point for a 5-10 minute evaluation run.

This project covers all three challenge categories in one platform:

1. Live Agent (realtime speech, interruption, translation, negotiation, grounded research)
2. Creative Storyteller (text + audio + image + video narrative flow)
3. UI Navigator (computer-use style UI planning/execution with approval guardrails)

Primary submission path is `GCP-first`: Cloud Run for `orchestrator`, `realtime-gateway`, and `api-backend`, Firestore enabled, analytics rows in BigQuery, and observability screenshots captured from the GCP baseline. Local stack remains the fastest debug fallback.

## 1) Deploy GCP Judge Runtime (Primary Submission Path)

Prerequisites:

1. Install Google Cloud SDK (`gcloud`) and BigQuery CLI (`bq`).
2. Authenticate with a project where you can enable `Cloud Run`, `Artifact Registry`, `Cloud Build`, `Firestore`, and `BigQuery`.
3. Keep repo-local `.env` populated with Gemini credentials, or pass keys explicitly to the wrapper. `prepare-judge-runtime.ps1` now syncs runtime secrets into Secret Manager and builds the three Cloud Run images into Artifact Registry before deploy.
3. Capture dashboard and alert screenshots into `artifacts/judge-visual-evidence/screenshots`.

One-shot path:

```powershell
pwsh ./infra/gcp/prepare-judge-runtime.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -FirestoreLocation "nam5" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

This wrapper now performs:

1. `bootstrap.ps1`
2. `ensure-firestore.ps1`
3. `setup-observability.ps1`
4. `sync-runtime-secrets.ps1`
5. `build-cloud-run-images.ps1`
6. `deploy-cloud-run.ps1`
7. proof/evidence collection

Then regenerate the judged evidence pack with the GCP-first wrapper:

```powershell
pwsh ./infra/gcp/refresh-submission-pack.ps1 -ProjectId "<your-project-id>" `
  -Region "us-central1" `
  -DatasetId "agent_analytics" `
  -ImageTag "<release-tag>"
```

`refresh-submission-pack.ps1` reuses `prepare-judge-runtime`, resolves `GOOGLE_GENAI_API_KEY`, `LIVE_API_API_KEY`, and `LIVE_API_AUTH_HEADER` from env, repo-local `.env`, or Secret Manager when available, blanks Moonshot-only judged overrides, reruns `demo/policy/badge`, refreshes local provenance, and rewrites judge visual pack artifacts. The wrapper uses the same demo retry/restart posture as `verify:release` and injects Storyteller media timeout knobs into the judged run. If `.env` only contains Gemini-style keys, the wrapper reuses that key for `LIVE_API_API_KEY` and defaults `LIVE_API_AUTH_HEADER` to `x-goog-api-key`. If `gcloud` is unavailable in the current shell, you can still pass `-GoogleGenAiApiKey`, `-LiveApiApiKey`, and `-LiveApiAuthHeader` explicitly.

Primary proof artifacts:

1. `artifacts/deploy/gcp-cloud-run-summary.json`
2. `artifacts/deploy/gcp-firestore-summary.json`
3. `artifacts/observability/observability-evidence-summary.json`
4. `artifacts/release-evidence/gcp-runtime-proof.json`
5. `artifacts/release-evidence/gcp-runtime-proof.md`
6. `artifacts/release-evidence/submission-refresh-status.json`
7. `artifacts/release-evidence/submission-refresh-status.md`

Submission-safe judged refresh criteria:

1. `artifacts/demo-e2e/summary.json` reports `liveApiEnabled=true`.
2. Submission scenarios do not report `translationProvider=fallback`.
3. Submission scenarios do not report `storytellerMediaMode=simulated`.
4. Submission scenarios do not report `uiExecutorForceSimulation=true`.

If runtime code changed, rerun `pwsh ./infra/gcp/refresh-submission-pack.ps1 ...` after the GCP deploy so `artifacts/demo-e2e/summary.json` is no longer stale relative to the deployed build.
If `verify:release:artifact-only` later reports stale provenance and GitHub API access is unavailable, rebuild `artifacts/release-artifact-revalidation/source-run.json` locally first:
```powershell
npm run verify:release:artifact:refresh-local-source
npm run verify:release:artifact-only
```

## 2) Start Local Demo Stack

```bash
npm install
npm run dev:orchestrator
npm run dev:gateway
npm run dev:api
npm run dev:ui-executor
npm run dev:frontend
```

Open: `http://localhost:3000`

## 3) Run Judge-Evidence Automation

One-command pipeline:

```bash
npm run demo:epic
```

Or run explicit steps:

```bash
npm run demo:e2e:fast
npm run demo:e2e:policy
npm run demo:e2e:badge
npm run demo:e2e:visual-capture
npm run demo:e2e:visual-pack
npm run demo:e2e:visual:gallery
npm run demo:e2e:visual:bundle
```

Artifacts:

1. `artifacts/demo-e2e/summary.json`
2. `artifacts/demo-e2e/policy-check.json`
3. `artifacts/demo-e2e/badge-details.json`
4. `artifacts/judge-visual-evidence/manifest.json`
5. `artifacts/judge-visual-evidence/manifest.md`
6. `artifacts/judge-visual-evidence/screenshots/_capture-manifest.json`
7. `artifacts/judge-visual-evidence/gallery.md`
8. `artifacts/judge-visual-evidence/presentation.md`
9. `artifacts/demo-e2e/epic-summary.json`

If deploy/publish artifacts are present, `manifest.md` and `presentation.md` also surface compact deploy/publish provenance from `artifacts/deploy/gcp-cloud-run-summary.json`, `artifacts/release-evidence/gcp-runtime-proof.json`, `artifacts/deploy/railway-deploy-summary.json`, and `artifacts/deploy/repo-publish-summary.json`. Ordinary local judge flows omit optional provenance instead of filling the page with `unavailable` placeholders, and raw deploy/publish JSON is not embedded into the judge-facing markdown.

## 4) Validate Release Readiness

```bash
npm run verify:release
```

## 5) What Judges Should See in UI

1. Connection + assistant lifecycle (`idle/streaming/speaking`).
2. Live interruption, truncate/delete evidence, gateway error correlation, and optional `research` citations/source URLs.
3. Operator Console panels:
   - Live Bridge Status
   - Approvals Queue
   - Workflow Runtime / Runtime Guardrails
   - Device Nodes Health / Updates
   - Bootstrap Doctor / Browser Workers
   - Governance Policy Lifecycle
   - Skills Registry Lifecycle
   - Plugin Marketplace Lifecycle
   - Agent Usage Evidence
   - Cost & Tokens Evidence
4. Operator support panels:
   - `Runtime Drill Runner` for repo-owned dry-run/live recovery drills and `followUpContext` handoff.
   - `Workflow Control Panel` for redacted assistive-router/runtime override posture.
   - `Operator Session Ops` for saved `operatorPurpose`, session replay, and cross-agent discovery.
   - `Bootstrap Doctor & Auth Profiles` for provider/auth-profile/device/fallback posture.
   - `Browser Worker Control` for queue/checkpoint posture on long-running UI jobs.
5. Session export controls:
   - `Export Session -> Export Markdown`
   - `Export Session -> Export JSON`
   - `Export Session -> Export Audio (WAV)`
   - Confirm exported Markdown/JSON include `runtimeGuardrailsSignalPaths`, `operatorPurpose`, `operatorSessionReplay`, and `operatorDiscovery`.
6. Story Studio panel:
   - Confirm the mode rail and prompt-first canvas stay visible above the fold.
   - The shared strip above Story Studio should read like a quiet context line, not a second dashboard row; before the first run it should collapse to title plus only the essential glance facts.
   - Confirm the direction strip keeps `lead / world / delivery / scope` readable without opening trays.
   - That direction strip should now read as low-profile cue chips, not another row of tall cards.
   - Secondary settings should read as summary-driven drawers with plain-language summaries and quiet meta chips, not as an always-open form.
   - When opened, the story and media drawers should breathe as roomier two-column editors instead of three squeezed controls in one row.
   - The upper rails should read as one stronger scenario row plus a quieter cue line; no permanent helper stepper should sit above the prompt, and hidden helper arrows should not leak into accessibility snapshots.
   - Closed desktop trays should keep a restrained chrome sheen and a fixed summary/meta stack; longer summary text should stay aligned instead of making one card sag or throwing tags off baseline.
   - The scenario rail should read as one featured active brief card plus quieter secondary chips, not four equal tiles.
   - The first scan should read `mode -> cues -> prompt`, with the scenario rail landing before the direction cues.
   - The grouped trays should sit below the prompt canvas, not above it; first fold should stay `scenario -> prompt -> generate`.
   - The prompt canvas should feel roomier than the surrounding chrome: more air around the active mode lockup, prompt heading, textarea, and CTA row.
- On larger screens before the first run, Story Studio should use the full available shell width with the same inner `24px` padding as the post-run layout instead of shrinking into a separate narrow card.
   - In focused Storyteller, the shared chrome should also retreat: left nav slimmer, inactive tabs quieter, and top controls smaller so the canvas wins the first glance.
   - On those larger pre-run screens, the active mode lockup should read like a quieter editorial brief card while the cue line flattens into inline facts and the secondary scenario pills step back.
   - That same desktop pre-run canvas should keep a calmer title/status lockup and a cleaner CTA zone, with `Generate from brief` anchoring the canvas while utility actions step back.
   - On those same larger screens, the shared shell above Story Studio should read like a transparent context strip, not a second hero card: small uppercase dashboard title, flatter controls, and one quieter workspace-fact line.
   - That same desktop presentation pass should leave the left rail reading like a quiet label strip, while the `Story Studio` heading tightens into an editorial title lockup with a smaller badge and shorter intro line.
   - Inside that same desktop compose shell, the `Creative Brief` tag should read like a quiet label, the title block should stay tighter, and one divider should hand off into the prompt lane so the surface reads as one editorial write canvas instead of stacked rows.
   - In that same desktop compose shell, the active scenario card and cue line should read as one calmer brief header: thin framed mode row, lighter secondary scenario chips, and cue facts tucked in tight under the lockup instead of feeling like a second control row.
   - The collapsed trays below that canvas should read as one quiet settings shelf on desktop: flatter summary rows, shorter hint lines, lighter inline summaries, and quiet fact-style meta instead of chip chrome competing with the prompt and CTA.
   - After a run on desktop, `Latest output` and `Current scene` should stay inside one calmer reading lane: a flatter dossier rail on the output side and a lighter inline support strip under the scene instead of stacked mini-cards.
   - In that same desktop ready-state, `Current scene` should read as a title-first preview surface: hide the repeated section intro, remove the inner copy-label chrome, and collapse the support rail to assets instead of a second summary card.
- That same desktop `Latest output` main card should read as one editorial narrative surface: no inner narrative card, quiet inline cue facts, and story copy starting under one light divider instead of another boxed panel.
- In that same desktop ready-state, `Latest output` should collapse into a title-first editorial preview: hide the repeated intro/meta chrome, use one compact fact line, and avoid repeating the same short status sentence in three places.
- That same ready-state `Latest output` should also read like an editorial proof: let the outer body shell recede, turn the status kicker into a quiet overline, and keep the story copy in a narrower reading measure than a generic content card.
- That same desktop post-run reading lane should now breathe more like an editorial proof too: `Latest output` should widen its narrative measure, dossier notes should get more space, and `Current scene` should drop the last inner-card density so both still read as one calm story lane.
- The same desktop polish should also keep tray chevrons and scene-jump arrows pinned inside their controls, tighten the navigator column, and widen storyboard/output lanes enough that desktop copy only wraps when it truly has to.
- In the same desktop post-run state, keep the left reading lane slightly wider than the atlas column and stack current-scene asset refs full width instead of squeezing two long technical pills side by side.
- That same desktop approval pass should also settle `Run status` into a flatter run brief and turn `Recent passes` into a short revision ledger, so post-run context stays supportive instead of rebuilding a second dashboard lane.
- Live desktop runs should also keep the shared `Output` glance and `Run status` guidance aligned with the real `pending / updating / ready` state instead of leaving idle copy behind after a successful story run.
- That same desktop interaction pass should also retune the compose CTA contract by state: the main button should lock and rename during first-pass or rerun rendering, the utility rail should switch to live-follow wording, and run guidance should stop reading like one generic idle launch prompt.
- After that same desktop run, the right side should read as one quieter production column: `Run status` as a flat summary rail and `Story atlas` as a flatter switcher with one active editorial panel instead of stacked KPI cards.
   - That same active `Story atlas` panel should read more like a quiet editorial side note: hide the duplicated inner eyebrow, tighten summary/meta into one factual stack, and let media counts step back into a lighter ledger.
   - That same desktop lower lane should read as one calmer filmstrip lane: `Navigator` as a quiet utility strip and `Storyboard shelf` as a lighter editorial shelf instead of two neighboring dashboard cards.
   - On the tightest mobile widths, Story Studio should keep one highlighted mode card, a compact secondary mode row, and shorter cue chips so the prompt reaches the top of the scan faster.
   - On those same mobile widths, the cue line should tuck under the active mode lockup as one quieter brief header and trim the `scope` cue before the prompt.
   - On the smallest mobile widths, quieter secondary mode choices should drop below that cue line as their own scenario row instead of sitting between the lockup and the prompt.
   - On those smallest widths, that scenario row should use lighter chrome and the cue line should sit against a subtle guide rule, so the mobile brief-header reads as one calm lockup instead of stacked pills.
   - At that same breakpoint, inactive mode titles and cue summaries should switch to shorter mobile copy, so the first fold scans faster instead of reading like full desktop labels squeezed into one column.
   - At that same breakpoint, the prompt field should drop its helper line and the character counter should flatten into quiet text, so the textarea reaches the eye faster instead of carrying extra pill chrome.
   - On those same mobile widths, collapsed trays should read as compact shelf rows: keep the drawer title and live summary, but hide static tray hints and flatten meta chips into quiet inline notes.
   - On larger screens, keep the grouped trays in a calmer editorial shelf instead of spreading them into three equal dashboard columns.
   - On mobile, the vertical chain from mode lockup through prompt textarea to Generate should feel tighter: compose-canvas padding, inter-element gaps, and textarea height compress progressively so the CTA arrives earlier in the viewport, and collapsed drawers sit below a quiet divider instead of stacking directly after the action row.
   - Generate story directly from Storyteller without detouring to Live; `Open Live` should remain secondary.
   - Empty `Latest output`, `Current scene`, and `Scene Cards` surfaces should not repeat the main CTA below the fold.
   - The direction strip (Lead / World / Delivery / Scope) should now read as compact inline pills in one row, not four separate cards.
   - The mode rail should now read as pill-tabs (rounded capsules) with only the active mode showing its hint, not four full cards each with a "Mode" kicker.
   - The compose canvas should feel like a focal card: visible border, subtle shadow, and inner glow on focus.
   - The prompt char count should show quality feedback: amber "add more detail" below 30 chars, green "great detail ✓" above 100 chars.
   - Before the first run, empty results surfaces (Latest output, Atlas, Run snapshot) should dim to 55–60% opacity and brighten on hover.
- `Run status` should read as one calmer rail instead of three equally loud cards, and the `Story atlas` should keep `world / character / media` inside one segmented creative surface instead of three stacked summary blocks.
  - The right side should feel like a quieter production sidebar with flatter metric cards, a softer next-step note, and a flatter atlas tab strip instead of a second mini dashboard.
- The lower scene lane should read as a compact navigator bar plus a storyboard shelf, not as another technical timeline panel.
  - That lower lane should also behave like one grouped storyboard lane with a subtle divider, so navigator context and the shelf scan as one calm strip instead of two neighboring cards.
- The right rail should read as a quiet snapshot stack with lighter stat cards, slimmer state chips, and one calm next-step note instead of a second dashboard.
   - The shared workspace shell above Storyteller should feel compressed and secondary, not like another dashboard before the studio.
   - On desktop, that shared shell should now read as a compact story strip with inline glance pills, so the first fold reaches `Story Studio` quickly.
- small screens should collapse the shared shell into a compact workspace line and compact tab switcher, so the story canvas appears earlier instead of after a full dashboard wrapper; the atlas switcher should also scroll horizontally instead of becoming another tall stack.
   - On small screens, the first fold should compress into an inline compose-status row, a horizontal direction strip, and short numbered flow chips so the prompt canvas starts earlier.
   - On larger screens, the scenario rail should sit as a one-row scenario lockup, and the prompt meta under the textarea should read as a shorter brief preview instead of a long payload string.
   - The compose footer should read as one dominant generate action plus a quieter utility row, and the trays below should behave like a shelf that opens one drawer full-width instead of stacking three equal cards.
   - Expanded drawers should group controls into small editorial sections, so the open state still feels guided instead of turning into a flat form.
   - Open drawers should keep short hints, a quiet action divider, and calm internal section dividers instead of reverting to a dense settings stack.
   - `Latest output` and `Current scene` should keep a calmer narrative rhythm, with the main story text reading first and the support cards stepping back.
- In focused Storyteller they should also read as a single calmer reading lane instead of two equal dashboard cards.
- Before the first Storyteller run, the `Run status` rail, `Latest output`, `Story atlas`, and the storyboard lane should stay off the page entirely, so the first screen remains compose-first instead of loading empty result dashboards.
- The desktop shared context strip should compress further into a thinner editorial ledger, so dashboard title, top controls, and workspace facts read as one quiet preface rather than a second header block.
- That desktop shared strip should now recede into an even quieter control ledger, so the toolbar shrinks, the workspace title shortens, and the inline facts read like small references instead of a header block.
- That desktop direction strip should now read more like inline reference notes, so `lead / world / delivery / scope` sit on one calmer baseline with shorter dividers and quieter labels instead of four mini cards.
- That desktop `Story prompt` header should now read more like a write-title lockup, so the helper note tucks under the label and the count line drops into a quieter footnote below the textarea.
- That desktop textarea shell should now read more like a calm writing surface, so the field loses harsher inset chrome, the paper gradient flattens, and focus settles into a softer editorial edge instead of a form-box ring.
- That desktop Story Studio title band should now step back further, so the heading tightens, the badge shrinks, and the intro line tucks under the title like a short deck instead of a full second row above the brief.
- That desktop Creative Brief heading block should now read tighter as well, so the label gets quieter, the story title becomes a denser lockup, and the supporting line narrows into one composed heading cluster.
- That desktop mode row should now step back into a quieter scenario header, so the active scenario card flattens and tightens while the secondary chips recede from the same brief-header cluster.
- That desktop cue line should now read like a tucked editorial ledger, so a subtle guide rule, shorter labels, and narrower values keep the reference facts attached to the active scenario lockup instead of becoming a second settings row.
- That desktop write surface should now tuck closer to that brief header, so the canvas edge softens, the prompt heading compresses, and the textarea enters a beat sooner instead of starting as a separate block.
- That desktop tray shelf should now settle lower as a quiet after-note ledger, so row height drops, summaries shorten, and meta facts recede instead of restarting a second settings block under the form.
- That desktop outer Story Studio shell should now recede into a lighter paper frame, so padding tightens, the title deck shortens, and the surrounding chrome stops competing with the compose surface.
- That desktop shared workspace strip should now compress into an even quieter micro-ledger, so the workspace title, separators, and glance values all shorten before the eye reaches `Story Studio`.
- That desktop top utility rail should now settle into an even quieter baseline, so language/theme controls slim into smaller utility chips, the workspace line shortens again, and the preface above `Story Studio` stops behaving like a header block.
- That same desktop cleanup should now also lock the top brief trays into a clean three-up shelf, move tray chevrons out of the text flow, and bias the post-run columns toward the narrative lane so avoidable desktop wraps stop happening when the width is already there.
- That same desktop cleanup should now also stack the `Current scene` heading rail, so the scene marker, title, and fact line stop fighting for the same row and the preview gets a longer title measure before wrapping.
- That same visible desktop Storyteller fold should now keep a readable type floor too, so microcopy stays at `11px+`, line-height opens up, and narrow title/summary widths stop forcing avoidable second lines when the lane already has room.
- That same post-run Storyteller reading lane should now keep that floor too, so run labels, atlas facts, output dossier metadata, and lower navigator/storyboard notes all stay at `11px+` with more air and fewer needless wraps after a run.
- That same desktop cleanup should now also equalize the top tray grid, settle production metrics into a calmer two-column ledger, and turn the storyboard shelf into aligned equal-width cards so the lower half stops reading like scattered blocks.
- That same desktop cleanup should now also keep collapsed tray titles, hints, and facts on steadier one-line rows, keep tray chevrons pinned to a stable right edge, shorten the scene-jump selector, and widen `Latest output`, `Current scene`, and the storyboard shelf so the lower half stops breaking into tetris-like blocks.
- Live desktop failed runs should now stay visibly failed instead of snapping back to idle: `Run status` should switch to review copy, `Latest output` should reduce raw gateway text into `code / trace / latency` facts, and empty preview/timeline states should stay in retry language until the next pass lands.
- That same desktop lower lane should now compress into a lighter control rail too, so the scrubber stays full width, the selector/position row tightens, the ready hint gets shorter, and the storyboard shelf gets a little more width instead of feeling like cramped control tiles next to cards.
- That same desktop pass should now also rebalance Latest output, Story atlas, and the storyboard lane into a tighter left-heavy reading grid, flatten production metrics into one inline ledger, and clamp storyboard titles to two steadier lines so long copy stops scattering the fold. That same desktop runtime pass now also trims the collapsed tray label rail, keeps summary rows on longer one-line locks, narrows the atlas support lane, and gives the navigator selector a fuller aligned row so chevrons stay pinned and the lower shelf stops feeling scattered.
- That same desktop cleanup should now also bind to the real `story-compose-shell` trays, so the top shelf stays three-up, helper copy holds one line, and both error and ready reading lanes stop wasting width on atlas chrome or selector wrap.
- That same desktop Storyteller pass should now also keep the Russian intro, compose heading, tray helper lines, and post-run atlas/output notes readable without fake one-line ellipses, while untouched defaults localize cleanly after a language switch.
- That same desktop polish should now also preserve one-line title/deck lines where width allows, switch tray/atlas/output support copy to honest wrap instead of fake ellipses, and hide native tray markers so the custom chevrons stay aligned.
- That same desktop cleanup should now also keep the Russian creative-brief headline and deck on one line at `1440px`, shorten the first tray summary into an honest `lead • world` shorthand, and pin the runtime atlas/dossier split behind a real EOF authority layer so later cascade drift does not reopen broken wraps.
- That desktop left nav rail should now recede into a thinner reference rail, so rows shorten, active marking softens, and the sidebar reads as orientation instead of control chrome.
- That same desktop Storyteller shell should now read more like an atmospheric preface too: the transparent hero keeps a faint baseline, the workspace facts compress into a shorter ledger, and the left rail uses softer marked nav rows instead of boxed sidebar buttons.
- That same desktop hero should now tighten into a clearer lockup as well: the workspace title gets a stronger measure, the facts stay on one line, and a faint accent rail anchors the preface back into the background.
- That same desktop `Story Studio` title band should now continue that hierarchy too: the brief heading gets a quiet left accent, the eyebrow chip softens, and the mode/status block resolves into one aligned support column instead of a separate little panel.
- That same desktop `Story Studio` shell should now also read as one continuous surface: the outer panel should drop the heavier card feel, the compose shell should behave more like a paper layer, and the inner canvas should sit quieter so hero and studio feel connected.
- That same desktop top shell should now also step back one more notch: the shared story strip should shorten into a quieter `Brief and scenes` ledger, the studio deck should collapse into one tighter line, and the compose heading should now read like a smaller section title beneath `Story Studio`.
- That same desktop hero/nav contract should now also favor readability: the workspace summary should sit on a darker glass rail with more breathing room, while the left nav should use equal-width tabs with one-line titles so long labels stop changing button size.
- That same desktop hero/nav should now also use a clearer structure: the hero summary should split into a calmer title-plus-ledger stack, and the left rail should add quiet icon chips so navigation reads cleaner without changing tab size.
- That same desktop hero/nav should now also land as a calmer foreground layer: the workspace summary should use a denser smoke-glass panel with a wider measure, and the left rail should lock every tab to the same footprint over a darker backdrop so video motion cannot distort the text.
- That same desktop first fold should now also stretch more evenly across the page: the hero summary should run full-width inside the top rail, and the `Story Studio` title band should widen into a more balanced header so the transition into the canvas feels continuous instead of stepped.
- That same desktop brief header should now also read more cleanly under that wider header: the active mode card should get calmer chrome, secondary modes should become a tighter utility row, and the cue strip should resolve into one inline fact ledger instead of a loose second control band.
- That same desktop writing surface should now also read as one calmer paper lane: the prompt hint should stay on one line, the textarea should get roomier paper spacing, the counter should resolve into a quiet 11px footnote, and the CTA row should widen into a cleaner handoff instead of a cramped button strip.
- That same desktop collapsed tray shelf should now also resolve into a tighter three-up reference row: titles should stay one-line, summaries should shorten, and meta tags should sit quieter so the bottom of the first fold reads like one shelf instead of three mini-cards.
- That same desktop upper fold should now also land on a denser foreground layer: the hero should get a darker smoke-glass rail, `Story Studio` should bridge upward into it, and the title band should read as one calmer continuation instead of a second heavy slab over the video.
- That same desktop hero lockup should now also read more cleanly: the title and summary should form one wider editorial stack, while the mode/status ledger should move into a compact right-aligned utility rail and the empty third slot should disappear instead of leaving dead space.
- That same desktop top microcopy should now also carry a calmer rhythm: `Студия истории` and `Кинематографичный бриф` should use shorter title/deck measures, softer spacing, and less headline weight so the first fold reads like one polished narrative preface instead of stacked headers.
- That same desktop brief header should now also give the right mode/status block a real utility-rail footprint: the status track should shrink to text-fit width, badges should stay compact, and runtime states should use shorter copy so the header no longer reserves a wide empty pocket.
- That same desktop first fold should now also sit on a 95% foreground readability plate: the hero rail, Story Studio shell, and compose shell should use near-opaque smoke-glass surfaces so background video keeps atmosphere without compromising text legibility.
- That same desktop post-run view should now also read as one calmer editorial lane: `Latest output` should get a wider reading column, `Atlas` should resolve into an equal-width tab rail with tighter cards, and the storyboard shelf should lock into a cleaner three-card board instead of uneven floating panels.
- That same desktop post-run pass should now also keep action states and helper copy clearer: `Atlas` tabs should hover and select without changing footprint, storyboard cards should show one stable selected state, and the support copy under `Latest output`, `Preview`, and `Navigator` should read in fuller 11px+ lines instead of clipped fragments.
- That same desktop header and left rail should now also feel more intentional: the workspace summary should tighten into a denser split header with a visible eyebrow and fuller deck, while the sidebar should use one fixed tab footprint with calmer chrome and one-line titles.
- That same desktop header and left rail should now also breathe more evenly: the workspace summary should become a taller two-zone split with compact utility cards on the right, while the sidebar should widen into a calmer rail with steadier one-line rows.
- That same desktop `Story Studio` band should now also carry more air: the title lockup should align under the badge, the intro deck should hold one calmer line, and the `Cinematic brief` header should resolve into a wider copy lane plus a tighter status utility rail.
- That same desktop compose header should now also give the mode rail and cue ledger more room: inactive modes should keep fuller one-line labels in calmer chips, while `Lead / World / Delivery / Scope` should hold longer readable values before truncating.
- That same desktop prompt lane should now also read as one calmer writing surface: the helper line should stay on one quieter baseline, the textarea should open with more paper-like room, the count should hold a readable `11px`, and the CTA handoff should resolve into one dominant generate action plus a tidier utility rail.
- That same desktop prompt lane should now also lock its text rhythm more cleanly: the helper should stack beneath the label instead of fighting it inline, the meta row should resolve into a quieter preview-plus-count ledger, and the action divider should give the writing surface a calmer handoff into CTA space.
- That same desktop collapsed tray shelf should now also hold a calmer editorial rhythm: titles and undertext should stay on one steadier line where they fit, summary copy should carry more signal before truncating, and the right-side meta chips should step back into one quieter aligned note column.
- That same desktop header and left rail should now also land more evenly: the workspace summary should tighten into a cleaner editorial copy lane with a smaller right utility block, while every sidebar tab should keep the same fixed 62px row and no longer drift in size on hover.
- That same desktop `Story Studio` shell should now also carry cleaner depth and rhythm: the outer panel should become a softer foreground plate, the space under the studio title should open up, and the compose surface should resolve into a clearer paper layer inside the shell instead of reading like one flat slab.
- That same desktop `Cinematic brief` header should now also read as a calmer lockup: the title/support copy should get more air and a wider measure, while the right status rail should shrink into a tighter utility note instead of a thin technical strip.
- That same desktop mode rail should now also read like a real narrative selector: the active mode card should carry calmer premium chrome, while the secondary chips should gain steadier width and height so the whole row stops looking like a compressed control strip.
- That same desktop cue ledger should now also read more like a quiet reference line: the fact row should use a steadier grid, longer runtime values should survive before truncating, and the labels should step back so the strip stops feeling like a second control band.
- That same desktop tray/runtime pass should now also close the remaining overflow traps: `Narrative anchor` and `Delivery stack` should open into even full-width two-column rows, tray chevrons should stay pinned beside the title, the top header cards plus `Run status` should absorb longer EN/RU strings without breaking, and the storyboard selector should flip upward instead of dropping off-screen.
- That same desktop tray/header pass should now also clean the first-fold details: the three collapsed trays should read as taller stacked cards with two-line summaries instead of clipped one-line fragments, `Story Studio` intro should align directly under the title, the sidebar should sit slightly higher as one fixed rail, and the `Live` nav entry should carry a clearer accent without changing tab geometry.
- That same desktop tray/utility polish should now also center the chevron inside its circular shell and keep the `Live` utility action on the same rounded pill geometry as the surrounding Storyteller actions instead of a square accent block.
- That same desktop pre-run shelf should now also hold up before any generation starts: the lower tray chevrons should stay centered inside their circles, the old rotated border contour should be reset so only the centered icon remains, and opening a tray should keep visible top padding above the title instead of letting the title stick to the container edge.
- That same desktop left rail should now also resolve under a late authority pass: the sidebar should sit slightly higher on the fold, every nav row should keep the same 62px footprint, `Консоль оператора` should fit cleanly on one line, and `Live` should carry a subtle accent without changing the shared pill geometry.
- That same desktop rail fix should now also update the Storyteller body grid itself: the widened sidebar should get matching column space so it no longer overlaps the studio panel, and the `Live / Story / Ops / Nodes` chips should use fixed overflow-safe pill boxes so span text cannot spill outside.
- That same desktop rail/header fix should now also close the last fit issues: the sidebar should align to the same top baseline as `Story Studio`, the icon chips should widen enough for `Story` and `Nodes` without clipping, and the intro line should sit directly under the title without hidden padding pushing it sideways.
- The desktop first fold should now behave more like a calm studio page: the outer Story Studio shell should shed extra glow, the pre-run compose surface should use tighter paper-like spacing, and the brief canvas should sit inside softer nested surfaces instead of stacked gradient cards.
- That same desktop CTA row should now resolve into one cleaner handoff: `Generate from brief` should keep the visual weight, while `Use scenario draft` and `Open live dialog` should retreat into a quieter utility rail instead of reading like peer CTAs.
- That desktop CTA handoff should now sit closer to that writing surface, so the divider softens, the action row tightens, and the secondary rail reads more like utility support than a second control band.
- That collapsed tray shelf should now sit as a quieter after-CTA note row, with shorter rows and lighter inline facts instead of reading like a second block of mini-cards.
- That same collapsed tray shelf should now recede further into an inline reference ledger, so repeated helper hints disappear in collapsed state, label columns narrow, and the remaining meta facts sit behind a softer divider instead of reading like separate tray cards.
- On small screens, `Latest output` side cards, `Current scene` support cards, and empty preview cues should collapse into short horizontal scrollers instead of one tall middle stack.
   - Latest output surface updates while `Timeline State` KPI and run-status cards transition (`0%` idle -> ready/pending).
- Latest output should read as a dossier with `brief lockup`, `delivery stack`, `production status`, and `recent passes` instead of one plain text block, and those brief/delivery/direction details should feel grouped into one quieter dossier stack instead of several equal mini-cards.
- In idle desktop state, `Latest output` should compress into one compact support strip, and `Current scene` should use one left-aligned support row plus one calmer unlock card instead of a tall centered placeholder stack or a second teaching panel.
- In active desktop/mobile states, `Latest output` should keep story cues inside the main narrative card and fold `production status` into the same side dossier instead of splitting them into several equal-weight subcards.
- In ready state, `Latest output` should now read as `brief -> delivery -> production`, with direction folded into the delivery context and redundant dossier labels hidden on the tightest breakpoints.
- When scenes are ready, the right rail should hide the ready chip row and standalone progress bar, so it keeps reading like a quiet production summary instead of another status cluster.
- In ready state, `Current scene` should keep cues and long-form scene copy inside one dominant narrative block, while media/status/assets fall into a quiet support strip instead of a side rail of equal mini-panels.
- `Current scene` support summaries should avoid duplicate hint lines so the preview still reads as one primary scene surface plus a short factual strip.
- `Storyboard shelf` should read left-to-right in scene order as a calmer filmstrip and use one footer meta line per card instead of a separate row of asset chips.
- Focused Storyteller mode should suppress helper intros in middle surfaces and lean on heading + live state/meta instead of stacking one more explanatory line above every panel.
- Focused Storyteller atlas media counts should read as a lightweight inline strip, with zero-value badges de-emphasized instead of three equal mini-cards.
- On the smallest Storyteller breakpoints, `Run status` should hide repeated ready-state guidance chrome and `Story atlas` should drop tab/card hints so the mobile middle stack stays compact.
- Segment scrubber/selector reflects `output.story.timeline`, and current-scene preview reads as a storyboard panel with beat headline, one compact fact line, and an asset-first support rail.
   - Scene cards should show cue tags and a readable editorial title/summary instead of collapsing into one text block.
   - `Scene controls` should stay collapsed until scenes exist, so the user does not see disabled scrubber/selector chrome before the timeline is ready.

## 6) Primary Docs (if deeper review is needed)

1. `docs/challenge-demo-runbook.md`
2. `docs/operator-guide.md`
3. `docs/ws-protocol.md`
4. `docs/architecture.md`

## 7) Demo Script by Minute (5-6 min)

1. `00:00-00:45` Platform intro:
   - Open `http://localhost:3000`.
   - Show connection panel and assistant lifecycle (`idle/streaming/speaking`).
   - Point to judge artifacts target: `artifacts/judge-visual-evidence/presentation.md`.
2. `00:45-02:15` Live Agent category:
   - Start mic, send live request, then trigger interruption.
   - Show truncate/delete/gateway-correlation evidence in Operator Console.
   - Mention roundtrip and interrupt KPI lanes in `artifacts/demo-e2e/badge-details.json`.
   - If judges ask for grounded-research proof, switch to `intent=research` once and show citation-bearing `answer`, `citations`, and `sourceUrls`.
3. `02:15-03:30` Creative Storyteller category:
   - Send storyteller prompt.
    - Open `Story Studio` panel and scrub segments.
   - Show image/video/audio refs and async media behavior.
4. `03:30-04:45` UI Navigator category:
   - Send `ui_task` intent with grounding fields.
   - Show approval flow and damage-control verdict in Operator Console.
   - Save a short purpose in `Operator Session Ops`, then open `Bootstrap Doctor & Auth Profiles` and `Browser Worker Control` once to show runtime posture before execution.
   - Confirm safety gates before execution.
5. `04:45-05:30` Evidence close:
   - Run `npm run demo:epic` (or fallback `npm run demo:e2e:visual:judge` if e2e/policy/badge were already executed).
   - Open `artifacts/judge-visual-evidence/presentation.md`.
   - Confirm all evidence lanes are `pass` in `artifacts/demo-e2e/badge-details.json`.
   - Export session `JSON` or `Markdown` and confirm `runtimeGuardrailsSignalPaths`, `operatorPurpose`, `operatorSessionReplay`, and `operatorDiscovery`.








