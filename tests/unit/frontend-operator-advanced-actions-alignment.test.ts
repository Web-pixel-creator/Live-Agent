import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps secondary controls in collapsed advanced actions section", () => {
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
    'id="operatorAdvancedActions"',
    'class="operator-advanced-actions"',
    "Advanced Actions",
    'class="operator-advanced-actions-hint"',
    'class="actions operator-advanced-actions-row"',
    'id="operatorRetryBtn"',
    'id="operatorDrainBtn"',
    'id="operatorWarmupBtn"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-advanced-actions token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "document.getElementById(\"operatorRetryBtn\").addEventListener(\"click\", () => {",
    "document.getElementById(\"operatorDrainBtn\").addEventListener(\"click\", () => {",
    "document.getElementById(\"operatorWarmupBtn\").addEventListener(\"click\", () => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-advanced-actions token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-advanced-actions {",
    ".operator-advanced-actions > summary {",
    ".operator-advanced-actions[open] > summary::after {",
    ".operator-advanced-actions-row {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-advanced-actions token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Secondary operator controls (`Retry Task`, `Failover Drain`, `Failover Warmup`) are grouped under collapsed `Advanced Actions`"),
    "README missing operator advanced actions note",
  );
  assert.ok(
    operatorGuideSource.includes("Secondary controls are under collapsed `Advanced Actions`"),
    "operator guide missing operator advanced actions note",
  );
});
