import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("readme exposes judge quick path and quickstart doc link", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const source = readFileSync(readmePath, "utf8");

  const requiredTokens = [
    "Judge Quickstart: `docs/judge-quickstart.md`",
    "## Judge Quick Path",
    "npm run demo:e2e:fast && npm run demo:e2e:policy",
    "artifacts/demo-e2e/badge-details.json",
  ];
  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `README missing judge quick path token: ${token}`);
  }
});

test("judge quickstart document includes core judge commands and categories", () => {
  const quickstartPath = resolve(process.cwd(), "docs", "judge-quickstart.md");
  const source = readFileSync(quickstartPath, "utf8");

  const requiredTokens = [
    "Live Agent",
    "Creative Storyteller",
    "UI Navigator",
    "npm run demo:e2e:fast",
    "npm run demo:e2e:policy",
    "npm run demo:e2e:badge",
    "npm run verify:release",
    "Export Session Markdown",
    "Export Session JSON",
    "docs/challenge-demo-runbook.md",
  ];
  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `judge quickstart missing token: ${token}`);
  }
});

test("judge runbook alias includes quickstart in reading order", () => {
  const aliasPath = resolve(process.cwd(), "docs", "judge-runbook.md");
  const source = readFileSync(aliasPath, "utf8");

  assert.match(source, /docs\/judge-quickstart\.md/);
  assert.match(source, /docs\/challenge-demo-runbook\.md/);
});

