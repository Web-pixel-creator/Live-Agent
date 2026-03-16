import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console keeps compact evidence checkpoints inside the focused drawer", () => {
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
    'id="operatorEvidenceDrawerCheckpointsLabel"',
    'id="operatorEvidenceDrawerCheckpoints"',
    'class="operator-evidence-drawer-checkpoints-shell"',
    'class="operator-evidence-drawer-checkpoints"',
    'class="operator-evidence-drawer-checkpoint is-placeholder is-muted"',
    'class="operator-evidence-drawer-checkpoint-value"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing evidence checkpoint token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorEvidenceDrawerCheckpointsLabel: document.getElementById("operatorEvidenceDrawerCheckpointsLabel")',
    'operatorEvidenceDrawerCheckpoints: document.getElementById("operatorEvidenceDrawerCheckpoints")',
    "function pushOperatorEvidenceDrawerCheckpoint(target, checkpoint, limit = 3) {",
    "function buildOperatorEvidenceDrawerLatestCheckpoints(details) {",
    "function buildOperatorEvidenceDrawerTraceCheckpoints(details) {",
    "function buildOperatorEvidenceDrawerRecoveryCheckpoints(details) {",
    "function buildOperatorEvidenceDrawerAuditCheckpoints(details) {",
    'checkpointsLabel: "Recent checkpoints"',
    'checkpointsLabel: "Trace anchors"',
    'checkpointsLabel: "Recovery anchors"',
    'checkpointsLabel: "Review anchors"',
    "setText(el.operatorEvidenceDrawerCheckpointsLabel, activeView?.checkpointsLabel ?? \"Recent checkpoints\");",
    'value.className = "operator-evidence-drawer-checkpoint-value";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence checkpoint token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer-checkpoints-shell {",
    ".panel-operator-console .operator-evidence-drawer-checkpoints-label {",
    ".panel-operator-console .operator-evidence-drawer-checkpoints {",
    ".panel-operator-console .operator-evidence-drawer-checkpoint {",
    ".panel-operator-console .operator-evidence-drawer-checkpoint-label {",
    ".panel-operator-console .operator-evidence-drawer-checkpoint-value {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing evidence checkpoint token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact checkpoint rail"),
    "README missing evidence checkpoint rail note",
  );
  assert.ok(
    operatorGuideSource.includes("compact checkpoint rail"),
    "operator guide missing evidence checkpoint rail note",
  );
});
