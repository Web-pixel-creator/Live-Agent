import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes runtime surface inventory and readiness routes", () => {
  const sourcePath = resolve(process.cwd(), "apps", "api-backend", "src", "index.ts");
  const inventoryPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-surface-inventory.ts");
  const readinessPath = resolve(process.cwd(), "apps", "api-backend", "src", "runtime-surface-readiness.ts");
  const source = readFileSync(sourcePath, "utf8");
  const inventory = readFileSync(inventoryPath, "utf8");
  const readiness = readFileSync(readinessPath, "utf8");

  for (const token of [
    "/v1/runtime/surface",
    "/v1/runtime/surface/readiness",
    "buildRuntimeSurfaceInventorySnapshot",
    "buildRuntimeSurfaceReadinessSnapshot",
    'source: "repo_owned_runtime_surface_inventory"',
    'source: "repo_owned_runtime_surface_readiness"',
    "const runtimeSurface = await buildRuntimeSurfaceInventorySnapshot({",
    "const runtimeSurfaceReadiness = await buildRuntimeSurfaceReadinessSnapshot({",
  ]) {
    assert.ok(source.includes(token), `runtime surface API missing token: ${token}`);
  }

  for (const token of [
    "RUNTIME_SURFACE_AGENT_SPECS",
    "RUNTIME_SURFACE_ROUTE_SPECS",
    "RUNTIME_SURFACE_CONTROL_PLANE_SPECS",
    "RUNTIME_SURFACE_EVIDENCE_SPECS",
    "RUNTIME_SURFACE_UI_CAPABILITIES",
    'path: "/v1/runtime/surface"',
    'path: "/v1/runtime/surface/readiness"',
    'label: "Runtime surface inventory"',
    'label: "Runtime surface readiness"',
  ]) {
    assert.ok(inventory.includes(token), `runtime surface inventory helper missing token: ${token}`);
  }

  for (const token of [
    'source: "repo_owned_runtime_surface_readiness"',
    "buildRuntimeBootstrapDoctorSnapshot",
    "buildRuntimeDiagnosticsSummary",
    "safeToRun:",
    "degradedReasons,",
    "inventorySummary:",
  ]) {
    assert.ok(readiness.includes(token), `runtime surface readiness helper missing token: ${token}`);
  }
});

test("runtime surface docs stay aligned with inventory and readiness routes", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(
    resolve(process.cwd(), "docs", "operator-guide.md"),
    "utf8",
  );
  const architecture = readFileSync(
    resolve(process.cwd(), "docs", "architecture.md"),
    "utf8",
  );

  assert.match(readme, /GET \/v1\/runtime\/surface/);
  assert.match(readme, /GET \/v1\/runtime\/surface\/readiness/);
  assert.match(readme, /Runtime surface inventory/i);
  assert.match(readme, /Runtime surface readiness/i);
  assert.match(operatorGuide, /runtime surface inventory/i);
  assert.match(operatorGuide, /runtime surface readiness/i);
  assert.match(architecture, /runtime surface/i);
});
