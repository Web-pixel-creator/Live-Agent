import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence keeps action provenance near the CTA rail", () => {
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
    'id="operatorEvidenceDrawerProvenanceLabel"',
    'id="operatorEvidenceDrawerProvenance"',
    'class="operator-evidence-drawer-provenance-shell"',
    'class="operator-evidence-drawer-provenance"',
    'class="operator-evidence-drawer-provenance-item is-placeholder is-muted"',
    'class="operator-evidence-drawer-provenance-item-label"',
    'class="operator-evidence-drawer-provenance-item-value"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing evidence provenance token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorEvidenceDrawerProvenanceLabel: document.getElementById("operatorEvidenceDrawerProvenanceLabel")',
    'operatorEvidenceDrawerProvenance: document.getElementById("operatorEvidenceDrawerProvenance")',
    "function pushOperatorEvidenceDrawerProvenance(target, item, limit = 3) {",
    "function resolveOperatorEvidenceDrawerActionActor(actionConfig, details = {}) {",
    "function resolveOperatorEvidenceDrawerActionRoute(actionConfig, details = {}) {",
    "function resolveOperatorEvidenceDrawerVerifyValue(details = {}) {",
    "function buildOperatorEvidenceDrawerProvenance(details = {}) {",
    'return "Active queue";',
    'return "Trace review";',
    'return "Action center";',
    'return "Saved view";',
    'label: "Actor"',
    'label: "Route"',
    'label: "Verify"',
    'setText(el.operatorEvidenceDrawerProvenanceLabel, "Action provenance");',
    'label.className = "operator-evidence-drawer-provenance-item-label";',
    'value.className = "operator-evidence-drawer-provenance-item-value";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence provenance token: ${token}`);
  }

  const requiredStyleTokens = [
    ".panel-operator-console .operator-evidence-drawer-provenance-shell {",
    ".panel-operator-console .operator-evidence-drawer-provenance-label {",
    ".panel-operator-console .operator-evidence-drawer-provenance {",
    ".panel-operator-console .operator-evidence-drawer-provenance-item {",
    ".panel-operator-console .operator-evidence-drawer-provenance-item-label {",
    ".panel-operator-console .operator-evidence-drawer-provenance-item-value {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing evidence provenance token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("Action provenance"),
    "README missing evidence provenance note",
  );
  assert.ok(
    readmeSource.includes("tab-aware"),
    "README missing tab-aware provenance note",
  );
  assert.ok(
    operatorGuideSource.includes("Action provenance"),
    "operator guide missing evidence provenance note",
  );
  assert.ok(
    operatorGuideSource.includes("tab-aware"),
    "operator guide missing tab-aware provenance note",
  );
});
