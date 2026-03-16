import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator lane radar shifts into a quieter desktop density when no lane is actively failing", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    'const signalDensity = failEntries.length > 0 ? "standard" : primaryEntries.length > 0 ? "quiet" : "shelf";',
    "el.operatorSignalStripSurface.dataset.signalDensity = signalDensity;",
    'if (signalDensity === "quiet") {',
    'if (signalDensity === "shelf") {',
    '"Other nominal lanes stay as quieter jump chips."',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing signal-density token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"],',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="shelf"]',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"] .operator-signal-strip-hint,',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"] .operator-signal-card,',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"] .operator-signal-stable-head,',
    '.panel-operator-console .operator-signal-strip-surface[data-signal-density="quiet"] .operator-signal-stable-chip,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing signal-density token: ${token}`);
  }

  assert.ok(
    htmlSource.includes('id="operatorSignalStripSurface"') && htmlSource.includes('data-signal-density="shelf"'),
    "frontend html missing quiet signal-radar first-paint seed",
  );

  assert.ok(
    readmeSource.includes("Lane Radar` now shifts into a quieter density mode whenever no lane is actively failing"),
    "README missing signal-density note",
  );
  assert.ok(
    readmeSource.includes("also ships in that shelf posture from first paint"),
    "README missing signal first-paint note",
  );
  assert.ok(
    operatorGuideSource.includes("Lane Radar` also shifts into a quieter density mode whenever no lane is actively failing"),
    "operator guide missing signal-density note",
  );
  assert.ok(
    operatorGuideSource.includes("also ships in that shelf posture from first paint"),
    "operator guide missing signal first-paint note",
  );
});
