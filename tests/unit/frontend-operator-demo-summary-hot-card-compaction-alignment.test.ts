import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator demo summary compacts hot desktop tiles into shorter incident strips", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveOperatorDemoSummaryPillText(statusCode, fallbackText) {",
    'summaryCard.classList.toggle("is-hot", !isQuiet);',
    "const nextMirrorLabel = summaryCard instanceof HTMLElement",
    'mirrorNode.title = fullMirrorLabel;',
    'mirrorNode.setAttribute("aria-label", fullMirrorLabel);',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing demo-summary hot token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="standard"] .operator-demo-summary-card.is-hot,',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-hot {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-hot .operator-demo-summary-placeholder-note {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-hot .operator-demo-summary-kpi-token {',
    '.panel-operator-console .operator-demo-summary-strip[data-summary-density="mixed"] .operator-demo-summary-card.is-hot .status-pill {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing demo-summary hot token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("remaining hot `Demo Summary` tiles now also shorten their mirrored status pills"),
    "README missing demo-summary hot-tile note",
  );
  assert.ok(
    operatorGuideSource.includes("remaining hot `Demo Summary` tiles now also shorten their mirrored status pills"),
    "operator guide missing demo-summary hot-tile note",
  );
});
