import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("runtime surface parity check passes against an offline snapshot artifact", () => {
  const repoRoot = process.cwd();
  const tempDir = mkdtempSync(resolve(tmpdir(), "runtime-surface-parity-"));
  const snapshotPath = resolve(tempDir, "runtime-surface-snapshot.json");
  const parityPath = resolve(tempDir, "runtime-surface-parity.json");
  const snapshotScriptPath = resolve(repoRoot, "scripts", "runtime-surface-snapshot.mjs");
  const parityScriptPath = resolve(repoRoot, "scripts", "runtime-surface-parity-check.mjs");
  const manifestPath = resolve(repoRoot, "configs", "runtime-surface-manifest.json");

  const snapshotResult = spawnSync(
    process.execPath,
    ["--import", "tsx", snapshotScriptPath, "--output", snapshotPath, "--offline", "true"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  const parityResult = spawnSync(
    process.execPath,
    [parityScriptPath, "--snapshot", snapshotPath, "--manifest", manifestPath, "--output", parityPath],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  try {
    assert.equal(snapshotResult.status, 0, `snapshot script failed: ${snapshotResult.stderr || snapshotResult.stdout}`);
    assert.equal(parityResult.status, 0, `parity script failed: ${parityResult.stderr || parityResult.stdout}`);
    assert.ok(existsSync(parityPath), "parity artifact was not created");
    const artifact = JSON.parse(readFileSync(parityPath, "utf8")) as Record<string, unknown>;
    assert.equal(artifact.ok, true);
    const checked = artifact.checked as Record<string, unknown>;
    assert.equal(Number(checked.agents ?? 0), 3);
    assert.equal(Number(checked.routes ?? 0), 6);
    assert.equal(Number(checked.uiCapabilities ?? 0), 4);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime surface parity check stays aligned across package, script, manifest, and docs", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const manifestSource = readFileSync(
    resolve(process.cwd(), "configs", "runtime-surface-manifest.json"),
    "utf8",
  );
  const scriptSource = readFileSync(
    resolve(process.cwd(), "scripts", "runtime-surface-parity-check.mjs"),
    "utf8",
  );
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.equal(
    packageJson.scripts?.["runtime:surface:parity"],
    "node ./scripts/runtime-surface-parity-check.mjs --snapshot ./artifacts/runtime/runtime-surface-snapshot.json --manifest ./configs/runtime-surface-manifest.json --output ./artifacts/runtime/runtime-surface-parity.json",
  );

  for (const token of [
    '"source": "repo_owned_runtime_surface_manifest"',
    '"requiredAgentIds"',
    '"requiredRouteIntents"',
    '"requiredControlPlaneIds"',
    '"runtime-session-replay"',
    '"requiredEvidenceIds"',
    '"requiredUiCapabilityIds"',
    '"requiredReadyPlaybookIds"',
    '"totalControlPlaneSurfaces": 16',
    '"minimumPlaybooks": 18',
  ]) {
    assert.ok(manifestSource.includes(token), `runtime surface manifest missing token: ${token}`);
  }

  for (const token of [
    'const snapshotPath = resolve(args.snapshot ?? "artifacts/runtime/runtime-surface-snapshot.json");',
    'const manifestPath = resolve(args.manifest ?? "configs/runtime-surface-manifest.json");',
    'source !== "repo_owned_runtime_surface_snapshot"',
    'source !== "repo_owned_runtime_surface_manifest"',
    "requiredControlPlaneIds",
    "requiredReadyPlaybookIds",
    '"totalControlPlaneSurfaces"',
    '"totalUiCapabilities"',
  ]) {
    assert.ok(scriptSource.includes(token), `runtime surface parity script missing token: ${token}`);
  }

  assert.match(readme, /npm run runtime:surface:parity/);
  assert.match(readme, /configs\/runtime-surface-manifest\.json/);
  assert.match(readme, /artifacts\/runtime\/runtime-surface-parity\.json/);
  assert.match(architecture, /runtime-surface-parity-check\.mjs/);
  assert.match(architecture, /configs\/runtime-surface-manifest\.json/);
  assert.match(operatorGuide, /npm run runtime:surface:parity/);
  assert.match(operatorGuide, /required ready playbooks/i);
});
