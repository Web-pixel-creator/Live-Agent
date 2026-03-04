import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend groups panels into tabbed layout with live tab default", () => {
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
    "class=\"tabs\"",
    'data-tab-target="live-negotiator"',
    'data-tab-target="storyteller"',
    'data-tab-target="operator"',
    'data-tab-target="device-nodes"',
    'id="tab-live-negotiator"',
    'id="tab-storyteller"',
    'id="tab-operator"',
    'id="tab-device-nodes"',
    'id="operatorEventLogSection"',
    '<span class="section-badge">Log</span>Event Log',
    "Debug Event Stream",
    'class="live-negotiator-main"',
    'id="storyTimelineProgressLabel"',
    'id="storyTimelineProgressTrack"',
    'id="storyTimelineProgressBar"',
    "class=\"tab-content active\"",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing tab token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const tabButtons = Array.from(document.querySelectorAll(\".tab-btn[data-tab-target]\"));",
    "const tabContents = Array.from(document.querySelectorAll(\".tab-content[data-tab]\"));",
    "const DEFAULT_TAB_ID = \"live-negotiator\";",
    "TAB_STORAGE_KEY",
    "readStoredTabId",
    "mla.demoFrontend.activeTab",
    "storyTimelineProgressLabel: document.getElementById(\"storyTimelineProgressLabel\")",
    "storyTimelineProgressTrack: document.getElementById(\"storyTimelineProgressTrack\")",
    "storyTimelineProgressBar: document.getElementById(\"storyTimelineProgressBar\")",
    "function renderStoryTimelineProgress(count, selectedIndex)",
    "function setActiveTab(tabId)",
    "window.localStorage?.setItem(TAB_STORAGE_KEY, resolvedTabId);",
    "setActiveTab(readStoredTabId());",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing tab token: ${token}`);
  }

  const requiredStylesTokens = [
    ".tabs {",
    "position: sticky;",
    "top: 12px;",
    ".tab-btn {",
    ".tab-btn:hover {",
    ".tab-btn:focus-visible {",
    ".tab-btn.active {",
    ".tab-content {",
    ".tab-content.active {",
    "@keyframes panel-fade-slide-in {",
    ".tab-content.active > .panel {",
    ".operator-event-log-settings {",
    ".live-negotiator-main {",
    ".section-badge {",
    ".kpi-value-ok {",
    ".story-progress-track {",
    ".story-progress-fill {",
    "overflow-x: hidden;",
    "overflow-wrap: anywhere;",
  ];
  for (const token of requiredStylesTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing tab/overflow token: ${token}`);
  }

  assert.ok(readmeSource.includes("Frontend is grouped into tabs"), "README missing tabbed-layout note");
  assert.ok(readmeSource.includes("remembers the last active tab"), "README missing active-tab persistence note");
  assert.ok(readmeSource.includes("Live Negotiator"), "README missing updated tab names");
  assert.ok(operatorGuideSource.includes("## Frontend Tabs"), "Operator guide missing tabbed-layout section");
  assert.ok(operatorGuideSource.includes("remembers last active tab"), "Operator guide missing active-tab persistence note");
  assert.ok(operatorGuideSource.includes("Storyteller"), "Operator guide missing storyteller tab note");
});
