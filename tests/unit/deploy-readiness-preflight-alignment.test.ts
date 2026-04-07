import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("deploy readiness preflight is wired across package, script, and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const packageRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:deploy:readiness"] ?? "";
  assert.match(alias, /deploy-readiness-preflight\.ps1/);

  const scriptPath = resolve(process.cwd(), "scripts", "deploy-readiness-preflight.ps1");
  const scriptRaw = readFileSync(scriptPath, "utf8");
  assert.match(scriptRaw, /\[switch\]\$Strict/);
  assert.match(scriptRaw, /\[switch\]\$SkipRailwayAuthProbe/);
  assert.match(scriptRaw, /\[switch\]\$SkipGitHubAuthProbe/);
  assert.match(scriptRaw, /railway whoami/);
  assert.match(scriptRaw, /gh auth status/);
  assert.match(scriptRaw, /RAILWAY_API_TOKEN/);
  assert.match(scriptRaw, /RAILWAY_PROJECT_TOKEN/);
  assert.match(scriptRaw, /GITHUB_TOKEN/);
  assert.match(scriptRaw, /deploy-readiness-preflight\.json/);
  assert.match(scriptRaw, /function Redact-SensitiveOutput/);
  assert.match(scriptRaw, /github_pat_\*\*\*REDACTED\*\*\*/);
  assert.match(scriptRaw, /status = \$status/);
  assert.match(scriptRaw, /strictStatus = \$strictStatus/);

  const readmePath = resolve(process.cwd(), "README.md");
  const readme = readFileSync(readmePath, "utf8");
  assert.match(readme, /npm run verify:deploy:readiness/);
  assert.match(readme, /deploy-readiness-preflight\.json/);

  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbook = readFileSync(runbookPath, "utf8");
  assert.match(runbook, /npm run verify:deploy:readiness/);
});

test("deploy readiness preflight supports report-only smoke without live auth probes", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "deploy-readiness-preflight.ps1");
  const outputDir = mkdtempSync(join(tmpdir(), "deploy-readiness-preflight-"));
  const outputPath = join(outputDir, "preflight.json");

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-SkipRailwayAuthProbe",
      "-SkipGitHubAuthProbe",
      "-OutputPath",
      outputPath,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, `preflight smoke failed: ${result.stderr}\n${result.stdout}`);
  const raw = readFileSync(outputPath, "utf8").replace(/^\uFEFF/, "");
  const summary = JSON.parse(raw) as {
    schemaVersion?: number;
    status?: string;
    strict?: boolean;
    checks?: Array<{ id?: string; status?: string }>;
    auth?: {
      railway?: { probe?: { skipped?: boolean } };
      github?: { probe?: { skipped?: boolean } };
    };
  };

  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.strict, false);
  assert.ok(summary.status === "ready" || summary.status === "ready_with_warnings" || summary.status === "blocked");
  assert.equal(summary.auth?.railway?.probe?.skipped, true);
  assert.equal(summary.auth?.github?.probe?.skipped, true);
  assert.ok(summary.checks?.some((check) => check.id === "railway_cli"));
  assert.ok(summary.checks?.some((check) => check.id === "github_cli"));
});
