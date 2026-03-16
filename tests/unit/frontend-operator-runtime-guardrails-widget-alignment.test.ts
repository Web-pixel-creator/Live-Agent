import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator runtime guardrails widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlIds = [
    'data-operator-signal-target="operatorRuntimeGuardrailsStatus"',
    'id="operatorSignalGuardrails"',
    'id="operatorRuntimeGuardrailsStatus"',
    'id="operatorRuntimeGuardrailsSignals"',
    'id="operatorRuntimeGuardrailsCoverage"',
    'id="operatorRuntimeGuardrailsSandbox"',
    'id="operatorRuntimeGuardrailsSkills"',
    'id="operatorRuntimeGuardrailsTopSignal"',
    'id="operatorRuntimeGuardrailsHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing runtime guardrails widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorSignalGuardrails: document.getElementById("operatorSignalGuardrails")',
    'operatorRuntimeGuardrailsStatus: document.getElementById("operatorRuntimeGuardrailsStatus")',
    'operatorRuntimeGuardrailsStatus: "operatorSignalGuardrails"',
    "setOperatorRuntimeGuardrailsHint",
    "resetOperatorRuntimeGuardrailsWidget",
    "renderOperatorRuntimeGuardrailsWidget",
    '"runtime_guardrails"',
    '"runtime_guardrails.top_signal"',
    "renderOperatorRuntimeGuardrailsWidget(runtimeDiagnostics);",
    "resetOperatorRuntimeGuardrailsWidget(failedRefreshReason);",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing runtime guardrails token: ${token}`);
  }

  assert.ok(readmeSource.includes("Runtime Guardrails"), "README missing runtime guardrails operator card note");
  assert.ok(operatorGuideSource.includes("Runtime Guardrails"), "operator guide missing runtime guardrails operator card note");
});
