import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence trims the compact desktop shell without losing provenance", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "function isOperatorEvidenceDrawerCompactView(viewId) {",
    "function resolveOperatorEvidenceDrawerCompactRouteValue(actionConfig, details = {}) {",
    "function resolveOperatorEvidenceDrawerCompactVerifyValue(details = {}) {",
    "const routeValue = resolveOperatorEvidenceDrawerActionRoute(preferredAction, details);",
    "const verifyValue = resolveOperatorEvidenceDrawerVerifyValue(details);",
    "const compactValue = normalizeOperatorUiCopy(item.compactValue);",
    "compactValue: resolveOperatorEvidenceDrawerCompactRouteValue(preferredAction, details),",
    "compactValue: resolveOperatorEvidenceDrawerCompactVerifyValue(details),",
    "compactValue: compactValue || \"\",",
    "details.primaryActionLabel",
    'const isCompactEvidenceView = !!activeView && isOperatorEvidenceDrawerCompactView(activeView.id);',
    "const provenanceValue =",
    'article.title = `${item.label}: ${item.value}`;',
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing compact evidence shell token: ${token}`);
  }

  const requiredStyleTokens = [
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-head,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-kicker,',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-provenance-item {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-provenance-item-value {',
    '.panel-operator-console .operator-evidence-drawer[data-evidence-view="latest"] .operator-evidence-drawer-action,',
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing compact evidence shell token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("single-line provenance chips"),
    "README missing compact evidence provenance-chip note",
  );
  assert.ok(
    readmeSource.includes("shorter route/refresh copy"),
    "README missing compact evidence route/refresh note",
  );
  assert.ok(
    operatorGuideSource.includes("single-line provenance chips"),
    "operator guide missing compact evidence provenance-chip note",
  );
  assert.ok(
    operatorGuideSource.includes("shorter route/refresh copy"),
    "operator guide missing compact evidence route/refresh note",
  );
});
