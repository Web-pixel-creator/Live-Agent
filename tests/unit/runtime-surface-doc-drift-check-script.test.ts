import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("runtime surface doc drift check passes against an offline snapshot artifact", () => {
  const repoRoot = process.cwd();
  const tempDir = mkdtempSync(resolve(tmpdir(), "runtime-surface-doc-drift-"));
  const snapshotPath = resolve(tempDir, "runtime-surface-snapshot.json");
  const reportPath = resolve(tempDir, "runtime-surface-doc-drift.json");
  const snapshotScriptPath = resolve(repoRoot, "scripts", "runtime-surface-snapshot.mjs");
  const docDriftScriptPath = resolve(repoRoot, "scripts", "runtime-surface-doc-drift-check.mjs");
  const manifestPath = resolve(repoRoot, "configs", "runtime-surface-manifest.json");

  const snapshotResult = spawnSync(
    process.execPath,
    ["--import", "tsx", snapshotScriptPath, "--output", snapshotPath, "--offline", "true"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  const docDriftResult = spawnSync(
    process.execPath,
    [
      docDriftScriptPath,
      "--snapshot",
      snapshotPath,
      "--manifest",
      manifestPath,
      "--readme",
      "./README.md",
      "--architecture",
      "./docs/architecture.md",
      "--operatorGuide",
      "./docs/operator-guide.md",
      "--package",
      "./package.json",
      "--output",
      reportPath,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  try {
    assert.equal(snapshotResult.status, 0, `snapshot script failed: ${snapshotResult.stderr || snapshotResult.stdout}`);
    assert.equal(
      docDriftResult.status,
      0,
      `doc drift script failed: ${docDriftResult.stderr || docDriftResult.stdout}`,
    );
    assert.ok(existsSync(reportPath), "doc drift artifact was not created");
    const artifact = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    assert.equal(artifact.ok, true);
    assert.equal(artifact.source, "repo_owned_runtime_surface_doc_drift");
    const checked = artifact.checked as Record<string, unknown>;
    assert.equal(Number(checked.packageScripts ?? 0), 3);
    assert.equal(Number(checked.readmeTokens ?? 0), 10);
    assert.equal(Number(checked.architectureTokens ?? 0), 6);
    assert.equal(Number(checked.operatorGuideTokens ?? 0), 8);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime surface doc drift check stays aligned across package, script, and docs", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scriptSource = readFileSync(
    resolve(process.cwd(), "scripts", "runtime-surface-doc-drift-check.mjs"),
    "utf8",
  );
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.equal(
    packageJson.scripts?.["runtime:surface:doc-drift"],
    "node ./scripts/runtime-surface-doc-drift-check.mjs --snapshot ./artifacts/runtime/runtime-surface-snapshot.json --manifest ./configs/runtime-surface-manifest.json --readme ./README.md --architecture ./docs/architecture.md --operatorGuide ./docs/operator-guide.md --package ./package.json --output ./artifacts/runtime/runtime-surface-doc-drift.json",
  );

  for (const token of [
    'const snapshotPath = resolve(args.snapshot ?? "artifacts/runtime/runtime-surface-snapshot.json");',
    'const manifestPath = resolve(args.manifest ?? "configs/runtime-surface-manifest.json");',
    'const packagePath = resolve(args.package ?? "package.json");',
    'const readmePath = resolve(args.readme ?? "README.md");',
    'const architecturePath = resolve(args.architecture ?? "docs/architecture.md");',
    'const operatorGuidePath = resolve(args.operatorGuide ?? "docs/operator-guide.md");',
    'source: "repo_owned_runtime_surface_doc_drift"',
    'runtime:surface:doc-drift',
    "README.md",
    "docs/architecture.md",
    "docs/operator-guide.md",
  ]) {
    assert.ok(scriptSource.includes(token), `runtime surface doc drift script missing token: ${token}`);
  }

  assert.match(readme, /npm run runtime:surface:doc-drift/);
  assert.match(readme, /artifacts\/runtime\/runtime-surface-doc-drift\.json/);
  assert.match(architecture, /runtime-surface-doc-drift-check\.mjs/);
  assert.match(operatorGuide, /Runtime surface doc drift note:/);
  assert.match(operatorGuide, /npm run runtime:surface:doc-drift/);
  assert.match(operatorGuide, /artifacts\/runtime\/runtime-surface-doc-drift\.json/);
});
