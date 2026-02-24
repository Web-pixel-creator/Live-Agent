import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks stay aligned on operator startup diagnostics contract", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");

  const sharedTokens = ["startupFailures", "operatorStartupDiagnosticsValidated=true"];
  for (const token of sharedTokens) {
    assert.ok(requirementsSource.includes(token), `requirements missing startup diagnostics token: ${token}`);
    assert.ok(designSource.includes(token), `design missing startup diagnostics token: ${token}`);
    assert.ok(tasksSource.includes(token), `tasks missing startup diagnostics token: ${token}`);
  }

  assert.ok(
    designSource.includes("operatorStartupFailuresStatus in {healthy,degraded,critical}"),
    "design missing startup status contract token",
  );
  assert.ok(tasksSource.includes("Startup Failures"), "tasks missing operator startup widget token");
});
