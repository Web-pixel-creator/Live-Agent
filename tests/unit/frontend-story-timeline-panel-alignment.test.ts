import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires interactive story timeline panel across UI/runtime/docs", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const judgeQuickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const html = readFileSync(htmlPath, "utf8");
  const app = readFileSync(appPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const judgeQuickstart = readFileSync(judgeQuickstartPath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    '<span class="section-badge">Story</span>Story Timeline',
    'id="storyTimelineTitle"',
    'id="storyTimelineCount"',
    'id="storyTimelinePendingJobs"',
    'id="storyTimelineStateCard"',
    'id="storyTimelineProgressKpi"',
    'id="storyTimelineNextCue"',
    'id="storyTimelineMode"',
    'id="storyTimelineAssetMix"',
    'id="storyTimelineProgressHint"',
    'id="storyTimelineGuidance"',
    'id="storyTimelineGuidanceTitle"',
    'id="storyTimelineGuidanceHint"',
    'id="storyTimelineGuideOpenLiveBtn"',
    'id="storyTimelineGuideTemplateBtn"',
    'id="storyTimelineGuidance" class="story-guidance is-idle"',
    'class="story-guidance-actions"',
    'id="storyTimelineProgressLabel"',
    'id="storyTimelineProgressTrack"',
    'id="storyTimelineProgressBar"',
    'id="storyTimelineScrubber"',
    'id="storyTimelineSelect"',
    'id="storyTimelinePosition"',
    'id="storyTimelinePreview"',
    'id="storyTimelineList"',
    'class="story-empty-state"',
    'class="story-empty-icon"',
    'class="story-empty-icon-glyph"',
    'class="story-empty-icon-label"',
    'class="story-empty-lead"',
    'class="story-empty-cta-note"',
    'class="story-empty-details"',
    'class="story-empty-details-summary"',
    'class="story-empty-details-body"',
    'class="story-empty-checklist"',
    'class="story-empty-kpis"',
    'class="story-empty-kpi"',
    'class="story-empty-arc"',
    'class="story-timeline-list-empty-status"',
    'class="story-timeline-list-empty-details"',
    'class="story-timeline-list-empty-details-summary"',
    'class="story-timeline-list-empty-preview"',
    'class="story-timeline-list-empty-card"',
    'class="story-timeline-list-empty-icon-glyph"',
    'class="story-timeline-list-empty-icon-label"',
    'class="story-timeline-list-empty-cta"',
    'id="storyTimelineOpenLiveBtn"',
    'id="storyTimelineApplyTemplateBtn"',
    "Open Live Negotiator",
    "Use Story Prompt Template",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(html.includes(token), `frontend html missing story timeline token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "storyTimelineTitle: null",
    "storyTimelineSegments: []",
    "storyTimelineSelectedIndex: 0",
    "storyTimelinePendingJobs: 0",
    "storyTimelineStateCard: document.getElementById(\"storyTimelineStateCard\")",
    "storyTimelineProgressKpi: document.getElementById(\"storyTimelineProgressKpi\")",
    "storyTimelineNextCue: document.getElementById(\"storyTimelineNextCue\")",
    "storyTimelineMode: document.getElementById(\"storyTimelineMode\")",
    "storyTimelineAssetMix: document.getElementById(\"storyTimelineAssetMix\")",
    "storyTimelineProgressHint: document.getElementById(\"storyTimelineProgressHint\")",
    "storyTimelineGuidance: document.getElementById(\"storyTimelineGuidance\")",
    "storyTimelineGuidanceTitle: document.getElementById(\"storyTimelineGuidanceTitle\")",
    "storyTimelineGuidanceHint: document.getElementById(\"storyTimelineGuidanceHint\")",
    "storyTimelineGuideOpenLiveBtn: document.getElementById(\"storyTimelineGuideOpenLiveBtn\")",
    "storyTimelineGuideTemplateBtn: document.getElementById(\"storyTimelineGuideTemplateBtn\")",
    "storyTimelineProgressLabel: document.getElementById(\"storyTimelineProgressLabel\")",
    "storyTimelineProgressTrack: document.getElementById(\"storyTimelineProgressTrack\")",
    "storyTimelineProgressBar: document.getElementById(\"storyTimelineProgressBar\")",
    "renderStoryTimelineProgress",
    "normalizeStoryTimelineSegment",
    "renderStoryTimelineStateCard",
    "syncStoryTimelineGuidance",
    "createStoryTimelineEmptyStatusPill",
    "setStoryTimelineData",
    "renderStoryTimeline",
    "updateStoryTimelineSelection",
    "renderStoryTimelinePreviewEmptyState",
    "function openLiveNegotiatorFromStoryEmptyState()",
    "function applyStoryPromptTemplateFromStoryEmptyState()",
    "STORY_EMPTY_STATE_PROMPT",
    "setActiveTab(\"live-negotiator\");",
    "el.intent.value = \"story\";",
    "el.message.value = STORY_EMPTY_STATE_PROMPT;",
    "action.textContent = \"Open Live Negotiator\";",
    "actions.className = \"story-timeline-list-empty-actions\";",
    "action.className = \"story-timeline-list-empty-action\";",
    "actionTemplate.className = \"button-muted story-timeline-list-empty-action story-timeline-list-empty-action-template\";",
    "actionTemplate.textContent = \"Use Story Prompt Template\";",
    "applyStoryPromptTemplateFromStoryEmptyState();",
    "icon.className = \"story-timeline-list-empty-icon\";",
    "iconGlyph.className = \"story-timeline-list-empty-icon-glyph\";",
    "iconLabel.textContent = \"Timeline\";",
    "status.className = \"story-timeline-list-empty-status\";",
    "createStoryTimelineEmptyStatusPill(\"timeline_idle\")",
    "createStoryTimelineEmptyStatusPill(\"assets=none\")",
    "createStoryTimelineEmptyStatusPill(\"progress=0%\")",
    "arc.className = \"story-empty-arc\";",
    "preview.className = \"story-timeline-list-empty-preview\";",
    "card.className = \"story-timeline-list-empty-card\";",
    "title: \"Hook\"",
    "title: \"Segment #1\"",
    "actionTemplate.id = \"storyTimelineApplyTemplateBtn\";",
    "actionTemplate.textContent = \"Use Story Prompt Template\";",
    "checklist.className = \"story-empty-checklist\";",
    "details.className = \"story-empty-details\";",
    "kpis.className = \"story-empty-kpis\";",
    "card.className = \"story-empty-kpi\";",
    "label: \"Segments\"",
    "value: \"img/audio/video\"",
    "summary.className = \"story-empty-details-summary\";",
    "detailsBody.className = \"story-empty-details-body\";",
    "lead.className = \"story-empty-lead\";",
    "ctaNote.className = \"story-empty-cta-note\";",
    "storyTimelinePreview.classList.add(\"story-timeline-preview-empty\")",
    "previewDetails.className = \"story-timeline-list-empty-details\";",
    "previewSummary.className = \"story-timeline-list-empty-details-summary\";",
    "ctaNote.className = \"story-timeline-list-empty-cta\";",
    "storyTimelineProgressTrack.classList.toggle(\"is-pending\", safeCount > 0 && hasPendingVideoJobs);",
    "setStatusPill(el.storyTimelineMode, \"timeline_pending_video\", \"neutral\");",
    "setStatusPill(el.storyTimelineAssetMix, assetText, hasAnyAssets ? \"ok\" : \"neutral\");",
    "setStatusPill(el.storyTimelineProgressHint, hintText, hintVariant);",
    "syncStoryTimelineGuidance(count, pendingJobs);",
    "el.storyTimelineGuidance.classList.toggle(\"is-hidden\", !isEmpty);",
    "el.storyTimelineGuideOpenLiveBtn.addEventListener(\"click\", openLiveNegotiatorFromStoryEmptyState);",
    "el.storyTimelineGuideTemplateBtn.addEventListener(\"click\", applyStoryPromptTemplateFromStoryEmptyState);",
    "Timeline ready for review",
    "Run story intent to initialize timeline",
    "Story timeline ready: use scrubber/selector for segment preview.",
    "selectedSegment",
    "## Story Timeline Snapshot",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(app.includes(token), `frontend runtime missing story timeline token: ${token}`);
  }

  const requiredStyleTokens = [
    ".story-head-grid {",
    "grid-template-columns: repeat(4, minmax(0, 1fr));",
    ".story-stat-note {",
    ".story-stat-card-state.is-idle {",
    ".story-stat-card-state.is-pending {",
    ".story-stat-card-state.is-ready {",
    ".story-guidance {",
    ".story-guidance.is-hidden {",
    ".story-guidance.is-pending {",
    ".story-guidance-actions {",
    ".story-guidance-action {",
    ".story-timeline-list-empty-status {",
    ".story-timeline-list-empty-status .status-pill {",
    ".story-empty-details {",
    ".story-empty-kpis {",
    ".story-empty-kpi {",
    ".story-empty-lead {",
    ".story-empty-cta-note {",
    ".story-empty-icon-glyph {",
    ".story-empty-details-summary {",
    ".story-timeline-list-empty-details {",
    ".story-timeline-list-empty-details-summary {",
    ".story-timeline-list-empty-cta {",
    ".story-timeline-list-empty-icon-glyph {",
    "@keyframes story-empty-float {",
    "@keyframes story-empty-sheen {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(styles.includes(token), `frontend styles missing story timeline token: ${token}`);
  }

  assert.ok(
    readme.includes("interactive `Story Timeline` panel"),
    "README missing Story Timeline quickstart note",
  );
  assert.ok(
    judgeQuickstart.includes("Story Timeline panel"),
    "judge quickstart missing Story Timeline checkpoint",
  );
  assert.ok(
    operatorGuide.includes("Story Timeline panel"),
    "operator guide missing Story Timeline instruction",
  );
});
