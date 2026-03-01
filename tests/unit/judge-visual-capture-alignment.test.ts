import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("judge visual capture script is wired across package scripts and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const visualDocPath = resolve(process.cwd(), "docs", "judge-visual-evidence.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const scriptPath = resolve(process.cwd(), "scripts", "judge-visual-capture.mjs");

  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const readme = readFileSync(readmePath, "utf8");
  const visualDoc = readFileSync(visualDocPath, "utf8");
  const quickstart = readFileSync(quickstartPath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");

  assert.equal(
    pkg.scripts["demo:e2e:visual-capture"],
    "node ./scripts/judge-visual-capture.mjs",
    "package script demo:e2e:visual-capture is misaligned",
  );
  assert.equal(
    pkg.scripts["demo:e2e:visual:auto"],
    "npm run demo:e2e:visual-capture && npm run demo:e2e:visual-pack:strict",
    "package script demo:e2e:visual:auto is misaligned",
  );

  const requiredReadmeTokens = ["npm run demo:e2e:visual-capture", "npm run demo:e2e:visual:auto"];
  for (const token of requiredReadmeTokens) {
    assert.ok(readme.includes(token), `README missing visual capture token: ${token}`);
  }
  assert.ok(readme.includes("--mockAll"), "README missing mockAll capture fallback token");

  const requiredVisualDocTokens = [
    "scripts/judge-visual-capture.mjs",
    "npm run demo:e2e:visual-capture",
    "npm run demo:e2e:visual:auto",
    "--mockAll",
    "_capture-manifest.json",
  ];
  for (const token of requiredVisualDocTokens) {
    assert.ok(visualDoc.includes(token), `judge visual evidence doc missing capture token: ${token}`);
  }

  assert.ok(
    quickstart.includes("npm run demo:e2e:visual-capture"),
    "judge quickstart missing visual-capture command",
  );
  assert.ok(runbook.includes("npm run demo:e2e:visual-capture"), "runbook missing visual-capture command");
  assert.ok(runbook.includes("npm run demo:e2e:visual:auto"), "runbook missing visual:auto command");
  assert.ok(runbook.includes("--mockAll"), "runbook missing mockAll capture fallback command");

  const requiredScriptTokens = [
    "observabilityMockHtml",
    "approval-flow-pending.png",
    "approval-flow-approved.png",
    "observability-dashboard.png",
    "observability-alert-gateway-latency.png",
    "observability-alert-service-error-rate.png",
    "observability-alert-orchestrator-persistence.png",
    "_capture-manifest.json",
    "fullMockHtml",
    "options.mockAll",
  ];
  for (const token of requiredScriptTokens) {
    assert.ok(script.includes(token), `judge visual capture script missing token: ${token}`);
  }
});
