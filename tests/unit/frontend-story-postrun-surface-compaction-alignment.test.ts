import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop post-run surfaces stay compact and readable", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const tailStylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "storyteller-runtime-tail.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const app = readFileSync(appPath, "utf8");
  const tailStyles = readFileSync(tailStylesPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    app.includes("function resolveStoryDesktopOutputDisplaySummary(descriptor, totalRefs, fallback = \"\") {"),
    "frontend app missing Storyteller desktop output-summary compaction helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopAtlasSummary(kind, value, fallback = \"\") {"),
    "frontend app missing Storyteller desktop atlas-summary compaction helper",
  );
  assert.ok(
    app.includes("title.className = \"story-output-dossier-title\";"),
    "frontend app missing Storyteller output dossier title class wiring",
  );
  assert.ok(
    app.includes("note.className = \"story-output-dossier-note\";"),
    "frontend app missing Storyteller output dossier note class wiring",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(summary, visibleDisplaySummary, displaySummary);"),
    "frontend app missing Storyteller compact output-summary handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyWorldSummary, visibleWorldSummary, worldSummaryText);"),
    "frontend app missing Storyteller compact atlas world-summary handoff",
  );
  assert.ok(
    app.includes("const accessibleLabel = [labelText, hintText].filter(Boolean).join(\" - \");"),
    "frontend app missing Storyteller atlas tab accessibility label handoff",
  );
  assert.ok(
    app.includes("button.setAttribute(\"aria-label\", accessibleLabel);"),
    "frontend app missing Storyteller atlas tab aria-label sync",
  );
  assert.ok(
    app.includes("const useDesktopQuietRuntime = hasStoryRunActivity() && isStoryDesktopRuntimeQuietViewport();"),
    "frontend app missing Storyteller preview quiet-runtime gate",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(mediaValue, visibleMediaSummary, fullMediaSummary);"),
    "frontend app missing Storyteller compact preview media summary handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(statusValue, visibleStatusSummary, fullStatusSummary);"),
    "frontend app missing Storyteller compact preview status summary handoff",
  );
  assert.ok(
    app.includes("supportStrip.append(summaryCard, assetsCard);"),
    "frontend app missing Storyteller preview summary rail insertion",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopSceneAssetsOverflowText(hiddenCount, fallback = \"\") {"),
    "frontend app missing Storyteller desktop preview asset-overflow helper",
  );
  assert.ok(
    app.includes("const overflowText = resolveStoryDesktopSceneAssetsOverflowText(hiddenAssetEntries.length, \"\");"),
    "frontend app missing Storyteller preview asset-overflow handoff",
  );
  assert.ok(
    app.includes("overflowPill.setAttribute(\"aria-label\", fullHiddenSummary);"),
    "frontend app missing Storyteller preview asset-overflow accessibility handoff",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopOutputVariantText(kind, value, fallback = \"\") {"),
    "frontend app missing Storyteller desktop revision-ledger text helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopSceneCardSummary(value, fallback = \"\") {"),
    "frontend app missing Storyteller desktop scene-card summary helper",
  );
  assert.ok(
    app.includes("const visiblePreviousEntries = useDesktopQuietRuntime ? previousEntries.slice(0, 1) : previousEntries;"),
    "frontend app missing Storyteller desktop revision-ledger entry compaction",
  );
  assert.ok(
    app.includes("variantsMore.className = \"story-output-variants-more\";"),
    "frontend app missing Storyteller revision-ledger overflow note",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(body, visibleSegmentSummary, fullSegmentSummary);"),
    "frontend app missing Storyteller compact storyboard summary handoff",
  );

  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-section-head p,\n  .layout.is-story-focused .story-preview-shell.is-ready .story-section-head p,\n  .layout.is-story-focused .story-results-secondary .story-section-head p {\n    display: none;"),
    "frontend tail stylesheet missing Storyteller desktop post-run intro suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-output-cue-pill:nth-child(n + 3) {\n    display: none;"),
    "frontend tail stylesheet missing Storyteller desktop cue-strip trim",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-card .story-section-eyebrow {\n    display: none;"),
    "frontend tail stylesheet missing Storyteller desktop atlas eyebrow suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-shell-head .story-section-eyebrow,\n  .layout.is-story-focused .story-results-secondary .story-atlas-shell-head p {\n    display: none !important;"),
    "frontend tail stylesheet missing Storyteller desktop atlas shell-head intro suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-rail {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;"),
    "frontend tail stylesheet missing Storyteller desktop atlas three-up switcher rail",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-tab-hint {\n    display: none !important;"),
    "frontend tail stylesheet missing Storyteller desktop atlas tab hint suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-results-secondary .story-atlas-metrics {\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;"),
    "frontend tail stylesheet missing Storyteller desktop compact media metric strip",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell.is-ready .story-output-stage,\n  .layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell.is-error .story-output-stage {\n    grid-template-columns: minmax(0, 1.58fr) minmax(184px, 0.42fr) !important;"),
    "frontend tail stylesheet missing Storyteller quieter latest-output lane split",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-latest-output-shell.is-ready .story-output-stage,\n  .layout.is-story-focused .story-latest-output-shell.is-error .story-output-stage {\n    grid-template-columns: minmax(0, 1.48fr) minmax(224px, 0.52fr) !important;"),
    "frontend tail stylesheet missing Storyteller final latest-output vertical-rhythm split",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell.is-ready .story-output-stage,\n  .layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell.is-error .story-output-stage {\n    grid-template-columns: minmax(0, 1.72fr) minmax(160px, 0.28fr) !important;"),
    "frontend tail stylesheet missing Storyteller final latest-output eof authority split",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyPreviewShell.story-preview-shell.is-ready .story-preview-support-strip {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) minmax(208px, 0.74fr) !important;"),
    "frontend tail stylesheet missing Storyteller current-scene support utility rail",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-preview-shell.is-ready .story-preview-support-strip {\n    grid-template-columns: minmax(0, 1fr) minmax(188px, 0.72fr) !important;"),
    "frontend tail stylesheet missing Storyteller final current-scene support split",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyPreviewShell.story-preview-shell.is-ready .story-preview-summary-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;"),
    "frontend tail stylesheet missing Storyteller current-scene summary utility grid",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-preview-shell.is-ready .story-asset-pill {\n    min-height: 20px !important;\n    padding: 3px 7px !important;"),
    "frontend tail stylesheet missing Storyteller compact current-scene asset pills",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyPreviewShell.story-preview-shell.is-ready .story-preview-support-strip {\n    grid-template-columns: minmax(0, 1fr) minmax(164px, 0.54fr) !important;"),
    "frontend tail stylesheet missing Storyteller final current-scene eof support split",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyPreviewShell.story-preview-shell.is-ready .story-preview-summary-item p {\n    display: none !important;"),
    "frontend tail stylesheet missing Storyteller final current-scene summary hint suppression",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyPreviewShell.story-preview-shell.is-ready .story-asset-pill {\n    min-height: 18px !important;\n    padding: 2px 6px !important;"),
    "frontend tail stylesheet missing Storyteller final current-scene compact asset pills",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell .story-output-variant-card {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1fr) auto !important;"),
    "frontend tail stylesheet missing Storyteller desktop revision-ledger grid rows",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused #storyLatestOutputShell.story-latest-output-shell .story-output-variants-more {\n    margin: 0 !important;\n    padding-top: 4px !important;"),
    "frontend tail stylesheet missing Storyteller revision-ledger overflow note",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-segment-card {\n    min-height: 138px !important;\n    gap: 4px !important;"),
    "frontend tail stylesheet missing Storyteller denser storyboard filmstrip cards",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-segment-meta {\n    max-width: 14ch !important;\n    font-size: 0.6875rem !important;"),
    "frontend tail stylesheet missing Storyteller quieter storyboard footer meta",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-scenes-shell.is-ready .story-timeline-list,\n  .layout.is-story-focused .story-scenes-shell.is-pending .story-timeline-list {\n    grid-template-columns: repeat(4, minmax(0, 1fr));"),
    "frontend tail stylesheet missing Storyteller desktop four-up storyboard shelf",
  );

  const docsNeedle =
    "That same desktop post-run pass now also turns `Latest output` into a tighter narrative lane, compresses `Story atlas` into a quieter side note, and lays `Scene cards` out as a steadier four-up shelf so the lower half reads in one scan.";
  assert.ok(readme.includes(docsNeedle), "README missing Storyteller desktop post-run compaction note");
  assert.ok(operatorGuide.includes(docsNeedle), "operator guide missing Storyteller desktop post-run compaction note");
  const docsFollowupNeedle =
    "That same desktop Storyteller pass now also turns `Story atlas` into a quieter note rail: the intro drops out of the desktop scan path, tabs compress into a short three-up switcher with preserved hover/ARIA labels, and the active panel resolves into one calmer editorial card with a lighter media metric strip.";
  assert.ok(readme.includes(docsFollowupNeedle), "README missing Storyteller atlas note-rail followup");
  assert.ok(operatorGuide.includes(docsFollowupNeedle), "operator guide missing Storyteller atlas note-rail followup");
  const docsCurrentSceneNeedle =
    "That same desktop post-run cleanup now also resolves `Current scene` into a truer scene rail: the hidden media/status summary returns as a compact utility row, `Latest output` sheds more card chrome, and both section heads quiet down so the eye stays on the story copy.";
  assert.ok(readme.includes(docsCurrentSceneNeedle), "README missing Storyteller current-scene quiet-rail note");
  assert.ok(operatorGuide.includes(docsCurrentSceneNeedle), "operator guide missing Storyteller current-scene quiet-rail note");
  const docsFilmstripNeedle =
    "That same desktop cleanup now also turns `Recent passes` into a quieter revision ledger and tightens `Scene cards` into a denser filmstrip, so the lower half keeps one scan path instead of reopening into mini-articles.";
  assert.ok(readme.includes(docsFilmstripNeedle), "README missing Storyteller revision-ledger filmstrip note");
  assert.ok(operatorGuide.includes(docsFilmstripNeedle), "operator guide missing Storyteller revision-ledger filmstrip note");
  const docsOutputPreviewNeedle =
    "That same desktop runtime cleanup now also tightens `Latest output` and `Current scene` into a shorter reading lane: the output dossier narrows, preview copy/cards shed padding, and extra scene assets collapse behind a compact overflow pill so the middle column keeps its narrative scan path.";
  assert.ok(readme.includes(docsOutputPreviewNeedle), "README missing Storyteller output/preview vertical-rhythm note");
  assert.ok(operatorGuide.includes(docsOutputPreviewNeedle), "operator guide missing Storyteller output/preview vertical-rhythm note");
});
