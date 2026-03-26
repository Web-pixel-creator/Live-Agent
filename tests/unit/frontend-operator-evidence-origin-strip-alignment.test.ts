import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence keeps quiet context chips above the facts grid", () => {
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
    'id="operatorEvidenceDrawerOrigins"',
    'class="operator-evidence-drawer-origins"',
    'class="operator-evidence-drawer-origin is-placeholder is-muted"',
    'class="operator-evidence-drawer-origin-label"',
    'class="operator-evidence-drawer-origin-value"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing evidence origin token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorEvidenceDrawerOrigins: document.getElementById("operatorEvidenceDrawerOrigins")',
    "function pushOperatorEvidenceDrawerOrigin(target, origin, limit = 3) {",
    "function buildOperatorEvidenceDrawerLatestOrigins(details) {",
    "function buildOperatorEvidenceDrawerTraceOrigins(details) {",
    "function buildOperatorEvidenceDrawerRecoveryOrigins(details) {",
    "function buildOperatorEvidenceDrawerAuditOrigins(details) {",
    'label: "Workspace"',
    'label: "View"',
    'label: "Source"',
    'label.className = "operator-evidence-drawer-origin-label";',
    'value.className = "operator-evidence-drawer-origin-value";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence origin token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer-origins {",
    ".panel-operator-console .operator-evidence-drawer-origin {",
    ".panel-operator-console .operator-evidence-drawer-origin-label {",
    ".panel-operator-console .operator-evidence-drawer-origin-value {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing evidence origin token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("quiet context chips (`Workspace`, `View`, `Source`)"),
    "README missing evidence origin note",
  );
  assert.ok(
    operatorGuideSource.includes("quiet context chips (`Workspace`, `View`, `Source`)"),
    "operator guide missing evidence origin note",
  );
});
