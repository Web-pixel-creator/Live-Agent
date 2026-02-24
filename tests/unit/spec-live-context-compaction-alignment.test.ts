import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks stay aligned on live context compaction KPI contract", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");

  const sharedToken = "liveContextCompactionValidated=true";
  assert.ok(
    requirementsSource.includes(sharedToken),
    "requirements missing live context compaction KPI contract token",
  );
  assert.ok(designSource.includes(sharedToken), "design missing live context compaction KPI contract token");
  assert.ok(tasksSource.includes(sharedToken), "tasks missing live context compaction KPI contract token");

  assert.ok(
    requirementsSource.includes("automatic context compaction"),
    "requirements missing automatic context compaction acceptance criteria",
  );
  assert.ok(
    tasksSource.includes("Live Agent context compaction runtime"),
    "tasks missing T-217 context compaction scope",
  );
});
