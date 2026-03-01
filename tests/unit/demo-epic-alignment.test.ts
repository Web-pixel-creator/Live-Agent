import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo:epic script is wired across package and judge docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const visualDocPath = resolve(process.cwd(), "docs", "judge-visual-evidence.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const scriptPath = resolve(process.cwd(), "scripts", "demo-epic.mjs");

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  const readme = readFileSync(readmePath, "utf8");
  const quickstart = readFileSync(quickstartPath, "utf8");
  const visualDoc = readFileSync(visualDocPath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");

  assert.equal(pkg.scripts?.["demo:epic"], "node ./scripts/demo-epic.mjs");

  for (const token of ["npm run demo:epic", "artifacts/demo-e2e/epic-summary.json"]) {
    assert.ok(readme.includes(token), `README missing demo:epic token: ${token}`);
    assert.ok(quickstart.includes(token), `judge quickstart missing demo:epic token: ${token}`);
    assert.ok(visualDoc.includes(token), `judge visual evidence doc missing demo:epic token: ${token}`);
  }
  assert.ok(runbook.includes("npm run demo:epic"), "runbook missing demo:epic command");

  const scriptTokens = [
    "demo:e2e:fast",
    "demo:e2e:policy",
    "demo:e2e:badge",
    "demo:e2e:visual:judge",
    "policy-check.json",
    "badge-details.json",
    "deviceNodeUpdates",
    "epic-summary.json",
  ];
  for (const token of scriptTokens) {
    assert.ok(script.includes(token), `demo-epic script missing token: ${token}`);
  }
});
