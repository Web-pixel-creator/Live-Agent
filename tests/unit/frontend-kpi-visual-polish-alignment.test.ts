import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("kpi panel exposes delta badges and source attribution for faster judge scan", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");

  const requiredHtmlTokens = [
    'class="kpi-signal-grid"',
    'id="kpiPriceDelta"',
    'id="kpiDeliveryDelta"',
    'id="kpiSlaDelta"',
    'id="kpiConstraintSource"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing kpi-polish token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "kpiPriceDelta: document.getElementById(\"kpiPriceDelta\")",
    "kpiDeliveryDelta: document.getElementById(\"kpiDeliveryDelta\")",
    "kpiSlaDelta: document.getElementById(\"kpiSlaDelta\")",
    "kpiConstraintSource: document.getElementById(\"kpiConstraintSource\")",
    "function setKpiDeltaBadge(node, text, variant = \"neutral\")",
    "function setKpiConstraintDelta(node, value, target, comparator, unitSuffix = \"\")",
    "function setKpiConstraintSourceLabel(text)",
    "setKpiConstraintDelta(el.kpiPriceDelta, price, targetPrice, \"max\");",
    "setKpiConstraintDelta(el.kpiDeliveryDelta, delivery, targetDelivery, \"max\", \"d\");",
    "setKpiConstraintDelta(el.kpiSlaDelta, sla, targetSla, \"min\", \"pp\");",
    "setKpiConstraintSourceLabel(\"Evaluating source: final_offer\");",
    "setKpiConstraintSourceLabel(\"Evaluating source: current_offer\");",
    "setKpiConstraintSourceLabel(\"Evaluating source: mixed_offer\");",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing kpi-polish token: ${token}`);
  }

  const requiredStylesTokens = [
    ".kpi-signal-grid {",
    ".kpi-signal {",
    ".kpi-delta {",
    ".kpi-delta-neutral {",
    ".kpi-delta-ok {",
    ".kpi-delta-fail {",
  ];
  for (const token of requiredStylesTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing kpi-polish token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("delta"),
    "README should mention KPI delta/signal visual cues for judged walkthrough",
  );
});
