import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator lane radar also compacts active desktop issue stacks into a top-four shelf", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function shouldCompactOperatorStandardSignalStrip(primaryEntries, signalDensity) {",
    'return signalDensity === "standard"',
    "&& primaryEntries.length > 4;",
    "const shouldCompactStandardSignals = shouldCompactOperatorStandardSignalStrip(primaryEntries, signalDensity);",
    "const signalCompactLimit = shouldCompactQuietSignals ? 3 : shouldCompactStandardSignals ? 4 : 0;",
    "primaryEntries.slice(signalCompactLimit)",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator active-radar compaction token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] {',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-strip-hint,',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-stable-head',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="standard"][data-signal-compact="collapsed"] .operator-signal-overflow-chip',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator active-radar compaction token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("top four active jump cards plus `More`"),
    "README missing active lane-radar top-four note",
  );
  assert.ok(
    operatorGuideSource.includes("top four active jump cards plus `More`"),
    "operator guide missing active lane-radar top-four note",
  );
});
