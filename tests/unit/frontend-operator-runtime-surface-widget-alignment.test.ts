import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator runtime surface widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    "<h3>Runtime Surface</h3>",
    'id="operatorRuntimeSurfaceStatus"',
    'id="operatorRuntimeSurfaceInventory"',
    'id="operatorRuntimeSurfaceMissing"',
    'id="operatorRuntimeSurfacePlaybooks"',
    'id="operatorRuntimeSurfaceEvidence"',
    'id="operatorRuntimeSurfaceSkills"',
    'id="operatorRuntimeSurfaceRefreshBtn"',
    'id="operatorRuntimeSurfaceHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing runtime surface widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    'operatorRuntimeSurfaceSnapshot: null',
    'operatorRuntimeSurfaceLoadedAt: null',
    'operatorRuntimeSurfaceStatus: document.getElementById("operatorRuntimeSurfaceStatus")',
    'operatorRuntimeSurfaceRefreshBtn: document.getElementById("operatorRuntimeSurfaceRefreshBtn")',
    "setOperatorRuntimeSurfaceHint",
    "resetOperatorRuntimeSurfaceWidget",
    "buildOperatorRuntimeSurfaceSnapshot",
    "renderOperatorRuntimeSurfaceWidget",
    "refreshOperatorRuntimeSurface(options = {})",
    'fetch(`${state.apiBaseUrl}/v1/runtime/surface`, {',
    'fetch(`${state.apiBaseUrl}/v1/runtime/surface/readiness`, {',
    "await refreshOperatorRuntimeSurface({ silent: true });",
    "renderOperatorRuntimeSurfaceWidget(state.operatorRuntimeSurfaceSnapshot);",
    "resetOperatorRuntimeSurfaceWidget(failedRefreshReason);",
    "refreshOperatorRuntimeSurface({ silent: true }).catch(() => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing runtime surface token: ${token}`);
  }

  assert.ok(readmeSource.includes("Runtime Surface"), "README missing Runtime Surface operator card note");
  assert.ok(
    operatorGuideSource.includes("Runtime Surface"),
    "operator guide missing Runtime Surface operator card note",
  );
});
