import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator startup diagnostics widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorStartupStatus"',
    'id="operatorStartupTotal"',
    'id="operatorStartupBlocking"',
    'id="operatorStartupLastType"',
    'id="operatorStartupLastService"',
    'id="operatorStartupLastCheckedAt"',
    'id="operatorStartupHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing startup widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorStartupHint",
    "resetOperatorStartupWidget",
    "renderOperatorStartupWidget",
    "startupFailures",
    "setStatusPill(el.operatorStartupStatus",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing startup widget token: ${token}`);
  }
});
