import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console overview surfaces use icon-led hierarchy and action-oriented empty states", () => {
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
    'class="operator-demo-summary-head"',
    'class="operator-demo-summary-title-row"',
    'class="operator-demo-summary-ledger"',
    'class="operator-demo-summary-placeholder-note"',
    'class="operator-signal-card-head"',
    'class="operator-signal-card-title-row"',
    'class="operator-surface-icon operator-surface-icon-realtime"',
    'class="operator-surface-icon operator-surface-icon-queue"',
    'class="operator-surface-icon operator-surface-icon-guardrails"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator visual-hierarchy token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'cue.textContent = "Awaiting signal";',
    "for (const [index, entry] of visibleEntries.entries()) {",
    "const head = document.createElement(\"div\");",
    "head.className = \"operator-priority-queue-head\";",
    "const rank = document.createElement(\"span\");",
    "rank.className = `operator-priority-queue-rank is-${tone}`;",
    "rank.textContent = `P${index + 1}`;",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator visual-hierarchy token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-surface-icon {",
    ".operator-demo-summary-head {",
    ".operator-demo-summary-ledger {",
    ".operator-demo-summary-placeholder-note {",
    ".operator-signal-card-head {",
    ".operator-priority-queue-head {",
    ".operator-priority-queue-rank {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator visual-hierarchy token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("icon-led status headers"),
    "README missing icon-led overview note",
  );
  assert.ok(
    readmeSource.includes("short health ledger"),
    "README missing overview ledger note",
  );
  assert.ok(
    readmeSource.includes("P1/P2/P3"),
    "README missing active queue priority note",
  );
  assert.ok(
    operatorGuideSource.includes("icon-led status headers"),
    "operator guide missing icon-led overview note",
  );
  assert.ok(
    operatorGuideSource.includes("short health ledger"),
    "operator guide missing overview ledger note",
  );
  assert.ok(
    operatorGuideSource.includes("P1/P2/P3"),
    "operator guide missing active queue priority note",
  );
});
