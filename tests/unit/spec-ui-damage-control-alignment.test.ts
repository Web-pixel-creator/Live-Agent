import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks stay aligned on UI damage-control KPI contract", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");

  const sharedToken = "damageControlDiagnosticsValidated=true";
  assert.ok(requirementsSource.includes(sharedToken), "requirements missing UI damage-control KPI token");
  assert.ok(designSource.includes(sharedToken), "design missing UI damage-control KPI token");
  assert.ok(tasksSource.includes(sharedToken), "tasks missing UI damage-control KPI token");

  assert.ok(
    requirementsSource.includes("rule-driven damage-control policy layer"),
    "requirements missing damage-control policy layer acceptance criteria",
  );
  assert.ok(designSource.includes("Rule-driven damage-control policy layer"), "design missing damage-control section");
  assert.ok(tasksSource.includes("T-238"), "tasks missing T-238 damage-control work item");
});

