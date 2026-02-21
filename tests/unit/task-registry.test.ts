import test from "node:test";
import assert from "node:assert/strict";
import { TaskRegistry } from "../../apps/realtime-gateway/src/task-registry.js";

test("task registry reactivates terminal task on repeated start", () => {
  const registry = new TaskRegistry({
    completedRetentionMs: 10_000,
    maxEntries: 100,
  });

  const created = registry.startTask({
    taskId: "task-restart",
    sessionId: "session-a",
    runId: "run-a",
    intent: "conversation",
    stage: "received",
  });
  assert.equal(created.status, "queued");

  const completed = registry.updateTask(created.taskId, {
    status: "completed",
    stage: "done",
  });
  assert.ok(completed);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.progressPct, 100);

  const restarted = registry.startTask({
    taskId: created.taskId,
    sessionId: "session-b",
    runId: "run-b",
    intent: "translation",
    stage: "received-again",
  });
  assert.equal(restarted.status, "running");
  assert.equal(restarted.progressPct, 0);
  assert.equal(restarted.error, null);
  assert.equal(restarted.sessionId, "session-b");
  assert.equal(restarted.runId, "run-b");
  assert.equal(restarted.intent, "translation");
  assert.equal(restarted.stage, "received-again");
});

test("task registry listActive excludes terminal statuses and applies filters", () => {
  const registry = new TaskRegistry({
    completedRetentionMs: 10_000,
    maxEntries: 100,
  });

  const queued = registry.startTask({
    taskId: "task-queued",
    sessionId: "session-1",
    runId: "run-1",
    stage: "received",
  });
  const running = registry.startTask({
    taskId: "task-running",
    sessionId: "session-2",
    runId: "run-2",
    stage: "received",
  });
  registry.updateTask(running.taskId, {
    status: "running",
    progressPct: 40,
    stage: "orchestrator.dispatch",
  });

  const completed = registry.startTask({
    taskId: "task-completed",
    sessionId: "session-1",
    runId: "run-3",
    stage: "received",
  });
  registry.updateTask(completed.taskId, {
    status: "completed",
    stage: "done",
  });

  const activeAll = registry.listActive({ limit: 50 });
  const activeIds = new Set(activeAll.map((item) => item.taskId));
  assert.equal(activeIds.has(queued.taskId), true);
  assert.equal(activeIds.has(running.taskId), true);
  assert.equal(activeIds.has(completed.taskId), false);

  const activeSession1 = registry.listActive({
    sessionId: "session-1",
    limit: 50,
  });
  assert.equal(activeSession1.length, 1);
  assert.equal(activeSession1[0]?.taskId, queued.taskId);
});

test("task registry cancel and retry mutate lifecycle deterministically", () => {
  const registry = new TaskRegistry({
    completedRetentionMs: 10_000,
    maxEntries: 100,
  });

  const task = registry.startTask({
    taskId: "task-operator",
    sessionId: "session-operator",
    runId: "run-operator",
    stage: "received",
  });

  const cancelled = registry.cancelTask(task.taskId, "cancelled by unit test");
  assert.ok(cancelled);
  assert.equal(cancelled?.status, "failed");
  assert.equal(cancelled?.progressPct, 100);
  assert.equal(cancelled?.stage, "operator.cancelled");
  assert.equal(cancelled?.error, "cancelled by unit test");

  const retried = registry.retryTask(task.taskId);
  assert.ok(retried);
  assert.equal(retried?.status, "queued");
  assert.equal(retried?.progressPct, 0);
  assert.equal(retried?.stage, "operator.retry_requested");
  assert.equal(retried?.error, null);
});
