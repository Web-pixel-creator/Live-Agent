import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence keeps compact desktop ctas as shorter utility labels", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function resolveOperatorEvidenceDrawerCompactActionLabel(actionConfig, details = {}) {",
    "function createOperatorEvidenceDrawerActionButton(config, options = {}) {",
    'button.dataset.actionDensity = compact ? "compact" : "default";',
    'button.textContent = compactLabel || fullLabel;',
    'button.setAttribute("aria-label", fullLabel);',
    'el.operatorEvidenceDrawer.dataset.evidenceActionDensity = isCompactEvidenceView ? "compact" : "default";',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing compact evidence action token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-evidence-drawer[data-evidence-action-density="compact"] .operator-evidence-drawer-actions {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-action-density="compact"] .operator-evidence-drawer-action {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-action,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing compact evidence action token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("compact `Focused Evidence` CTAs now shorten visible labels"),
    "README missing compact evidence CTA label note",
  );
  assert.ok(
    operatorGuideSource.includes("compact `Focused Evidence` CTAs now shorten visible labels"),
    "operator guide missing compact evidence CTA label note",
  );
});
