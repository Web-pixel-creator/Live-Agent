import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("judge visual evidence pack is wired across package scripts, docs, and runbook", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const visualDocPath = resolve(process.cwd(), "docs", "judge-visual-evidence.md");
  const scriptPath = resolve(process.cwd(), "scripts", "judge-visual-evidence-pack.mjs");

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const readme = readFileSync(readmePath, "utf8");
  const quickstart = readFileSync(quickstartPath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");
  const visualDoc = readFileSync(visualDocPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");

  assert.equal(
    packageJson.scripts["demo:e2e:visual-pack"],
    "node ./scripts/judge-visual-evidence-pack.mjs",
    "package script demo:e2e:visual-pack is misaligned",
  );
  assert.equal(
    packageJson.scripts["demo:e2e:visual-pack:strict"],
    "node ./scripts/judge-visual-evidence-pack.mjs --strict",
    "package script demo:e2e:visual-pack:strict is misaligned",
  );

  const requiredReadmeTokens = [
    "Judge Visual Evidence Pack: `docs/judge-visual-evidence.md`",
    "npm run demo:e2e:visual-pack",
    "npm run demo:e2e:visual-pack:strict",
    "artifacts/judge-visual-evidence/manifest.json",
    "artifacts/judge-visual-evidence/manifest.md",
  ];
  for (const token of requiredReadmeTokens) {
    assert.ok(readme.includes(token), `README missing visual evidence token: ${token}`);
  }

  const requiredQuickstartTokens = [
    "npm run demo:e2e:visual-pack",
    "artifacts/judge-visual-evidence/manifest.json",
    "artifacts/judge-visual-evidence/manifest.md",
  ];
  for (const token of requiredQuickstartTokens) {
    assert.ok(quickstart.includes(token), `judge quickstart missing visual evidence token: ${token}`);
  }

  const requiredRunbookTokens = [
    "npm run demo:e2e:visual-pack",
    "npm run demo:e2e:visual-pack:strict",
  ];
  for (const token of requiredRunbookTokens) {
    assert.ok(runbook.includes(token), `runbook missing visual evidence token: ${token}`);
  }

  const requiredVisualDocTokens = [
    "scripts/judge-visual-evidence-pack.mjs",
    "live-console-main.png",
    "operator-console-evidence.png",
    "observability-dashboard.png",
    "operatorTurnTruncation",
    "deviceNodeUpdates",
  ];
  for (const token of requiredVisualDocTokens) {
    assert.ok(visualDoc.includes(token), `judge visual evidence doc missing token: ${token}`);
  }

  const requiredScriptTokens = [
    "buildChecklist",
    "overallStatus",
    "screenshotChecklist",
    "criticalBadgeLanes",
    "deviceNodeUpdates",
    "costEstimatePresent",
    "tokensUsedPresent",
  ];
  for (const token of requiredScriptTokens) {
    assert.ok(script.includes(token), `judge visual evidence script missing token: ${token}`);
  }
});
