import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("ui-executor sandbox env knobs stay documented in README and env example", () => {
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const envExampleSource = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const uiExecutorSource = readFileSync(resolve(process.cwd(), "apps", "ui-executor", "src", "index.ts"), "utf8");

  const requiredTokens = [
    "UI_EXECUTOR_SANDBOX_MODE",
    "UI_EXECUTOR_SANDBOX_NETWORK_POLICY",
    "UI_EXECUTOR_SANDBOX_ALLOWED_ORIGINS",
    "UI_EXECUTOR_SANDBOX_ALLOWED_READ_ROOTS",
    "UI_EXECUTOR_SANDBOX_ALLOWED_WRITE_ROOTS",
    "UI_EXECUTOR_SANDBOX_SETUP_MARKER_PATH",
    "UI_EXECUTOR_SANDBOX_SETUP_MARKER_VERSION",
  ];

  for (const token of requiredTokens) {
    assert.ok(readmeSource.includes(token), `README is missing sandbox env token: ${token}`);
    assert.ok(envExampleSource.includes(token), `.env.example is missing sandbox env token: ${token}`);
  }

  assert.ok(uiExecutorSource.includes("UI_EXECUTOR_SANDBOX_POLICY_BLOCKED"));
  assert.ok(uiExecutorSource.includes("sandboxPolicyRuntimeSnapshot"));
});
