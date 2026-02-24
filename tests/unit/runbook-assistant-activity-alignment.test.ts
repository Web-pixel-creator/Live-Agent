import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("runbook documents assistant status lifecycle checkpoints", () => {
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const requiredTokens = [
    "`Assistant` status pill lifecycle",
    "`waiting_connection`",
    "`idle`",
    "`streaming`/`speaking`",
  ];

  for (const token of requiredTokens) {
    assert.ok(runbookSource.includes(token), `runbook missing assistant status token: ${token}`);
  }
});

test("demo frontend keeps assistant status indicator wired in UI and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  assert.ok(
    htmlSource.includes('id="assistantStreamStatus"'),
    "demo frontend is missing assistantStreamStatus element",
  );
  assert.ok(
    appSource.includes("resolveAssistantActivityStatus"),
    "app.js is missing assistant activity status resolver wiring",
  );
  assert.ok(
    appSource.includes("renderAssistantActivityStatus"),
    "app.js is missing assistant activity status render function",
  );
  assert.ok(
    appSource.includes("setStatusPill(el.assistantStreamStatus"),
    "app.js is missing assistant status pill rendering path",
  );
});
