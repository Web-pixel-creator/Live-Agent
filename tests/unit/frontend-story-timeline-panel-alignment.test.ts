import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires prompt-first storyteller studio across UI/runtime/docs", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const storytellerTailStylesPath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "storyteller-runtime-tail.css",
  );
  const storytellerHeaderAuthorityPath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "public",
    "storyteller-header-nav-authority.css",
  );
  const readmePath = resolve(process.cwd(), "README.md");
  const judgeQuickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const html = readFileSync(htmlPath, "utf8");
  const app = readFileSync(appPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  const storytellerTailStyles = readFileSync(storytellerTailStylesPath, "utf8");
  const storytellerHeaderAuthority = readFileSync(storytellerHeaderAuthorityPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const judgeQuickstart = readFileSync(judgeQuickstartPath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'class="panel panel-story-studio"',
    'id="storyShellTop"',
    'id="storyModeRail"',
    'data-story-mode="cinematic"',
    'data-story-mode="scenes"',
    'data-story-mode="character"',
    'data-story-mode="world"',
    'id="storyComposerPrompt"',
    'id="storyComposerSubmitBtn"',
    'id="storyComposerTemplateBtn"',
    'id="storyComposerOpenLiveBtn"',
    'class="story-compose-secondary-actions"',
    'id="storyRunRail"',
    'id="storyResultsGrid"',
    'id="storyResultsPrimary"',
    'id="storyLatestOutputShell"',
    'id="storyPreviewShell"',
    'id="storyResultsSecondary"',
    'id="storyBottomGrid"',
    'id="storyCraftTray"',
    'id="storyCraftAnchorEyebrow"',
    'id="storyCraftStructureEyebrow"',
    'id="storyCraftTraySummaryText"',
    'id="storyCraftTraySummaryMeta"',
    'id="storyMediaTray"',
    'id="storyMediaDeliveryEyebrow"',
    'id="storyMediaVoiceEyebrow"',
    'id="storyMediaTraySummaryText"',
    'id="storyMediaTraySummaryMeta"',
    'id="storyDirectionTray"',
    'id="storyDirectionLeadHint"',
    'id="storyDirectionTraySummaryText"',
    'id="storyDirectionTraySummaryMeta"',
    'id="storySignalLeadLabel"',
    'id="storySignalDeliveryValue"',
    'class="story-flow-strip" aria-label="Story flow" hidden aria-hidden="true"',
    'id="storyFlowStepOneTitle"',
    'id="storyFlowStepTwoTitle"',
    'id="storyFlowStepThreeTitle"',
    'id="storyCharacterFocus"',
    'id="storyWorldFocus"',
    'id="storySceneTarget"',
    'id="storyTone"',
    'id="storyMediaMix"',
    'id="storyNarrationStyle"',
    'id="storyEditorialNotes"',
    'id="storyLatestOutputMeta"',
    'id="storyLatestOutput"',
    'id="storyAtlasRail"',
    'id="storyAtlasHeading"',
    'data-story-atlas-panel="world"',
    'data-story-atlas-panel="character"',
    'data-story-atlas-panel="media"',
    'id="storyWorldSummary"',
    'id="storyCharacterSummary"',
    'id="storyMediaSummary"',
    'id="storyMediaImageLabel"',
    'id="storyMediaImageCount"',
    'id="storyMediaVideoLabel"',
    'id="storyMediaVideoCount"',
    'id="storyMediaAudioLabel"',
    'id="storyMediaAudioCount"',
    'id="storyWorldTags"',
    'id="storyCharacterTags"',
    'id="storyMediaTags"',
    'id="storyScenesChip"',
    'class="story-results-grid"',
    'class="story-bottom-grid"',
    'class="story-scenes-shell"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(html.includes(token), `frontend html missing storyteller studio token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'storyComposerMode: "cinematic"',
    'storyAtlasFocus: "world"',
    "storyLatestRequestAt: null",
    "storyLatestResult: {",
    "const STORY_COMPOSER_COPY = Object.freeze({",
    "storyComposeChip: document.getElementById(\"storyComposeChip\")",
    "storyShellTop: document.getElementById(\"storyShellTop\")",
    "storySignalLeadLabel: document.getElementById(\"storySignalLeadLabel\")",
    "storyCraftTraySummaryText: document.getElementById(\"storyCraftTraySummaryText\")",
    "storyCraftTraySummaryMeta: document.getElementById(\"storyCraftTraySummaryMeta\")",
    "storyCraftAnchorEyebrow: document.getElementById(\"storyCraftAnchorEyebrow\")",
    "storyMediaDeliveryEyebrow: document.getElementById(\"storyMediaDeliveryEyebrow\")",
    "storyDirectionLeadHint: document.getElementById(\"storyDirectionLeadHint\")",
    "storyComposerSubmitBtn: document.getElementById(\"storyComposerSubmitBtn\")",
    "storyRunRail: document.getElementById(\"storyRunRail\")",
    "storyResultsGrid: document.getElementById(\"storyResultsGrid\")",
    "storyResultsPrimary: document.getElementById(\"storyResultsPrimary\")",
    "storyPreviewShell: document.getElementById(\"storyPreviewShell\")",
    "storyResultsSecondary: document.getElementById(\"storyResultsSecondary\")",
    "storyBottomGrid: document.getElementById(\"storyBottomGrid\")",
    "storyScenesChip: document.getElementById(\"storyScenesChip\")",
    "function normalizeStoryComposerMode(value) {",
    "function getStoryComposerCopy() {",
    "function formatStoryTraySummary(parts, maxLength = 96) {",
    'storyCraftAnchorEyebrow: "Narrative anchor",',
    'storyMediaDeliveryEyebrow: "Delivery stack",',
    'storyDirectionLeadHint: "Use this drawer for motifs, camera behavior, and the feeling of the final beat.",',
    'templateLabel: "Use scenario draft",',
    'openLiveLabel: "Open live dialog",',
    'promptPreviewPrefix: "Brief preview",',
    "idleSupportCounts: (sceneCount, totalRefs) =>",
      "function buildStoryOutputSupportCard(detail) {",
    "function getStoryAtlasPresentationCopy(isRu = state.languageMode === \"ru\") {",
    "function resolveStoryAtlasPreferredPanel({",
    "function syncStoryAtlasSurface(activePanel, tabMeta = {}) {",
    "function applyStoryAtlasFocus(value, options = {}) {",
    "function getStoryWorkspaceOutputStatusLabel(isRu = state.languageMode === \"ru\") {",
    "function getStoryWorkspaceSceneStatusLabel(isRu = state.languageMode === \"ru\") {",
    "card.hidden = isHidden;",
    "generateLabel: \"Generate from brief\",",
    "generateLabel: \"Сгенерировать по брифу\",",
    "function buildStoryComposerPrompt() {",
    "function compactStorySignalValue(value, maxLength = 68) {",
    "function compactStorySceneCopy(value, maxLength = 156) {",
    "function getStoryScenePresentationCopy(isRu = state.languageMode === \"ru\") {",
    "function getStorySceneLaneStatusLabel(kind, isRu = state.languageMode === \"ru\") {",
    "function getStoryTimelineNavigatorHint(kind, isRu = state.languageMode === \"ru\") {",
    "function deriveStorySceneNarrative(text, index, isRu = state.languageMode === \"ru\") {",
    "function getStorySceneCueTags(segment, isRu = state.languageMode === \"ru\") {",
    "function buildStoryPreviewDisplaySummary(segment, isRu = state.languageMode === \"ru\") {",
    "function getStoryOutputPresentationCopy(isRu = state.languageMode === \"ru\") {",
    "function deriveStoryLatestOutputNarrative(text, isRu = state.languageMode === \"ru\") {",
    "function getStoryLatestOutputDescriptorData() {",
    "function hasStoryLatestOutputText() {",
    "function hasStoryRunActivity() {",
    "function syncStoryStudioVisibility(count, pendingJobs) {",
    "el.storyRunRail.hidden = !hasRunActivity;",
    "el.storyShellTop.classList.toggle(\"is-prerun\", !hasRunActivity);",
    "function pushStoryLatestHistoryEntry(role, text, options = {}) {",
    "function renderStoryTagList(container, items) {",
    "function buildStoryOutputMetrics(metrics, compact = false) {",
    "function buildStoryOutputDossierSection(detail) {",
    "function seedLiveNegotiatorWithStoryPrompt(message = buildStoryComposerPrompt()) {",
    "function renderStoryModeRail() {",
    "function renderStorySignalStrip() {",
    "function renderStoryLatestOutput() {",
    "function renderStoryAtlasCards() {",
    "function renderStoryStudioSurface() {",
    "function submitStoryComposerRequest() {",
    'layoutRoot.classList.toggle("is-story-focused", isStoryTab);',
    'dashboardBody.classList.toggle("is-story-focused", isStoryTab);',
    'dashboardSidebar.classList.toggle("is-story-focused", isStoryTab);',
    "entrypoint: \"storyteller_canvas\"",
    "storyMode: state.storyComposerMode",
    "renderStoryStudioSurface();",
    "sendIntentRequest({",
    "intent: \"story\"",
    "setText(el.storyFlowStepOneTitle, copy.flowStepOneTitle);",
    "setText(el.storySignalLeadLabel, copy.signalLeadLabel);",
    "setText(el.storyMediaImageLabel, copy.mediaMetricImages);",
    "syncStoryStudioVisibility(count, pendingJobs);",
    "renderStoryTagList(el.storyWorldTags, [toneLabel, sceneTargetLabel]);",
      "compactStoryReferenceValue(characterFocus, 5, 40)",
      "renderStoryTagList(el.storyCraftTraySummaryMeta, [sceneTargetLabel]);",
      "compactStoryReferenceValue(mediaMixLabel, 4, 34)",
      "renderStoryTagList(el.storyMediaTraySummaryMeta, [toneLabel]);",
      "compactStoryReferenceValue(editorialNotes, 12, 108)",
      "renderStoryTagList(el.storyDirectionTraySummaryMeta, []);",
      'value: storyHasRunActivity ? storyOutputStatus : (isRu ? "\\u0411\\u0440\\u0438\\u0444 \\u0433\\u043e\\u0442\\u043e\\u0432" : "Brief ready"),',
      "hidden: !storyHasRunActivity,",
      'const previewDescriptor = [modeConfig.badge, sceneTargetLabel, mediaMixLabel].filter(Boolean).join(" · ");',
      "supportStrip.className = \"story-output-support-strip\";",
      "supportStrip.append(buildStoryOutputSupportCard(detail));",
      "bodyCard.className = \"story-output-body-card story-output-body-card-main\";",
      "const deliveryContext = [descriptor.narrationLabel];",
      "cueStrip.className = \"story-output-cue-strip\";",
      "metrics: productionMetrics,",
      "stage.className = \"story-preview-stage story-preview-stage-editorial\";",
      "previewShell?.classList.add(\"is-ready\");",
      "summary.className = \"story-preview-summary story-preview-summary-meta\";",
      "copyCard.className = \"story-preview-copy-card story-preview-copy-card-main\";",
      "supportStrip.className = \"story-preview-support-strip\";",
      "assetsCard.className = \"story-preview-rail-card story-preview-support-card story-preview-support-card-assets\";",
      "supportStrip.append(summaryCard, assetsCard);",
      "for (let idx = 0; idx < segments.length; idx += 1) {",
      "footer.className = \"story-segment-footer\";",
      "syncStoryCompactTextMeta(mediaValue, visibleMediaSummary, fullMediaSummary);",
      "readinessNote.className = \"story-empty-board-note\";",
      "readinessCard.append(readinessKicker, checklist, readinessNote);",
    "syncStoryCompactTextMeta(el.storyAtlasHeading, visibleAtlasHeading, atlasCopy.heading);",
    "syncStoryAtlasSurface(activePanel, {",
    'metricCard.classList.toggle("is-empty", value === 0);',
    "syncStoryActionButton(el.storyTimelineGuideTemplateBtn, {",
    "applyStoryAtlasFocus(button.dataset.storyAtlasPanel);",
    "tray.addEventListener(\"toggle\", () => {",
    "el.storyComposerSubmitBtn.addEventListener(\"click\", submitStoryComposerRequest);",
    "el.storyTimelineGuideTemplateBtn.addEventListener(\"click\", submitStoryComposerRequest);",
    "openLiveNegotiatorFromStoryEmptyState({ message: buildStoryComposerPrompt() });",
    "applyStoryComposerMode(state.storyComposerMode, { force: true });",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(app.includes(token), `frontend runtime missing storyteller studio token: ${token}`);
  }

  assert.ok(
    app.includes('storyCraftTrayHint: "Character, world, and scene shape.",'),
    "frontend runtime missing calmer Story Studio craft-tray hint",
  );
  assert.ok(
    app.includes('storyMediaTrayHint: "Tone, assets, and voice.",'),
    "frontend runtime missing calmer Story Studio media-tray hint",
  );
  assert.ok(
    app.includes('storyDirectionTrayHint: "Motifs, camera, and the final beat.",'),
    "frontend runtime missing calmer Story Studio direction-tray hint",
  );
  assert.ok(
    app.includes('storyDirectionTraySummaryEmpty: "Optional notes.",'),
    "frontend runtime missing shorter Story Studio direction-tray empty summary",
  );
  assert.ok(
    app.includes("function resolveStoryCompactModeTitle(mode, fallbackTitle = \"\") {"),
    "frontend runtime missing Story Studio compact mobile mode-title helper",
  );
  assert.ok(
    app.includes("function resolveStoryCompactDeliveryLabel(mediaMixValue, narrationStyleValue, fallbackLabel = \"\") {"),
    "frontend runtime missing Story Studio compact mobile delivery helper",
  );
  assert.ok(
    app.includes("renderStoryModeRail();\n    renderStorySignalStrip();"),
    "frontend runtime missing Story Studio responsive copy rerender on resize",
  );
  assert.ok(
    app.includes('shell.classList.toggle("is-ready", text.length > 0 && latest.role !== "error");'),
    "frontend runtime missing Story Studio ready-state latest-output shell flag",
  );
  assert.ok(
    app.includes('main.classList.toggle("is-compact", shouldCondenseBody);'),
    "frontend runtime missing Story Studio compact latest-output body toggle",
  );
  assert.ok(
    app.includes("const cueItems = narrative.highlights.filter((item) => {"),
    "frontend runtime missing Story Studio compact latest-output cue dedupe",
  );
  assert.ok(
    app.includes("function settleStreamingResult(result) {"),
    "frontend runtime missing Story Studio streaming-result settle helper",
  );
  assert.ok(
    app.includes("function resolveStoryLatestResponsePhase(latest = state.storyLatestResult) {"),
    "frontend runtime missing Story Studio live response-phase resolver",
  );
  assert.ok(
    app.includes("function resolveStoryComposerInteractionState({"),
    "frontend runtime missing Story Studio interaction-state resolver",
  );
  assert.ok(
    app.includes('submitLabelReady: "Generate another pass",'),
    "frontend runtime missing Story Studio rerun CTA copy",
  );
  assert.ok(
    app.includes("button.dataset.storyActionState = state;"),
    "frontend runtime missing Story Studio CTA action-state sync",
  );
  assert.ok(
    app.includes('composeActions.dataset.storyComposeState = interactionState;'),
    "frontend runtime missing Story Studio compose action-row state sync",
  );
  assert.ok(
    app.includes('guidanceReadyTitle: "Scenes ready",'),
    "frontend runtime missing Story Studio ready-state guidance title copy",
  );
  assert.ok(
    app.includes('guidanceUpdatingTitle: "More scenes incoming",'),
    "frontend runtime missing Story Studio updating guidance title copy",
  );
  assert.ok(
    app.includes("function parseStoryRuntimeError(text, isRu = state.languageMode === \"ru\") {"),
    "frontend runtime missing Story Studio runtime error parser",
  );
  assert.ok(
    app.includes("function resolveStoryTimelineRuntimeState({"),
    "frontend runtime missing Story Studio runtime-state resolver",
  );
  assert.ok(
    app.includes('guidanceErrorTitle: "Run needs review",'),
    "frontend runtime missing Story Studio failed-run guidance title copy",
  );
  assert.ok(
    app.includes('el.storyTimelineGuidance.classList.toggle("is-ready", isReady);'),
    "frontend runtime missing Story Studio ready-state guidance sync",
  );
  assert.ok(
    app.includes('el.storyTimelineGuidance.classList.toggle("is-error", isError);'),
    "frontend runtime missing Story Studio failed-run guidance sync",
  );
  assert.ok(
    app.includes('main.classList.toggle("is-error", isErrorStory);'),
    "frontend runtime missing Story Studio latest-output error-state toggle",
  );
  assert.ok(
    app.includes('runRail.classList.remove("is-idle", "is-pending", "is-ready", "is-error");'),
    "frontend runtime missing Story Studio failed-run rail reset",
  );
  assert.ok(
    app.includes('setStatusPill(el.storyTimelineMode, "run_failed", "neutral");'),
    "frontend runtime missing Story Studio failed-run mode pill",
  );
  assert.ok(
    app.includes('setStatusPill(el.storyTimelineAssetMix, copy.assetMixError, "neutral");'),
    "frontend runtime missing Story Studio failed-run asset-mix pill",
  );
  assert.ok(
    app.includes('el.storyTimelineControlsHint.classList.add("story-controls-hint-error");'),
    "frontend runtime missing Story Studio failed-run navigator hint state",
  );
  assert.ok(
    app.includes("function buildStoryTimelineSelectLabel(segment, isRu = state.languageMode === \"ru\") {"),
    "frontend runtime missing Story Studio shorter scene-selector label helper",
  );
  assert.ok(
    app.includes('compactStorySceneCopy(narrative.title || fallbackTitle, isRu ? 26 : 30) || fallbackTitle;'),
    "frontend runtime missing Story Studio tighter scene-selector title clamp",
  );
  assert.ok(
    app.includes("story-output-body-card-main story-output-body-card-compact"),
    "frontend runtime missing Story Studio compact latest-output excerpt card",
  );

  const requiredStyleTokens = [
    ".panel-story-studio {",
    ".story-compose-shell {",
    ".story-compose-head {",
    ".story-signal-strip {",
    ".story-signal-card {",
    ".story-mode-rail {",
    ".story-flow-strip {",
    ".story-flow-step {",
    ".story-mode-card {",
    ".story-mode-card.is-active {",
    ".story-compose-canvas {",
    ".story-tray-grid {",
    ".story-tray {",
    ".story-tray[open] {",
    ".story-tray > summary::after {",
    ".story-tray-copy {",
    ".story-tray-section {",
    ".story-tray-section-head {",
    ".story-tray-section-eyebrow {",
    ".story-tray-section-copy {",
    ".story-tray-section-grid {",
    ".story-tray-note-card {",
    ".story-tray-summary {",
    ".story-tray[open] .story-tray-summary {",
    ".story-tray-summary-text {",
    ".story-tray-summary-meta {",
    ".story-tray-summary-meta .story-atlas-tag {",
    ".story-compose-secondary-actions {",
    ".story-compose-secondary-actions > #storyComposerTemplateBtn {",
    ".story-compose-secondary-actions > #storyComposerOpenLiveBtn {",
    ".story-run-rail {",
    ".story-run-rail .story-head-grid {",
    ".story-run-rail.is-idle .story-status-row-summary {",
    ".layout.is-story-focused .story-shell-top.is-prerun {",
    ".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status,",
    ".layout.is-story-focused .story-run-rail[hidden] {",
    ".layout.is-story-focused .story-compose-preview[hidden] {",
    ".story-results-grid {",
    ".story-latest-output-shell {",
    ".story-latest-output-body {",
    ".story-output-stage {",
    ".story-output-stage-idle {",
    ".story-output-body-card,",
    ".story-output-side-card,",
      ".story-output-side-card-dossier {",
      ".story-output-side-card-idle {",
      ".story-output-support-strip {",
      ".story-output-support-card {",
      ".story-output-support-label {",
      ".story-output-dossier-section {",
      ".story-output-dossier-title {",
      ".story-output-body-card-main {",
      ".story-output-cue-strip {",
      ".story-output-cue-pill {",
      ".story-output-variants-grid {",
      ".story-empty-board-note {",
    ".story-preview-stage {",
    ".story-preview-stage-editorial {",
    ".story-preview-cue-stack {",
    ".story-preview-copy-card {",
    ".story-preview-copy-card-main {",
    ".story-preview-cues-inline {",
    ".story-preview-cues-hero {",
    ".story-preview-rail-card {",
    ".story-preview-support-strip {",
    ".story-preview-support-card {",
    ".story-preview-support-card-assets {",
    ".story-preview-rail-card-split {",
    ".story-preview-summary-grid {",
    ".story-preview-summary-item {",
    ".story-empty-support {",
    ".story-empty-column {",
    ".story-atlas-shell-head {",
    ".story-atlas-rail {",
    ".story-atlas-tab {",
    ".story-atlas-tab.is-active {",
    ".story-atlas-panels {",
    ".story-atlas-card {",
    ".story-atlas-card[hidden] {",
    ".story-atlas-card.is-active {",
    ".story-atlas-card.is-shaped {",
    ".story-atlas-tags {",
    ".story-atlas-metrics {",
    ".story-atlas-metric.is-empty {",
    ".layout.is-story-focused .story-output-side,",
    ".layout.is-story-focused .story-preview-rail,",
    ".layout.is-story-focused .story-empty-kpis,",
    ".layout.is-story-focused .story-compose-status {",
    ".layout.is-story-focused .story-signal-strip {",
    ".layout.is-story-focused .story-signal-label {",
    ".layout.is-story-focused .story-latest-output-shell.is-empty .story-output-stage {",
    ".layout.is-story-focused .story-timeline-preview-empty .story-empty-state {",
    ".layout.is-story-focused .story-bottom-grid {",
    ".layout.is-story-focused .story-controls .story-section-head {",
    ".layout.is-story-focused .story-scenes-shell .story-list-head {",
    ".layout.is-story-focused .story-results-secondary .story-atlas-metric.is-empty {",
    ".layout.is-story-focused .story-run-rail.is-ready .story-guidance-actions {",
    '.layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions[data-story-compose-state="pending"],',
    '.layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions > #storyComposerSubmitBtn[disabled] {',
    '.layout.is-story-focused .story-run-rail .story-guidance-action[disabled] {',
    ".layout.is-story-focused .story-atlas-tab-hint,",
    ".layout.is-story-focused .story-scenes-shell.is-ready .story-timeline-list,",
    ".layout.is-story-focused .story-segment-card {",
    ".layout.is-story-focused .story-segment-card.is-selected {",
    ".layout.is-story-focused .story-signal-card {",
    ".dashboard-workspace-summary.is-story-minimal {",
    ".dashboard-body.is-story-focused {",
    ".dashboard-sidebar.is-story-focused .dashboard-nav {",
    ".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn.active {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {",
    ".layout.is-story-focused .hero-sub {",
    ".layout.is-story-focused .hero-language-control {",
    ".layout.is-story-focused #themeToggleBtn {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-workspace-head > div {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-workspace-head .status-pill {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-card {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-card:not([hidden]):not(:last-child)::after {",
    ".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-hint {",
    ".layout.is-story-focused .story-mode-rail {",
    ".layout.is-story-focused .story-mode-card {",
    ".layout.is-story-focused .story-mode-card .story-mode-kicker,",
    ".layout.is-story-focused .story-mode-card.is-active .story-mode-kicker {",
      ".layout.is-story-focused .story-flow-strip {",
      ".layout.is-story-focused .story-flow-step {",
      ".layout.is-story-focused .story-flow-step:not(:last-child)::after {",
      ".layout.is-story-focused .story-flow-step-copy p {",
      ".layout.is-story-focused .story-compose-secondary-actions {",
      ".layout.is-story-focused .story-tray-summary {",
      ".layout.is-story-focused .story-tray-summary-text {",
      ".layout.is-story-focused .story-tray-summary-meta {",
    ".layout.is-story-focused .story-tray-grid {",
      ".layout.is-story-focused .story-tray-section {",
      ".layout.is-story-focused .story-tray-section-copy {",
    ".layout.is-story-focused .story-mode-rail::-webkit-scrollbar {",
    ".layout.is-story-focused .story-tray:not([open]) .story-tray-hint {",
    ".layout.is-story-focused .story-tray:not([open]) .story-tray-summary-meta .story-atlas-tag {",
    ".layout.is-story-focused .story-output-support-strip {",
    ".layout.is-story-focused .story-output-support-card {",
    ".layout.is-story-focused .story-output-title {",
    ".layout.is-story-focused .story-output-summary {",
    ".layout.is-story-focused .story-output-body-card-main {",
    ".layout.is-story-focused .story-output-cue-pill {",
    ".layout.is-story-focused .story-output-dossier-note {",
    ".layout.is-story-focused .story-preview-title {",
    ".layout.is-story-focused .story-preview-summary {",
    ".layout.is-story-focused .story-preview-copy-card-main {",
    ".layout.is-story-focused .story-preview-support-strip {",
    ".layout.is-story-focused .story-preview-summary-grid {",
    ".layout.is-story-focused .story-preview-summary-item p {",
    ".layout.is-story-focused .story-results-grid.is-output-only {",
    ".layout.is-story-focused .story-results-primary {",
    ".layout.is-story-focused .story-results-primary.is-output-only {",
    ".layout.is-story-focused .story-results-primary::before {",
    ".layout.is-story-focused .story-results-primary > .story-latest-output-shell,",
    ".layout.is-story-focused .story-results-primary.is-output-only > .story-latest-output-shell {",
    ".layout.is-story-focused .story-results-primary > .story-latest-output-shell {",
    ".layout.is-story-focused .story-bottom-grid::before {",
    ".layout.is-story-focused .story-bottom-grid > * {",
    ".layout.is-story-focused .story-bottom-grid > .story-controls,",
    ".layout.is-story-focused .story-results-primary .story-latest-output-body,",
    ".layout.is-story-focused .story-results-primary .story-preview-stage {",
    ".layout.is-story-focused .story-latest-output-shell .story-section-head,",
    ".layout.is-story-focused .story-latest-output-shell .story-section-head p,",
    ".layout.is-story-focused .story-scenes-shell .story-list-head-summary {",
    ".layout.is-story-focused .story-run-rail .story-head-grid {",
    ".layout.is-story-focused .story-run-rail.is-prerun .story-head-grid,",
    ".layout.is-story-focused .story-run-rail:not(.is-idle) .story-stat-card-title {",
    ".layout.is-story-focused .story-run-rail.is-idle .story-progress {",
    ".layout.is-story-focused .story-run-rail .story-inline-metric-label {",
    ".layout.is-story-focused .story-run-rail .story-status-row-summary {",
    ".layout.is-story-focused .story-run-rail.is-ready .story-status-row-summary {",
    ".layout.is-story-focused .story-run-rail.is-ready #storyTimelineProgressHint {",
    ".layout.is-story-focused .story-run-rail.is-ready .story-progress {",
    ".layout.is-story-focused .story-run-rail #storyTimelineGuideTemplateBtn {",
    ".layout.is-story-focused .story-atlas-tab.is-active {",
    ".layout.is-story-focused .story-results-secondary .story-atlas-head {",
    ".layout.is-story-focused .story-results-secondary .story-atlas-metrics {",
    ".story-controls.is-collapsed .story-controls-grid {",
    ".story-scenes-shell.is-idle .story-timeline-list-empty {",
    ".story-empty-board {",
    ".story-empty-board-single {",
    ".story-timeline-list-empty-board {",
    ".story-segment-kicker {",
    ".story-segment-cue {",
    ".story-segment-footer {",
    ".story-segment-meta {",
    ".story-bottom-grid {",
    ".story-scenes-shell {",
    "font-family: var(--font-serif);",
    /* UX redesign pass 1+2+3 tokens */
    ".layout.is-story-focused .story-signal-strip {",
    ".layout.is-story-focused .story-signal-card {",
    ".layout.is-story-focused .story-flow-strip {",
    ".layout.is-story-focused .story-compose-canvas {",
    ".layout.is-story-focused .story-mode-rail {",
    ".layout.is-story-focused .story-mode-card {",
    ".layout.is-story-focused .story-mode-kicker {",
    /* UX redesign pass 6+8 tokens */
    '.layout.is-story-focused .story-compose-count[data-quality="short"]',
    '.layout.is-story-focused .story-compose-count[data-quality="detailed"]',
    ".layout.is-story-focused .story-latest-output-shell.is-empty {",
    ".layout.is-story-focused .story-guidance.is-idle {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(styles.includes(token), `frontend styles missing storyteller studio token: ${token}`);
  }

  assert.ok(
    styles.includes(".layout.is-story-focused .story-mode-rail {\n  order: 1;"),
    "frontend styles missing Story Studio mode-first ordering",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun {\n  grid-template-columns: minmax(0, 1fr);\n  justify-items: stretch;"),
    "frontend styles missing Story Studio full-width prerun shell layout",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell {\n  width: 100%;\n  max-width: none;"),
    "frontend styles missing Story Studio full-width prerun compose shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-signal-strip {\n  order: 2;"),
    "frontend styles missing Story Studio cue-strip ordering",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-flow-strip {\n  display: none;"),
    "frontend styles missing Story Studio hidden helper stepper",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-signal-card:not(:last-child)::after {"),
    "frontend styles missing Story Studio inline cue separator",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-tray-grid {\n  order: 5;"),
    "frontend styles missing Story Studio tray-below-canvas ordering",
  );
  assert.ok(
    styles.includes("grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);"),
    "frontend styles missing Story Studio calmer editorial tray shelf",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-card-scope {\n    display: none;"),
    "frontend styles missing Story Studio tighter mobile brief-header scope trim",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-rail {\n    display: contents;"),
    "frontend styles missing Story Studio split smallest-mobile mode rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip::before {"),
    "frontend styles missing Story Studio subtle mobile cue guide rule",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active .story-mode-kicker {\n    min-height: 0;"),
    "frontend styles missing Story Studio desktop calmer active-mode kicker",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-card {\n    display: inline-flex;\n    align-items: baseline;\n    gap: 4px;\n    max-width: 21ch;\n    padding: 0 12px 0 0;") ||
      styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-card {\n    display: inline-flex;\n    align-items: baseline;\n    gap: 3px;\n    max-width: 18ch;\n    padding: 0 10px 0 0;"),
    "frontend styles missing Story Studio desktop flatter cue-line facts",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card:not(.is-active) {\n    padding: 4px 10px;") ||
      styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card:not(.is-active) {\n    padding: 4px 8px;") ||
      styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card:not(.is-active) {\n    min-height: 0;\n    padding: 0 2px;"),
    "frontend styles missing Story Studio desktop quieter secondary scenario pills",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status {\n    align-items: center;"),
    "frontend styles missing Story Studio desktop calmer title-status lockup",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions {\n    grid-template-columns: max-content minmax(0, 1fr);\n    align-items: center;\n    padding-top: 10px;\n    gap: 10px 14px;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 34%, transparent);"),
    "frontend styles missing Story Studio desktop anchored CTA zone",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions > #storyComposerSubmitBtn {\n    min-width: 214px;\n    min-height: 42px;\n    padding: 0 22px;"),
    "frontend styles missing Story Studio desktop tighter primary generate button",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-secondary-actions {\n    align-items: center;\n    justify-content: flex-end;\n    gap: 5px 9px;\n    padding-left: 12px;\n    border-left: 1px solid color-mix(in oklch, var(--border-soft) 38%, transparent);"),
    "frontend styles missing Story Studio desktop utility-rail secondary CTA group",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .hero {\n    gap: 1px 10px;\n    padding: 0 1px;\n    border: 0;"),
    "frontend styles missing Story Studio desktop transparent context-strip shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-workspace-eyebrow {\n    display: none;"),
    "frontend styles missing Story Studio desktop quieter workspace fact strip",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .hero-headline {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) max-content;\n    gap: 2px 10px;\n    align-items: baseline;"),
    "frontend styles missing Story Studio desktop tighter context-strip lockup",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .hero-language-control {\n    padding: 1px 0 1px 5px;\n    border-color: transparent;\n    background: transparent;"),
    "frontend styles missing Story Studio desktop quieter context-strip controls",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .hero-language-select {\n    min-height: 24px;\n    padding: 1px 7px;\n    border-color: color-mix(in oklch, var(--border-soft) 20%, transparent);"),
    "frontend styles missing Story Studio desktop slimmer top utility chips",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .hero h1 {\n    font-size: 0.6875rem;\n    line-height: 1.18;"),
    "frontend styles missing Story Studio desktop readable top utility type floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-workspace-title {\n    font-size: 0.72rem;\n    line-height: 1.12;\n    color: color-mix(in oklch, var(--foreground) 64%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop shorter workspace title lockup",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-card {\n    gap: 2px;\n    padding-right: 5px;"),
    "frontend styles missing Story Studio desktop thinner workspace ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-value {\n    font-size: 0.6875rem;\n    line-height: 1.16;"),
    "frontend styles missing Story Studio desktop quieter workspace value micro-ledger",
  );
  assert.ok(
    styles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav {\n    gap: 3px;\n    padding: 2px 0;\n    border: 0;"),
    "frontend styles missing Story Studio desktop quiet label rail",
  );
  assert.ok(
    styles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    position: relative;\n    min-height: 40px;\n    padding: 5px 0 5px 12px;\n    border: 0;\n    border-radius: 0;\n    gap: 4px;"),
    "frontend styles missing Story Studio desktop thinner nav reference rows",
  );
  assert.ok(
    styles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav-title {\n    font-size: 0.7rem;\n    line-height: 1.2;"),
    "frontend styles missing Story Studio desktop quieter nav label copy",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .panel-story-studio {\n    gap: 13px;\n    padding: 15px 20px 17px;\n    border-color: color-mix(in oklch, var(--border-soft) 66%, transparent);\n    border-radius: 26px;"),
    "frontend styles missing Story Studio desktop quieter title-band outer shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .panel-story-studio > h2 {\n    display: flex;\n    align-items: center;\n    gap: 7px;\n    margin-bottom: 0;\n    font-size: clamp(1.64rem, 1.08rem + 0.98vw, 1.98rem);"),
    "frontend styles missing Story Studio desktop tighter editorial title lockup",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-intro {\n    max-width: 30ch;\n    margin-top: -5px;\n    padding-left: 46px;\n    font-size: 0.6875rem;"),
    "frontend styles missing Story Studio desktop tucked title-band intro deck",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-overview-chip {\n    min-height: 0;\n    padding: 0;\n    border: 0;"),
    "frontend styles missing Story Studio desktop quiet brief-tag",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell {\n    gap: 9px;\n    padding: 18px 20px 18px;\n    border-radius: 24px;\n    border-color: color-mix(in oklch, var(--border-soft) 80%, transparent);"),
    "frontend styles missing Story Studio desktop calmer prerun studio page shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head {\n    grid-template-columns: minmax(0, 1fr) max-content;\n    gap: 7px 18px;\n    align-items: start;\n    padding-bottom: 7px;\n    border-bottom: 1px solid color-mix(in oklch, var(--border-soft) 40%, transparent);"),
    "frontend styles missing Story Studio desktop tighter brief-heading divider",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy h3 {\n    max-width: 28ch;\n    font-size: clamp(1.3rem, 1.14rem + 0.34vw, 1.48rem);\n    line-height: 0.98;\n    letter-spacing: -0.038em;"),
    "frontend styles missing Story Studio desktop tighter brief-heading title block",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy p {\n    max-width: 44ch;\n    font-size: 0.72rem;\n    line-height: 1.38;\n    color: color-mix(in oklch, var(--foreground) 58%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop quieter brief-heading support line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-rail {\n    grid-template-columns: minmax(0, 1.12fr) repeat(3, max-content);\n    align-items: center;\n    gap: 6px 9px;\n    margin-top: 1px;\n    padding: 4px 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 26%, transparent);"),
    "frontend styles missing Story Studio desktop quieter mode-row brief header",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active {\n    gap: 2px 8px;\n    padding: 8px 10px;\n    border-radius: 12px;\n    border-color: color-mix(in oklch, var(--border-soft) 30%, transparent);"),
    "frontend styles missing Story Studio desktop flatter active mode card",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active .story-mode-hint {\n    max-width: 24ch;\n    color: color-mix(in oklch, var(--foreground) 62%, var(--muted-foreground));\n    font-size: 0.64rem;\n    line-height: 1.28;\n    opacity: 0.82;"),
    "frontend styles missing Story Studio desktop quieter active mode support line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip {\n    position: relative;\n    align-items: baseline;\n    gap: 0;\n    margin-top: -1px;\n    padding: 2px 0 0 11px;"),
    "frontend styles missing Story Studio desktop tucked cue-facts header",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    top: 2px;\n    bottom: 1px;\n    width: 1px;"),
    "frontend styles missing Story Studio desktop cue-line guide rule",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-card {\n    display: inline-flex;\n    align-items: baseline;\n    gap: 3px;\n    max-width: 18ch;\n    padding: 0 10px 0 0;"),
    "frontend styles missing Story Studio desktop inline direction-reference facts",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-value {\n    display: block;\n    max-width: 13ch;\n    font-size: 0.66rem;\n    line-height: 1.2;\n    color: color-mix(in oklch, var(--foreground) 60%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop quieter cue-value ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-canvas {\n    margin-top: -1px;\n    gap: 9px;\n    padding: 16px 18px 15px;\n    border-radius: 17px;"),
    "frontend styles missing Story Studio desktop softer nested brief canvas",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field .field-heading {\n    display: grid;\n    justify-content: start;\n    gap: 3px;\n    padding-left: 1px;"),
    "frontend styles missing Story Studio desktop title-first prompt header",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-count {\n    padding: 0;\n    min-height: 0;\n    border-color: transparent;\n    background: transparent;\n    color: color-mix(in oklch, var(--foreground) 54%, var(--muted-foreground));\n    font-size: 0.6875rem;"),
    "frontend styles missing Story Studio desktop quieter prompt footnote",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field textarea {\n    min-height: 194px;\n    padding: 17px 20px 19px;\n    border-radius: 18px;\n    border-color: color-mix(in oklch, var(--border-soft) 52%, transparent);"),
    "frontend styles missing Story Studio desktop calmer writing-surface textarea",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions {\n    grid-template-columns: max-content minmax(0, 1fr);\n    align-items: center;\n    padding-top: 10px;\n    gap: 10px 14px;"),
    "frontend styles missing Story Studio desktop tighter write-surface handoff",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field textarea:focus {\n    border-color: color-mix(in oklch, var(--accent) 18%, var(--border-soft));"),
    "frontend styles missing Story Studio desktop softer writing-surface focus state",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px 8px;\n    padding-top: 3px;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 32%, transparent);"),
    "frontend styles missing Story Studio desktop quieter tray-shelf ledger divider",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) > summary {\n    position: relative;\n    grid-template-columns: minmax(138px, max-content) minmax(0, 1fr);\n    align-items: center;\n    gap: 6px 10px;\n    min-height: 54px;\n    padding: 8px 30px 8px 13px;"),
    "frontend styles missing Story Studio desktop tighter tray ledger rows",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) > summary::after {\n    position: absolute;\n    top: 50%;\n    right: 12px;\n    width: 14px;\n    height: 14px;"),
    "frontend styles missing Story Studio desktop pinned tray chevron rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-hint {\n    display: none;"),
    "frontend styles missing Story Studio desktop hidden collapsed tray helper line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-summary-meta .story-atlas-tag {\n    min-height: 0;\n    padding: 0;\n    border: 0;\n    background: transparent;\n    color: color-mix(in oklch, var(--foreground) 50%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop inline tray meta facts",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-summary {\n    display: flex;\n    flex-wrap: nowrap;\n    align-items: baseline;\n    justify-content: flex-start;\n    gap: 4px 7px;\n    min-width: 0;"),
    "frontend styles missing Story Studio desktop quieter after-CTA tray ledger notes",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-summary-text {\n    max-width: none;\n    min-width: 0;\n    flex: 1 1 auto;\n    font-size: 0.6875rem;\n    line-height: 1.28;"),
    "frontend styles missing Story Studio desktop shorter tray after-note measure",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-summary-meta {\n    flex-wrap: nowrap;\n    align-items: baseline;\n    gap: 3px 6px;\n    min-width: max-content;\n    padding-left: 8px;\n    border-left: 1px solid color-mix(in oklch, var(--border-soft) 28%, transparent);"),
    "frontend styles missing Story Studio desktop tray meta divider rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-tray:not([open]) > summary {\n    position: relative;\n    grid-template-columns: minmax(170px, max-content) minmax(0, 1fr);\n    align-items: center;\n    gap: 8px 16px;\n    min-height: 64px;"),
    "frontend styles missing Story Studio desktop steadier collapsed-tray geometry",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-tray:not([open]) .story-tray-summary {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) auto;\n    align-items: center;\n    gap: 4px 10px;"),
    "frontend styles missing Story Studio desktop one-line tray summary layout",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px 8px;"),
    "frontend styles missing Story Studio desktop equalized tray shelf grid",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-side-card-dossier {\n    border: 0;\n    border-left: 1px solid color-mix(in oklch, var(--border-soft) 72%, transparent);"),
    "frontend styles missing Story Studio desktop flatter output dossier rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-support-strip {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 0;\n    padding-top: 11px;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 64%, transparent);"),
    "frontend styles missing Story Studio desktop inline preview support strip",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail,\n  .layout.is-story-focused .story-results-secondary {\n    gap: 6px;\n    padding: 11px 12px 12px;"),
    "frontend styles missing Story Studio desktop quieter production-column shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-tag {\n    min-height: 0;\n    padding: 0;\n    border: 0;\n    background: transparent;"),
    "frontend styles missing Story Studio desktop flatter atlas fact tags",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-card.is-active {\n    gap: 4px;\n    min-height: 0;\n    padding-top: 8px;"),
    "frontend styles missing Story Studio desktop calmer active atlas note panel",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-card .story-section-eyebrow {\n    display: none;"),
    "frontend styles missing Story Studio desktop hidden atlas inner eyebrow",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail .story-guidance {\n    padding: 8px 0 0;\n    border: 0;\n    border-top: 1px dashed color-mix(in oklch, var(--border-soft) 58%, transparent);"),
    "frontend styles missing Story Studio desktop flatter run-guidance rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail.is-error .story-guidance {\n  padding: 8px 0 0;\n  border: 0;\n  border-top: 1px dashed color-mix(in oklch, oklch(0.68 0.1 28) 20%, var(--border-soft));"),
    "frontend styles missing Story Studio desktop failed-run guidance rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail .story-stat-card {\n    gap: 2px;\n    padding: 8px 0 9px;\n    border: 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 52%, transparent);"),
    "frontend styles missing Story Studio desktop flatter run-brief stat ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail.is-error .story-stat-card {\n  gap: 2px;\n  padding: 8px 0 9px;\n  border: 0;\n  border-top: 1px solid color-mix(in oklch, oklch(0.68 0.08 28) 16%, var(--border-soft));"),
    "frontend styles missing Story Studio desktop failed-run stat ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail:not(.is-idle) .story-stat-card-title {\n    background: transparent;\n    box-shadow: none;"),
    "frontend styles missing Story Studio desktop flat ready-state run-title ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-body-card-main {\n    gap: 8px;\n    padding: 10px 0 0;\n    border: 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 68%, transparent);"),
    "frontend styles missing Story Studio desktop editorial latest-output narrative surface",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-latest-output-body {\n    min-height: 0;\n    padding: 13px 0 0;\n    border: 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 62%, transparent);"),
    "frontend styles missing Story Studio desktop flatter ready-state latest-output body shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-section-head p,\n  .layout.is-story-focused .story-latest-output-shell.is-ready .story-latest-output-meta {\n    display: none;"),
    "frontend styles missing Story Studio desktop output-header declutter",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-summary.is-display-meta {\n    max-width: none;\n    color: color-mix(in oklch, var(--foreground) 66%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop title-first output meta line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-kicker {\n    min-height: 0;\n    padding: 0;\n    border: 0;\n    border-radius: 0;\n    background: transparent;"),
    "frontend styles missing Story Studio desktop quiet ready-state output overline",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-shell.is-ready .story-section-head p {\n    display: none;"),
    "frontend styles missing Story Studio desktop current-scene header declutter",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-head {\n    display: grid;\n    grid-template-columns: max-content minmax(0, 1fr);\n    align-items: start;\n    gap: 6px 10px;"),
    "frontend styles missing Story Studio desktop stacked current-scene header rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-summary.story-preview-summary-meta {\n    max-width: none;\n    color: color-mix(in oklch, var(--foreground) 64%, var(--muted-foreground));"),
    "frontend styles missing Story Studio desktop current-scene compact fact line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-support-card:not(.story-preview-support-card-assets) {\n    display: none;"),
    "frontend styles missing Story Studio desktop asset-first current-scene support rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-main.is-compact .story-output-cue-strip {\n    padding-top: 7px;\n    border-top: 1px dashed color-mix(in oklch, var(--border-soft) 62%, transparent);"),
    "frontend styles missing Story Studio desktop compact output fact rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-cue-pill {\n    min-height: 0;\n    padding: 0;\n    border: 0;\n    background: transparent;"),
    "frontend styles missing Story Studio desktop inline latest-output cue facts",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-run-rail .story-stat-label {\n    font-size: 0.6875rem;\n    line-height: 1.18;"),
    "frontend styles missing Story Studio post-run readable run-label floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-meta {\n    max-width: none;\n    padding-top: 6px;\n    border-top: 1px dashed color-mix(in oklch, var(--border-soft) 56%, transparent);\n    color: color-mix(in oklch, var(--foreground) 60%, var(--muted-foreground));\n    font-size: 0.6875rem;\n    line-height: 1.38;"),
    "frontend styles missing Story Studio post-run readable atlas fact line",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-kicker {\n    min-height: 0;\n    padding: 0;\n    border: 0;\n    border-radius: 0;\n    background: transparent;\n    color: color-mix(in oklch, var(--foreground) 48%, var(--muted-foreground));\n    font-size: 0.6875rem;\n    line-height: 1.2;"),
    "frontend styles missing Story Studio post-run readable ready-state overline",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-stage {\n    grid-template-columns: minmax(0, 1.28fr) minmax(220px, 0.72fr);\n    gap: 12px;"),
    "frontend styles missing Story Studio calmer ready-state output stage rhythm",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-body-card-main {\n    gap: 9px;\n    padding-top: 12px;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 58%, transparent);"),
    "frontend styles missing Story Studio calmer ready-state output narrative spacing",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-error .story-output-stage {\n    grid-template-columns: minmax(0, 1.24fr) minmax(208px, 0.76fr);\n    gap: 11px;"),
    "frontend styles missing Story Studio desktop failed-run output stage rhythm",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-error .story-output-cue-strip {\n    max-width: 60ch;\n    gap: 4px 9px;\n    padding-top: 7px;"),
    "frontend styles missing Story Studio desktop failed-run output cue rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-error .story-output-body-text {\n    max-width: 56ch;\n    max-height: none;\n    overflow: visible;"),
    "frontend styles missing Story Studio desktop failed-run output body measure",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-error .story-output-side-card-dossier {\n    border: 0;\n    border-left: 1px solid color-mix(in oklch, oklch(0.68 0.08 28) 14%, var(--border-soft));"),
    "frontend styles missing Story Studio desktop failed-run dossier rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-body-card-compact {\n    gap: 0;\n    max-width: 68ch;\n    padding-top: 10px;"),
    "frontend styles missing Story Studio desktop compact latest-output excerpt block",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-primary .story-preview-stage {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 8px;\n    padding: 12px 0 0;\n    border: 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 64%, transparent);"),
    "frontend styles missing Story Studio calmer current-scene editorial stage",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-metrics.is-compact {\n    grid-template-columns: repeat(4, max-content);\n    align-items: baseline;\n    gap: 5px 12px;"),
    "frontend styles missing Story Studio calmer production-metric ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-variants-grid {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr);\n    gap: 0;\n    overflow: visible;"),
    "frontend styles missing Story Studio calmer recent-passes revision ledger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-variant-card {\n    gap: 3px;\n    padding: 10px 0;\n    border: 0;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 54%, transparent);\n    border-radius: 0;\n    background: transparent;\n    box-shadow: none;"),
    "frontend styles missing Story Studio flat recent-passes ledger rows",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-primary .story-section-eyebrow {\n  min-height: 28px;\n  padding: 5px 10px;\n  font-size: 0.6875rem;\n  line-height: 1.18;"),
    "frontend styles missing Story Studio post-run readable result-eyebrow floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-dossier-label {\n    font-size: 0.6875rem;\n    line-height: 1.18;"),
    "frontend styles missing Story Studio post-run readable dossier label floor",
  );
  assert.ok(
    styles.includes(".story-output-side-card-dossier .story-output-card-tag {\n  min-height: 26px;\n  padding: 4px 9px;\n  font-size: 0.6875rem;"),
    "frontend styles missing Story Studio readable output dossier tag floor",
  );
  assert.ok(
    styles.includes(".story-output-metric span {\n  color: color-mix(in oklch, var(--foreground) 66%, var(--muted-foreground));\n  font-size: 0.6875rem;\n  font-weight: 700;\n  line-height: 1.24;"),
    "frontend styles missing Story Studio readable output-metric label floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-bottom-grid {\n    grid-template-columns: minmax(192px, 0.38fr) minmax(0, 1.62fr);\n    gap: 8px;\n    padding: 14px 15px 15px;"),
    "frontend styles missing Story Studio desktop calmer filmstrip-lane shell",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-hint {\n    padding: 8px 0 0;\n    border: 0;\n    border-top: 1px dashed color-mix(in oklch, var(--border-soft) 62%, transparent);"),
    "frontend styles missing Story Studio desktop quieter navigator utility strip",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-footer {\n    grid-template-columns: minmax(0, 1fr) auto;\n    align-items: end;\n    gap: 6px 10px;\n    padding-top: 9px;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 64%, transparent);"),
    "frontend styles missing Story Studio desktop lighter storyboard shelf meta rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-index {\n  min-height: 24px;\n  padding: 4px 9px;\n  font-size: 0.6875rem;\n  letter-spacing: 0.14em;\n  line-height: 1.18;"),
    "frontend styles missing Story Studio readable storyboard pill floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid .field > span {\n  font-size: 0.6875rem;\n  line-height: 1.28;\n  letter-spacing: 0.12em;"),
    "frontend styles missing Story Studio post-run readable timeline-control label floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid {\n    grid-template-columns: minmax(0, 1fr);\n    gap: 7px;"),
    "frontend styles missing Story Studio desktop compact navigator control-grid",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid .field:nth-child(3) {\n    display: flex;\n    grid-column: 1 / -1;\n    align-items: baseline;\n    gap: 8px;"),
    "frontend styles missing Story Studio desktop inline board-position note rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-scenes-shell.is-ready .story-timeline-list,\n  .layout.is-story-focused .story-scenes-shell.is-pending .story-timeline-list {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 7px;"),
    "frontend styles missing Story Studio desktop aligned storyboard grid shelf",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid .field :is(select, .select-trigger) {\n    display: block;\n    min-height: 38px;\n    padding: 8px 28px 8px 10px;\n    overflow: hidden;\n    font-size: 0.72rem;\n    line-height: 1.28;\n    white-space: nowrap;\n    text-overflow: ellipsis;"),
    "frontend styles missing Story Studio desktop ellipsized scene-jump trigger",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-support-card-assets .story-asset-pill {\n    min-width: 0;\n    max-width: 100%;\n    padding: 6px 11px;\n    overflow: hidden;\n    white-space: nowrap;\n    text-overflow: ellipsis;"),
    "frontend styles missing Story Studio desktop compact preview asset-pill overflow handling",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-support-card-assets .story-preview-assets {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr);\n    gap: 6px;"),
    "frontend styles missing Story Studio desktop full-width preview asset stack",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-grid {\n    grid-template-columns: minmax(0, 1.36fr) minmax(220px, 0.64fr);\n    gap: 9px;"),
    "frontend styles missing Story Studio desktop left-heavy post-run reading lane",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-meta {\n    font-size: 0.6875rem;\n    line-height: 1.42;"),
    "frontend styles missing Story Studio post-run readable storyboard meta floor",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-title {\n    display: -webkit-box;\n    overflow: hidden;\n    font-size: 0.86rem;\n    line-height: 1.18;"),
    "frontend styles missing Story Studio desktop clamped storyboard card titles",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) > summary {\n    position: relative;\n    grid-template-columns: minmax(124px, max-content) minmax(0, 1fr);\n    align-items: center;\n    gap: 5px 9px;\n    min-height: 52px;\n    padding: 7px 29px 7px 12px;"),
    "frontend styles missing Story Studio desktop tighter one-line tray lockups",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell .story-tray-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 8px;\n    align-items: stretch;"),
    "frontend styles missing Story Studio desktop real compose-shell three-up tray shelf",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell #storyDirectionTray:not([open]) {\n    grid-column: auto;"),
    "frontend styles missing Story Studio desktop non-tetris editorial tray placement",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell .story-tray:not([open]) > summary {\n    position: relative;\n    grid-template-columns: minmax(0, 1fr);\n    align-content: center;\n    gap: 4px;\n    min-height: 58px;\n    padding: 10px 34px 10px 14px;"),
    "frontend styles missing Story Studio desktop stacked collapsed tray summary rows",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell .story-tray:not([open]) .story-tray-hint {\n    overflow: hidden;\n    font-size: 0.6875rem;\n    line-height: 1.38;\n    white-space: nowrap;\n    text-overflow: ellipsis;"),
    "frontend styles missing Story Studio desktop one-line tray helper lock",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-tray:not([open]) .story-tray-title {\n    font-size: 0.82rem;\n    line-height: 1.08;\n    white-space: nowrap;"),
    "frontend styles missing Story Studio desktop single-line collapsed tray titles",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-grid {\n    grid-template-columns: minmax(0, 1.42fr) minmax(244px, 0.58fr);\n    align-items: start;\n    gap: 8px;"),
    "frontend styles missing Story Studio desktop tighter runtime reading split",
  );
  assert.ok(
    html.includes('href="/storyteller-runtime-tail.css?v=20260316"'),
    "frontend html missing versioned storyteller tail stylesheet",
  );
  assert.ok(
    html.includes('href="/storyteller-header-nav-authority.css?v=20260316g"'),
    "frontend html missing versioned storyteller header/left-rail authority stylesheet",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-13 Pass - desktop storyteller one-line and honest-wrap cleanup (late load) */"),
    "storyteller tail stylesheet missing desktop one-line cleanup pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-card {\n    gap: 3px;\n    max-width: none;\n    min-width: 0;\n    margin-right: 10px;\n    padding-right: 14px;\n    border-right: 1px solid color-mix(in oklch, var(--border-soft) 34%, transparent);"),
    "storyteller tail stylesheet missing calmer cue-line ledger separators",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-summary-text {\n    flex: 1 1 19ch;\n    min-width: 12ch;\n    max-width: none;\n    display: block;\n    overflow: visible;\n    font-size: 0.75rem;\n    line-height: 1.46;\n    white-space: normal;\n    text-overflow: clip;"),
    "storyteller tail stylesheet missing honest-wrap tray summaries",
  );
  assert.ok(
    html.includes('class="story-flow-strip" aria-label="Story flow" hidden aria-hidden="true"'),
    "frontend html missing Story Studio hidden helper stepper accessibility guard",
  );
  assert.ok(
    storytellerTailStyles.includes(".story-flow-strip[hidden] .story-flow-step::after {\n  content: none !important;\n}"),
    "storyteller tail stylesheet missing hidden helper pseudo-arrow suppression",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-13 Pass - desktop storyteller tray chrome and aligned summary stack */"),
    "storyteller tail stylesheet missing desktop tray chrome pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-summary {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr);\n    grid-template-rows: minmax(2.15rem, auto) auto;"),
    "storyteller tail stylesheet missing desktop tray fixed summary/meta stack",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-results-grid {\n    grid-template-columns: minmax(0, 1.66fr) minmax(272px, 0.34fr);\n    align-items: start;\n    gap: 12px;"),
    "storyteller tail stylesheet missing wider narrative-vs-atlas split",
  );
  assert.ok(
    styles.includes("/* 2026-03-13: storyteller desktop final one-line and honest-wrap cleanup pass */"),
    "frontend styles missing Story Studio final desktop honest-wrap cleanup pass comment",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell .story-tray > summary {\n    list-style: none;"),
    "frontend styles missing Story Studio desktop native tray-marker reset",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-shell .story-tray:not([open]) .story-tray-summary-text {\n    flex: 1 1 19ch;\n    min-width: 12ch;\n    max-width: none;\n    display: block;\n    overflow: visible;\n    font-size: 0.75rem;\n    line-height: 1.46;\n    white-space: normal;\n    text-overflow: clip;"),
    "frontend styles missing Story Studio desktop honest-wrap tray summaries",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-grid {\n    grid-template-columns: minmax(0, 1.66fr) minmax(272px, 0.34fr);\n    align-items: start;\n    gap: 12px;"),
    "frontend styles missing Story Studio desktop wider narrative-vs-atlas split",
  );
  assert.ok(
    readme.includes("one-line title/deck lines where width allows"),
    "README missing Story Studio desktop one-line title/deck note",
  );
  assert.ok(
    judgeQuickstart.includes("honest wrap instead of fake ellipses"),
    "judge quickstart missing Story Studio desktop honest-wrap note",
  );
  assert.ok(
    operatorGuide.includes("hides native tray markers so the custom chevrons stay aligned and intentional"),
    "operator guide missing Story Studio desktop aligned chevron note",
  );
  assert.ok(
    app.includes('"storyteller.intro": "Бриф, сцены и медиа в одном холсте."'),
    "frontend app missing Story Studio Russian one-line intro copy",
  );
  assert.ok(
    app.includes('scripted: "Сценарная озвучка"'),
    "frontend app missing Story Studio Russian readable narration label",
  );
  assert.ok(
    app.includes('applyStoryComposerMode(state.storyComposerMode, { previousConfig: previousStoryModeConfig });'),
    "frontend app missing Story Studio language-switch default refresh",
  );
  assert.ok(
    app.includes('function renderLiveIntentExperience() {\n  const intent = el.intent instanceof HTMLSelectElement ? el.intent.value : state.lastRequestedIntent;\n  const normalizedIntent = typeof intent === "string" && intent.trim().length > 0 ? intent.trim() : "conversation";'),
    "frontend app missing live intent normalization before composer-specific visibility toggles",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-copy h3 {\n    max-width: none;\n    white-space: nowrap;"),
    "frontend styles missing Story Studio desktop one-line compose heading override",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-grid {\n    grid-template-columns: minmax(0, 1.46fr) minmax(292px, 0.54fr);\n    gap: 12px;"),
    "frontend styles missing Story Studio desktop wider readable post-run split",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-output-dossier-note {\n    display: -webkit-box;\n    max-width: none;\n    overflow: hidden;\n    white-space: normal;"),
    "frontend styles missing Story Studio desktop readable dossier notes without misleading ellipsis",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-preview-shell.is-ready .story-preview-summary.story-preview-summary-meta {\n    overflow: visible;\n    white-space: normal;\n    text-overflow: clip;"),
    "frontend styles missing Story Studio desktop wrapped current-scene meta rail",
  );
  assert.ok(
    styles.includes(".story-tray > summary::marker {\n  content: \"\";"),
    "frontend styles missing Story Studio custom tray marker reset",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-results-secondary {\n    align-self: start;\n    gap: 5px;\n    padding: 10px 11px 11px;"),
    "frontend styles missing Story Studio desktop compact atlas support rail",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-stage {\n    grid-template-columns: minmax(0, 1.34fr) minmax(232px, 0.66fr);\n    gap: 11px;"),
    "frontend styles missing Story Studio desktop calmer ready-state output ratio",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-stage,\n  .layout.is-story-focused .story-latest-output-shell.is-error .story-output-stage {\n    grid-template-columns: minmax(0, 1.48fr) minmax(212px, 0.52fr);\n    gap: 14px;"),
    "frontend styles missing Story Studio desktop wider narrative output stage",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-bottom-grid {\n    grid-template-columns: minmax(224px, 0.34fr) minmax(0, 1.66fr);\n    align-items: start;\n    gap: 7px;\n    padding: 13px 14px 14px;"),
    "frontend styles missing Story Studio desktop steadier navigator storyboard split",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-bottom-grid {\n    grid-template-columns: minmax(236px, 0.32fr) minmax(0, 1.68fr);\n    align-items: start;\n    gap: 9px;\n    padding: 14px 15px 15px;"),
    "frontend styles missing Story Studio desktop calmer lower-lane proportion pass",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid .field :is(select, .select-trigger) {\n    display: flex;\n    align-items: center;\n    width: 100%;\n    min-height: 36px;\n    padding: 7px 31px 7px 10px;"),
    "frontend styles missing Story Studio desktop selector trigger alignment pass",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-controls-grid {\n    grid-template-columns: minmax(0, 1fr) 104px;\n    gap: 7px 9px;"),
    "frontend styles missing Story Studio desktop calmer selector-position row split",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-card,\n  .layout.is-story-focused .story-segment-card.is-selected {\n    min-height: 186px;"),
    "frontend styles missing Story Studio desktop tighter storyboard card cadence",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-card,\n  .layout.is-story-focused .story-segment-card.is-selected {\n    min-height: 192px;"),
    "frontend styles missing Story Studio desktop roomier storyboard card cadence",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-segment-title {\n    font-size: 0.85rem;\n    line-height: 1.15;\n    min-height: calc(2 * 1.15em);"),
    "frontend styles missing Story Studio desktop steadier storyboard title clamp",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-field .field-inline-hint {\n    display: none;"),
    "frontend styles missing Story Studio smaller mobile prompt-hint trim",
  );
  assert.ok(
    styles.includes(".layout.is-story-focused .story-compose-count {\n    padding: 0;"),
    "frontend styles missing Story Studio smaller mobile flat count treatment",
  );
  assert.ok(
    styles.includes("border-top: 1px solid color-mix(in oklch, var(--border-soft) 58%, transparent);"),
    "frontend styles missing Story Studio compose-action divider",
  );
  assert.ok(
    styles.includes("border-bottom: 1px solid color-mix(in oklch, var(--border-soft) 48%, transparent);"),
    "frontend styles missing Story Studio tray section divider",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(characterFocus, 5, 40),"),
    "frontend app missing Story Studio desktop lead-first craft tray shorthand",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(worldFocus, 6, 48),"),
    "frontend app missing Story Studio desktop world shorthand cap",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller real eof authority */"),
    "storyteller tail stylesheet missing Story Studio real eof authority pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero/nav atmospheric refinement */"),
    "storyteller tail stylesheet missing Story Studio atmospheric hero/nav pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero lockup refinement */"),
    "storyteller tail stylesheet missing Story Studio hero lockup refinement pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller title-band editorial continuation */"),
    "storyteller tail stylesheet missing Story Studio title-band continuation pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller outer frame softening */"),
    "storyteller tail stylesheet missing Story Studio outer-frame softening pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller top-shell hierarchy calming */"),
    "storyteller tail stylesheet missing Story Studio top-shell calming pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero/nav readability framing */"),
    "storyteller tail stylesheet missing Story Studio hero/nav readability pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero/nav structure refinement */"),
    "storyteller tail stylesheet missing Story Studio hero/nav structure refinement pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero/nav depth and alignment final */"),
    "storyteller tail stylesheet missing Story Studio hero/nav depth/alignment final pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller full-width header continuity */"),
    "storyteller tail stylesheet missing Story Studio full-width header continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller brief-header mode and cue continuity */"),
    "storyteller tail stylesheet missing Story Studio brief-header mode/cue continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller writing-surface and CTA continuity */"),
    "storyteller tail stylesheet missing Story Studio writing-surface/CTA continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller collapsed-tray shelf continuity */"),
    "storyteller tail stylesheet missing Story Studio collapsed-tray shelf continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero/title foreground continuity */"),
    "storyteller tail stylesheet missing Story Studio hero/title foreground continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller hero lockup and ledger clarity */"),
    "storyteller tail stylesheet missing Story Studio hero lockup/ledger clarity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-14 Pass - desktop storyteller top microcopy rhythm */"),
    "storyteller tail stylesheet missing Story Studio top microcopy rhythm pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller brief status utility rail */"),
    "storyteller tail stylesheet missing Story Studio brief status utility rail pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller 95% foreground readability overlay */"),
    "storyteller tail stylesheet missing Story Studio 95% foreground readability overlay pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller postrun reading lane continuity */"),
    "storyteller tail stylesheet missing Story Studio postrun reading-lane continuity pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy h3,\n  .layout.is-story-focused .story-shell-top .story-compose-copy h3 {\n    width: max-content !important;\n    max-width: none !important;"),
    "storyteller tail stylesheet missing Story Studio desktop one-line creative brief headline authority",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .hero-headline::after {\n    content: \"\" !important;\n    position: absolute !important;\n    right: 0 !important;\n    bottom: 0 !important;\n    left: 0 !important;\n    height: 1px !important;"),
    "storyteller tail stylesheet missing Story Studio atmospheric hero baseline",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .hero::before {\n    content: \"\" !important;\n    position: absolute !important;\n    inset: -14px 0 6px !important;"),
    "storyteller tail stylesheet missing Story Studio upper-fold smoke-glass continuity layer",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .panel-story-studio {\n    position: relative !important;\n    margin-top: -6px !important;\n    padding: 18px 22px 18px !important;"),
    "storyteller tail stylesheet missing Story Studio softened hero-to-studio bridge shell",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) auto !important;"),
    "storyteller tail stylesheet missing Story Studio hero two-zone lockup grid",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-card:has(#workspaceGlanceThreeValue:empty) {\n    display: none !important;"),
    "storyteller tail stylesheet missing Story Studio empty hero glance-slot suppression",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .panel-story-studio > h2 {\n    display: grid !important;\n    grid-template-columns: max-content minmax(0, 1fr) !important;"),
    "storyteller tail stylesheet missing Story Studio calmer top title grid",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy p,\n  .layout.is-story-focused .story-shell-top .story-compose-copy p {\n    width: min(100%, 52ch) !important;\n    max-width: 52ch !important;"),
    "storyteller tail stylesheet missing Story Studio calmer brief deck measure",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head,\n  .layout.is-story-focused .story-shell-top .story-compose-head {\n    grid-template-columns: minmax(0, 1fr) fit-content(24ch) !important;"),
    "storyteller tail stylesheet missing Story Studio compact brief status track",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun #storyComposeStatus,\n  .layout.is-story-focused .story-shell-top #storyComposeStatus {\n    max-width: 24ch !important;\n    font-size: 0.6875rem !important;"),
    "storyteller tail stylesheet missing Story Studio compact brief status copy measure",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    min-height: 116px !important;\n    padding: 24px 34px 22px !important;"),
    "storyteller tail stylesheet missing Story Studio denser 95 percent hero foreground plate",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .panel-story-studio {\n    margin-top: -4px !important;\n    padding: 18px 22px 20px !important;"),
    "storyteller tail stylesheet missing Story Studio 95 percent foreground studio shell",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell,\n  .layout.is-story-focused .story-shell-top .story-compose-shell {\n    background:\n      linear-gradient(\n        180deg,\n        color-mix(in oklch, var(--surface-panel) 95%, transparent) 0%,"),
    "storyteller tail stylesheet missing Story Studio 95 percent foreground compose shell",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyResultsGrid.story-results-grid {\n    grid-template-columns: minmax(0, 1.56fr) minmax(290px, 0.44fr) !important;"),
    "storyteller tail stylesheet missing Story Studio wider postrun reading-lane split",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyAtlasRail.story-atlas-rail {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;"),
    "storyteller tail stylesheet missing Story Studio equal-width atlas tab rail",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyTimelineList.story-timeline-list {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;"),
    "storyteller tail stylesheet missing Story Studio storyboard three-up board grid",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn::after {\n    content: \"\" !important;\n    position: absolute !important;\n    inset: 0 !important;\n    border: 1px solid color-mix(in oklch, var(--border-soft) 20%, transparent) !important;"),
    "storyteller tail stylesheet missing Story Studio atmospheric nav row chrome",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal::before {\n    content: \"\" !important;\n    position: absolute !important;\n    top: 4px !important;\n    bottom: 4px !important;\n    left: 0 !important;\n    width: 1px !important;"),
    "storyteller tail stylesheet missing Story Studio hero accent rail",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head::before,\n  .layout.is-story-focused .story-shell-top .story-compose-head::before {\n    content: \"\" !important;\n    position: absolute !important;\n    top: 2px !important;\n    bottom: 10px !important;\n    left: 0 !important;\n    width: 1px !important;"),
    "storyteller tail stylesheet missing Story Studio title-band accent rail",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status,\n  .layout.is-story-focused .story-shell-top .story-compose-status {\n    align-self: end !important;\n    justify-self: end !important;\n    display: grid !important;"),
    "storyteller tail stylesheet missing Story Studio aligned title-band status column",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .panel-story-studio {\n    position: relative !important;\n    gap: 12px !important;\n    padding: 15px 20px 18px !important;"),
    "storyteller tail stylesheet missing Story Studio softened outer frame",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell,\n  .layout.is-story-focused .story-shell-top .story-compose-shell {\n    position: relative !important;\n    gap: 8px !important;\n    padding: 16px 18px 17px !important;"),
    "storyteller tail stylesheet missing Story Studio softened compose shell",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-intro {\n    max-width: 58ch !important;\n    margin-top: -2px !important;\n    overflow: hidden !important;"),
    "storyteller tail stylesheet missing Story Studio calmer one-line intro deck",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    position: relative !important;\n    max-width: 728px !important;\n    gap: 12px !important;"),
    "storyteller tail stylesheet missing Story Studio darker readable hero rail",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    width: 100% !important;\n    min-width: 0 !important;\n    min-height: 58px !important;"),
    "storyteller tail stylesheet missing Story Studio equal-width nav tabs",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav-title {\n    min-width: 0 !important;\n    overflow: hidden !important;\n    font-size: 0.78125rem !important;"),
    "storyteller tail stylesheet missing Story Studio one-line nav title lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-shell-meta {\n    gap: 18px !important;\n    padding-top: 9px !important;\n    border-top: 1px solid color-mix(in oklch, var(--border-soft) 24%, transparent) !important;"),
    "storyteller tail stylesheet missing Story Studio hero ledger divider",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav-icon {\n    display: inline-flex !important;\n    width: 36px !important;\n    min-height: 22px !important;"),
    "storyteller tail stylesheet missing Story Studio nav icon-chip treatment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    position: relative !important;\n    width: min(840px, calc(100% - 84px)) !important;"),
    "storyteller tail stylesheet missing Story Studio denser smoke-glass hero summary lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    width: 100% !important;\n    min-width: 0 !important;\n    min-height: 60px !important;"),
    "storyteller tail stylesheet missing Story Studio fixed nav footprint lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    width: 100% !important;\n    max-width: none !important;\n    min-height: 108px !important;"),
    "storyteller tail stylesheet missing Story Studio full-width hero summary continuity lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head,\n  .layout.is-story-focused .story-shell-top .story-compose-head {\n    grid-template-columns: minmax(0, 1.08fr) minmax(290px, 0.92fr) !important;"),
    "storyteller tail stylesheet missing Story Studio wider title-band continuity grid",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-mode-card.is-active {\n    min-width: 304px !important;"),
    "storyteller tail stylesheet missing Story Studio calmer active mode card lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip {\n    display: flex !important;\n    align-items: baseline !important;"),
    "storyteller tail stylesheet missing Story Studio inline cue-ledger treatment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field textarea,\n  .layout.is-story-focused .story-shell-top .story-compose-field textarea {\n    min-height: 194px !important;"),
    "storyteller tail stylesheet missing Story Studio roomier writing-surface textarea lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-count,\n  .layout.is-story-focused .story-shell-top .story-compose-count {\n    min-height: 0 !important;\n    padding: 0 !important;\n    border: 0 !important;"),
    "storyteller tail stylesheet missing Story Studio quiet 11px compose-count footnote treatment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions,\n  .layout.is-story-focused .story-shell-top .story-compose-actions {\n    width: 100% !important;\n    grid-template-columns: max-content minmax(0, 1fr) !important;"),
    "storyteller tail stylesheet missing Story Studio wider CTA handoff grid",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray-grid,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray-grid {\n    gap: 7px !important;"),
    "storyteller tail stylesheet missing Story Studio tighter three-up tray-shelf gap",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused :is(#storyCraftTray, #storyMediaTray, #storyDirectionTray):not([open]) > summary {\n    min-height: 106px !important;\n    gap: 7px !important;\n    padding: 13px 42px 12px 16px !important;"),
    "storyteller tail stylesheet missing Story Studio ID-specific tray summary authority",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-title,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) .story-tray-title {\n    width: 100% !important;\n    overflow: hidden !important;\n    white-space: nowrap !important;"),
    "storyteller tail stylesheet missing Story Studio one-line tray-title lock",
  );
  assert.ok(
    app.includes('composeChip: "Brief",'),
    "frontend runtime missing quieter Story Studio brief chip",
  );
  assert.ok(
    app.includes('composeStatusSubmitting: "Sending first pass.",'),
    "frontend runtime missing compact Story Studio compose submitting status",
  );
  assert.ok(
    app.includes('composeStatusUpdating: "Refreshing from brief.",'),
    "frontend runtime missing compact Story Studio compose updating status",
  );
  assert.ok(
    app.includes('const desktopQuietDeliverySignal = compactStorySignalValue('),
    "frontend runtime missing Story Studio widened desktop delivery cue compaction",
  );
  assert.ok(
    app.includes('? compactStoryReferenceValue(characterFocus, 6, 36)'),
    "frontend runtime missing Story Studio wider desktop lead cue compaction",
  );
  assert.ok(
    app.includes('? compactStoryReferenceValue(worldFocus, 6, 38)'),
    "frontend runtime missing Story Studio wider desktop world cue compaction",
  );
  assert.ok(
    app.includes("const deliverySignal = useDesktopQuietCompose"),
    "frontend runtime missing Story Studio desktop-aware delivery cue switch",
  );
  assert.ok(
    app.includes("const scopeSignal = useDesktopQuietCompose"),
    "frontend runtime missing Story Studio desktop-aware scope cue switch",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(characterFocus, 2, 20)"),
    "frontend runtime missing Story Studio fuller craft-tray lead summary compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(worldFocus, 3, 26)"),
    "frontend runtime missing Story Studio fuller craft-tray world summary compaction",
  );
  assert.ok(
    /const desktopQuietDeliverySignal = compactStorySignalValue\([\s\S]*?\n\s+36,\n\s+\);/.test(app),
    "frontend runtime missing Story Studio wider desktop delivery cue compaction",
  );
  assert.ok(
    /const desktopQuietScopeSignal = compactStorySignalValue\([\s\S]*?\n\s+28,\n\s+\);/.test(app),
    "frontend runtime missing Story Studio wider desktop scope cue compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(characterFocus, 6, 36)"),
    "frontend runtime missing Story Studio wider desktop lead cue compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(worldFocus, 6, 38)"),
    "frontend runtime missing Story Studio wider desktop world cue compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(fullText, 7, 64)"),
    "frontend runtime missing Story Studio fuller direction-tray summary compaction",
  );
  assert.ok(
    app.includes('outputIntro: "Newest response stays here while scenes and assets settle.",'),
    "frontend runtime missing clearer latest-output intro copy",
  );
  assert.ok(
    app.includes('"storyteller.previewIntro": "The selected scene stays here with copy and media.",'),
    "frontend runtime missing clearer preview intro copy",
  );
  assert.ok(
    app.includes('"storyteller.controlsIntro": "Jump scenes and keep the preview in view.",'),
    "frontend runtime missing clearer navigator intro copy",
  );
  assert.ok(
    app.includes('intro: "World, character, and media stay in one quieter sidecar.",'),
    "frontend runtime missing quieter atlas intro copy",
  );
  assert.ok(
    app.includes('guidancePendingTitle: "Scenes incoming",'),
    "frontend runtime missing tighter pending guidance title",
  );
  assert.ok(
    app.includes('listPendingTitle: "Scenes incoming",'),
    "frontend runtime missing tighter pending timeline title",
  );
  assert.ok(
    app.includes('title: isRu ? "\\u0411\\u0440\\u0438\\u0444 \\u0438 \\u0441\\u0446\\u0435\\u043d\\u044b" : "Brief and scenes",'),
    "frontend runtime missing quieter Story Studio workspace title",
  );
  assert.ok(
    app.includes('        : "Shape the brief first, then stage scenes and media.",'),
    "frontend runtime missing fuller Story Studio workspace description",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyResultsGrid.story-results-grid {\n    grid-template-columns: minmax(0, 1.44fr) minmax(320px, 0.56fr) !important;\n    gap: 14px !important;"),
    "storyteller tail stylesheet missing runtime id-specific atlas split authority",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller postrun action and microcopy clarity */"),
    "storyteller tail stylesheet missing Story Studio postrun action and microcopy pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyAtlasRail .story-atlas-tab.is-active {\n    border-color: color-mix(in oklch, var(--primary) 38%, var(--border-soft)) !important;"),
    "storyteller tail stylesheet missing Story Studio stronger active atlas-tab state",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .story-atlas-head p,\n  .layout.is-story-focused .story-atlas-meta {\n    display: block !important;\n    overflow: visible !important;\n    min-height: 2.96em !important;"),
    "storyteller tail stylesheet missing Story Studio readable atlas-support copy treatment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyTimelineList .story-segment-card.is-selected {\n    border-color: color-mix(in oklch, var(--primary) 34%, var(--border-soft)) !important;"),
    "storyteller tail stylesheet missing Story Studio stronger selected storyboard-card state",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused #storyTimelineList .story-segment-meta {\n    display: block !important;\n    overflow: visible !important;\n    min-height: 2.96em !important;"),
    "storyteller tail stylesheet missing Story Studio readable storyboard meta wrap treatment",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller header and left-rail refinement */"),
    "storyteller tail stylesheet missing Story Studio header and left-rail refinement pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1.14fr) auto !important;\n    gap: 14px 24px !important;"),
    "storyteller tail stylesheet missing Story Studio tighter header split lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-workspace-eyebrow {\n    display: inline-flex !important;"),
    "storyteller tail stylesheet missing Story Studio restored workspace eyebrow treatment",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused {\n    flex: 0 0 198px !important;\n    padding: 12px 10px 12px !important;"),
    "storyteller tail stylesheet missing Story Studio calmer left-rail shell",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    display: grid !important;\n    grid-template-columns: 44px minmax(0, 1fr) !important;"),
    "storyteller tail stylesheet missing Story Studio tighter fixed-footprint nav tabs",
  );
  assert.ok(
    storytellerTailStyles.includes("/* 2026-03-15 Pass - desktop storyteller header and left-rail air refinement */"),
    "storyteller tail stylesheet missing Story Studio header and left-rail air refinement pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller header and left-rail air refinement final authority */",
    ),
    "storyteller header authority stylesheet missing final air refinement pass comment",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1fr) fit-content(23.75rem) !important;\n    gap: 22px 36px !important;"),
    "storyteller tail stylesheet missing Story Studio airier header split and spacing lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1fr) fit-content(23.75rem) !important;\n    gap: 22px 36px !important;"),
    "storyteller header authority stylesheet missing final airy header split and spacing lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-shell-meta {\n    width: min(100%, 23.75rem) !important;\n    justify-self: end !important;\n    align-self: center !important;\n    display: grid !important;"),
    "storyteller tail stylesheet missing Story Studio utility-card meta cluster treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".dashboard-sidebar.is-story-focused {\n    flex: 0 0 232px !important;\n    min-width: 232px !important;\n    max-width: 232px !important;"),
    "storyteller header authority stylesheet missing final wider left-rail shell lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller studio band and compose-head air refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio band and compose-head air pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .panel-story-studio {\n    gap: 14px !important;\n    padding: 22px 24px 24px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer panel shell spacing",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .panel-story-studio .story-intro {\n    max-width: 52ch !important;\n    margin: -4px 0 0 64px !important;"),
    "storyteller header authority stylesheet missing Story Studio aligned one-line intro deck",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head,\n  .layout.is-story-focused .story-shell-top .story-compose-head {\n    grid-template-columns: minmax(0, 1fr) fit-content(16.5rem) !important;"),
    "storyteller header authority stylesheet missing Story Studio compose-head utility split",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy p,\n  .layout.is-story-focused .story-shell-top .story-compose-copy p {\n    max-width: 44ch !important;"),
    "storyteller header authority stylesheet missing Story Studio one-line compose support deck",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller mode rail and cue ledger air refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio mode-rail and cue-ledger air pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyModeRail.story-mode-rail,\n  .layout.is-story-focused .story-shell-top #storyModeRail.story-mode-rail {\n    gap: 10px 12px !important;\n    padding: 6px 0 8px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer desktop mode-rail spacing",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-signal-strip,\n  .layout.is-story-focused .story-shell-top .story-signal-strip {\n    gap: 2px !important;\n    padding: 8px 0 0 14px !important;"),
    "storyteller header authority stylesheet missing Story Studio roomier cue-ledger padding",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-signal-strip .story-signal-card-world .story-signal-value,\n  .layout.is-story-focused .story-shell-top .story-signal-strip .story-signal-card-world .story-signal-value {\n    max-width: 24ch !important;"),
    "storyteller header authority stylesheet missing Story Studio wider desktop world-cue measure",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller prompt lane and CTA handoff refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio prompt-lane and CTA handoff pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field .field-heading,\n  .layout.is-story-focused .story-shell-top .story-compose-field .field-heading {\n    display: grid !important;\n    grid-template-columns: auto minmax(0, 1fr) !important;"),
    "storyteller header authority stylesheet missing Story Studio prompt-heading one-line helper grid",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-count,\n  .layout.is-story-focused .story-shell-top .story-compose-count {\n    min-height: 0 !important;\n    font-size: 0.6875rem !important;"),
    "storyteller header authority stylesheet missing Story Studio readable 11px compose-count treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-secondary-actions,\n  .layout.is-story-focused .story-shell-top .story-compose-secondary-actions {\n    display: flex !important;\n    align-items: center !important;"),
    "storyteller header authority stylesheet missing Story Studio tidier secondary CTA utility rail",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller collapsed tray shelf rhythm refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio collapsed tray-shelf rhythm pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) > summary,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) > summary {\n    min-height: 112px !important;\n    grid-template-columns: minmax(0, 1fr) fit-content(10rem) !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer tray-summary split grid",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-hint,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) .story-tray-hint {\n    overflow: hidden !important;\n    font-size: 0.71875rem !important;"),
    "storyteller header authority stylesheet missing Story Studio one-line tray-undertext treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell .story-tray:not([open]) .story-tray-summary-meta,\n  .layout.is-story-focused .story-shell-top .story-compose-shell .story-tray:not([open]) .story-tray-summary-meta {\n    justify-content: flex-end !important;\n    align-items: center !important;"),
    "storyteller header authority stylesheet missing Story Studio quieter aligned tray-meta column",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller header and left-rail balance refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio header and left-rail balance pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1fr) fit-content(21.5rem) !important;\n    gap: 24px 28px !important;"),
    "storyteller header authority stylesheet missing Story Studio cleaner header split balance lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    width: 100% !important;\n    min-height: 62px !important;\n    height: 62px !important;"),
    "storyteller header authority stylesheet missing Story Studio fixed-height sidebar tab rows",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller studio shell depth and rhythm refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio shell depth and rhythm pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .panel-story-studio {\n    gap: 18px !important;\n    padding: 24px 28px 28px !important;"),
    "storyteller header authority stylesheet missing Story Studio roomier outer shell rhythm lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-shell,\n  .layout.is-story-focused .story-shell-top .story-compose-shell {\n    gap: 11px !important;\n    padding: 18px 20px 20px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer compose-shell paper-layer lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-canvas,\n  .layout.is-story-focused .story-shell-top .story-compose-canvas {\n    gap: 14px !important;\n    padding: 16px 18px 17px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer compose-canvas depth lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller compose-head lockup refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio compose-head lockup pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-head,\n  .layout.is-story-focused .story-shell-top .story-compose-head {\n    grid-template-columns: minmax(0, 1fr) fit-content(14.75rem) !important;\n    gap: 14px 24px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer compose-head split lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-copy p,\n  .layout.is-story-focused .story-shell-top .story-compose-copy p {\n    max-width: 48ch !important;\n    font-size: 0.8125rem !important;"),
    "storyteller header authority stylesheet missing Story Studio wider compose-support measure",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-status,\n  .layout.is-story-focused .story-shell-top .story-compose-status {\n    width: min(100%, 14.75rem) !important;\n    gap: 4px 10px !important;"),
    "storyteller header authority stylesheet missing Story Studio tighter compose-status utility rail",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller mode-rail lockup refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio mode-rail lockup pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyModeRail.story-mode-rail,\n  .layout.is-story-focused .story-shell-top #storyModeRail.story-mode-rail {\n    gap: 12px 14px !important;\n    padding: 7px 0 10px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer mode-rail row rhythm lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyModeRail .story-mode-card.is-active,\n  .layout.is-story-focused .story-shell-top #storyModeRail .story-mode-card.is-active {\n    min-width: 356px !important;\n    min-height: 58px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer active mode-card lockup",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyModeRail .story-mode-card:not(.is-active),\n  .layout.is-story-focused .story-shell-top #storyModeRail .story-mode-card:not(.is-active) {\n    justify-content: center !important;\n    min-width: 126px !important;\n    min-height: 40px !important;"),
    "storyteller header authority stylesheet missing Story Studio steadier inactive mode-chip geometry",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller cue-ledger lockup refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio cue-ledger lockup pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-signal-strip,\n  .layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip,\n  .layout.is-story-focused .story-shell-top .story-signal-strip {\n    display: grid !important;\n    grid-template-columns:"),
    "storyteller header authority stylesheet missing Story Studio steadier cue-ledger grid lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-signal-strip .story-signal-card,\n  .layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip .story-signal-card,\n  .layout.is-story-focused .story-shell-top .story-signal-strip .story-signal-card {\n    min-width: 0 !important;\n    gap: 4px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer cue-card spacing",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-signal-strip .story-signal-value,\n  .layout.is-story-focused .story-shell-top.is-prerun .story-signal-strip .story-signal-value,\n  .layout.is-story-focused .story-shell-top .story-signal-strip .story-signal-value {\n    display: block !important;\n    min-width: 0 !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer cue-value measure lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller prompt lockup and meta-ledger refinement */",
    ),
    "storyteller header authority stylesheet missing Story Studio prompt lockup meta-ledger pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-field .field-heading,\n  .layout.is-story-focused .story-shell-top .story-compose-field .field-heading {\n    grid-template-columns: minmax(0, 1fr) !important;\n    gap: 3px !important;"),
    "storyteller header authority stylesheet missing Story Studio stacked prompt-heading lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-meta,\n  .layout.is-story-focused .story-shell-top .story-compose-meta {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) max-content !important;"),
    "storyteller header authority stylesheet missing Story Studio prompt meta-ledger split",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-shell-top.is-prerun .story-compose-actions,\n  .layout.is-story-focused .story-shell-top .story-compose-actions {\n    gap: 12px 18px !important;\n    padding-top: 14px !important;"),
    "storyteller header authority stylesheet missing Story Studio calmer prompt CTA divider rhythm",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(
      "/* 2026-03-15 Pass - desktop storyteller tray-open, header, and run-rail overflow resilience */",
    ),
    "storyteller header authority stylesheet missing Story Studio tray-open and overflow resilience pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1fr) minmax(31rem, 33%) !important;"),
    "storyteller header authority stylesheet missing Story Studio wider overflow-safe header split",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal .dashboard-glance-value {\n    display: -webkit-box !important;\n    overflow: hidden !important;\n    overflow-wrap: anywhere !important;"),
    "storyteller header authority stylesheet missing Story Studio overflow-safe header value wrapping",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-compose-shell #storyCraftTray[open] .story-tray-body,\n  .layout.is-story-focused .story-compose-shell #storyMediaTray[open] .story-tray-body {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1.12fr) minmax(260px, 0.88fr) !important;"),
    "storyteller header authority stylesheet missing Story Studio even open tray body split",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-compose-shell #storyCraftTray[open] .story-tray-section-grid:not(.story-tray-section-grid-single),\n  .layout.is-story-focused .story-compose-shell #storyMediaTray[open] .story-tray-section-grid:not(.story-tray-section-grid-single) {\n    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;"),
    "storyteller header authority stylesheet missing Story Studio full-width two-column tray field rows",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .story-compose-shell #storyDirectionTray[open] .story-tray-body.story-tray-body-full {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) !important;"),
    "storyteller header authority stylesheet missing Story Studio full-width editorial-notes body",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyRunRail .story-head-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;"),
    "storyteller header authority stylesheet missing Story Studio overflow-safe run-rail two-column grid",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyTimelineControls .select-shell.is-open-upward .select-menu {\n    top: auto !important;\n    bottom: calc(100% + 8px) !important;"),
    "storyteller header authority stylesheet missing Story Studio upward storyboard selector menu",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("/* 2026-03-15 Pass - desktop storyteller tray-card clarity, title alignment, and sidebar lift */"),
    "storyteller header authority stylesheet missing Story Studio tray-card clarity/title alignment/sidebar lift pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("/* 2026-03-15 Pass - desktop storyteller chevron alignment and live utility pill */"),
    "storyteller header authority stylesheet missing Story Studio chevron/live utility pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("/* 2026-03-15 Pass - desktop storyteller chevron alignment and live utility pill (late load) */"),
    "storyteller header authority stylesheet missing Story Studio chevron/live utility late-load pass comment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-workspace-summary.is-story-minimal {\n    grid-template-columns: minmax(0, 1fr) minmax(34rem, 40%) !important;"),
    "storyteller header authority stylesheet missing Story Studio wider first-fold header split",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".dashboard-sidebar.is-story-focused {\n    flex: 0 0 236px !important;\n    min-width: 236px !important;\n    max-width: 236px !important;"),
    "storyteller header authority stylesheet missing Story Studio lifted fixed-width sidebar rail",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .panel-story-studio .story-intro {\n    max-width: 36ch !important;\n    margin: 2px 0 0 86px !important;"),
    "storyteller header authority stylesheet missing Story Studio intro-under-title alignment lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused #storyTimelineSelect + .select-shell .select-menu {\n    left: 0 !important;\n    right: auto !important;"),
    "storyteller header authority stylesheet missing Story Studio selector menu width/placement authority",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ece8f5' stroke-width='1.9'"),
    "storyteller header authority stylesheet missing Story Studio centered chevron svg treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused\n    .story-compose-shell\n    :is(#storyCraftTray, #storyMediaTray, #storyDirectionTray)[open]\n    > summary {\n    min-height: 58px !important;\n    gap: 12px 24px !important;\n    padding: 12px 56px 12px 12px !important;"),
    "storyteller header authority stylesheet missing Story Studio roomier open-tray header padding",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused\n    .story-shell-top.is-prerun\n    :is(#storyComposerOpenLiveBtn.button-muted, #storyTimelineGuideOpenLiveBtn.button-muted),"),
    "storyteller header authority stylesheet missing Story Studio live utility pill selectors",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("border-radius: 999px !important;\n    line-height: 1 !important;\n    white-space: nowrap !important;"),
    "storyteller header authority stylesheet missing Story Studio rounded live utility pill geometry",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused\n    .story-compose-shell\n    :is(#storyCraftTray, #storyMediaTray, #storyDirectionTray):not([open])\n    > summary::before,\n  .layout.is-story-focused\n    .story-compose-shell\n    :is(#storyCraftTray, #storyMediaTray, #storyDirectionTray)[open]\n    > summary::before {\n    top: 14px !important;\n    right: 14px !important;\n    width: 30px !important;\n    height: 30px !important;"),
    "storyteller header authority stylesheet missing Story Studio chevron bubble shell geometry",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("background-size: 13px 13px !important;"),
    "storyteller header authority stylesheet missing Story Studio centered chevron icon sizing",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("border: 0 !important;"),
    "storyteller header authority stylesheet missing Story Studio chevron border reset",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("transform: none !important;"),
    "storyteller header authority stylesheet missing Story Studio chevron transform reset",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("/* 2026-03-16 Pass - desktop storyteller left-rail late authority */"),
    "storyteller header authority stylesheet missing Story Studio left-rail late-authority pass",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-body.is-story-focused {\n    grid-template-columns: 284px minmax(0, 1fr) !important;\n    column-gap: 24px !important;"),
    "storyteller header authority stylesheet missing Story Studio final widened story-body grid",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused {\n    flex: 0 0 284px !important;\n    min-width: 284px !important;\n    max-width: 284px !important;"),
    "storyteller header authority stylesheet missing Story Studio final late-authority sidebar rail",
  );
  assert.ok(
    storytellerHeaderAuthority.includes('.layout.is-story-focused .dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn[data-tab-target="live-negotiator"] {\n    border-color: color-mix(in oklch, var(--primary) 26%, var(--border-soft)) !important;'),
    "storyteller header authority stylesheet missing Story Studio accented Live nav entry",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused .dashboard-nav-icon {\n    display: inline-flex !important;\n    width: 60px !important;\n    min-width: 60px !important;"),
    "storyteller header authority stylesheet missing Story Studio final overflow-safe nav icon chip",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ece8f5' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='7 14 12 9 17 14'/%3E%3C/svg%3E\") !important;"),
    "storyteller header authority stylesheet missing Story Studio open-state chevron svg treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ece8f5' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='7 10 12 15 17 10'/%3E%3C/svg%3E\") !important;"),
    "storyteller header authority stylesheet missing Story Studio closed-state chevron svg treatment",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("/* 2026-03-16 Pass - desktop storyteller left-rail and title alignment EOF authority */"),
    "storyteller header authority stylesheet missing Story Studio EOF left-rail/title alignment pass",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-body.is-story-focused {\n    grid-template-columns: 284px minmax(0, 1fr) !important;\n    column-gap: 24px !important;"),
    "storyteller header authority stylesheet missing Story Studio final widened body grid",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused {\n    flex: 0 0 284px !important;\n    min-width: 284px !important;\n    max-width: 284px !important;"),
    "storyteller header authority stylesheet missing Story Studio final sidebar width lock",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused .dashboard-nav-icon {\n    display: inline-flex !important;\n    width: 60px !important;\n    min-width: 60px !important;"),
    "storyteller header authority stylesheet missing Story Studio final wider nav icon chip",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused .dashboard-nav-copy {\n    display: flex !important;\n    align-items: center !important;\n    min-width: 0 !important;"),
    "storyteller header authority stylesheet missing Story Studio single-line nav copy layout",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .dashboard-sidebar.is-story-focused .dashboard-nav-title {\n    min-width: 0 !important;\n    overflow: hidden !important;\n    white-space: nowrap !important;"),
    "storyteller header authority stylesheet missing Story Studio single-line nav title block",
  );
  assert.ok(
    storytellerHeaderAuthority.includes("text-overflow: ellipsis !important;"),
    "storyteller header authority stylesheet missing Story Studio overflow-safe nav title text",
  );
  assert.ok(
    storytellerHeaderAuthority.includes(".layout.is-story-focused .panel-story-studio .story-intro {\n    margin: 2px 0 0 88px !important;\n    padding-left: 0 !important;"),
    "storyteller header authority stylesheet missing Story Studio intro realignment under title",
  );
  assert.ok(
    app.includes('shell.classList.remove("is-open-upward");'),
    "frontend runtime missing custom select upward-placement reset",
  );
  assert.ok(
    app.includes('shell.classList.toggle("is-open-upward", shouldOpenUpward);'),
    "frontend runtime missing custom select upward-placement toggle",
  );
  assert.ok(
    app.includes('return isRu ? "ждём" : "awaiting";'),
    "frontend runtime missing shorter Story Studio output awaiting label",
  );
  assert.ok(
    app.includes('return isRu ? "готов" : "ready";'),
    "frontend runtime missing shorter Story Studio output ready label",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(characterFocus, 5, 40),"),
    "frontend runtime missing Story Studio expanded craft tray character summary compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(worldFocus, 6, 48),"),
    "frontend runtime missing Story Studio expanded craft tray world summary compaction",
  );
  assert.ok(
    app.includes("compactStoryReferenceValue(editorialNotes, 12, 108)"),
    "frontend runtime missing Story Studio expanded direction tray summary compaction",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused {\n    flex: 0 0 228px !important;\n    min-width: 228px !important;\n    max-width: 228px !important;"),
    "storyteller tail stylesheet missing Story Studio wider left-rail shell spacing lock",
  );
  assert.ok(
    storytellerTailStyles.includes(".dashboard-sidebar.is-story-focused .dashboard-nav .tab-btn {\n    grid-template-columns: 48px minmax(0, 1fr) !important;\n    min-height: 60px !important;\n    padding: 10px 14px !important;"),
    "storyteller tail stylesheet missing Story Studio calmer nav row rhythm lock",
  );
  assert.ok(
    readme.includes("creative-brief headline and deck on one line at `1440px`"),
    "README missing Story Studio 1440 one-line headline note",
  );
  assert.ok(
    readme.includes("atmospheric editorial frame"),
    "README missing Story Studio atmospheric hero/nav note",
  );
  assert.ok(
    readme.includes("clearer lockup"),
    "README missing Story Studio clearer hero lockup note",
  );
  assert.ok(
    readme.includes("title band now continues that hero hierarchy"),
    "README missing Story Studio title-band continuation note",
  );
  assert.ok(
    readme.includes("outer panel sheds heavy card chrome"),
    "README missing Story Studio outer-frame continuity note",
  );
  assert.ok(
    readme.includes("compose heading now reads like a smaller section title beneath `Story Studio`"),
    "README missing Story Studio smaller compose-heading note",
  );
  assert.ok(
    readme.includes("equal-width tabs with one-line titles"),
    "README missing Story Studio hero/nav readability note",
  );
  assert.ok(
    readme.includes("hero summary splits into a calmer title-plus-ledger stack"),
    "README missing Story Studio hero/nav structure note",
  );
  assert.ok(
    readme.includes("denser smoke-glass panel with a wider measure"),
    "README missing Story Studio hero/nav foreground-layer note",
  );
  assert.ok(
    readme.includes("stretches more evenly across the page"),
    "README missing Story Studio full-width first-fold continuity note",
  );
  assert.ok(
    readme.includes("cue strip resolves into one inline fact ledger"),
    "README missing Story Studio brief-header mode/cue continuity note",
  );
  assert.ok(
    readme.includes("sharpens action clarity"),
    "README missing Story Studio postrun action-clarity note",
  );
  assert.ok(
    readme.includes("cleaner header and left rail"),
    "README missing Story Studio header and left-rail refinement note",
  );
  assert.ok(
    readme.includes("header and left rail now also breathe more evenly"),
    "README missing Story Studio header and left-rail air note",
  );
  assert.ok(
    readme.includes("Story Studio band now carries more air"),
    "README missing Story Studio band air note",
  );
  assert.ok(
    readme.includes("mode rail and cue ledger more room to breathe"),
    "README missing Story Studio calmer mode-rail and cue-ledger note",
  );
  assert.ok(
    readme.includes("prompt lane now also reads as one calmer writing surface"),
    "README missing Story Studio calmer prompt-lane writing-surface note",
  );
  assert.ok(
    readme.includes("collapsed tray shelf now also holds a calmer editorial rhythm"),
    "README missing Story Studio calmer collapsed tray-shelf rhythm note",
  );
  assert.ok(
    readme.includes("desktop header and left rail now also land more evenly"),
    "README missing Story Studio header and left-rail balance note",
  );
  assert.ok(
    readme.includes("Story Studio` shell now also carries cleaner depth and rhythm"),
    "README missing Story Studio shell depth and rhythm note",
  );
  assert.ok(
    readme.includes("Cinematic brief` header now also reads as a calmer lockup"),
    "README missing Story Studio compose-head lockup note",
  );
  assert.ok(
    readme.includes("desktop mode rail now also reads like a real narrative selector"),
    "README missing Story Studio mode-rail narrative-selector note",
  );
  assert.ok(
    readme.includes("desktop cue ledger now also reads more like a quiet reference line"),
    "README missing Story Studio cue-ledger reference-line note",
  );
  assert.ok(
    readme.includes("desktop prompt lane now also locks the text rhythm more cleanly"),
    "README missing Story Studio prompt lockup meta-ledger note",
  );
  assert.ok(
    readme.includes("storyboard selector can flip upward instead of dropping off-screen"),
    "README missing Story Studio tray/runtime overflow note",
  );
  assert.ok(
    readme.includes("desktop tray/header pass now also cleans the first-fold details"),
    "README missing Story Studio first-fold tray/header cleanup note",
  );
  assert.ok(
    readme.includes("desktop tray/utility polish now also recenters the tray chevrons"),
    "README missing Story Studio chevron/live utility polish note",
  );
  assert.ok(
    readme.includes("counter resolves into a quiet 11px footnote"),
    "README missing Story Studio writing-surface CTA continuity note",
  );
  assert.ok(
    readme.includes("tighter three-up reference row"),
    "README missing Story Studio collapsed tray-shelf continuity note",
  );
  assert.ok(
    judgeQuickstart.includes("lead • world` shorthand"),
    "judge quickstart missing Story Studio lead-world shorthand note",
  );
  assert.ok(
    operatorGuide.includes("runtime atlas/dossier split behind a real EOF authority layer"),
    "operator guide missing Story Studio eof authority note",
  );
  assert.ok(
    judgeQuickstart.includes("mode rail and cue ledger more room"),
    "judge quickstart missing Story Studio calmer mode-rail and cue-ledger note",
  );
  assert.ok(
    operatorGuide.includes("mode rail and cue ledger more room"),
    "operator guide missing Story Studio calmer mode-rail and cue-ledger note",
  );
  assert.ok(
    judgeQuickstart.includes("prompt lane should now also read as one calmer writing surface"),
    "judge quickstart missing Story Studio calmer prompt-lane note",
  );
  assert.ok(
    operatorGuide.includes("prompt lane now also reads as one calmer writing surface"),
    "operator guide missing Story Studio calmer prompt-lane note",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed tray shelf should now also hold a calmer editorial rhythm"),
    "judge quickstart missing Story Studio calmer collapsed tray-shelf note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop header and left rail should now also land more evenly"),
    "judge quickstart missing Story Studio header and left-rail balance note",
  );
  assert.ok(
    judgeQuickstart.includes("Story Studio` shell should now also carry cleaner depth and rhythm"),
    "judge quickstart missing Story Studio shell depth and rhythm note",
  );
  assert.ok(
    judgeQuickstart.includes("Cinematic brief` header should now also read as a calmer lockup"),
    "judge quickstart missing Story Studio compose-head lockup note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop mode rail should now also read like a real narrative selector"),
    "judge quickstart missing Story Studio mode-rail narrative-selector note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop cue ledger should now also read more like a quiet reference line"),
    "judge quickstart missing Story Studio cue-ledger reference-line note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop prompt lane should now also lock its text rhythm more cleanly"),
    "judge quickstart missing Story Studio prompt lockup meta-ledger note",
  );
  assert.ok(
    judgeQuickstart.includes("storyboard selector should flip upward instead of dropping off-screen"),
    "judge quickstart missing Story Studio tray/runtime overflow note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop tray/header pass should now also clean the first-fold details"),
    "judge quickstart missing Story Studio first-fold tray/header cleanup note",
  );
  assert.ok(
    judgeQuickstart.includes("desktop tray/utility polish should now also center the chevron"),
    "judge quickstart missing Story Studio chevron/live utility polish note",
  );
  assert.ok(
    operatorGuide.includes("collapsed tray shelf now also holds a calmer editorial rhythm"),
    "operator guide missing Story Studio calmer collapsed tray-shelf note",
  );
  assert.ok(
    operatorGuide.includes("desktop header and left rail now also land more evenly"),
    "operator guide missing Story Studio header and left-rail balance note",
  );
  assert.ok(
    operatorGuide.includes("Story Studio` shell now also carries cleaner depth and rhythm"),
    "operator guide missing Story Studio shell depth and rhythm note",
  );
  assert.ok(
    operatorGuide.includes("Cinematic brief` header now also reads as a calmer lockup"),
    "operator guide missing Story Studio compose-head lockup note",
  );
  assert.ok(
    operatorGuide.includes("desktop mode rail now also reads like a real narrative selector"),
    "operator guide missing Story Studio mode-rail narrative-selector note",
  );
  assert.ok(
    operatorGuide.includes("desktop cue ledger now also reads more like a quiet reference line"),
    "operator guide missing Story Studio cue-ledger reference-line note",
  );
  assert.ok(
    operatorGuide.includes("desktop prompt lane now also locks its text rhythm more cleanly"),
    "operator guide missing Story Studio prompt lockup meta-ledger note",
  );
  assert.ok(
    operatorGuide.includes("storyboard selector can flip upward instead of dropping off-screen"),
    "operator guide missing Story Studio tray/runtime overflow note",
  );
  assert.ok(
    operatorGuide.includes("desktop tray/header pass now also cleans the first-fold details"),
    "operator guide missing Story Studio first-fold tray/header cleanup note",
  );
  assert.ok(
    operatorGuide.includes("desktop tray/utility polish now also centers the chevron"),
    "operator guide missing Story Studio chevron/live utility polish note",
  );
  assert.ok(
    judgeQuickstart.includes("atmospheric preface"),
    "judge quickstart missing Story Studio atmospheric hero/nav note",
  );
  assert.ok(
    judgeQuickstart.includes("clearer lockup"),
    "judge quickstart missing Story Studio clearer hero lockup note",
  );
  assert.ok(
    judgeQuickstart.includes("title band should now continue that hierarchy"),
    "judge quickstart missing Story Studio title-band continuation note",
  );
  assert.ok(
    judgeQuickstart.includes("outer panel should drop the heavier card feel"),
    "judge quickstart missing Story Studio outer-frame continuity note",
  );
  assert.ok(
    judgeQuickstart.includes("equal-width tabs with one-line titles"),
    "judge quickstart missing Story Studio hero/nav readability note",
  );
  assert.ok(
    judgeQuickstart.includes("hero summary should split into a calmer title-plus-ledger stack"),
    "judge quickstart missing Story Studio hero/nav structure note",
  );
  assert.ok(
    judgeQuickstart.includes("denser smoke-glass panel with a wider measure"),
    "judge quickstart missing Story Studio hero/nav foreground-layer note",
  );
  assert.ok(
    judgeQuickstart.includes("stretch more evenly across the page"),
    "judge quickstart missing Story Studio full-width first-fold continuity note",
  );
  assert.ok(
    judgeQuickstart.includes("cue strip should resolve into one inline fact ledger"),
    "judge quickstart missing Story Studio brief-header mode/cue continuity note",
  );
  assert.ok(
    judgeQuickstart.includes("counter should resolve into a quiet 11px footnote"),
    "judge quickstart missing Story Studio writing-surface CTA continuity note",
  );
  assert.ok(
    judgeQuickstart.includes("tighter three-up reference row"),
    "judge quickstart missing Story Studio collapsed tray-shelf continuity note",
  );
  assert.ok(
    operatorGuide.includes("atmospheric editorial frame"),
    "operator guide missing Story Studio atmospheric hero/nav note",
  );
  assert.ok(
    operatorGuide.includes("hero lockup now also reads more cleanly"),
    "operator guide missing Story Studio hero lockup note",
  );
  assert.ok(
    operatorGuide.includes("title band now also continues the hero hierarchy"),
    "operator guide missing Story Studio title-band continuation note",
  );
  assert.ok(
    operatorGuide.includes("outer panel sheds heavier card chrome"),
    "operator guide missing Story Studio outer-frame continuity note",
  );
  assert.ok(
    operatorGuide.includes("compose heading now reads like a smaller section title beneath `Story Studio`"),
    "operator guide missing Story Studio smaller compose-heading note",
  );
  assert.ok(
    operatorGuide.includes("equal-width tabs with one-line titles"),
    "operator guide missing Story Studio hero/nav readability note",
  );
  assert.ok(
    operatorGuide.includes("hero summary splits into a calmer title-plus-ledger stack"),
    "operator guide missing Story Studio hero/nav structure note",
  );
  assert.ok(
    operatorGuide.includes("denser smoke-glass panel with a wider measure"),
    "operator guide missing Story Studio hero/nav foreground-layer note",
  );
  assert.ok(
    operatorGuide.includes("stretches more evenly across the page"),
    "operator guide missing Story Studio full-width first-fold continuity note",
  );
  assert.ok(
    operatorGuide.includes("cue strip resolves into one inline fact ledger"),
    "operator guide missing Story Studio brief-header mode/cue continuity note",
  );
  assert.ok(
    operatorGuide.includes("counter resolves into a quiet 11px footnote"),
    "operator guide missing Story Studio writing-surface CTA continuity note",
  );
  assert.ok(
    operatorGuide.includes("tighter three-up reference row"),
    "operator guide missing Story Studio collapsed tray-shelf continuity note",
  );

  assert.ok(
    readme.includes("prompt-first `Story Studio` workspace"),
    "README missing Story Studio quickstart note",
  );
  assert.ok(
    readme.includes("title-first line plus a couple of flat glance facts"),
    "README missing Story Studio quieter top-strip note",
  );
  assert.ok(
    readme.includes("compose -> run status -> output -> scenes"),
    "README missing Story Studio hierarchy note",
  );
  assert.ok(
    readme.includes("equalizes the top tray grid"),
    "README missing Story Studio aligned desktop tray-grid note",
  );
  assert.ok(
    readme.includes("segmented `Story atlas`"),
    "README missing Story Studio segmented atlas note",
  );
  assert.ok(
    readme.includes("Generate from brief"),
    "README missing Story Studio direct generate CTA note",
  );
  assert.ok(
    readme.includes("storyboard-style preview panel"),
    "README missing Story Studio preview polish note",
  );
  assert.ok(
    readme.includes("result dossier instead of a plain transcript block"),
    "README missing Story Studio latest-output dossier note",
  );
  assert.ok(
    readme.includes("one quieter dossier stack"),
    "README missing Story Studio quieter dossier-stack note",
  );
  assert.ok(
    readme.includes("one compact support strip"),
    "README missing Story Studio compact idle-dossier note",
  );
  assert.ok(
    readme.includes("one calmer unlock card"),
    "README missing Story Studio calmer current-scene idle note",
  );
  assert.ok(
    readme.includes("one compact fact line"),
    "README missing Story Studio compact current-scene fact-line note",
  );
  assert.ok(
    readme.includes("avoid repeating the same CTA cluster"),
    "README missing Story Studio calmer empty-state hierarchy note",
  );
  assert.ok(
    readme.includes("quieter production rail"),
    "README missing Story Studio production-rail note",
  );
  assert.ok(
    readme.includes("compact navigator bar plus a storyboard shelf"),
    "README missing Story Studio navigator/shelf note",
  );
  assert.ok(
    readme.includes("grouped storyboard lane"),
    "README missing Story Studio grouped storyboard-lane note",
  );
  assert.ok(
    readme.includes("quiet snapshot stack"),
    "README missing Story Studio quiet snapshot-stack note",
  );
  assert.ok(
    readme.includes("title-first editorial preview"),
    "README missing Story Studio title-first latest-output note",
  );
  assert.ok(
    readme.includes("segmented switcher"),
    "README missing Story Studio atlas switcher note",
  );
  assert.ok(
    readme.includes("collapse into short horizontal summary lanes"),
    "README missing Story Studio compact middle-stack note",
  );
  assert.ok(
    readme.includes("inline compose-status row"),
    "README missing Story Studio compact first-fold status note",
  );
  assert.ok(
    readme.includes("workspace summary intentionally compresses into a quieter header"),
    "README missing Story Studio compact workspace-shell note",
  );
  assert.ok(
    readme.includes("compact story strip with inline glance pills"),
    "README missing Story Studio compact top-shell note",
  );
  assert.ok(
    readme.includes("desktop shared context strip now compresses further into a thinner editorial ledger"),
    "README missing Story Studio thinner desktop context-strip note",
  );
  assert.ok(
    readme.includes("desktop first fold now also behaves more like a calm studio page"),
    "README missing Story Studio calm studio-page shell note",
  );
  assert.ok(
    readme.includes("desktop CTA row now resolves into one cleaner handoff"),
    "README missing Story Studio cleaner CTA handoff note",
  );
  assert.ok(
    readme.includes("collapsed tray shelf now also sits as a quieter after-CTA note row"),
    "README missing Story Studio quieter after-CTA tray shelf note",
  );
  assert.ok(
    readme.includes("desktop shared strip now recedes into an even quieter control ledger"),
    "README missing Story Studio quieter control-ledger note",
  );
  assert.ok(
    readme.includes("desktop direction strip now also reads more like inline reference notes"),
    "README missing Story Studio inline direction-reference note",
  );
  assert.ok(
    readme.includes("desktop `Story prompt` header now reads more like a write-title lockup"),
    "README missing Story Studio prompt-header lockup note",
  );
  assert.ok(
    readme.includes("desktop textarea shell now reads more like a calm writing surface"),
    "README missing Story Studio writing-surface textarea note",
  );
  assert.ok(
    readme.includes("desktop Story Studio title band now steps back further"),
    "README missing Story Studio title-band note",
  );
  assert.ok(
    readme.includes("desktop `Creative Brief` heading block now reads tighter as well"),
    "README missing Story Studio brief-heading note",
  );
  assert.ok(
    readme.includes("desktop mode row now steps back into a quieter scenario header"),
    "README missing Story Studio quieter mode-row note",
  );
  assert.ok(
    readme.includes("desktop cue line now also reads like a tucked editorial ledger"),
    "README missing Story Studio tucked cue-line ledger note",
  );
  assert.ok(
    readme.includes("desktop write surface now tucks closer to that brief header"),
    "README missing Story Studio tighter write-surface handoff note",
  );
  assert.ok(
    readme.includes("desktop tray shelf now settles even lower as a quiet after-note ledger"),
    "README missing Story Studio quieter after-note tray shelf note",
  );
  assert.ok(
    readme.includes("desktop outer Story Studio shell now recedes further into a lighter paper frame"),
    "README missing Story Studio lighter outer-shell note",
  );
  assert.ok(
    readme.includes("desktop top utility rail now settles into an even quieter baseline"),
    "README missing Story Studio top utility-rail note",
  );
  assert.ok(
    readme.includes("visible desktop Storyteller fold now keeps a readable type floor"),
    "README missing Story Studio readable type-floor note",
  );
  assert.ok(
    readme.includes("post-run Storyteller reading lane now keeps that floor too"),
    "README missing Story Studio post-run readable type-floor note",
  );
  assert.ok(
    readme.includes("collapsed tray titles, hints, and facts on steadier one-line rows"),
    "README missing Story Studio steadier tray-row and lower-lane cleanup note",
  );
  assert.ok(
    readme.includes("desktop left nav rail now recedes further into a thinner reference rail"),
    "README missing Story Studio thinner nav-rail note",
  );
  assert.ok(
    readme.includes("desktop CTA handoff now sits closer to that writing surface"),
    "README missing Story Studio softer CTA-handoff note",
  );
  assert.ok(
    readme.includes("collapsed tray shelf now recedes further into an inline reference ledger"),
    "README missing Story Studio collapsed tray ledger note",
  );
  assert.ok(
    readme.includes("compact workspace line and horizontal tab switcher"),
    "README missing Story Studio mobile shell simplification note",
  );
  assert.ok(
    readme.includes("atlas switcher become lighter horizontal scrollers"),
    "README missing Story Studio mobile atlas-switcher note",
  );
  assert.ok(
    readme.includes("horizontal direction strip"),
    "README missing Story Studio compact first-fold direction-strip note",
  );
  assert.ok(
    readme.includes("one stronger scenario row plus a quieter cue line"),
    "README missing Story Studio quieter upper-rails note",
  );
  assert.ok(
    readme.includes("hidden helper stepper now also stays out of the accessibility tree"),
    "README missing Story Studio hidden-helper accessibility note",
  );
  assert.ok(
    readme.includes("regains a restrained chrome sheen and a fixed summary/meta stack"),
    "README missing Story Studio tray chrome-stack note",
  );
  assert.ok(
    readme.includes("low-profile cue chips"),
    "README missing Story Studio cue-chip strip note",
  );
  assert.ok(
    readme.includes("featured active brief card plus quieter secondary chips"),
    "README missing Story Studio active-mode rail note",
  );
  assert.ok(
    readme.includes("first scan reads `mode -> cues -> prompt`"),
    "README missing Story Studio mode-first scan-order note",
  );
  assert.ok(
    readme.includes("one-row scenario lockup"),
    "README missing Story Studio one-row scenario-lockup note",
  );
  assert.ok(
    readme.includes("shorter brief preview"),
    "README missing Story Studio shorter brief-preview note",
  );
  assert.ok(
    readme.includes("summary-driven editorial drawers with plain-language summary lines and quiet meta chips"),
    "README missing Story Studio tray-drawer note",
  );
  assert.ok(
    readme.includes("stay below the prompt canvas"),
    "README missing Story Studio tray-below-canvas note",
  );
  assert.ok(
    readme.includes("more room around the active mode lockup, prompt heading, textarea, and CTA row"),
    "README missing Story Studio roomier compose-canvas note",
  );
  assert.ok(
    readme.includes("full Story Studio width"),
    "README missing Story Studio full-width prerun note",
  );
  assert.ok(
    readme.includes("slimmer quiet nav"),
    "README missing Story Studio quieter shared-chrome note",
  );
  assert.ok(
    readme.includes("active mode lockup now reads like a quieter editorial brief card while the cue line flattens into inline facts"),
    "README missing Story Studio desktop brief-header polish note",
  );
  assert.ok(
    readme.includes("desktop pre-run canvas now keeps a calmer title/status lockup and a cleaner CTA zone"),
    "README missing Story Studio desktop CTA-zone polish note",
  );
  assert.ok(
    readme.includes("shared shell above Story Studio now behaves more like a transparent context strip"),
    "README missing Story Studio desktop context-strip shell note",
  );
  assert.ok(
    readme.includes("left rail read more like a quiet label strip than a boxed sidebar"),
    "README missing Story Studio desktop quiet label-rail note",
  );
  assert.ok(
    readme.includes("the `Creative Brief` tag now steps back into a quiet label"),
    "README missing Story Studio desktop quiet brief-tag note",
  );
  assert.ok(
    readme.includes("active scenario card and cue line now also sit inside one calmer brief header on desktop"),
    "README missing Story Studio desktop calmer brief-header note",
  );
  assert.ok(
    readme.includes("collapsed trays below the canvas now behave more like one quiet settings shelf on desktop"),
    "README missing Story Studio desktop quiet tray-shelf note",
  );
  assert.ok(
    readme.includes("quiet fact-style meta instead of chip chrome"),
    "README missing Story Studio desktop inline tray meta note",
  );
  assert.ok(
    readme.includes("Latest output` and `Current scene` now stay inside one calmer reading lane"),
    "README missing Story Studio desktop calmer reading lane note",
  );
  assert.ok(
    readme.includes("Latest output` main card now reads more like one editorial narrative surface"),
    "README missing Story Studio editorial latest-output narrative-surface note",
  );
  assert.ok(
    readme.includes("ready-state `Latest output` now also behaves more like an editorial proof"),
    "README missing Story Studio editorial proof latest-output note",
  );
  assert.ok(
    readme.includes("Latest output` widens its narrative measure"),
    "README missing Story Studio calmer post-run narrative-rhythm note",
  );
  assert.ok(
    readme.includes("Recent passes` into a short revision ledger"),
    "README missing Story Studio desktop revision-ledger note",
  );
  assert.ok(
    readme.includes("shared `Output` glance and `Run status` guidance aligned with the real `pending / updating / ready` state"),
    "README missing Story Studio live runtime state-alignment note",
  );
  assert.ok(
    readme.includes("desktop interaction pass now also changes the compose CTA contract by state"),
    "README missing Story Studio interaction-state CTA note",
  );
  assert.ok(
    readme.includes("right side now reads as one quieter production column"),
    "README missing Story Studio quieter right-column note",
  );
  assert.ok(
    readme.includes("active `Story atlas` panel now reads more like a quiet editorial side note"),
    "README missing Story Studio quieter active atlas-panel note",
  );
  assert.ok(
    readme.includes("one calmer filmstrip lane"),
    "README missing Story Studio calmer filmstrip-lane note",
  );
  assert.ok(
    readme.includes("one highlighted mode card with a compact secondary mode row"),
    "README missing Story Studio compact mobile mode-row note",
  );
  assert.ok(
    readme.includes("cue line now tucks under the active mode lockup as one quieter brief header"),
    "README missing Story Studio tighter mobile brief-header note",
  );
  assert.ok(
    readme.includes("secondary mode choices now drop below that cue line as their own scenario row"),
    "README missing Story Studio smallest-mobile split mode-row note",
  );
  assert.ok(
    readme.includes("scenario row now also uses lighter chrome, while the cue line sits against a subtle guide rule"),
    "README missing Story Studio calmer smallest-mobile brief-header note",
  );
  assert.ok(
    readme.includes("inactive mode titles and cue summaries now switch to shorter mobile copy"),
    "README missing Story Studio shorter smallest-mobile copy note",
  );
  assert.ok(
    readme.includes("prompt field drops its helper line and the character counter flattens into quiet text"),
    "README missing Story Studio smaller mobile prompt-field note",
  );
  assert.ok(
    readme.includes("one stronger scenario row plus a quieter cue line"),
    "README missing Story Studio quieter cue-line note",
  );
  assert.ok(
    readme.includes("collapsed trays now read as compact shelf rows"),
    "README missing Story Studio calmer mobile tray-shelf note",
  );
  assert.ok(
    readme.includes("instead of widening into three equal dashboard columns"),
    "README missing Story Studio calmer wide-tray shelf note",
  );
  assert.ok(
    readme.includes("roomier two-column editors"),
    "README missing Story Studio roomier expanded-drawer note",
  );
  assert.ok(
    readme.includes("one dominant generate action plus a quieter utility row"),
    "README missing Story Studio quieter compose-action note",
  );
  assert.ok(
    readme.includes("one drawer full-width"),
    "README missing Story Studio full-width drawer note",
  );
  assert.ok(
    readme.includes("small editorial sections"),
    "README missing Story Studio grouped drawer-sections note",
  );
  assert.ok(
    readme.includes("shorter tray hints"),
    "README missing Story Studio calmer tray-hint note",
  );
  assert.ok(
    readme.includes("quiet action divider"),
    "README missing Story Studio quiet action-divider note",
  );
  assert.ok(
    readme.includes("calmer section dividers"),
    "README missing Story Studio calmer tray-section divider note",
  );
  assert.ok(
    readme.includes("calmer narrative rhythm"),
    "README missing Story Studio calmer narrative-rhythm note",
  );
  assert.ok(
    readme.includes("single calmer reading lane"),
    "README missing Story Studio shared reading-lane note",
  );
  assert.ok(
    readme.includes("Run status` rail and the lower result surfaces stay off the page entirely"),
    "README missing Story Studio prerun surface-gating note",
  );
  assert.ok(
    readme.includes("quieter production sidebar"),
    "README missing Story Studio quieter production-sidebar note",
  );
  assert.ok(
    readme.includes("flatter tab strip"),
    "README missing Story Studio flatter atlas-tab-strip note",
  );
  assert.ok(
    readme.includes("Scene controls` now stay collapsed until the first scene arrives"),
    "README missing Story Studio collapsed scene-controls note",
  );
  assert.ok(
    judgeQuickstart.includes("Story Studio panel"),
    "judge quickstart missing Story Studio checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("quiet context line, not a second dashboard row"),
    "judge quickstart missing Story Studio quiet top-strip checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("mode rail and prompt-first canvas"),
    "judge quickstart missing Story Studio flow checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Generate story directly from Storyteller"),
    "judge quickstart missing Story Studio direct-generate checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("storyboard panel with beat headline"),
    "judge quickstart missing Story Studio preview-panel checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("brief lockup"),
    "judge quickstart missing Story Studio latest-output dossier checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one quieter dossier stack"),
    "judge quickstart missing Story Studio calmer dossier-stack checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one compact support strip"),
    "judge quickstart missing Story Studio compact idle-dossier checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one calmer unlock card"),
    "judge quickstart missing Story Studio calmer current-scene idle checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one compact fact line"),
    "judge quickstart missing Story Studio compact current-scene fact-line checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("should not repeat the main CTA below the fold"),
    "judge quickstart missing Story Studio quieter empty-state checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Run status` should read as one calmer rail"),
    "judge quickstart missing Story Studio production-rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("compact navigator bar plus a storyboard shelf"),
    "judge quickstart missing Story Studio navigator/shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("grouped storyboard lane"),
    "judge quickstart missing Story Studio grouped storyboard-lane checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("quiet snapshot stack"),
    "judge quickstart missing Story Studio quiet snapshot-stack checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("segmented creative surface"),
    "judge quickstart missing Story Studio segmented-atlas checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("shared workspace shell above Storyteller should feel compressed and secondary"),
    "judge quickstart missing Story Studio compact workspace-shell checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("compact story strip with inline glance pills"),
    "judge quickstart missing Story Studio compact top-shell checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop shared context strip should compress further into a thinner editorial ledger"),
    "judge quickstart missing Story Studio thinner desktop context-strip checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop first fold should now behave more like a calm studio page"),
    "judge quickstart missing Story Studio calm studio-page shell checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop CTA row should now resolve into one cleaner handoff"),
    "judge quickstart missing Story Studio cleaner CTA handoff checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed tray shelf should now sit as a quieter after-CTA note row"),
    "judge quickstart missing Story Studio quieter after-CTA tray shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop shared strip should now recede into an even quieter control ledger"),
    "judge quickstart missing Story Studio quieter control-ledger checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop direction strip should now read more like inline reference notes"),
    "judge quickstart missing Story Studio inline direction-reference checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop `Story prompt` header should now read more like a write-title lockup"),
    "judge quickstart missing Story Studio prompt-header lockup checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop textarea shell should now read more like a calm writing surface"),
    "judge quickstart missing Story Studio writing-surface textarea checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop Story Studio title band should now step back further"),
    "judge quickstart missing Story Studio title-band checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop Creative Brief heading block should now read tighter as well"),
    "judge quickstart missing Story Studio brief-heading checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop mode row should now step back into a quieter scenario header"),
    "judge quickstart missing Story Studio quieter mode-row checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop cue line should now read like a tucked editorial ledger"),
    "judge quickstart missing Story Studio tucked cue-line ledger checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop write surface should now tuck closer to that brief header"),
    "judge quickstart missing Story Studio tighter write-surface handoff checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop tray shelf should now settle lower as a quiet after-note ledger"),
    "judge quickstart missing Story Studio quieter after-note tray shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop outer Story Studio shell should now recede into a lighter paper frame"),
    "judge quickstart missing Story Studio lighter outer-shell checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop top utility rail should now settle into an even quieter baseline"),
    "judge quickstart missing Story Studio top utility-rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("visible desktop Storyteller fold should now keep a readable type floor"),
    "judge quickstart missing Story Studio readable type-floor checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("post-run Storyteller reading lane should now keep that floor too"),
    "judge quickstart missing Story Studio post-run readable type-floor checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed tray titles, hints, and facts on steadier one-line rows"),
    "judge quickstart missing Story Studio steadier tray-row checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("equalize the top tray grid"),
    "judge quickstart missing Story Studio aligned desktop layout checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop left nav rail should now recede into a thinner reference rail"),
    "judge quickstart missing Story Studio thinner nav-rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop CTA handoff should now sit closer to that writing surface"),
    "judge quickstart missing Story Studio softer CTA-handoff checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed tray shelf should now recede further into an inline reference ledger"),
    "judge quickstart missing Story Studio collapsed tray ledger checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("small screens should collapse the shared shell into a compact workspace line and compact tab switcher"),
    "judge quickstart missing Story Studio compact mobile-shell checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("atlas switcher should also scroll horizontally"),
    "judge quickstart missing Story Studio compact mobile-atlas checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("inline compose-status row"),
    "judge quickstart missing Story Studio compact first-fold status checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one stronger scenario row plus a quieter cue line"),
    "judge quickstart missing Story Studio quieter upper-rails checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("hidden helper arrows should not leak into accessibility snapshots"),
    "judge quickstart missing Story Studio hidden-helper accessibility checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("restrained chrome sheen and a fixed summary/meta stack"),
    "judge quickstart missing Story Studio tray chrome-stack checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("low-profile cue chips"),
    "judge quickstart missing Story Studio cue-chip strip checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("featured active brief card plus quieter secondary chips"),
    "judge quickstart missing Story Studio active-mode rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("The first scan should read `mode -> cues -> prompt`"),
    "judge quickstart missing Story Studio mode-first scan-order checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one-row scenario lockup"),
    "judge quickstart missing Story Studio one-row scenario-lockup checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("shorter brief preview"),
    "judge quickstart missing Story Studio shorter brief-preview checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("summary-driven drawers with plain-language summaries and quiet meta chips"),
    "judge quickstart missing Story Studio tray-drawer checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("The grouped trays should sit below the prompt canvas"),
    "judge quickstart missing Story Studio tray-below-canvas checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("The prompt canvas should feel roomier than the surrounding chrome"),
    "judge quickstart missing Story Studio roomier compose-canvas checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("full available shell width"),
    "judge quickstart missing Story Studio full-width prerun checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("left nav slimmer, inactive tabs quieter, and top controls smaller"),
    "judge quickstart missing Story Studio quieter shared-chrome checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("the active mode lockup should read like a quieter editorial brief card while the cue line flattens into inline facts"),
    "judge quickstart missing Story Studio desktop brief-header polish checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop pre-run canvas should keep a calmer title/status lockup and a cleaner CTA zone"),
    "judge quickstart missing Story Studio desktop CTA-zone polish checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("shared shell above Story Studio should read like a transparent context strip"),
    "judge quickstart missing Story Studio desktop context-strip checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("left rail reading like a quiet label strip"),
    "judge quickstart missing Story Studio desktop quiet label-rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("the `Creative Brief` tag should read like a quiet label"),
    "judge quickstart missing Story Studio desktop quiet brief-tag checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("active scenario card and cue line should read as one calmer brief header"),
    "judge quickstart missing Story Studio desktop calmer brief-header checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed trays below that canvas should read as one quiet settings shelf on desktop"),
    "judge quickstart missing Story Studio desktop quiet tray-shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("quiet fact-style meta instead of chip chrome"),
    "judge quickstart missing Story Studio desktop inline tray meta checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Latest output` and `Current scene` should stay inside one calmer reading lane"),
    "judge quickstart missing Story Studio desktop calmer reading lane checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Latest output` main card should read as one editorial narrative surface"),
    "judge quickstart missing Story Studio editorial latest-output narrative-surface checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("ready-state `Latest output` should also read like an editorial proof"),
    "judge quickstart missing Story Studio editorial proof latest-output checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Latest output` should widen its narrative measure"),
    "judge quickstart missing Story Studio calmer post-run narrative-rhythm checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Recent passes` into a short revision ledger"),
    "judge quickstart missing Story Studio desktop revision-ledger checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("shared `Output` glance and `Run status` guidance aligned with the real `pending / updating / ready` state"),
    "judge quickstart missing Story Studio live runtime state-alignment checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("desktop interaction pass should also retune the compose CTA contract by state"),
    "judge quickstart missing Story Studio CTA state checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("title-first editorial preview"),
    "judge quickstart missing Story Studio title-first latest-output checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("right side should read as one quieter production column"),
    "judge quickstart missing Story Studio quieter right-column checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("active `Story atlas` panel should read more like a quiet editorial side note"),
    "judge quickstart missing Story Studio quieter active atlas-panel checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one calmer filmstrip lane"),
    "judge quickstart missing Story Studio calmer filmstrip-lane checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one highlighted mode card, a compact secondary mode row, and shorter cue chips"),
    "judge quickstart missing Story Studio compact mobile mode-row checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("cue line should tuck under the active mode lockup as one quieter brief header"),
    "judge quickstart missing Story Studio tighter mobile brief-header checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("secondary mode choices should drop below that cue line as their own scenario row"),
    "judge quickstart missing Story Studio smallest-mobile split mode-row checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("that scenario row should use lighter chrome and the cue line should sit against a subtle guide rule"),
    "judge quickstart missing Story Studio calmer smallest-mobile brief-header checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("inactive mode titles and cue summaries should switch to shorter mobile copy"),
    "judge quickstart missing Story Studio shorter smallest-mobile copy checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("prompt field should drop its helper line and the character counter should flatten into quiet text"),
    "judge quickstart missing Story Studio smaller mobile prompt-field checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapsed trays should read as compact shelf rows"),
    "judge quickstart missing Story Studio calmer mobile tray-shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("instead of spreading them into three equal dashboard columns"),
    "judge quickstart missing Story Studio calmer wide-tray shelf checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("roomier two-column editors"),
    "judge quickstart missing Story Studio roomier expanded-drawer checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one dominant generate action plus a quieter utility row"),
    "judge quickstart missing Story Studio quieter compose-action checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("one drawer full-width"),
    "judge quickstart missing Story Studio full-width drawer checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("small editorial sections"),
    "judge quickstart missing Story Studio grouped drawer-sections checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Open drawers should keep short hints, a quiet action divider, and calm internal section dividers"),
    "judge quickstart missing Story Studio calmer open-drawer checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("calmer narrative rhythm"),
    "judge quickstart missing Story Studio calmer narrative-rhythm checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("single calmer reading lane"),
    "judge quickstart missing Story Studio shared reading-lane checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("`Run status` rail, `Latest output`, `Story atlas`, and the storyboard lane"),
    "judge quickstart missing Story Studio prerun surface-gating checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("quieter production sidebar"),
    "judge quickstart missing Story Studio quieter production-sidebar checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("flatter atlas tab strip"),
    "judge quickstart missing Story Studio flatter atlas-tab-strip checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("collapse into short horizontal scrollers"),
    "judge quickstart missing Story Studio compact mobile middle-stack checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Scene controls` should stay collapsed until scenes exist"),
    "judge quickstart missing Story Studio collapsed scene-controls checkpoint",
  );
  assert.ok(
    operatorGuide.includes("prompt-first story studio workspace"),
    "operator guide missing Story Studio tab description",
  );
  assert.ok(
    operatorGuide.includes("segmented `Story atlas`"),
    "operator guide missing Story Studio segmented-atlas note",
  );
  assert.ok(
    operatorGuide.includes("scene cards render as editorial tiles with cue tags"),
    "operator guide missing Story Studio scene-card polish note",
  );
  assert.ok(
    operatorGuide.includes("Latest output` behaves like a result dossier"),
    "operator guide missing Story Studio latest-output dossier note",
  );
  assert.ok(
    operatorGuide.includes("one quieter dossier stack"),
    "operator guide missing Story Studio calmer dossier-stack note",
  );
  assert.ok(
    operatorGuide.includes("one compact support strip"),
    "operator guide missing Story Studio compact idle-dossier note",
  );
  assert.ok(
    operatorGuide.includes("one calmer unlock card"),
    "operator guide missing Story Studio calmer current-scene idle note",
  );
  assert.ok(
    operatorGuide.includes("one compact fact line"),
    "operator guide missing Story Studio compact current-scene fact-line note",
  );
  assert.ok(
    operatorGuide.includes("do not repeat the main CTA cluster below the fold"),
    "operator guide missing Story Studio quieter empty-state note",
  );
  assert.ok(
    operatorGuide.includes("quieter production rail"),
    "operator guide missing Story Studio production-rail note",
  );
  assert.ok(
    operatorGuide.includes("compact navigator bar plus a storyboard shelf"),
    "operator guide missing Story Studio navigator/shelf note",
  );
  assert.ok(
    operatorGuide.includes("grouped storyboard lane"),
    "operator guide missing Story Studio grouped storyboard-lane note",
  );
  assert.ok(
    operatorGuide.includes("quiet snapshot stack"),
    "operator guide missing Story Studio quiet snapshot-stack note",
  );
  assert.ok(
    operatorGuide.includes("shared workspace summary compresses into a quieter header"),
    "operator guide missing Story Studio compact workspace-shell note",
  );
  assert.ok(
    operatorGuide.includes("compact story strip with inline glance pills"),
    "operator guide missing Story Studio compact top-shell note",
  );
  assert.ok(
    operatorGuide.includes("desktop shared context strip now compresses further into a thinner editorial ledger"),
    "operator guide missing Story Studio thinner desktop context-strip note",
  );
  assert.ok(
    operatorGuide.includes("desktop first fold now also behaves more like a calm studio page"),
    "operator guide missing Story Studio calm studio-page shell note",
  );
  assert.ok(
    operatorGuide.includes("desktop CTA row now resolves into one cleaner handoff"),
    "operator guide missing Story Studio cleaner CTA handoff note",
  );
  assert.ok(
    operatorGuide.includes("collapsed tray shelf now also sits as a quieter after-CTA note row"),
    "operator guide missing Story Studio quieter after-CTA tray shelf note",
  );
  assert.ok(
    operatorGuide.includes("desktop shared strip now recedes into an even quieter control ledger"),
    "operator guide missing Story Studio quieter control-ledger note",
  );
  assert.ok(
    operatorGuide.includes("desktop direction strip now also reads more like inline reference notes"),
    "operator guide missing Story Studio inline direction-reference note",
  );
  assert.ok(
    operatorGuide.includes("desktop `Story prompt` header now reads more like a write-title lockup"),
    "operator guide missing Story Studio prompt-header lockup note",
  );
  assert.ok(
    operatorGuide.includes("desktop textarea shell now reads more like a calm writing surface"),
    "operator guide missing Story Studio writing-surface textarea note",
  );
  assert.ok(
    operatorGuide.includes("desktop Story Studio title band now steps back further"),
    "operator guide missing Story Studio title-band note",
  );
  assert.ok(
    operatorGuide.includes("desktop Creative Brief heading block now reads tighter as well"),
    "operator guide missing Story Studio brief-heading note",
  );
  assert.ok(
    operatorGuide.includes("desktop mode row now steps back into a quieter scenario header"),
    "operator guide missing Story Studio quieter mode-row note",
  );
  assert.ok(
    operatorGuide.includes("desktop cue line now also reads like a tucked editorial ledger"),
    "operator guide missing Story Studio tucked cue-line ledger note",
  );
  assert.ok(
    operatorGuide.includes("desktop write surface now tucks closer to that brief header"),
    "operator guide missing Story Studio tighter write-surface handoff note",
  );
  assert.ok(
    operatorGuide.includes("desktop tray shelf now settles even lower as a quiet after-note ledger"),
    "operator guide missing Story Studio quieter after-note tray shelf note",
  );
  assert.ok(
    operatorGuide.includes("desktop outer Story Studio shell now recedes further into a lighter paper frame"),
    "operator guide missing Story Studio lighter outer-shell note",
  );
  assert.ok(
    operatorGuide.includes("desktop top utility rail now settles into an even quieter baseline"),
    "operator guide missing Story Studio top utility-rail note",
  );
  assert.ok(
    operatorGuide.includes("visible desktop Storyteller fold now keeps a readable type floor"),
    "operator guide missing Story Studio readable type-floor note",
  );
  assert.ok(
    operatorGuide.includes("post-run Storyteller reading lane now keeps that floor too"),
    "operator guide missing Story Studio post-run readable type-floor note",
  );
  assert.ok(
    operatorGuide.includes("collapsed tray titles, hints, and facts on steadier one-line rows"),
    "operator guide missing Story Studio steadier tray-row note",
  );
  assert.ok(
    operatorGuide.includes("desktop left nav rail now recedes further into a thinner reference rail"),
    "operator guide missing Story Studio thinner nav-rail note",
  );
  assert.ok(
    operatorGuide.includes("desktop CTA handoff now sits closer to that writing surface"),
    "operator guide missing Story Studio softer CTA-handoff note",
  );
  assert.ok(
    operatorGuide.includes("collapsed tray shelf now recedes further into an inline reference ledger"),
    "operator guide missing Story Studio collapsed tray ledger note",
  );
  assert.ok(
    operatorGuide.includes("compact workspace line and compact tab switcher"),
    "operator guide missing Story Studio compact mobile-shell note",
  );
  assert.ok(
    operatorGuide.includes("atlas switcher becomes a horizontal scroller"),
    "operator guide missing Story Studio compact mobile-atlas note",
  );
  assert.ok(
    operatorGuide.includes("inline compose-status row"),
    "operator guide missing Story Studio compact first-fold status note",
  );
  assert.ok(
    operatorGuide.includes("quieter cue line"),
    "operator guide missing Story Studio quieter cue-line note",
  );
  assert.ok(
    operatorGuide.includes("dormant helper stepper stays hidden from the accessibility tree"),
    "operator guide missing Story Studio hidden-helper accessibility note",
  );
  assert.ok(
    operatorGuide.includes("regains a restrained chrome sheen and a fixed summary/meta stack"),
    "operator guide missing Story Studio tray chrome-stack note",
  );
  assert.ok(
    operatorGuide.includes("title-first context line with flat glance facts"),
    "operator guide missing Story Studio quiet top-strip note",
  );
  assert.ok(
    operatorGuide.includes("stay below the prompt canvas instead of surfacing ahead of the first action"),
    "operator guide missing Story Studio tray-below-canvas note",
  );
  assert.ok(
    operatorGuide.includes("more room around the active mode lockup, prompt heading, textarea, and CTA row"),
    "operator guide missing Story Studio roomier compose-canvas note",
  );
  assert.ok(
    operatorGuide.includes("full Story Studio width"),
    "operator guide missing Story Studio full-width prerun note",
  );
  assert.ok(
    operatorGuide.includes("slimmer quiet nav with lighter inactive tabs"),
    "operator guide missing Story Studio quieter shared-chrome note",
  );
  assert.ok(
    operatorGuide.includes("active mode lockup reads like a quieter editorial brief card while the cue line flattens into inline facts"),
    "operator guide missing Story Studio desktop brief-header polish note",
  );
  assert.ok(
    operatorGuide.includes("desktop pre-run canvas keeps a calmer title/status lockup and a cleaner CTA zone"),
    "operator guide missing Story Studio desktop CTA-zone polish note",
  );
  assert.ok(
    operatorGuide.includes("global shell above Story Studio now reads more like a transparent context strip than a second hero card"),
    "operator guide missing Story Studio desktop context-strip note",
  );
  assert.ok(
    operatorGuide.includes("left rail reading more like a quiet label strip than a boxed sidebar"),
    "operator guide missing Story Studio desktop quiet label-rail note",
  );
  assert.ok(
    operatorGuide.includes("the `Creative Brief` tag now behaves like a quiet label"),
    "operator guide missing Story Studio desktop quiet brief-tag note",
  );
  assert.ok(
    operatorGuide.includes("active scenario card and cue line now also sit inside one calmer brief header on desktop"),
    "operator guide missing Story Studio desktop calmer brief-header note",
  );
  assert.ok(
    operatorGuide.includes("collapsed trays below that canvas now behave more like one quiet settings shelf on desktop"),
    "operator guide missing Story Studio desktop quiet tray-shelf note",
  );
  assert.ok(
    operatorGuide.includes("quiet fact-style meta instead of chip chrome"),
    "operator guide missing Story Studio desktop inline tray meta note",
  );
  assert.ok(
    operatorGuide.includes("Latest output` and `Current scene` now stay inside one calmer reading lane"),
    "operator guide missing Story Studio desktop calmer reading lane note",
  );
  assert.ok(
    operatorGuide.includes("Latest output` main card now also reads more like one editorial narrative surface"),
    "operator guide missing Story Studio editorial latest-output narrative-surface note",
  );
  assert.ok(
    operatorGuide.includes("ready-state `Latest output` now also reads more like an editorial proof"),
    "operator guide missing Story Studio editorial proof latest-output note",
  );
  assert.ok(
    operatorGuide.includes("Latest output` widens its narrative measure"),
    "operator guide missing Story Studio calmer post-run narrative-rhythm note",
  );
  assert.ok(
    operatorGuide.includes("Recent passes` into a short revision ledger"),
    "operator guide missing Story Studio desktop revision-ledger note",
  );
  assert.ok(
    operatorGuide.includes("shared `Output` glance and `Run status` guidance aligned with the real `pending / updating / ready` state"),
    "operator guide missing Story Studio live runtime state-alignment note",
  );
  assert.ok(
    operatorGuide.includes("desktop interaction pass now also retunes the compose CTA contract by state"),
    "operator guide missing Story Studio CTA state note",
  );
  assert.ok(
    operatorGuide.includes("title-first editorial preview"),
    "operator guide missing Story Studio title-first latest-output note",
  );
  assert.ok(
    operatorGuide.includes("right side now reads as one quieter production column"),
    "operator guide missing Story Studio quieter right-column note",
  );
  assert.ok(
    operatorGuide.includes("active `Story atlas` panel now reads more like a quiet editorial side note"),
    "operator guide missing Story Studio quieter active atlas-panel note",
  );
  assert.ok(
    operatorGuide.includes("one calmer filmstrip lane"),
    "operator guide missing Story Studio calmer filmstrip-lane note",
  );
  assert.ok(
    operatorGuide.includes("interaction layer calmer"),
    "operator guide missing Story Studio postrun interaction-clarity note",
  );
  assert.ok(
    operatorGuide.includes("header and left rail now also read more cleanly"),
    "operator guide missing Story Studio header and left-rail refinement note",
  );
  assert.ok(
    operatorGuide.includes("header and left rail now also breathe more evenly"),
    "operator guide missing Story Studio header and left-rail air note",
  );
  assert.ok(
    operatorGuide.includes("equalizes the top tray grid"),
    "operator guide missing Story Studio aligned desktop layout note",
  );
  assert.ok(
    operatorGuide.includes("one highlighted mode card with a compact secondary mode row"),
    "operator guide missing Story Studio compact mobile mode-row note",
  );
  assert.ok(
    operatorGuide.includes("cue line now tucks under the active mode lockup as one quieter brief header"),
    "operator guide missing Story Studio tighter mobile brief-header note",
  );
  assert.ok(
    operatorGuide.includes("secondary mode choices now drop below that cue line as their own scenario row"),
    "operator guide missing Story Studio smallest-mobile split mode-row note",
  );
  assert.ok(
    operatorGuide.includes("scenario row uses lighter chrome, and the cue line sits against a subtle guide rule"),
    "operator guide missing Story Studio calmer smallest-mobile brief-header note",
  );
  assert.ok(
    operatorGuide.includes("inactive mode titles plus cue summaries switch to shorter mobile copy"),
    "operator guide missing Story Studio shorter smallest-mobile copy note",
  );
  assert.ok(
    operatorGuide.includes("prompt field drops its helper line while the character counter flattens into quiet text"),
    "operator guide missing Story Studio smaller mobile prompt-field note",
  );
  assert.ok(
    operatorGuide.includes("instead of widening into three equal dashboard columns"),
    "operator guide missing Story Studio calmer wide-tray shelf note",
  );
  assert.ok(
    operatorGuide.includes("collapsed trays now read as compact shelf rows"),
    "operator guide missing Story Studio calmer mobile tray-shelf note",
  );
  assert.ok(
    operatorGuide.includes("low-profile cue chips"),
    "operator guide missing Story Studio cue-chip strip note",
  );
  assert.ok(
    operatorGuide.includes("featured active brief card plus quieter secondary chips"),
    "operator guide missing Story Studio active-mode rail note",
  );
  assert.ok(
    operatorGuide.includes("first scan is `mode -> cues -> prompt`"),
    "operator guide missing Story Studio mode-first scan-order note",
  );
  assert.ok(
    operatorGuide.includes("one-row scenario lockup"),
    "operator guide missing Story Studio one-row scenario-lockup note",
  );
  assert.ok(
    operatorGuide.includes("one dominant generate action plus a quieter utility row"),
    "operator guide missing Story Studio quieter compose-action note",
  );
  assert.ok(
    operatorGuide.includes("one drawer full-width"),
    "operator guide missing Story Studio full-width drawer note",
  );
  assert.ok(
    operatorGuide.includes("small editorial sections"),
    "operator guide missing Story Studio grouped drawer-sections note",
  );
  assert.ok(
    operatorGuide.includes("keep shorter tray hints, use a quiet action divider, and add calmer internal section dividers"),
    "operator guide missing Story Studio calmer open-drawer note",
  );
  assert.ok(
    operatorGuide.includes("calmer narrative rhythm"),
    "operator guide missing Story Studio calmer narrative-rhythm note",
  );
  assert.ok(
    operatorGuide.includes("single calmer reading lane"),
    "operator guide missing Story Studio shared reading-lane note",
  );
  assert.ok(
    operatorGuide.includes("`Run status` rail and result surfaces stay off the page entirely"),
    "operator guide missing Story Studio prerun surface-gating note",
  );
  assert.ok(
    operatorGuide.includes("quieter production sidebar"),
    "operator guide missing Story Studio quieter production-sidebar note",
  );
  assert.ok(
    operatorGuide.includes("flatter atlas tab strip"),
    "operator guide missing Story Studio flatter atlas-tab-strip note",
  );
  assert.ok(
    operatorGuide.includes("shorter brief preview"),
    "operator guide missing Story Studio shorter brief-preview note",
  );
    assert.ok(
      operatorGuide.includes("summary-driven editorial drawers with plain-language summary lines and quiet meta chips"),
      "operator guide missing Story Studio tray-drawer note",
    );
    assert.ok(
      operatorGuide.includes("roomier two-column editors"),
      "operator guide missing Story Studio roomier expanded-drawer note",
    );
  assert.ok(
    operatorGuide.includes("collapse into short horizontal summary lanes"),
    "operator guide missing Story Studio compact mobile middle-stack note",
  );
  assert.ok(
    operatorGuide.includes("Scene controls` stay collapsed until the first scene exists"),
    "operator guide missing Story Studio collapsed scene-controls note",
  );
  assert.ok(
    operatorGuide.includes("vertical chain from mode lockup through prompt textarea to Generate is now tighter"),
    "operator guide missing Story Studio mobile vertical-rhythm note",
  );
  assert.ok(
    judgeQuickstart.includes("vertical chain from mode lockup through prompt textarea to Generate should feel tighter"),
    "judge quickstart missing Story Studio mobile vertical-rhythm checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("Atlas` tabs should hover and select without changing footprint"),
    "judge quickstart missing Story Studio postrun action-state checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("header and left rail should now also feel more intentional"),
    "judge quickstart missing Story Studio header and left-rail checkpoint",
  );
  assert.ok(
    judgeQuickstart.includes("header and left rail should now also breathe more evenly"),
    "judge quickstart missing Story Studio header and left-rail air checkpoint",
  );
  assert.ok(
    styles.includes("border-top: 1px solid color-mix(in oklch, var(--border-soft) 32%, transparent);"),
    "frontend styles missing Story Studio mobile tray-grid quiet divider",
  );
  assert.ok(
    styles.includes("/* 2026-03-12: storyteller mobile prompt-canvas vertical rhythm pass */"),
    "frontend styles missing Story Studio vertical-rhythm pass comment",
  );
});







