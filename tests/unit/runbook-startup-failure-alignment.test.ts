import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("runbook documents non-retryable startup failure recovery flow", () => {
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const requiredRunbookTokens = [
    "Non-retryable startup failures (fail-fast):",
    "`cannot find module` / `ERR_MODULE_NOT_FOUND`",
    "`SyntaxError` / `ReferenceError` / `TypeError`",
    "`EADDRINUSE` / `address already in use`",
    "`EACCES` / `permission denied`",
    "`artifacts/demo-e2e/logs/<service>.attempt<k>.stderr.log`",
    "Operator recovery sequence:",
  ];

  for (const token of requiredRunbookTokens) {
    assert.ok(runbookSource.includes(token), `runbook missing startup-failure guidance token: ${token}`);
  }
});

test("demo-e2e script exposes startup fail-fast classification used by runbook", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "demo-e2e.ps1");
  const scriptSource = readFileSync(scriptPath, "utf8");

  const requiredScriptTokens = [
    "function Test-IsRetryableServiceStartFailure",
    '"cannot find module"',
    '"syntaxerror"',
    '"eaddrinuse"',
    '"eacces"',
    "startup failed with non-retryable diagnostics on attempt",
  ];

  for (const token of requiredScriptTokens) {
    assert.ok(scriptSource.includes(token), `demo-e2e script missing startup fail-fast token: ${token}`);
  }
});
