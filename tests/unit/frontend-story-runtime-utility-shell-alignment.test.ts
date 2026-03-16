import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop runtime shells stay compact and readable after a run", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const tailStylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "storyteller-runtime-tail.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const app = readFileSync(appPath, "utf8");
  const tailStyles = readFileSync(tailStylesPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    app.includes("function resolveStoryDesktopTimelineModePillLabel(runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime mode-pill helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelineAssetMixPillLabel(assetCount, pendingJobs, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime asset-pill helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelineProgressPillLabel(count, selectedIndex, pendingJobs, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime progress-pill helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelineControlLabel(kind, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime control-label helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelinePositionText(count, selectedIndex, pendingJobs, runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime position-text helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopRunRailHeading(runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller desktop run-rail heading helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopRunRailCue(count, pendingJobs, runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller compact run-rail cue helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopRunRailLabel(kind, fallback = \"\") {"),
    "frontend app missing Storyteller desktop run-rail label helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopAtlasShellHeading(activePanel, pendingJobs, totalRefs, fallback = \"\") {"),
    "frontend app missing Storyteller desktop atlas-shell heading helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopAtlasPanelHeading(kind, hasValue, pendingJobs = 0, totalRefs = 0, fallback = \"\") {"),
    "frontend app missing Storyteller desktop atlas-panel heading helper",
  );
  assert.ok(
    app.includes("function syncStoryTimelineControlUtilityDensity(count, pendingJobs, runtimeState) {"),
    "frontend app missing Storyteller desktop runtime control-density sync helper",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyTimelineTitle, visibleTimelineTitle, fullTimelineTitle);"),
    "frontend app missing Storyteller compact runtime title handoff",
  );
  assert.ok(
    app.includes("resolveStoryDesktopTimelineModePillLabel(\"ready\", \"timeline_ready\")"),
    "frontend app missing Storyteller ready-state mode compaction",
  );
  assert.ok(
    app.includes("resolveStoryDesktopTimelineAssetMixPillLabel(totalAssetCount, pendingJobs, assetText)"),
    "frontend app missing Storyteller asset-mix compaction handoff",
  );
  assert.ok(
    app.includes("resolveStoryDesktopTimelineProgressPillLabel(\n      count,\n      state.storyTimelineSelectedIndex,\n      pendingJobs,\n      fullProgressHint,"),
    "frontend app missing Storyteller progress-pill compaction handoff",
  );
  assert.ok(
    app.includes("syncStoryTimelineControlUtilityDensity(count, pendingJobs, runtimeState);"),
    "frontend app missing Storyteller control-density handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyRunHeading, visibleRunHeading, runCopy.runHeading);"),
    "frontend app missing Storyteller compact run-rail heading handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyTimelineNextCue, visibleCue, fullCue);"),
    "frontend app missing Storyteller compact run-rail cue handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyAtlasHeading, visibleAtlasHeading, atlasCopy.heading);"),
    "frontend app missing Storyteller compact atlas-shell heading handoff",
  );
  assert.ok(
    app.includes("resolveStoryDesktopAtlasPanelHeading(\"media\", totalRefs > 0, pendingJobs, totalRefs, copy.mediaHeading)"),
    "frontend app missing Storyteller compact media-panel heading handoff",
  );
  assert.ok(
    app.includes("resolveStoryDesktopTimelinePositionText(\n          count,\n          state.storyTimelineSelectedIndex,\n          pendingJobs,\n          runtimeState,\n          fullPositionText,"),
    "frontend app missing Storyteller compact position-text handoff",
  );

  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail.is-ready .story-run-rail-head p,\n  .layout.is-story-focused .story-run-rail.is-ready .story-guidance-chip,\n  .layout.is-story-focused .story-run-rail.is-ready .story-guidance-hint,\n  .layout.is-story-focused .story-controls.is-ready .story-section-head p,\n  .layout.is-story-focused .story-controls.is-ready .story-controls-hint {\n    display: none;"),
    "frontend tail stylesheet missing Storyteller desktop runtime helper suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-output-dossier-section {\n    display: grid;\n    grid-template-columns: max-content minmax(0, 1fr);"),
    "frontend tail stylesheet missing Storyteller compact output dossier grid",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-output-dossier-note {\n    grid-area: note;\n    display: -webkit-box;"),
    "frontend tail stylesheet missing Storyteller dossier note clamping",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-controls.is-ready .field :is(input, select, .select-trigger),\n  .layout.is-story-focused .story-controls.is-ready .meta-box {\n    min-height: 34px;"),
    "frontend tail stylesheet missing Storyteller ready controls utility compaction",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-controls-grid[data-story-control-density=\"utility\"] {\n    grid-template-columns: minmax(0, 1.08fr) minmax(220px, 0.84fr) max-content;"),
    "frontend tail stylesheet missing Storyteller utility-density control grid",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-controls-grid[data-story-control-density=\"utility\"] .field:first-child {\n    grid-column: auto;\n    display: grid;\n    grid-template-columns: max-content minmax(0, 1fr);"),
    "frontend tail stylesheet missing Storyteller inline scrubber utility row",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-controls-grid[data-story-control-density=\"utility\"] .field:nth-child(2) {\n    display: grid;\n    grid-template-columns: max-content minmax(0, 1fr);"),
    "frontend tail stylesheet missing Storyteller inline selector utility row",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-controls-grid[data-story-control-density=\"utility\"] .field:nth-child(3) {\n    display: grid;\n    grid-column: auto;\n    grid-template-columns: max-content auto;"),
    "frontend tail stylesheet missing Storyteller inline position utility row",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail .story-stat-card-title .story-stat-note {\n    display: none !important;"),
    "frontend tail stylesheet missing Storyteller quiet run-title note suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail.is-ready .story-head-grid {\n    grid-template-columns: minmax(0, 1.24fr) minmax(112px, 0.44fr) minmax(112px, 0.44fr) !important;"),
    "frontend tail stylesheet missing Storyteller one-row ready-state run grid",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail.is-ready .story-stat-card-title {\n    grid-column: auto !important;"),
    "frontend tail stylesheet missing Storyteller ready-state title card inline placement",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail.is-ready .story-guidance {\n    grid-template-columns: minmax(0, 1fr) max-content !important;"),
    "frontend tail stylesheet missing Storyteller ready-state guidance utility row",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-card .story-atlas-head p {\n    display: block !important;\n    overflow: hidden !important;\n    white-space: nowrap !important;\n    text-overflow: ellipsis !important;\n    font-size: 0.6875rem !important;\n    -webkit-line-clamp: 1 !important;"),
    "frontend tail stylesheet missing Storyteller one-line atlas summary clamp",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-meta {\n    display: block !important;\n    overflow: hidden !important;\n    white-space: nowrap !important;\n    text-overflow: ellipsis !important;\n    font-size: 0.640625rem !important;\n    -webkit-line-clamp: 1 !important;"),
    "frontend tail stylesheet missing Storyteller one-line atlas meta clamp",
  );

  const docsNeedle =
    "That same desktop runtime pass now also flattens `Run snapshot` into a shorter continuity strip, turns `Scene controls` into a quieter utility shelf, and compresses the `Latest output` dossier into a narrower companion rail so the post-run scan path stays cleaner.";
  assert.ok(readme.includes(docsNeedle), "README missing Storyteller runtime utility-shell note");
  assert.ok(operatorGuide.includes(docsNeedle), "operator guide missing Storyteller runtime utility-shell note");
  const docsNeedleFollowup =
    "That same desktop cleanup now also resolves `Scene controls` into a truer utility shelf: the visible labels shorten to `Scrub / Scene / At`, the live position collapses to a tighter cue, and the whole navigator sits on one steadier row once scenes exist.";
  assert.ok(readme.includes(docsNeedleFollowup), "README missing Storyteller scene-controls utility-row note");
  assert.ok(operatorGuide.includes(docsNeedleFollowup), "operator guide missing Storyteller scene-controls utility-row note");
  const docsNeedleRuntimeMicrocopy =
    "That same desktop runtime pass now also makes `Run snapshot` and `Story atlas` more contextual: the run rail switches to short state-led labels (`Latest run`, `Run in flight`, `Queue`), while atlas headings pivot to the active panel (`World notes`, `Lead notes`, `Media queue`) so the right side reads faster without losing full hover labels.";
  assert.ok(readme.includes(docsNeedleRuntimeMicrocopy), "README missing Storyteller runtime microcopy note");
  assert.ok(operatorGuide.includes(docsNeedleRuntimeMicrocopy), "operator guide missing Storyteller runtime microcopy note");
  const docsNeedleRuntimeRow =
    "That same desktop runtime rail now also resolves `Run snapshot` into a truer support strip in ready-state: `Story / Scenes / State` share one row, the next cue shortens to a tooltip-backed compact cue, and the remaining guidance collapses into one lighter utility line instead of reopening a mini-dashboard.";
  assert.ok(readme.includes(docsNeedleRuntimeRow), "README missing Storyteller ready-state runtime-strip note");
  assert.ok(operatorGuide.includes(docsNeedleRuntimeRow), "operator guide missing Storyteller ready-state runtime-strip note");
});
