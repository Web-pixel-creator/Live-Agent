import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator lane radar keeps desktop quiet states on a short shelf with a More toggle", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    'operatorSignalStripExpanded: false,',
    "function shouldCompactOperatorQuietSignalStrip(primaryEntries, signalDensity) {",
    "function createOperatorSignalOverflowChip(hiddenCount, expanded) {",
    "const signalCompactLimit = shouldCompactQuietSignals ? 3 : shouldCompactStandardSignals ? 4 : 0;",
    "const hiddenPrimaryEntries = signalCompactLimit > 0 ? primaryEntries.slice(signalCompactLimit) : [];",
    'primaryEntries.slice(0, signalCompactLimit)',
    'el.operatorSignalStripSurface.dataset.signalCompact = signalCompactLimit > 0',
    'state.operatorSignalStripExpanded = !state.operatorSignalStripExpanded;',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator signal-overflow token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-signal-overflow-chip {",
    ".panel-operator-console .operator-signal-overflow-chip-label {",
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"] .operator-signal-overflow-chip,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator signal-overflow token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("top three jump chips plus a quiet `More` toggle"),
    "README missing operator signal-overflow note",
  );
  assert.ok(
    operatorGuideSource.includes("top three jump chips plus a quiet `More` toggle"),
    "operator guide missing operator signal-overflow note",
  );
});
