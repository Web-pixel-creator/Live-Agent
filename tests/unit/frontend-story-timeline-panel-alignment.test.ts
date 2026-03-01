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
    "<h2>Story Timeline</h2>",
    'id="storyTimelineTitle"',
    'id="storyTimelineCount"',
    'id="storyTimelinePendingJobs"',
    'id="storyTimelineScrubber"',
    'id="storyTimelineSelect"',
    'id="storyTimelinePosition"',
    'id="storyTimelinePreview"',
    'id="storyTimelineList"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(html.includes(token), `frontend html missing story timeline token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "storyTimelineTitle: null",
    "storyTimelineSegments: []",
    "storyTimelineSelectedIndex: 0",
    "storyTimelinePendingJobs: 0",
    "normalizeStoryTimelineSegment",
    "setStoryTimelineData",
    "renderStoryTimeline",
    "updateStoryTimelineSelection",
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

