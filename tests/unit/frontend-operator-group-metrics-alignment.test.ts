import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console lane headers expose group-level triage counters", () => {
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
    'class="operator-health-group-title-row"',
    'class="operator-health-group-title-cluster"',
    'class="operator-health-group-icon operator-surface-icon-realtime"',
    'class="operator-health-group-kicker"',
    'class="operator-health-group-copy"',
    'class="operator-health-group-preview" data-operator-group-preview',
    'Preview updates after refresh.',
    'class="operator-group-metrics" data-operator-group-metrics',
    "Live Health",
    "Decisions",
    "Runtime Health",
    "Audit Trail",
    "visible 0 | fail 0 | neutral 0 | ok 0 | hidden 0",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-group-metrics token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "function formatOperatorGroupPreviewLabels(items, maxItems = 2)",
    "function formatOperatorGroupMetricsMarkup(visible, fail, neutral, ok, hidden)",
    "function refreshOperatorGroupMetrics()",
    "const metricsNode = group.querySelector(\"[data-operator-group-metrics]\");",
    "const previewNode = group.querySelector(\"[data-operator-group-preview]\");",
    "previewText = `Act first: ${formatOperatorGroupPreviewLabels(failCards)}.`;",
    "previewText = `Refresh first: ${formatOperatorGroupPreviewLabels(staleCards)}.`;",
    "previewText = `Check next: ${formatOperatorGroupPreviewLabels(neutralCards)}.`;",
    "previewText = `Steady: ${ok} visible ${ok === 1 ? \"check\" : \"checks\"}.`;",
    "previewNode.textContent = previewText;",
    "metricsNode.setAttribute(\"aria-label\", `visible ${visible}, fail ${fail}, neutral ${neutral}, ok ${ok}, hidden ${hidden}`);",
    "metricsNode.innerHTML = formatOperatorGroupMetricsMarkup(visible, fail, neutral, ok, hidden);",
    "metricsNode.classList.toggle(\"is-has-fail\", fail > 0);",
    "metricsNode.classList.toggle(\"is-all-ok\", fail === 0 && neutral === 0 && ok > 0);",
    "refreshOperatorGroupMetrics();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-group-metrics token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-group-title-row {",
    ".operator-health-group-title-cluster {",
    ".operator-health-group-icon {",
    ".operator-health-group-kicker {",
    ".operator-health-group-copy {",
    ".operator-health-group-preview {",
    ".operator-health-group-preview.is-has-fail {",
    ".operator-health-group-preview.is-all-ok {",
    ".operator-group-metrics {",
    ".operator-group-metric-pill {",
    ".operator-group-metric-pill-label {",
    ".operator-group-metrics.is-has-fail {",
    ".operator-group-metrics.is-all-ok {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-group-metrics token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Each operator lane header now includes live mini-counters, a lane-type label, one short scope line, and a live preview line"),
    "README missing operator group-metrics note",
  );
  assert.ok(
    readmeSource.includes("chip-based visibility counters"),
    "README missing operator group metric chip note",
  );
  assert.ok(
    readmeSource.includes("plainer category labels (`Live Health`, `Runtime Health`, `Decisions`, `Audit Trail`)"),
    "README missing plain-language lane label note",
  );
  assert.ok(
    readmeSource.includes("action-first preview copy (`Act first`, `Refresh first`, `Check next`)"),
    "README missing action-first preview copy note",
  );
  assert.ok(
    operatorGuideSource.includes("Each lane header shows live mini-counters (`visible/fail/neutral/ok/hidden`), a lane-type label, one short scope line, and a live preview line"),
    "operator guide missing operator group-metrics note",
  );
  assert.ok(
    operatorGuideSource.includes("chip-based visibility counters"),
    "operator guide missing operator group metric chip note",
  );
  assert.ok(
    operatorGuideSource.includes("plainer category labels (`Live Health`, `Runtime Health`, `Decisions`, `Audit Trail`)"),
    "operator guide missing plain-language lane label note",
  );
  assert.ok(
    operatorGuideSource.includes("action-first preview copy (`Act first`, `Refresh first`, `Check next`)"),
    "operator guide missing action-first preview copy note",
  );
});
