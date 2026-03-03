import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend wires interactive story timeline panel across UI/runtime/docs", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const judgeQuickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const html = readFileSync(htmlPath, "utf8");
  const app = readFileSync(appPath, "utf8");
  const readme = readFileSync(readmePath, "utf8");
  const judgeQuickstart = readFileSync(judgeQuickstartPath, "utf8");
  const operatorGuide = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    '<span class="section-badge">Story</span>Story Timeline',
    'id="storyTimelineTitle"',
    'id="storyTimelineCount"',
    'id="storyTimelinePendingJobs"',
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
    'id="storyTimelineOpenLiveBtn"',
    "Open Live Negotiator",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(html.includes(token), `frontend html missing story timeline token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "storyTimelineTitle: null",
    "storyTimelineSegments: []",
    "storyTimelineSelectedIndex: 0",
    "storyTimelinePendingJobs: 0",
    "storyTimelineMode: document.getElementById(\"storyTimelineMode\")",
    "storyTimelineAssetMix: document.getElementById(\"storyTimelineAssetMix\")",
    "storyTimelineProgressHint: document.getElementById(\"storyTimelineProgressHint\")",
    "storyTimelineProgressLabel: document.getElementById(\"storyTimelineProgressLabel\")",
    "storyTimelineProgressTrack: document.getElementById(\"storyTimelineProgressTrack\")",
    "storyTimelineProgressBar: document.getElementById(\"storyTimelineProgressBar\")",
    "renderStoryTimelineProgress",
    "normalizeStoryTimelineSegment",
    "setStoryTimelineData",
    "renderStoryTimeline",
    "updateStoryTimelineSelection",
    "renderStoryTimelinePreviewEmptyState",
    "function openLiveNegotiatorFromStoryEmptyState()",
    "setActiveTab(\"live-negotiator\");",
    "el.intent.value = \"story\";",
    "action.textContent = \"Open Live Negotiator\";",
    "storyTimelinePreview.classList.add(\"story-timeline-preview-empty\")",
    "storyTimelineProgressTrack.classList.toggle(\"is-pending\", safeCount > 0 && hasPendingVideoJobs);",
    "setStatusPill(el.storyTimelineMode, \"timeline_pending_video\", \"neutral\");",
    "setStatusPill(el.storyTimelineAssetMix, assetText, hasAnyAssets ? \"ok\" : \"neutral\");",
    "setStatusPill(el.storyTimelineProgressHint, hintText, hintVariant);",
    "Story timeline ready: use scrubber/selector for segment preview.",
    "selectedSegment",
    "## Story Timeline Snapshot",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(app.includes(token), `frontend runtime missing story timeline token: ${token}`);
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
