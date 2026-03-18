import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes runtime diagnostics endpoint and operator summary lane", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const helperPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-diagnostics-summary.ts");
  const source = readFileSync(sourcePath, "utf8");
  const helper = readFileSync(helperPath, "utf8");

  const requiredTokens = [
    "/v1/runtime/diagnostics",
    "buildRuntimeDiagnosticsSummary",
    "const runtimeDiagnostics = buildRuntimeDiagnosticsSummary({",
    "runtimeDiagnostics,",
    'source: "operator_runtime_diagnostics"',
  ];

  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `runtime diagnostics API contract missing token: ${token}`);
  }

  const requiredHelperTokens = [
    "workflowExecutionStatus",
    "workflowCurrentStage",
    "workflowActiveRole",
    "workflowTaskId",
  ];

  for (const token of requiredHelperTokens) {
    assert.ok(helper.includes(token), `runtime diagnostics helper missing token: ${token}`);
  }
});

test("readme documents runtime diagnostics endpoint and operator summary coverage", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

  assert.match(readme, /GET \/v1\/runtime\/diagnostics/);
  assert.match(readme, /runtimeDiagnostics/);
  assert.match(readme, /workflow stage/i);
});
