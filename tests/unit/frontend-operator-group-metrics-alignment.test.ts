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
    'class="operator-group-metrics" data-operator-group-metrics',
    "visible 0 | fail 0 | neutral 0 | ok 0 | hidden 0",
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-group-metrics token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "function refreshOperatorGroupMetrics()",
    "const metricsNode = group.querySelector(\"[data-operator-group-metrics]\");",
    "metricsNode.textContent = `visible ${visible} | fail ${fail} | neutral ${neutral} | ok ${ok} | hidden ${hidden}`;",
    "metricsNode.classList.toggle(\"is-has-fail\", fail > 0);",
    "metricsNode.classList.toggle(\"is-all-ok\", fail === 0 && neutral === 0 && ok > 0);",
    "refreshOperatorGroupMetrics();",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-group-metrics token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-health-group-title-row {",
    ".operator-group-metrics {",
    ".operator-group-metrics.is-has-fail {",
    ".operator-group-metrics.is-all-ok {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-group-metrics token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Each operator lane header now includes live mini-counters"),
    "README missing operator group-metrics note",
  );
  assert.ok(
    operatorGuideSource.includes("Each lane header shows live mini-counters"),
    "operator guide missing operator group-metrics note",
  );
});
