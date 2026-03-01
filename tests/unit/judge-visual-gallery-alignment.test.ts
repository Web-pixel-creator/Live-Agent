import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("judge visual gallery script is wired across package scripts and docs", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const visualDocPath = resolve(process.cwd(), "docs", "judge-visual-evidence.md");
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const scriptPath = resolve(process.cwd(), "scripts", "judge-visual-gallery.mjs");

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  const readme = readFileSync(readmePath, "utf8");
  const visualDoc = readFileSync(visualDocPath, "utf8");
  const quickstart = readFileSync(quickstartPath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");

  assert.equal(
    pkg.scripts?.["demo:e2e:visual:gallery"],
    "node ./scripts/judge-visual-gallery.mjs",
    "package script demo:e2e:visual:gallery is misaligned",
  );
  assert.equal(
    pkg.scripts?.["demo:e2e:visual:present"],
    "npm run demo:e2e:visual:auto && npm run demo:e2e:visual:gallery",
    "package script demo:e2e:visual:present is misaligned",
  );

  const readmeTokens = ["npm run demo:e2e:visual:gallery", "npm run demo:e2e:visual:present", "gallery.md"];
  for (const token of readmeTokens) {
    assert.ok(readme.includes(token), `README missing visual gallery token: ${token}`);
  }

  const visualDocTokens = ["npm run demo:e2e:visual:gallery", "npm run demo:e2e:visual:present", "gallery.md"];
  for (const token of visualDocTokens) {
    assert.ok(visualDoc.includes(token), `judge visual evidence doc missing gallery token: ${token}`);
  }

  assert.ok(
    quickstart.includes("npm run demo:e2e:visual:gallery"),
    "judge quickstart missing visual-gallery command",
  );
  assert.ok(runbook.includes("npm run demo:e2e:visual:gallery"), "runbook missing visual-gallery command");
  assert.ok(runbook.includes("npm run demo:e2e:visual:present"), "runbook missing visual-present command");

  const requiredScriptTokens = [
    "Judge Visual Gallery",
    "_capture-manifest.json",
    "manifest.json",
    "deviceNodeUpdates",
    "operatorTurnTruncation",
    "Screenshot Gallery",
  ];
  for (const token of requiredScriptTokens) {
    assert.ok(script.includes(token), `judge visual gallery script missing token: ${token}`);
  }
});
