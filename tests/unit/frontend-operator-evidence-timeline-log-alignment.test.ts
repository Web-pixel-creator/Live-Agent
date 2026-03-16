import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator evidence timeline behaves like a compact lane mini-log with timestamp chips", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function getOperatorEvidenceDrawerRefreshStamp(refreshLabel) {",
    "function resolveOperatorEvidenceDrawerTimelineTime(details, pattern, options = {}) {",
    "const OPERATOR_EVIDENCE_REFRESH_ROW_PATTERN = /(\\bupdated\\b|\\blast\\b|\\brefresh\\b|\\bheartbeat\\b|\\btime\\b|\\btimestamp\\b|\\bseen\\b|\\bsnapshot\\b|\\bobserved\\b|\\brefreshed\\b|\\bat\\b)/i;",
    "const OPERATOR_EVIDENCE_SIGNAL_TIME_PATTERN = /(\\blatest\\b|\\bupdated\\b|\\blast\\b|\\btime\\b|\\btimestamp\\b|\\bseen\\b|\\bevent\\b|\\bsignal\\b|\\brefresh\\b|\\bat\\b)/i;",
    'timelineLabel: "Recent lane log"',
    'timelineLabel: "Trace log"',
    'timelineLabel: "Review log"',
    'step: "Observed"',
    'step: "Next check"',
    'step: "Anchor"',
    'step: "Verify after"',
    'const head = document.createElement("div");',
    'head.className = "operator-evidence-drawer-timeline-item-head";',
    'time.className = "operator-evidence-drawer-timeline-time";',
    'title.className = "operator-evidence-drawer-timeline-title";',
    'meta.className = "operator-evidence-drawer-timeline-meta";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence mini-log token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer-timeline-item-head {",
    ".panel-operator-console .operator-evidence-drawer-timeline-time {",
    ".panel-operator-console .operator-evidence-drawer-timeline-title {",
    ".panel-operator-console .operator-evidence-drawer-timeline-meta {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing evidence mini-log token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("lane mini-log with tighter timestamp chips"),
    "README missing evidence mini-log note",
  );
  assert.ok(
    operatorGuideSource.includes("lane mini-log with tighter timestamp chips"),
    "operator guide missing evidence mini-log note",
  );
});
