import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator lane radar compact desktop states shorten jump pills but keep full hover labels", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveOperatorSignalStripPillText(statusCode, fallbackText) {",
    'return isRu ? "\\u043d\\u0443\\u0436\\u043d\\u043e \\u0434\\u043e\\u043a." : "proof";',
    'return isRu ? "\\u0435\\u0441\\u0442\\u044c \\u043e\\u0432\\u0435\\u0440\\u0440\\u0430\\u0439\\u0434" : "override";',
    "const shouldCompactSignalPills = signalCompactLimit > 0 && !state.operatorSignalStripExpanded;",
    "const compactSignalLabel = shouldCompactSignalPills",
    "statusNode.textContent = compactSignalLabel;",
    "statusNode.title = fullSignalLabel;",
    'statusNode.setAttribute("aria-label", fullSignalLabel);',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator signal-pill token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] {',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-strip-summary-secondary {',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-card .status-pill {',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-overflow-chip-meta {',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator signal-pill token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("shortens visible jump-status pills (`blocking 2`, `request wait`, `proof`)"),
    "README missing compact lane-radar pill note",
  );
  assert.ok(
    operatorGuideSource.includes("shortens visible jump-status pills (`blocking 2`, `request wait`, `proof`)"),
    "operator guide missing compact lane-radar pill note",
  );
});
