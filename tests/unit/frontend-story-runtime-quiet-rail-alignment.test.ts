import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("storyteller desktop runtime rail stays compact and action-first", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const tailStylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "storyteller-runtime-tail.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const html = readFileSync(htmlPath, "utf8");
  const app = readFileSync(appPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  const tailStyles = readFileSync(tailStylesPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  assert.ok(
    html.includes('href="/storyteller-runtime-tail.css?v=20260316"'),
    "frontend html missing Storyteller runtime tail stylesheet link",
  );

  assert.ok(
    app.includes("function isStoryDesktopRuntimeQuietViewport() {"),
    "frontend app missing Storyteller desktop runtime viewport helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelineGuidanceTitle(runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime guidance-title helper",
  );
  assert.ok(
    app.includes("function resolveStoryDesktopTimelineActionLabel(kind, runtimeState, fallback = \"\") {"),
    "frontend app missing Storyteller desktop runtime CTA-label helper",
  );
  assert.ok(
    app.includes("syncStoryActionButtonMeta(el.storyTimelineGuideTemplateBtn, guideTemplateLabel);"),
    "frontend app missing Storyteller runtime CTA meta handoff",
  );
  assert.ok(
    app.includes("syncStoryCompactTextMeta(el.storyTimelineControlsHint, visibleHint, fullHint);"),
    "frontend app missing Storyteller compact controls-hint handoff",
  );
  assert.ok(
    app.includes("resolveStoryDesktopSceneCardStatusLabel(segment.videoStatus, fullStatusLabel)"),
    "frontend app missing Storyteller compact storyboard status labels",
  );
  assert.ok(
    app.includes("resolveStoryDesktopSceneMediaLabel(segment, fullMediaLabel)"),
    "frontend app missing Storyteller compact storyboard meta labels",
  );

  assert.ok(
    styles.includes("quieter desktop story runtime rail and storyboard shelf"),
    "frontend styles missing Storyteller desktop runtime quiet-shell note",
  );
  assert.ok(
    tailStyles.includes("/* 2026-03-13 Pass - quieter desktop story runtime rail and storyboard shelf (late load) */"),
    "frontend tail stylesheet missing Storyteller late-load runtime pass",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail .story-guidance {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) auto;"),
    "frontend tail stylesheet missing Storyteller desktop two-column run-guidance rail",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-run-rail #storyTimelineGuideTemplateBtn {\n    display: inline-flex;"),
    "frontend tail stylesheet missing Storyteller desktop compact rerun CTA",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-segment-cue:nth-child(n + 2) {\n    display: none;"),
    "frontend tail stylesheet missing Storyteller desktop primary-cue storyboard trim",
  );
  assert.ok(
    tailStyles.includes(".layout.is-story-focused .story-segment-card {\n    flex: 0 0 clamp(198px, 15.6vw, 214px);"),
    "frontend tail stylesheet missing Storyteller desktop denser storyboard filmstrip cards",
  );

  const docsNeedle =
    "Run status` one short action-first rail (`Generate/Retry` plus `Live`) and trims storyboard cards to a denser filmstrip with one primary cue chip";
  assert.ok(readme.includes(docsNeedle), "README missing Storyteller runtime action-first rail note");
  assert.ok(operatorGuide.includes(docsNeedle), "operator guide missing Storyteller runtime action-first rail note");
});
