import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks stay aligned on assistant lifecycle KPI contract", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");

  const lifecycleTokens = ["waiting_connection", "idle", "streaming", "speaking"];
  for (const token of lifecycleTokens) {
    assert.ok(requirementsSource.includes(token), `requirements missing assistant lifecycle token: ${token}`);
  }

  const kpiToken = "assistantActivityLifecycleValidated=true";
  assert.ok(requirementsSource.includes(kpiToken), "requirements missing assistant lifecycle KPI token");
  assert.ok(designSource.includes(kpiToken), "design missing assistant lifecycle KPI token");
  assert.ok(tasksSource.includes(kpiToken), "tasks missing assistant lifecycle KPI token");
});
