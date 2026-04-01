import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("runtime surface snapshot script writes an offline artifact", () => {
  const repoRoot = process.cwd();
  const tempDir = mkdtempSync(resolve(tmpdir(), "runtime-surface-"));
  const outputPath = resolve(tempDir, "runtime-surface-snapshot.json");
  const scriptPath = resolve(repoRoot, "scripts", "runtime-surface-snapshot.mjs");

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", scriptPath, "--output", outputPath, "--offline", "true"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  try {
    assert.equal(result.status, 0, `snapshot script failed: ${result.stderr || result.stdout}`);
    assert.ok(existsSync(outputPath), "snapshot artifact was not created");
    const artifact = JSON.parse(readFileSync(outputPath, "utf8")) as Record<string, unknown>;
    assert.equal(artifact.source, "repo_owned_runtime_surface_snapshot");
    assert.equal(artifact.mode, "offline");
    assert.ok(typeof artifact.generatedAt === "string" && String(artifact.generatedAt).length > 0);
    assert.ok(typeof artifact.outputPath === "string" && String(artifact.outputPath).endsWith("runtime-surface-snapshot.json"));

    const inventory = artifact.inventory as Record<string, unknown>;
    const readiness = artifact.readiness as Record<string, unknown>;
    assert.equal(inventory.source, "repo_owned_runtime_surface_inventory");
    assert.equal(readiness.source, "repo_owned_runtime_surface_readiness");
    assert.ok(typeof readiness.status === "string" && String(readiness.status).length > 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime surface snapshot script stays aligned across package and docs", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const scriptSource = readFileSync(resolve(process.cwd(), "scripts", "runtime-surface-snapshot.mjs"), "utf8");

  assert.equal(
    packageJson.scripts?.["runtime:surface:snapshot"],
    "node --import tsx ./scripts/runtime-surface-snapshot.mjs --output ./artifacts/runtime/runtime-surface-snapshot.json",
  );

  for (const token of [
    'source: "repo_owned_runtime_surface_snapshot"',
    'mode: offline ? "offline" : "live"',
    'buildRuntimeSurfaceInventorySnapshot',
    'buildRuntimeSurfaceReadinessSnapshot',
    "artifacts/runtime/runtime-surface-snapshot.json",
  ]) {
    assert.ok(scriptSource.includes(token), `runtime surface snapshot script missing token: ${token}`);
  }

  assert.match(readme, /npm run runtime:surface:snapshot/);
  assert.match(readme, /artifacts\/runtime\/runtime-surface-snapshot\.json/);
  assert.match(readme, /offline true/);
  assert.match(architecture, /runtime-surface-snapshot\.mjs/);
  assert.match(architecture, /artifacts\/runtime\/runtime-surface-snapshot\.json/);
  assert.match(operatorGuide, /npm run runtime:surface:snapshot/);
  assert.match(operatorGuide, /artifacts\/runtime\/runtime-surface-snapshot\.json/);
});
