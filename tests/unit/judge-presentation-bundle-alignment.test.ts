import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("judge presentation bundle script is wired across package scripts and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const visualDocPath = resolve(process.cwd(), "docs", "judge-visual-evidence.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const scriptPath = resolve(process.cwd(), "scripts", "judge-presentation-bundle.mjs");

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  const readme = readFileSync(readmePath, "utf8");
  const visualDoc = readFileSync(visualDocPath, "utf8");
  const quickstart = readFileSync(quickstartPath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");

  assert.equal(
    pkg.scripts?.["demo:e2e:visual:bundle"],
    "node ./scripts/judge-presentation-bundle.mjs",
    "package script demo:e2e:visual:bundle is misaligned",
  );
  assert.equal(
    pkg.scripts?.["demo:e2e:visual:judge"],
    "npm run demo:e2e:visual:present && npm run demo:e2e:visual:bundle",
    "package script demo:e2e:visual:judge is misaligned",
  );

  const docTokens = [
    "npm run demo:e2e:visual:bundle",
    "npm run demo:e2e:visual:judge",
    "presentation.md",
  ];
  for (const token of docTokens) {
    assert.ok(readme.includes(token), `README missing presentation token: ${token}`);
    assert.ok(visualDoc.includes(token), `judge visual evidence doc missing presentation token: ${token}`);
  }
  assert.ok(
    quickstart.includes("npm run demo:e2e:visual:bundle"),
    "judge quickstart missing visual bundle command",
  );
  assert.ok(runbook.includes("npm run demo:e2e:visual:bundle"), "runbook missing visual bundle command");
  assert.ok(runbook.includes("npm run demo:e2e:visual:judge"), "runbook missing visual judge command");

  const scriptTokens = [
    "Judge Presentation Bundle",
    "Challenge Category Coverage",
    "Critical Evidence Lanes",
    "release-evidence/report.json",
    "manifest.json",
    "gallery.md",
    "deviceNodeUpdates",
  ];
  for (const token of scriptTokens) {
    assert.ok(script.includes(token), `judge presentation script missing token: ${token}`);
  }
});
