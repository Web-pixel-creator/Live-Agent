import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway deploy helper uses clean worktree and orchestrator-specific manifest template", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "railway-deploy.ps1");
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /function Resolve-ServiceNameFromStatus\(/);
  assert.match(script, /function Resolve-RailwayServiceManifestTemplatePath\(/);
  assert.match(script, /function New-RailwayDeployWorkspace\(/);
  assert.match(script, /function Remove-RailwayDeployWorkspace\(/);
  assert.match(script, /git @gitArgs 2>&1/);
  assert.match(script, /worktree", "add", "--detach"/);
  assert.match(script, /"Live-Agent-Orchestrator"/);
  assert.match(script, /infra\\railway\\manifests\\orchestrator\.railway\.json/);
  assert.match(script, /Applied service-specific Railway manifest template/);
  assert.match(script, /Using repository root Railway manifest in clean deploy worktree/);
});

test("orchestrator railway manifest template pins the orchestrator start command", () => {
  const manifestPath = resolve(process.cwd(), "infra", "railway", "manifests", "orchestrator.railway.json");
  const manifestRaw = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as {
    build?: { buildCommand?: string; builder?: string };
    deploy?: { startCommand?: string; healthcheckPath?: string; healthcheckTimeout?: number };
  };

  assert.equal(manifest.build?.builder, "RAILPACK");
  assert.equal(manifest.build?.buildCommand, "npm run build");
  assert.equal(manifest.deploy?.startCommand, "node --import tsx agents/orchestrator/src/index.ts");
  assert.equal(manifest.deploy?.healthcheckPath, "/healthz");
  assert.equal(manifest.deploy?.healthcheckTimeout, 120);
});

test("docs mention clean Railway deploy worktree and orchestrator manifest override", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /temporary clean git worktree/i);
  assert.match(readme, /Live-Agent-Orchestrator/);
  assert.match(readme, /infra\/railway\/manifests\/orchestrator\.railway\.json/);

  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbook = readFileSync(runbookPath, "utf8");
  assert.match(runbook, /clean temporary git worktree/i);
  assert.match(runbook, /infra\/railway\/manifests\/orchestrator\.railway\.json/);
});
