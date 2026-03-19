import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend keeps live negotiator UX guardrails for advanced controls and intent-aware support rail", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    'id="liveContextDock"',
    'id="liveContextTray"',
    'id="liveContextDockEyebrow"',
    'id="liveContextDockTitle"',
    'id="liveContextDockHint"',
    'id="liveContextDockCurrentLabel"',
    'id="liveContextDockCurrentHint"',
    'id="liveContextDockCurrentState"',
    'id="liveDockWorkflowBtn"',
    'id="liveDockWorkflowState"',
    'id="liveDockVoiceBtn"',
    'id="liveDockVoiceState"',
    'id="liveDockControlBtn"',
    'id="liveDockControlState"',
    'id="liveDockMoreBtn"',
    'id="liveDockMoreState"',
    'id="liveContextTrayEyebrow"',
    'id="liveContextTrayTitle"',
    'id="liveContextTrayHint"',
    'id="liveContextTrayStatus"',
    'id="liveContextTrayClose"',
    'id="liveContextTrayWorkflow"',
    'id="liveContextTrayVoice"',
    'id="liveContextTrayControl"',
    'id="liveContextTrayMore"',
    'id="liveUtilitySection"',
    'id="connectionAdvancedSummary"',
    'id="connectionAdvancedSection"',
    'id="exportMenuSummary"',
    'id="liveSetupAdvanced"',
    'id="liveSetupAdvancedSummary"',
    'id="approvalAdvancedSection"',
    'id="approvalStatusCard"',
    'id="uiTaskAdvancedSection"',
    'id="exportMenu"',
    'class="live-session-export-shell"',
    'class="live-support-card live-support-card-approval"',
    'class="actions approval-actions"',
    'class="live-setup-advanced-grid"',
    'id="kpiPanel"',
    'id="liveSupportPanelTitle"',
    'id="liveSupportPanelIntro"',
    'id="liveResultCard"',
    'id="liveResultLabel"',
    'id="liveResultMeta"',
    'id="liveResultBody"',
    'class="live-reading-stack"',
    'class="live-history-shell"',
    'id="conversationHistory"',
    'id="conversationHistoryHint"',
    'id="liveTechnicalTimelineSection"',
    'id="liveTechnicalTimelineTitle"',
    'id="liveTechnicalTimelineHint"',
    'id="intentLanguageField"',
    'id="targetLanguageHint"',
    'id="liveIntentStageLabel"',
    'id="liveIntentStageHint"',
    'id="liveIntentCards"',
    'id="liveIntentSecondaryShell"',
    'id="liveIntentSecondaryLabel"',
    'id="liveIntentSecondaryHint"',
    'id="liveIntentSecondaryActions"',
    'id="liveIntentSecondaryShell" class="live-intent-secondary-shell" open',
    'class="advanced-settings live-input-optional-tools" open',
    'class="panel live-support-section" open',
    'id="liveUtilitySection" class="panel panel-live-top live-utility-shell" open',
    'id="liveComposeModeChip"',
    'id="liveComposeHelper"',
    'id="messageFieldLabel"',
    'id="messageFieldHint"',
    'id="sendBtnHint"',
    'class="panel panel-live-intent-composer"',
    'class="live-top-summary live-utility-summary"',
    'class="panel live-support-section"',
    'class="live-support-card-title"',
    "class=\"actions actions-priority\"",
    "class=\"action-group action-group-primary\"",
    "class=\"action-group action-group-secondary\"",
    "class=\"panel panel-transcript panel-transcript-live\"",
    'id="uiTaskFields"',
    'class="live-secondary-tools-grid"',
    'class="live-secondary-tool-card"',
    'class="live-debug-transcript-shell"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing live-negotiator ux token: ${token}`);
  }

  const transcriptIdOccurrences = htmlSource.match(/id="transcript"/g)?.length ?? 0;
  assert.equal(transcriptIdOccurrences, 1, "frontend html should keep a single transcript container id");

  const requiredRuntimeTokens = [
    "function getLiveIntentExperienceConfig(intent) {",
    "function getResolvedLiveIntentExperienceConfig(intent) {",
    "function getLiveIntentComposerConfig(intent) {",
    "function getLiveWorkspaceIntentLabel(intent, isRu = state.languageMode === \"ru\") {",
    "function getLiveWorkspaceSessionLabel(sessionText, isRu = state.languageMode === \"ru\") {",
    "function getLiveIntentCardDefinitions() {",
    "function renderLiveIntentCards() {",
    "function focusPrimaryLiveFieldForIntent(intent) {",
    "function renderLiveIntentExperience() {",
    "function normalizeLiveContextDockPanel(value) {",
    "function getLiveContextDockButtonMap() {",
    "function getLiveContextDockTrayMap() {",
    "function getLiveContextDockStateMap() {",
    "function getLiveContextDockOrderedButtons() {",
    "function syncLiveContextDockRovingState(preferredButton = null) {",
    "function bindDismissibleDetailsPanel(details) {",
    "function closeDismissibleDetailsPanel(details) {",
    "function bindPersistentMountedLiveContextSection(section) {",
    "function ensureMountedLiveContextSectionExpanded(container) {",
    "function scheduleDeferredFocus(callback, delays = [0, 40, 120]) {",
    'function focusExportMenuAction(edge = "start") {',
    "function focusExportMenuSummary() {",
    "function focusLiveContextTrayPrimaryAction(trayId) {",
    "const LIVE_CONTEXT_KEYBOARD_HANDOFF_DELAYS = Object.freeze([0, 120, 280, 520]);",
    "const LIVE_CONTEXT_DISCLOSURE_FOCUS_DELAYS = Object.freeze([0, 200, 520, 900]);",
    "function getCurrentLiveIntentValue() {",
    "function getLiveContextDockTaskCountLabel(count, isRu) {",
    "function getLiveContextDockPanelDescriptor(panelKey) {",
    "function mountLiveContextDockPanels() {",
    "function renderLiveContextDock() {",
    "function setActiveLiveContextPanel(panelKey, options = {}) {",
    "function setLiveResult(role, text, options = {}) {",
    "function appendConversationHistory(role, text, options = {}) {",
    'liveContextDock: document.getElementById("liveContextDock")',
    'liveContextTray: document.getElementById("liveContextTray")',
    'liveContextDockCurrentHint: document.getElementById("liveContextDockCurrentHint")',
    'liveContextDockCurrentState: document.getElementById("liveContextDockCurrentState")',
    'liveDockWorkflowState: document.getElementById("liveDockWorkflowState")',
    'liveDockVoiceState: document.getElementById("liveDockVoiceState")',
    'liveDockControlState: document.getElementById("liveDockControlState")',
    'liveDockMoreState: document.getElementById("liveDockMoreState")',
    'liveContextTrayTitle: document.getElementById("liveContextTrayTitle")',
    'liveContextTrayHint: document.getElementById("liveContextTrayHint")',
    'liveContextTrayStatus: document.getElementById("liveContextTrayStatus")',
    'liveContextTrayClose: document.getElementById("liveContextTrayClose")',
    'liveInputOptionalToolsSection: document.querySelector(".live-input-optional-tools")',
    'liveSupportSection: document.querySelector(".live-support-section")',
    'liveUtilitySection: document.getElementById("liveUtilitySection")',
    'approvalStatusCard: document.getElementById("approvalStatusCard")',
    'uiTaskAdvancedSection: document.getElementById("uiTaskAdvancedSection")',
    'kpiPanel: document.getElementById("kpiPanel")',
    'liveResultCard: document.getElementById("liveResultCard")',
    'liveSupportPanelIntro: document.getElementById("liveSupportPanelIntro")',
    'conversationHistory: document.getElementById("conversationHistory")',
    'liveTechnicalTimelineSection: document.getElementById("liveTechnicalTimelineSection")',
    'liveIntentSecondaryShell: document.getElementById("liveIntentSecondaryShell")',
    'liveIntentSecondaryHint: document.getElementById("liveIntentSecondaryHint")',
    'liveIntentCards: document.getElementById("liveIntentCards")',
    'liveIntentSecondaryActions: document.getElementById("liveIntentSecondaryActions")',
    '"live.compose.serviceActionsTitle": "Service-side actions"',
    '"live.compose.sendBackgroundRequest": "Send background request"',
    '"live.compose.secondaryTitle": "Story & UI tasks"',
    '"live.connection.targetLanguageHint": "Language you want back"',
    '"live.context.workflow": "Workflow"',
    '"live.context.voice": "Voice"',
    '"live.context.control": "Control"',
    '"live.context.more": "More"',
    "function getLiveTargetLanguageValue() {",
    "function getLiveTargetLanguageDisplayLabel() {",
    'CUSTOM_SELECT_EXCLUDE_IDS.add("intent");',
    "const LIVE_INTENT_PRIMARY_CARD_ORDER = Object.freeze([",
    "const LIVE_INTENT_SECONDARY_CARD_ORDER = Object.freeze([",
    "const LIVE_CONTEXT_DOCK_PANELS = Object.freeze([",
    "button.dataset.intentCard = intentKey;",
    "focusPrimaryLiveFieldForIntent(intentKey);",
    "renderLiveIntentCards();",
    "renderLiveContextDock();",
    "const orderedLiveContextDockButtons = getLiveContextDockOrderedButtons();",
    "syncLiveContextDockRovingState(nextButton);",
    "queueMicrotask(finalizeRovingState);",
    "window.requestAnimationFrame(finalizeRovingState);",
    'focusExportMenuAction("start");',
    'focusExportMenuAction("end");',
    "focusLiveContextDockButtonByIndex(currentIndex + 1);",
    "focusLiveContextDockButtonByIndex(currentIndex - 1);",
    "event.detail === 0",
    'const activeTrayId = button.getAttribute("aria-controls") ?? "";',
    'setActiveLiveContextPanel(panelKey, { allowCollapse: false });',
    'button.addEventListener("keyup", (event) => {',
    "window.setTimeout(() => {",
    "preferActionable: true,",
    "blurActive: true,",
    "focusLiveContextTrayPrimaryAction(activeTrayId);",
    'summary, button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    "closeExportMenu({ restoreFocus: true });",
    "closeDismissibleDetailsPanel(activeOpenDetails);",
    "bindPersistentMountedLiveContextSection(mountedDetails);",
    "ensureMountedLiveContextSectionExpanded(tray);",
    "const activePanelKey = normalizeLiveContextDockPanel(activeElement.dataset.liveDockTarget);",
    "scheduleDeferredFocus(() => {",
    "el.exportMenu instanceof HTMLDetailsElement && el.exportMenu.open",
    'const targetOpenDetails = eventTarget instanceof HTMLElement ? eventTarget.closest("details[open]") : null;',
    'activeElement.getAttribute("aria-selected") !== "true"',
    'const activeTrayId = activeElement.getAttribute("aria-controls") ?? "";',
    'document.addEventListener("keyup", (event) => {',
    "const dismissibleLivePanels = [",
    'setActiveLiveContextPanel("workflow", { force: true });',
    'setActiveLiveContextPanel(null, { force: true });',
    "const config = getResolvedLiveIntentExperienceConfig(intent);",
    "const composeConfig = getLiveIntentComposerConfig(intent);",
    "el.uiTaskAdvancedSection.hidden = !isUiTaskIntent;",
    'el.uiTaskAdvancedSection.setAttribute("aria-hidden", isUiTaskIntent ? "false" : "true");',
    "el.uiTaskAdvancedSection.open = isUiTaskIntent;",
    'el.kpiPanel.hidden = !config.showKpi;',
    'el.intentLanguageField.hidden = !composeConfig.showTargetLanguage;',
    "function syncLiveIntentSubmitState(composeConfig = null) {",
    'el.message.placeholder = composeConfig.messagePlaceholder;',
    "livePendingRequest: null,",
    "pendingIntentRequest: null,",
    "function dispatchIntentRequestEnvelope({ intent, input, conversation, requestMetadata, requestRunId }) {",
    "state.pendingIntentRequest = requestEnvelope;",
    "connectWebSocket();",
    "Queued request sent after connection.",
    'case "quick_conversation":',
    'case "quick_research":',
    'config.historyEmpty ?? "No conversation turns yet."',
    'config.historyPending ?? config.historyEmpty',
    'config.pendingResult ?? config.emptyResult',
    'config.streamingMeta ?? (state.languageMode === "ru" ? "Ассистент печатает..." : "Assistant is streaming...")',
    'el.liveResultCard.classList.toggle("is-pending", !hasIntentMatchedResult && awaitingFreshResponse);',
    'function getLiveConversationRoleLabel(role) {',
    'function normalizeLiveConversationIntent(value) {',
    'function resolveLiveConversationIntent(intent = null) {',
    'function filterLiveConversationHistoryByIntent(history, intent) {',
    'function renderConversationHistory() {',
    'state.liveConversationHistory = [];',
    'el.conversationHistory.classList.toggle("is-awaiting", awaitingFreshResponse);',
    'el.transcript.setAttribute("data-empty-text", config.technicalEmpty ?? "Runtime and queue events appear here only when they matter.");',
    'appendConversationHistory(role, text, { intent: transcriptIntent });',
    'setLiveResult(role, text, {',
    'function findResearchDebugPayload(value) {',
    'const researchDebugSummary = !isOutOfBandResponse ? findResearchDebugPayload(output) : null;',
    'appendTranscript("system", researchDebugSummary, { exposeInLiveResult: false });',
    "function renderActiveTaskEmptyState() {",
    "applyIntentTemplateFromActiveTasks(scenario.intent, scenario.template);",
    "renderActiveTaskEmptyState();",
    'return t("live.connection.exportSession");',
    "function getOperatorControlPlaneFailureState(error, options = {}) {",
    "function ensureOperatorWorkflowControlPrimed(options = {}) {",
    "function ensureOperatorBrowserWorkerControlPrimed(options = {}) {",
    "function resolveOperatorWorkflowPayloadDegradedState(payload) {",
    "function resolveOperatorBrowserWorkerPayloadDegradedState(payload) {",
    'el.operatorWorkflowControl.addEventListener("toggle", () => {',
    'el.operatorBrowserWorkerControl.addEventListener("toggle", () => {',
    'state.operatorWorkflowControlState = "loading";',
    'state.operatorBrowserWorkerControlState = "loading";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live-negotiator ux token: ${token}`);
  }

  const requiredStyleTokens = [
    ".advanced-settings {",
    ".advanced-connection-settings {",
    ".panel-live-intent-composer {",
    "#tab-live-negotiator {",
    ".live-utility-shell {",
    ".live-utility-grid > .panel-live-top {",
    ".live-utility-card-heading {",
    ".live-top-summary,",
    ".live-top-summary:focus-visible,",
    ".advanced-settings > summary:focus-visible {",
    ".live-intent-secondary-shell > summary:focus-visible {",
    ".live-support-section {",
    ".live-support-grid {",
    ".live-compose-guidance {",
    ".live-intent-stage-head {",
    ".live-intent-stage {",
    ".live-intent-switcher {",
    ".live-intent-option {",
    ".live-context-dock-shell {",
    ".live-context-dock-head {",
    ".live-context-dock-current {",
    ".live-context-dock-current-hint {",
    ".live-context-dock {",
    ".live-context-dock-btn {",
    ".live-context-dock-btn:focus-visible {",
    ".live-context-dock-btn-head {",
    ".live-context-tray {",
    ".live-context-tray-head {",
    ".live-context-tray-close {",
    ".live-context-tray-close:focus-visible {",
    ".live-context-mounted-section {",
    ".live-intent-secondary-shell {",
    ".live-intent-secondary-copy {",
    ".live-intent-secondary-hint {",
    ".live-intent-native-field {",
    ".live-compose-mode-chip {",
    ".intent-compose-grid {",
    ".field-heading {",
    ".field-inline-hint {",
    ".live-compose-send-hint {",
    ".live-secondary-tools-grid {",
    ".live-secondary-tool-card {",
    ".live-secondary-tool-title {",
    ".live-secondary-tool-hint {",
    ".live-negotiator-secondary {",
    "position: sticky;",
    ".actions-priority {",
    ".actions-priority .action-group-primary {",
    ".actions-priority .action-group-secondary.action-group-export {",
    ".action-group {",
    ".panel-live-connection .action-group-primary > .export-menu {",
    ".live-session-export-shell {",
    ".export-menu-item:focus-visible {",
    ".export-menu-summary-copy {",
    ".connection-advanced-shell {",
    ".live-setup-advanced-grid {",
    ".operator-workflow-control.is-unavailable,",
    ".operator-browser-worker-control.is-unavailable {",
    ".operator-workflow-control.is-stale .operator-workflow-control-output-card:first-child,",
    ".panel-live-controls .action-group-live-control {",
    ".panel-live-controls .control-cluster + .control-cluster {",
    ".live-top-panel-body,",
    ".live-support-card .actions {",
    ".live-support-card .meta-row > div {",
    ".live-support-card .events.is-empty-state {",
    ".live-support-card .active-task-empty-actions {",
    ".live-support-card-approval {",
    ".approval-overview {",
    ".approval-status-card {",
    ".approval-actions {",
    "#approvalAdvancedSection > summary {",
    ".approval-advanced-grid .field {",
    ".dashboard-workspace-summary {",
    ".dashboard-glance-card {",
    '.layout[data-active-tab="live-negotiator"] .dashboard-body {',
    '.layout[data-active-tab="live-negotiator"] .dashboard-nav {',
    '.layout[data-active-tab="live-negotiator"] .dashboard-shell-meta {',
    '.layout[data-active-tab="live-negotiator"] .live-negotiator-main {',
    ".panel-transcript-live .transcript {",
    ".live-context-dock-copy-hint {",
    ".live-context-dock-current .status-pill {",
    ".live-context-tray-actions .status-pill {",
    ".live-context-tray-panel .live-intent-option-secondary {",
    ".live-context-dock-shell + .intent-compose-grid {",
    ".live-compose-primary-actions {",
    ".live-reading-stack {",
    ".live-result-card {",
    ".live-result-card .live-result-copy {",
    ".live-result-card.is-pending {",
    ".live-result-card.is-ready {",
    ".live-result-head {",
    ".panel-transcript-live #liveResultMeta {",
    ".live-history-shell {",
    ".conversation-history {",
    ".panel-transcript-live .conversation-history.is-awaiting:empty {",
    ".panel-transcript-live .conversation-history .entry::before {",
    ".conversation-history .entry.user {",
    ".conversation-history .entry.assistant {",
    ".live-technical-timeline {",
    ".live-debug-transcript-shell {",
    ".live-debug-transcript-shell .transcript:empty {",
    ".live-debug-transcript-shell .entry.error {",
    ".entry.user {",
    ".entry.assistant {",
    "position: static;",
    ".active-task-empty-state {",
    ".active-task-empty-actions {",
    ".active-task-empty-action-refresh {",
    ".task-entry-title-block {",
    ".task-entry-details {",
    ".task-entry-ref-grid {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing live-negotiator ux token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("task-first"),
    "README missing task-first live lane note",
  );
  assert.ok(
    readmeSource.includes("summary-led approval card"),
    "README missing approval-card hierarchy note",
  );
  assert.ok(
    readmeSource.includes("More tools` now reads as two calmer support cards"),
    "README missing more-tools micro-polish note",
  );
  assert.ok(
    readmeSource.includes("visual mode switcher"),
    "README missing visual mode-switcher note",
  );
  assert.ok(
    readmeSource.includes("translation-first"),
    "README missing translation-first live entry note",
  );
  assert.ok(
    readmeSource.includes("status-aware utility dock"),
    "README missing status-aware utility dock note",
  );
  assert.ok(
    readmeSource.includes("display-safe `payload.output.text`"),
    "README missing research display-text note",
  );
  assert.ok(
    operatorGuideSource.includes("status-aware utility dock"),
    "operator guide missing status-aware utility dock note",
  );
  assert.ok(
    operatorGuideSource.includes("summary-led approval card"),
    "operator guide missing approval-card hierarchy note",
  );
  assert.ok(
    operatorGuideSource.includes("More tools` now reads as two calmer support cards"),
    "operator guide missing more-tools micro-polish note",
  );
  assert.ok(
    readmeSource.includes("compact active-workspace shell"),
    "README missing compact workspace-shell note",
  );
  assert.ok(
    readmeSource.includes("hero no longer duplicates task choice"),
    "README missing non-duplicated task-choice note",
  );
  assert.ok(
    readmeSource.includes("short uppercase labels over full tab names"),
    "README missing two-line dashboard rail note",
  );
  assert.ok(
    readmeSource.includes("quiet utility trays"),
    "README missing live utility-tray note",
  );
  assert.ok(
    readmeSource.includes("support dock directly below the main composer"),
    "README missing support-dock placement note",
  );
  assert.ok(
    readmeSource.includes("shared utility tray"),
    "README missing shared utility tray note",
  );
  assert.ok(
    readmeSource.includes("one collapsible `Voice Mode & Session` shell"),
    "README missing unified live utility-layer note",
  );
  assert.ok(
    readmeSource.includes("single-column stack"),
    "README missing live support single-column note",
  );
  assert.ok(
    readmeSource.includes("latest-result card plus clean conversation history"),
    "README missing action-lane hierarchy note",
  );
  assert.ok(
    readmeSource.includes("reading rail"),
    "README missing reading-rail note",
  );
  assert.ok(
    readmeSource.includes("rare-use drawer for audio and service actions"),
    "README missing rare-use drawer note",
  );
  assert.ok(
    readmeSource.includes("plain `From language -> Translate to` model with real language pickers"),
    "README missing clearer translation-direction picker note",
  );
  assert.ok(
    readmeSource.includes("plain-language section names (`More tools`, `Operator Control`, `Current Tasks`)"),
    "README missing plain-language live section note",
  );
  assert.ok(
    readmeSource.includes("debug-only block"),
    "README missing debug-only block note",
  );
  assert.ok(
    readmeSource.includes("ArrowLeft/ArrowRight/Home/End"),
    "README missing live dock keyboard-navigation note",
  );
  assert.ok(
    readmeSource.includes("Escape now closes open live trays"),
    "README missing live escape-dismiss note",
  );
  assert.ok(
    readmeSource.includes("first fold stays focused on mode, input, and result"),
    "README missing first-fold focus note",
  );
  assert.ok(
    operatorGuideSource.includes("intent-aware right rail"),
    "operator guide missing intent-aware rail note",
  );
  assert.ok(
    operatorGuideSource.includes("reading rail"),
    "operator guide missing reading-rail note",
  );
  assert.ok(
    operatorGuideSource.includes("visual mode switcher"),
    "operator guide missing visual mode-switcher note",
  );
  assert.ok(
    operatorGuideSource.includes("task-first"),
    "operator guide missing task-first live workflow note",
  );
  assert.ok(
    operatorGuideSource.includes("translation-first"),
    "operator guide missing translation-first live workflow note",
  );
  assert.ok(
    operatorGuideSource.includes("collapsed technical-details block"),
    "operator guide missing technical timeline collapse note",
  );
  assert.ok(
    operatorGuideSource.includes("rare-use drawer"),
    "operator guide missing rare-use drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("debug-only block"),
    "operator guide missing debug-only block note",
  );
  assert.ok(
    operatorGuideSource.includes("ArrowLeft/ArrowRight/Home/End"),
    "operator guide missing live dock keyboard-navigation note",
  );
  assert.ok(
    operatorGuideSource.includes("Escape now closes open live trays"),
    "operator guide missing live escape-dismiss note",
  );
  assert.ok(
    operatorGuideSource.includes("first fold stays focused on mode, input, and result"),
    "operator guide missing first-fold focus note",
  );
  assert.ok(
    operatorGuideSource.includes("four user-facing action cards"),
    "operator guide missing simplified action-deck note",
  );
  assert.ok(
    operatorGuideSource.includes("`Story` / `UI task` are pushed into a quieter follow-up drawer"),
    "operator guide missing follow-up-drawer note",
  );
  assert.ok(
    operatorGuideSource.includes("short uppercase labels over full tab names"),
    "operator guide missing two-line dashboard rail note",
  );
  assert.ok(
    operatorGuideSource.includes("quiet utility trays"),
    "operator guide missing live utility-tray note",
  );
  assert.ok(
    operatorGuideSource.includes("support dock directly below the main composer"),
    "operator guide missing support-dock placement note",
  );
  assert.ok(
    operatorGuideSource.includes("shared utility tray"),
    "operator guide missing shared utility tray note",
  );
  assert.ok(
    operatorGuideSource.includes("one collapsible utility layer (`Voice Mode & Session`)"),
    "operator guide missing unified live utility-layer note",
  );
  assert.ok(
    operatorGuideSource.includes("single-column support stack"),
    "operator guide missing live support single-column note",
  );
  assert.ok(
    operatorGuideSource.includes("plain-language section names"),
    "operator guide missing plain-language naming note",
  );
  assert.ok(
    operatorGuideSource.includes("plain `From language -> Translate to` translation setup"),
    "operator guide missing clearer translation-direction picker note",
  );
  assert.ok(
    operatorGuideSource.includes("`Active Tasks` empty state offers one-click quick starts"),
    "operator guide missing active task empty-state quick starts note",
  );
});

test("demo frontend prefers display-safe output.text over technical output.message", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const startToken = "function findTextPayload(value) {";
  const nextHelperTokens = [
    "\n\nfunction buildStoryLaunchFallbackText(output) {",
    "\n\nfunction findResearchDebugPayload(value) {",
  ];
  const startIndex = appSource.indexOf(startToken);
  const endIndex = nextHelperTokens
    .map((token) => appSource.indexOf(token, startIndex + startToken.length))
    .filter((index) => index !== -1)
    .sort((left, right) => left - right)[0] ?? -1;

  assert.notEqual(startIndex, -1, "frontend runtime missing findTextPayload helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing findTextPayload helper boundary");

  const functionSource = appSource.slice(startIndex, endIndex);
  const findTextPayload = runInNewContext(`(${functionSource})`) as (value: unknown) => string | null;

  assert.equal(
    findTextPayload({
      text: "How are you?",
      message: "Translation (ru -> en): How are you?",
      translation: {
        translatedText: "How are you?",
      },
    }),
    "How are you?",
    "frontend should prefer display-safe output.text when both text and message are present",
  );

  assert.equal(
    findTextPayload({
      message: "Translation (ru -> en): How are you?",
      translation: {
        translatedText: "How are you?",
      },
    }),
    "Translation (ru -> en): How are you?",
    "frontend should fall back to technical message only when display-safe text is absent",
  );
});

test("demo frontend uses the selected speech-language label in translation result meta", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const startToken = "function getLiveTargetLanguageValue() {";
  const endToken = "\n\nfunction getLiveIntentComposerConfig(intent) {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing live language helpers");
  assert.notEqual(endIndex, -1, "frontend runtime missing live intent composer boundary");

  const helperSource = appSource.slice(startIndex, endIndex);

  class HtmlSelectMock {
    value: string;
    selectedIndex: number;
    options: { item: (index: number) => { textContent?: string } | null };

    constructor(value: string, labels: string[], selectedIndex = 0) {
      this.value = value;
      this.selectedIndex = selectedIndex;
      this.options = {
        item: (index: number) => (index >= 0 && index < labels.length ? { textContent: labels[index] } : null),
      };
    }
  }

  const helpers = runInNewContext(`${helperSource}; ({ getResolvedLiveIntentExperienceConfig })`, {
    state: {
      languageMode: "ru",
    },
    el: {
      targetLanguage: new HtmlSelectMock("en", ["English / Английский"]),
      speechLanguage: new HtmlSelectMock("ru-RU", ["Русский (Россия)"]),
    },
    navigator: {
      languages: ["ru-RU"],
      language: "ru-RU",
    },
    HTMLSelectElement: HtmlSelectMock,
    HTMLInputElement: class HtmlInputMock {},
  }) as {
    getResolvedLiveIntentExperienceConfig: (intent: string) => { resultMeta: string };
  };

  const config = helpers.getResolvedLiveIntentExperienceConfig("translation");

  assert.equal(
    config.resultMeta,
    "Целевой язык: English / Английский · язык речи: Русский (Россия)",
    "translation result meta should use the selected speech-language label instead of the raw select element",
  );
  assert.ok(
    !config.resultMeta.includes("[object HTMLSelectElement]"),
    "translation result meta should never leak the speech-language DOM element",
  );
});

test("demo frontend scopes visible conversation history to the active intent", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const normalizeStartToken = "function normalizeLiveConversationIntent(value) {";
  const normalizeEndToken = "\n\nfunction resolveLiveConversationIntent(intent = null) {";
  const resolveStartToken = "function resolveLiveConversationIntent(intent = null) {";
  const resolveEndToken = "\n\nfunction filterLiveConversationHistoryByIntent(history, intent) {";
  const filterStartToken = "function filterLiveConversationHistoryByIntent(history, intent) {";
  const filterEndToken = "\n\nfunction renderConversationHistory() {";

  const normalizeStartIndex = appSource.indexOf(normalizeStartToken);
  const normalizeEndIndex = appSource.indexOf(normalizeEndToken, normalizeStartIndex);
  const resolveStartIndex = appSource.indexOf(resolveStartToken);
  const resolveEndIndex = appSource.indexOf(resolveEndToken, resolveStartIndex);
  const filterStartIndex = appSource.indexOf(filterStartToken);
  const filterEndIndex = appSource.indexOf(filterEndToken, filterStartIndex);

  assert.notEqual(normalizeStartIndex, -1, "frontend runtime missing normalizeLiveConversationIntent helper");
  assert.notEqual(normalizeEndIndex, -1, "frontend runtime missing resolveLiveConversationIntent helper boundary");
  assert.notEqual(resolveStartIndex, -1, "frontend runtime missing resolveLiveConversationIntent helper");
  assert.notEqual(resolveEndIndex, -1, "frontend runtime missing filterLiveConversationHistoryByIntent helper boundary");
  assert.notEqual(filterStartIndex, -1, "frontend runtime missing filterLiveConversationHistoryByIntent helper");
  assert.notEqual(filterEndIndex, -1, "frontend runtime missing renderConversationHistory helper boundary");

  const normalizeSource = appSource.slice(normalizeStartIndex, normalizeEndIndex);
  const resolveSource = appSource.slice(resolveStartIndex, resolveEndIndex);
  const filterSource = appSource.slice(filterStartIndex, filterEndIndex);

  const normalizeLiveConversationIntent = runInNewContext(`(${normalizeSource})`, {
    LIVE_INTENT_PRIMARY_CARD_ORDER: ["translation", "conversation", "negotiation", "research"],
    LIVE_INTENT_SECONDARY_CARD_ORDER: ["story", "ui_task"],
  }) as (value: unknown) => string;

  const resolveLiveConversationIntent = runInNewContext(`(${resolveSource})`, {
    normalizeLiveConversationIntent,
    getCurrentLiveIntentValue: () => "translation",
  }) as (value: unknown) => string;

  const filterLiveConversationHistoryByIntent = runInNewContext(`(${filterSource})`, {
    normalizeLiveConversationIntent,
  }) as (history: unknown[], intent: string) => Array<Record<string, unknown>>;

  assert.equal(
    resolveLiveConversationIntent("conversation"),
    "conversation",
    "explicit conversation replies should stay scoped to the conversation lane even if the UI switched intents",
  );

  const visibleHistory = [
    { intent: "conversation", role: "assistant", text: "РџРѕРјРѕРіР°СЋ СЃ РІРѕРїСЂРѕСЃР°РјРё Рё Р·Р°РґР°С‡Р°РјРё." },
    { intent: "translation", role: "assistant", text: "How are you?" },
    { intent: "conversation", role: "user", text: "РљР°Рє РґРµР»Р° С‡РµРј Р·Р°РЅРёРјР°РµС€СЊСЃСЏ?" },
    { intent: "research", role: "assistant", text: "Research answer" },
  ];

  assert.deepEqual(
    filterLiveConversationHistoryByIntent(visibleHistory, "conversation").map((entry) => entry.text),
    ["РџРѕРјРѕРіР°СЋ СЃ РІРѕРїСЂРѕСЃР°РјРё Рё Р·Р°РґР°С‡Р°РјРё.", "РљР°Рє РґРµР»Р° С‡РµРј Р·Р°РЅРёРјР°РµС€СЊСЃСЏ?"],
    "visible history should keep only conversation turns inside the conversation lane",
  );

  assert.deepEqual(
    filterLiveConversationHistoryByIntent(visibleHistory, "translation").map((entry) => entry.text),
    ["How are you?"],
    "visible history should keep translation turns out of the conversation lane",
  );
});

test("demo frontend keeps the live submit button in a pending state while awaiting an agent reply", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");

  const requiredRuntimeTokens = [
    "liveLastRequestAt: null,",
    "livePendingRequest: null,",
    "function resolveLivePendingSubmitCopy(intent, phase = \"awaiting_response\") {",
    "function resolveLivePendingRequest() {",
    "function syncLiveIntentSubmitState(composeConfig = null) {",
    'el.sendBtn.classList.toggle("is-pending", isPending);',
    'el.sendBtn.setAttribute("aria-busy", isPending ? "true" : "false");',
    'setLivePendingRequest(intent, { phase: "connecting", runId: requestRunId });',
    'setLivePendingRequest(intent, { phase: "awaiting_response", runId: requestRunId });',
    "function clearLivePendingRequest() {",
    "clearLivePendingRequest();",
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing pending submit token: ${token}`);
  }

  const requiredStyleTokens = [
    ".live-compose-primary-actions > button.is-pending {",
    ".live-compose-primary-actions > button.is-pending::before {",
    ".live-compose-send-hint.is-pending {",
    "@keyframes live-send-button-spin {",
  ];

  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing pending submit token: ${token}`);
  }
});

test("demo frontend keeps websocket and gateway transport details out of the user-facing live result", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const requiredRuntimeTokens = [
    "function hasLiveRequestInFlight() {",
    "function resolveLiveRuntimeFailureCopy(kind = \"transport\") {",
    "function reportLiveRuntimeFailure(kind, technicalMessage, options = {}) {",
    'appendTranscript("error", technicalText, { exposeInLiveResult: false });',
    'reportLiveRuntimeFailure("gateway", details.length > 0 ? `${fallbackMessage} (${details})` : fallbackMessage);',
    'reportLiveRuntimeFailure("transport", "WebSocket closed");',
    'reportLiveRuntimeFailure("transport", "WebSocket error", {',
    'reportLiveRuntimeFailure("protocol", `Received non-JSON frame from gateway: ${details}`, {',
  ];

  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing live transport failure token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Transport failures now keep websocket/gateway technical details in the debug-only system log"),
    "README missing live transport-failure reading-rail note",
  );
});

test("demo frontend sends workflow story launches with storyteller-shaped input", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const inferStartToken = "function resolveStorySegmentCountFromPrompt(prompt) {";
  const inferEndToken = "\n\nfunction inferStorySegmentCountFromPrompt(prompt) {";
  const buildStartToken = "function buildLiveIntentInput(intent, options = {}) {";
  const buildEndToken = "\n\nfunction sendIntentRequest(options = {}) {";

  const inferStartIndex = appSource.indexOf(inferStartToken);
  const inferEndIndex = appSource.indexOf(inferEndToken, inferStartIndex);
  const buildStartIndex = appSource.indexOf(buildStartToken);
  const buildEndIndex = appSource.indexOf(buildEndToken, buildStartIndex);

  assert.notEqual(inferStartIndex, -1, "frontend runtime missing resolveStorySegmentCountFromPrompt helper");
  assert.notEqual(inferEndIndex, -1, "frontend runtime missing inferStorySegmentCountFromPrompt helper boundary");
  assert.notEqual(buildStartIndex, -1, "frontend runtime missing buildLiveIntentInput helper");
  assert.notEqual(buildEndIndex, -1, "frontend runtime missing sendIntentRequest helper boundary");

  const inferSource = appSource.slice(inferStartIndex, inferEndIndex);
  const buildSource = appSource.slice(buildStartIndex, buildEndIndex);

  const resolveStorySegmentCountFromPrompt = runInNewContext(`(${inferSource})`) as (prompt: string) => number;
  const buildLiveIntentInput = runInNewContext(`(${buildSource})`, {
    inferStorySegmentCountFromPrompt: resolveStorySegmentCountFromPrompt,
    normalizeStoryComposerMode: (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : "cinematic"),
    resolveLiveStoryLanguage: () => "ru",
    state: {
      storyComposerMode: "cinematic",
    },
  }) as (intent: string, options?: Record<string, unknown>) => Record<string, unknown>;
  const fourScenePrompt = "Собери 4-сценную историю про запуск продукта.";
  const fiveScenePrompt = "Собери 5 сцен про запуск нового AI-продукта.";

  assert.equal(
    resolveStorySegmentCountFromPrompt(fourScenePrompt),
    4,
    "story prompt helper should recover 4-scene requests from the live workflow brief",
  );
  assert.equal(
    resolveStorySegmentCountFromPrompt(fiveScenePrompt),
    5,
    "story prompt helper should recover scene counts from Russian prompts too",
  );
  assert.equal(
    resolveStorySegmentCountFromPrompt("Build a 5 scene launch story."),
    5,
    "story prompt helper should recover scene counts from English prompts too",
  );

  const storyInput = buildLiveIntentInput("story", {
    message: "Собери 5 сцен про запуск нового AI-продукта.",
    targetLanguage: "en",
    targetPrice: 100,
    targetDelivery: 14,
    targetSla: 98,
    uiTaskOverrides: {
      url: "https://example.com",
    },
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(storyInput)),
    {
      prompt: "Собери 5 сцен про запуск нового AI-продукта.",
      language: "ru",
      style: "cinematic",
      segmentCount: 5,
      includeImages: true,
      includeVideo: false,
    },
    "workflow story launches should send storyteller-shaped input instead of the generic live text payload",
  );

  assert.ok(
    readmeSource.includes("Workflow Story launches in Live now send storyteller-shaped input"),
    "README missing workflow story payload note",
  );
  assert.ok(
    readmeSource.includes("requested scene counts from both Russian and English briefs"),
    "README missing bilingual live story segment-count note",
  );
});

test("demo frontend exposes a direct Storyteller CTA on ready live story launches", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const helperStartToken = "function getLiveResultActionConfig(intent, latestResult, hasIntentMatchedResult) {";
  const helperEndTokenCandidates = [
    "\n\nfunction getLiveResultSummaryConfig(intent, latestResult, hasIntentMatchedResult) {",
    "\n\nfunction getResolvedLiveIntentExperienceConfig(intent) {",
  ];
  const helperStartIndex = appSource.indexOf(helperStartToken);
  const helperEndIndex = helperEndTokenCandidates
    .map((token) => appSource.indexOf(token, helperStartIndex))
    .filter((index) => index !== -1)
    .sort((left, right) => left - right)[0] ?? -1;

  assert.notEqual(helperStartIndex, -1, "frontend runtime missing getLiveResultActionConfig helper");
  assert.notEqual(helperEndIndex, -1, "frontend runtime missing getLiveResultActionConfig helper boundary");

  const helperSource = appSource.slice(helperStartIndex, helperEndIndex);
  const getLiveResultActionConfig = runInNewContext(`(${helperSource})`, {
    state: {
      languageMode: "ru",
    },
  }) as (intent: string, latestResult: Record<string, unknown>, hasIntentMatchedResult: boolean) => Record<string, unknown> | null;

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        getLiveResultActionConfig(
          "story",
          {
            role: "assistant",
            streaming: false,
          },
          true,
        ),
      ),
    ),
    {
      action: "story_view",
      label: "Открыть Сторителлер",
    },
    "ready story launches should expose a direct action to open the Storyteller tab",
  );
  assert.equal(
    getLiveResultActionConfig(
      "story",
      {
        role: "error",
        streaming: false,
      },
      true,
    ),
    null,
    "error story runs should not expose the Storyteller CTA",
  );
  assert.equal(
    getLiveResultActionConfig(
      "translation",
      {
        role: "assistant",
        streaming: false,
      },
      true,
    ),
    null,
    "non-story intents should not expose the Storyteller CTA",
  );

  assert.ok(
    htmlSource.includes('id="liveResultActionBtn"'),
    "live support panel HTML missing direct result action button",
  );
  assert.ok(
    appSource.includes('if (el.liveResultActionBtn instanceof HTMLButtonElement) {'),
    "frontend runtime missing live result action button wiring",
  );
  assert.ok(
    appSource.includes('if (el.liveResultActionBtn.dataset.action === "story_view") {'),
    "frontend runtime missing Storyteller CTA click behavior",
  );
  assert.ok(
    stylesSource.includes(".live-result-action-btn {"),
    "frontend styles missing live result action button styling",
  );
  assert.ok(
    readmeSource.includes("direct `Open Storyteller` CTA"),
    "README missing live story CTA note",
  );
});

test("demo frontend hydrates Storyteller composer from the latest live story run", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const helperStartToken = "function deriveStoryComposerHydrationFromLatestRun(params = {}) {";
  const helperEndToken = "\n\nfunction hydrateStoryComposerFromLatestRun() {";
  const helperStartIndex = appSource.indexOf(helperStartToken);
  const helperEndIndex = appSource.indexOf(helperEndToken, helperStartIndex);

  assert.notEqual(helperStartIndex, -1, "frontend runtime missing deriveStoryComposerHydrationFromLatestRun helper");
  assert.notEqual(helperEndIndex, -1, "frontend runtime missing hydrateStoryComposerFromLatestRun helper boundary");

  const helperSource = appSource.slice(helperStartIndex, helperEndIndex);
  const deriveStoryComposerHydrationFromLatestRun = runInNewContext(`(${helperSource})`, {
    state: {
      storyComposerMode: "cinematic",
    },
    toOptionalText: (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    normalizeStoryComposerMode: (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : "cinematic"),
    inferStorySegmentCountFromPrompt: (value: string) => (/5/.test(value) ? 5 : 4),
    extractStoryComposerPromptSeed: (value: string) => value.trim(),
    extractStoryCharacterFocusSeed: (value: string) => {
      const match = value.match(/Главный герой:\s*([^.!?\n]+)/i);
      return match?.[1]?.trim() ?? "";
    },
    extractStoryWorldFocusSeed: (value: string) => {
      const match = value.match(/про\s+([^.!?\n]+)/i);
      return match?.[1]?.trim() ?? "";
    },
    getStoryAssetCountsFromSegments: (segments: Array<Record<string, unknown>>) => ({
      images: segments.filter((segment) => Boolean(segment.imageRef)).length,
      video: segments.filter((segment) => Boolean(segment.videoRef)).length,
      audio: segments.filter((segment) => Boolean(segment.audioRef)).length,
    }),
    resolveStorySceneTargetValue: (value: number, fallback: string) =>
      Number.isFinite(value) ? String(Math.max(2, Math.min(6, Math.floor(value)))) : fallback,
  }) as (params: Record<string, unknown>) => Record<string, unknown> | null;

  const hydrated = deriveStoryComposerHydrationFromLatestRun({
    requestText:
      "Собери 5 сцен про запуск нового AI-продукта. Главный герой: основатель стартапа. Тон: кинематографичный, но понятный.",
    requestInput: {
      style: "cinematic",
      segmentCount: 5,
    },
    latestStory: {
      style: "cinematic",
      logline: "Запуск нового AI-продукта меняет правила рынка.",
    },
    timelineSegments: Array.from({ length: 5 }, (_, index) => ({
      index: index + 1,
      imageRef: `image-${index + 1}`,
      audioRef: `audio-${index + 1}`,
    })),
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(hydrated)),
    {
      mode: "cinematic",
      prompt:
        "Собери 5 сцен про запуск нового AI-продукта. Главный герой: основатель стартапа. Тон: кинематографичный, но понятный.",
      sceneTarget: "5",
      characterFocus: "основатель стартапа",
      worldFocus: "запуск нового AI-продукта",
      mediaMix: "balanced",
      narrationStyle: "scripted",
    },
    "Storyteller composer should hydrate from the latest live story request instead of falling back to the default 4-scene template",
  );

  assert.ok(
    htmlSource.includes('<option value="2">2 scenes</option>'),
    "Storyteller scene-target select missing 2-scene option",
  );
  assert.ok(
    htmlSource.includes('<option value="5">5 scenes</option>'),
    "Storyteller scene-target select missing 5-scene option",
  );
  assert.ok(
    appSource.includes('resolvedTabId === "storyteller" && state.storyComposerSyncPending'),
    "frontend runtime missing one-shot Storyteller hydration on tab open",
  );
  assert.ok(
    readmeSource.includes("hydrates the composer from the latest live story request"),
    "README missing Storyteller hydration note",
  );
});

test("demo frontend ignores stray non-JSON gateway frames without replacing the live result", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const parseStartToken = "function parseGatewayFrameData(data) {";
  const parseEndToken = "\n\nfunction shouldSurfaceLiveProtocolFailure() {";
  const parseStartIndex = appSource.indexOf(parseStartToken);
  const parseEndIndex = appSource.indexOf(parseEndToken, parseStartIndex);

  assert.notEqual(parseStartIndex, -1, "frontend runtime missing parseGatewayFrameData helper");
  assert.notEqual(parseEndIndex, -1, "frontend runtime missing connectWebSocket helper boundary");

  const parseSource = appSource.slice(parseStartIndex, parseEndIndex);
  const parseGatewayFrameData = runInNewContext(`(${parseSource})`) as (data: unknown) => unknown;

  assert.equal(parseGatewayFrameData(new Uint8Array([1, 2, 3])), null, "binary websocket frames should be ignored");
  assert.equal(parseGatewayFrameData("assistant is typing"), null, "plain-text gateway frames should be ignored");
  assert.deepEqual(
    JSON.parse(JSON.stringify(parseGatewayFrameData('{"type":"gateway.connected","payload":{"ok":true}}'))),
    {
      type: "gateway.connected",
      payload: {
        ok: true,
      },
    },
    "JSON gateway frames should still parse normally",
  );

  assert.ok(
    appSource.includes('appendTranscript("system", `Ignored non-JSON gateway frame (${frameKind})`, {'),
    "frontend runtime missing debug-only ignored-frame transcript note",
  );
  assert.ok(
    readmeSource.includes("Stray non-JSON websocket frames now stay debug-only"),
    "README missing ignored-frame protocol note",
  );
});

test("demo frontend keeps late protocol noise out of the result card after orchestrator completion", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const helperStartToken = "function shouldSurfaceLiveProtocolFailure() {";
  const helperEndToken = "\n\nfunction connectWebSocket() {";
  const helperStartIndex = appSource.indexOf(helperStartToken);
  const helperEndIndex = appSource.indexOf(helperEndToken, helperStartIndex);

  assert.notEqual(helperStartIndex, -1, "frontend runtime missing shouldSurfaceLiveProtocolFailure helper");
  assert.notEqual(helperEndIndex, -1, "frontend runtime missing connectWebSocket helper boundary");

  const helperSource = appSource.slice(helperStartIndex, helperEndIndex);
  const completedStateHelper = runInNewContext(`(${helperSource})`, {
    state: {
      sessionState: "orchestrator_completed",
    },
  }) as () => boolean;
  const dispatchingStateHelper = runInNewContext(`(${helperSource})`, {
    state: {
      sessionState: "orchestrator_dispatching",
    },
  }) as () => boolean;

  assert.equal(
    completedStateHelper(),
    false,
    "late protocol noise should stay debug-only once the live result already reached orchestrator_completed",
  );
  assert.equal(
    dispatchingStateHelper(),
    true,
    "protocol failures should still surface while a live request is actively dispatching",
  );

  assert.ok(
    appSource.includes('surfaceInResult: hadLiveRequestInFlight && shouldSurfaceLiveProtocolFailure(),'),
    "frontend runtime missing completed-state protocol gating",
  );
  assert.ok(
    readmeSource.includes("Late protocol noise after a completed live result now stays debug-only"),
    "README missing completed-state protocol gating note",
  );
});

test("demo frontend can synthesize a story launch summary when text payload is blank", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const findStartToken = "function findTextPayload(value) {";
  const findEndToken = "\n\nfunction buildStoryLaunchFallbackText(output) {";
  const fallbackStartToken = "function buildStoryLaunchFallbackText(output) {";
  const fallbackEndToken = "\n\nfunction findResearchDebugPayload(value) {";

  const findStartIndex = appSource.indexOf(findStartToken);
  const findEndIndex = appSource.indexOf(findEndToken, findStartIndex);
  const fallbackStartIndex = appSource.indexOf(fallbackStartToken);
  const fallbackEndIndex = appSource.indexOf(fallbackEndToken, fallbackStartIndex);

  assert.notEqual(findStartIndex, -1, "frontend runtime missing findTextPayload helper");
  assert.notEqual(findEndIndex, -1, "frontend runtime missing story fallback helper boundary");
  assert.notEqual(fallbackStartIndex, -1, "frontend runtime missing buildStoryLaunchFallbackText helper");
  assert.notEqual(fallbackEndIndex, -1, "frontend runtime missing research debug helper boundary");

  const functionSource = `${appSource.slice(findStartIndex, findEndIndex)}\n${appSource.slice(fallbackStartIndex, fallbackEndIndex)}`;
  const helpers = runInNewContext(`(() => { ${functionSource}; return { findTextPayload, buildStoryLaunchFallbackText }; })()`, {
    state: {
      languageMode: "ru",
    },
    toOptionalText: (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
  }) as {
    findTextPayload: (value: unknown) => string | null;
    buildStoryLaunchFallbackText: (value: unknown) => string | null;
  };

  assert.equal(
    helpers.findTextPayload({
      message: "   ",
      story: {
        title: "The Last Transit Accord",
      },
    }),
    "The Last Transit Accord",
    "findTextPayload should skip blank top-level strings and continue scanning nested story data",
  );

  assert.equal(
    helpers.buildStoryLaunchFallbackText({
      message: "   ",
      story: {
        title: "The Last Transit Accord",
        timeline: [{ index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }, { index: 5 }],
      },
      assets: new Array(10).fill({ kind: "image" }),
      mediaJobs: {
        video: [],
      },
    }),
    'История готова: «The Last Transit Accord», 5 сцен, 10 медиа-ассетов.',
    "story launch fallback should keep the live result visible even when the textual payload is blank",
  );
});

test("demo frontend reports gateway handler failures separately from frame parsing failures", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  assert.ok(
    appSource.includes('reportLiveRuntimeFailure("protocol", `Gateway event handling failed: ${details}`, {'),
    "frontend runtime should report internal gateway event handling failures with the real error cause",
  );
  assert.ok(
    appSource.includes('reportLiveRuntimeFailure("protocol", `Received non-JSON frame from gateway: ${details}`, {'),
    "frontend runtime should preserve a separate path for actual frame parsing failures",
  );
  assert.ok(
    readmeSource.includes("gateway handler failures now log the real processing error"),
    "README missing gateway handler diagnostics note",
  );
});

test("demo frontend renders story timeline previews without throwing on ready story runs", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const startToken = "function renderStoryTimelinePreview(segment) {";
  const endToken = "\n\nfunction renderStoryTimelineProgress(count, selectedIndex) {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing renderStoryTimelinePreview helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing renderStoryTimelineProgress helper boundary");

  const functionSource = appSource.slice(startIndex, endIndex);

  class HTMLElementFake {
    public tagName: string;
    public textContent = "";
    public title = "";
    public className = "";
    public innerHTML = "";
    public dataset: Record<string, string> = {};
    public children: HTMLElementFake[] = [];
    public attributes = new Map<string, string>();
    private readonly classTokens = new Set<string>();
    public classList = {
      add: (...tokens: string[]) => {
        for (const token of tokens) {
          if (token) {
            this.classTokens.add(token);
          }
        }
      },
      remove: (...tokens: string[]) => {
        for (const token of tokens) {
          this.classTokens.delete(token);
        }
      },
      toggle: (token: string, force?: boolean) => {
        if (force === true) {
          this.classTokens.add(token);
          return true;
        }
        if (force === false) {
          this.classTokens.delete(token);
          return false;
        }
        if (this.classTokens.has(token)) {
          this.classTokens.delete(token);
          return false;
        }
        this.classTokens.add(token);
        return true;
      },
    };

    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
    }

    append(...nodes: Array<HTMLElementFake | string>) {
      for (const node of nodes) {
        if (typeof node === "string") {
          const textNode = new HTMLElementFake("#text");
          textNode.textContent = node;
          this.children.push(textNode);
        } else {
          this.children.push(node);
        }
      }
    }

    appendChild(node: HTMLElementFake) {
      this.children.push(node);
      return node;
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }

    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
  }

  const previewRoot = new HTMLElementFake("section");
  const previewShell = new HTMLElementFake("section");

  const renderStoryTimelinePreview = runInNewContext(`(${functionSource})`, {
    HTMLElement: HTMLElementFake,
    document: {
      createElement: (tagName: string) => new HTMLElementFake(tagName),
    },
    el: {
      storyTimelinePreview: previewRoot,
      storyPreviewShell: previewShell,
    },
    state: {
      storyTimelinePendingJobs: 0,
      languageMode: "ru",
    },
    isStoryDesktopRuntimeQuietViewport: () => false,
    resolveStoryTimelineRuntimeState: () => "ready",
    getStoryTimelineCopy: () => ({
      previewIndex: (index: number) => `Scene #${index}`,
      emptySegmentText: "(empty)",
      noAssets: "no assets",
    }),
    getStoryScenePresentationCopy: () => ({
      mediaLabel: "Media",
      statusLabel: "Status",
      assetsLabel: "Assets",
    }),
    deriveStorySceneNarrative: (text: string) => ({
      title: text,
      summary: text,
    }),
    buildStoryPreviewDisplaySummary: () => "summary",
    getStorySceneCueTags: () => ["Copy ready", "Image ready"],
    resolveStoryVideoStatusVariant: () => "status-neutral",
    toOptionalText: (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null),
    formatStoryVideoStatusText: () => "Video ready",
    formatStoryAssetPillText: (_kind: string, ref: string) => ref,
    compactStoryAssetRef: (ref: string) => ref,
    buildStoryAssetPill: (text: string) => {
      const pill = new HTMLElementFake("span");
      pill.textContent = text;
      return pill;
    },
    resolveStoryDesktopSceneAssetsOverflowText: () => "",
    formatStorySceneMediaSummary: () => "image + audio",
    resolveStoryDesktopSceneMediaLabel: (_segment: unknown, fallback: string) => fallback,
    syncStoryCompactTextMeta: (node: HTMLElementFake, visibleText = "", fullText = "") => {
      node.textContent = visibleText;
      node.title = visibleText !== fullText ? fullText : "";
    },
    formatStorySceneStatusSummary: () => "ready",
    resolveStoryDesktopSceneCardStatusLabel: (_status: unknown, fallback: string) => fallback,
  }) as (segment: Record<string, unknown>) => void;

  assert.doesNotThrow(
    () =>
      renderStoryTimelinePreview({
        index: 1,
        text: "Launch night over the city skyline.",
        imageRef: "simulated://story/scene-1-image.jpg",
        audioRef: "data:audio/mpeg;base64,AAAA",
        videoRef: null,
        videoStatus: null,
      }),
    "story timeline preview should render ready scenes without throwing inside the live workflow lane",
  );

  assert.ok(
    previewRoot.children.length > 0,
    "story timeline preview should append rendered content for a ready scene",
  );
});
