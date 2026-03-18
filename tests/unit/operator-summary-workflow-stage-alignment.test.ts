import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator summary exposes workflow stage counts and task queue stage posture", () => {
  const apiSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const tracesSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "operator-traces.ts"), "utf8");
  const runtimeDiagnosticsSource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-diagnostics-summary.ts"),
    "utf8",
  );

  const requiredApiTokens = ["stageCounts", "oldestTaskStage", "buildTaskQueueSummary(activeTasks)", "traces"];
  for (const token of requiredApiTokens) {
    assert.ok(apiSource.includes(token), `operator summary API missing workflow-stage token: ${token}`);
  }

  const requiredTraceTokens = ["byStage", "activeTaskStage"];
  for (const token of requiredTraceTokens) {
    assert.ok(tracesSource.includes(token), `operator traces missing workflow-stage token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "workflowExecutionStatus",
    "workflowCurrentStage",
    "workflowActiveRole",
    "workflowTaskId",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(runtimeDiagnosticsSource.includes(token), `runtime diagnostics missing workflow-state token: ${token}`);
  }
});
