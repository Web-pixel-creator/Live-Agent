import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence keeps dormant lead-signal meta compact and restores the fuller split after hydration", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");

  for (const token of [
    'id="operatorEvidenceDrawerContextSignalItem"',
    'id="operatorEvidenceDrawerContextSignalValue"',
    'id="operatorEvidenceDrawerContextSignalSource"',
    'id="operatorEvidenceDrawerContextSignalFreshness"',
    'class="operator-evidence-drawer-context-source">Source: Overview</span>',
    'class="operator-evidence-drawer-context-freshness">Freshness: awaiting refresh</span>',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing focused-evidence context-density token: ${token}`);
  }

  for (const token of [
    "function buildOperatorEvidenceDrawerCompactContextSignalMeta(leadSignalSource, freshnessValue) {",
    'const useCompactSignalMeta = leadSignal.state === "dormant" || freshness.state === "dormant";',
    'el.operatorEvidenceDrawerContextSignalItem.dataset.signalDensity = useCompactSignalMeta ? "compact" : "full";',
    'buildOperatorEvidenceDrawerCompactContextSignalMeta(leadSignalSource, freshness.value)',
    'return `${sourceText} | ${freshnessText}`;',
    'el.operatorEvidenceDrawerContextSignalFreshness.hidden = useCompactSignalMeta;',
    'el.operatorEvidenceDrawerContextSignalFreshness.setAttribute("aria-hidden", useCompactSignalMeta ? "true" : "false");',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing focused-evidence context-density token: ${token}`);
  }

  assert.ok(
    stylesSource.includes('.panel-operator-console .operator-evidence-drawer-context-item[data-signal-density="compact"] .operator-evidence-drawer-context-source {'),
    "styles.css should style compact dormant focused-evidence signal meta",
  );
});
