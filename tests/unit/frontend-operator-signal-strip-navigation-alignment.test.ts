import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator signal strip supports jump-to-card navigation", () => {
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
    'id="operatorSignalStripSurface"',
    'class="operator-signal-strip-surface"',
    'id="operatorSignalStripHint" class="operator-signal-strip-hint"',
    'id="operatorSignalStrip" class="operator-signal-strip"',
    'data-operator-signal-target="operatorHealthStatus"',
    'data-operator-signal-target="operatorTaskQueueStatus"',
    'data-operator-signal-target="operatorApprovalsStatus"',
    'data-operator-signal-target="operatorStartupStatus"',
    'data-operator-signal-target="operatorUiExecutorStatus"',
    'data-operator-signal-target="operatorWorkflowRuntimeStatus"',
    'data-operator-signal-target="operatorRuntimeGuardrailsStatus"',
    'data-operator-signal-target="operatorDeviceNodesStatus"',
    'class="operator-signal-card operator-signal-jump"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator-signal-nav token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "const OPERATOR_SIGNAL_FLASH_MS = 1200;",
    'operatorSignalStripSurface: document.getElementById("operatorSignalStripSurface")',
    'operatorSignalStripHint: document.getElementById("operatorSignalStripHint")',
    "function getOperatorCardByStatusId(statusId)",
    "function jumpToOperatorStatusCard(statusId)",
    "function getOperatorSignalStripEntries()",
    "function syncOperatorSignalStripSurface()",
    "entry.card.style.order = String(orderBucket * 100 + entry.baseOrder);",
    "el.operatorSignalStripSurface.dataset.signalState = signalState;",
    "card.classList.add(\"operator-health-card-flash\");",
    "card.scrollIntoView({ behavior: \"smooth\", block: \"center\", inline: \"nearest\" });",
    "const operatorSignalJumps = document.querySelectorAll(\"[data-operator-signal-target]\");",
    "jumpToOperatorStatusCard(statusId ?? \"\");",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator-signal-nav token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-signal-strip-surface {",
    ".operator-signal-strip-head {",
    ".operator-signal-strip-hint {",
    ".operator-signal-card[data-operator-variant=\"stale\"] {",
    ".operator-signal-card:hover {",
    ".operator-signal-card:focus-visible {",
    ".operator-health-card-flash {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing operator-signal-nav token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Signal strip cards are clickable and jump to the corresponding evidence widget"),
    "README missing operator signal-strip navigation note",
  );
  assert.ok(
    readmeSource.includes("`Lane Radar` surface"),
    "README missing operator lane-radar note",
  );
  assert.ok(
    operatorGuideSource.includes("Signal strip cards are clickable jump-links"),
    "operator guide missing operator signal-strip navigation note",
  );
  assert.ok(
    operatorGuideSource.includes("`Lane Radar`"),
    "operator guide missing operator lane-radar note",
  );
});
