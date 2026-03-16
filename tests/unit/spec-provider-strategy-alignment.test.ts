import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("requirements/design/tasks stay aligned on secondary provider adapter roadmap", () => {
  const requirementsPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "requirements.md");
  const designPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "design.md");
  const tasksPath = resolve(process.cwd(), ".kiro", "specs", "multimodal-agents", "tasks.md");

  const requirementsSource = readFileSync(requirementsPath, "utf8");
  const designSource = readFileSync(designPath, "utf8");
  const tasksSource = readFileSync(tasksPath, "utf8");

  const sharedTokens = ["Deepgram Aura-2", "fal-ai/nano-banana-2/edit", "Perplexity Sonar"];
  for (const token of sharedTokens) {
    assert.ok(requirementsSource.includes(token), `requirements missing provider roadmap token: ${token}`);
    assert.ok(designSource.includes(token), `design missing provider roadmap token: ${token}`);
    assert.ok(tasksSource.includes(token), `tasks missing provider roadmap token: ${token}`);
  }

  assert.ok(requirementsSource.includes("`image_edit`"), "requirements missing image_edit capability token");
  assert.ok(requirementsSource.includes("`research`"), "requirements missing research capability token");
  assert.ok(
    designSource.includes("2026 External Provider Surface Map (Gemini-First, Adapter-Ready)"),
    "design missing provider surface map section",
  );

  const designAndTasksTokens = ["GPT-5.4", "Claude 4 family", "DeepSeek V3.1", "Kimi", "Manus"];
  for (const token of designAndTasksTokens) {
    assert.ok(designSource.includes(token), `design missing provider token: ${token}`);
    assert.ok(tasksSource.includes(token), `tasks missing provider token: ${token}`);
  }

  for (const token of ["OpenClaw", "Voicebox", "pi-vs-claude-code"]) {
    assert.ok(designSource.includes(token), `design missing cloned-source token: ${token}`);
  }

  for (const token of ["T-239", "T-240", "T-241", "T-242", "T-243", "T-244", "T-245"]) {
    assert.ok(tasksSource.includes(token), `tasks missing provider roadmap task: ${token}`);
  }
});
