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
    'class="story-empty-checklist"',
    'class="story-empty-arc"',
    'class="story-timeline-list-empty-status"',
    'class="story-timeline-list-empty-preview"',
    'class="story-timeline-list-empty-card"',
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
    "storyTimelineProgressLabel: document.getElementById(\"storyTimelineProgressLabel\")",
    "storyTimelineProgressTrack: document.getElementById(\"storyTimelineProgressTrack\")",
    "storyTimelineProgressBar: document.getElementById(\"storyTimelineProgressBar\")",
    "renderStoryTimelineProgress",
    "normalizeStoryTimelineSegment",
    "renderStoryTimelineStateCard",
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
    "actionTemplate.className = \"button-muted story-timeline-list-empty-action story-timeline-list-empty-action-template\";",
    "actionTemplate.textContent = \"Use Story Prompt Template\";",
    "applyStoryPromptTemplateFromStoryEmptyState();",
    "icon.className = \"story-timeline-list-empty-icon\";",
    "icon.textContent = \"Timeline\";",
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
    "storyTimelinePreview.classList.add(\"story-timeline-preview-empty\")",
    "storyTimelineProgressTrack.classList.toggle(\"is-pending\", safeCount > 0 && hasPendingVideoJobs);",
    "setStatusPill(el.storyTimelineMode, \"timeline_pending_video\", \"neutral\");",
    "setStatusPill(el.storyTimelineAssetMix, assetText, hasAnyAssets ? \"ok\" : \"neutral\");",
    "setStatusPill(el.storyTimelineProgressHint, hintText, hintVariant);",
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
    ".story-timeline-list-empty-status {",
    ".story-timeline-list-empty-status .status-pill {",
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
