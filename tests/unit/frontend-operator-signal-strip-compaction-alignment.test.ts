import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator lane radar keeps active lanes upfront and compresses stable systems into a secondary strip", () => {
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
    'class="operator-signal-strip-meta"',
    'id="operatorSignalPrimaryCount"',
    'id="operatorSignalStableCount"',
    'id="operatorSignalStableSurface" class="operator-signal-stable-surface is-hidden"',
    'id="operatorSignalStableHint" class="operator-signal-stable-hint"',
    'id="operatorSignalStableStrip" class="operator-signal-stable-strip"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator signal-compaction token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSignalPrimaryCount: document.getElementById("operatorSignalPrimaryCount")',
    'operatorSignalStableCount: document.getElementById("operatorSignalStableCount")',
    'operatorSignalStableSurface: document.getElementById("operatorSignalStableSurface")',
    'operatorSignalStableStrip: document.getElementById("operatorSignalStableStrip")',
    "function createOperatorStableSignalChip(entry, tone) {",
    "function renderOperatorStableSignalStrip(entries) {",
    "const dormantEntries = entries.filter((entry) => entry.isPlaceholder);",
    "const primaryEntries = [...failEntries, ...staleEntries, ...neutralEntries];",
    "renderOperatorStableSignalStrip(stableEntries);",
    'entry.card.hidden = !shouldShowAsCard;',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator signal-compaction token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-signal-strip-meta {",
    ".panel-operator-console .operator-signal-stable-surface {",
    ".panel-operator-console .operator-signal-stable-strip {",
    ".panel-operator-console .operator-signal-stable-chip {",
    ".panel-operator-console .operator-signal-stable-chip.is-dormant {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator signal-compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("healthy and dormant lanes now collapse into a quieter `Stable systems` rail"),
    "README missing operator signal-compaction note",
  );
  assert.ok(
    operatorGuideSource.includes("healthy and dormant lanes collapse into a quieter `Stable systems` rail"),
    "operator guide missing operator signal-compaction note",
  );
});
