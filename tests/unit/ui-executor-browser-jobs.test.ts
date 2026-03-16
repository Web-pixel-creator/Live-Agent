import assert from "node:assert/strict";
import test from "node:test";
import {
  getBrowserJob,
  getBrowserJobRuntimeSnapshot,
  resetBrowserJobRuntimeForTests,
  resumeBrowserJob,
  setBrowserJobRunner,
  submitBrowserJob,
  cancelBrowserJob,
} from "../../apps/ui-executor/src/browser-jobs.ts";

async function waitForJobStatus(jobId: string, statuses: string[], timeoutMs = 4000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = getBrowserJob(jobId);
    if (job && statuses.includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for browser job ${jobId} to reach one of: ${statuses.join(", ")}`);
}

test("ui-executor browser worker pauses at checkpoint and resumes to completion", async () => {
  resetBrowserJobRuntimeForTests();
  setBrowserJobRunner(async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return {
      trace: input.actions.map((action, index) => ({
        index: index + 1,
        actionId: action.id,
        actionType: action.type,
        target: action.target,
        status: "ok",
        screenshotRef: `${input.screenshotSeed}/step-${index + 1}.png`,
        notes: "worker step ok",
      })),
      finalStatus: "completed",
      retries: 0,
      executor: "unit-browser-worker",
      adapterMode: "remote_http",
      adapterNotes: ["unit runner"],
      deviceNode: null,
    };
  });

  const job = submitBrowserJob({
    sessionId: "session-browser-worker",
    runId: "run-browser-worker",
    actions: [
      { id: "step-1", type: "navigate", target: "https://example.com" },
      { id: "step-2", type: "click", target: "button:submit" },
      { id: "step-3", type: "verify", target: "done" },
    ],
    checkpointEverySteps: 2,
    sandbox: {
      mode: "enforce",
      decision: "allow",
      violations: [],
      warnings: [],
      setupMarkerStatus: "ready",
    },
  });

  const paused = await waitForJobStatus(job.jobId, ["paused"]);
  assert.equal(paused.executedSteps, 2);
  assert.equal(paused.totalSteps, 3);
  assert.equal(paused.checkpoints.length, 1);
  assert.equal(paused.checkpoints[0]?.status, "ready");
  assert.equal(getBrowserJobRuntimeSnapshot().queue.paused, 1);

  const resumed = resumeBrowserJob(job.jobId, "unit resume");
  assert.ok(resumed);
  assert.equal(resumed?.status, "queued");

  const completed = await waitForJobStatus(job.jobId, ["completed"]);
  assert.equal(completed.executedSteps, 3);
  assert.equal(completed.status, "completed");
  assert.equal(completed.checkpoints[0]?.status, "resumed");
  assert.equal(completed.trace.length >= 3, true);
});

test("ui-executor browser worker cancel stops an active job deterministically", async () => {
  resetBrowserJobRuntimeForTests();
  setBrowserJobRunner(async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      trace: input.actions.map((action, index) => ({
        index: index + 1,
        actionId: action.id,
        actionType: action.type,
        target: action.target,
        status: "ok",
        screenshotRef: `${input.screenshotSeed}/step-${index + 1}.png`,
        notes: "worker step ok",
      })),
      finalStatus: "completed",
      retries: 0,
      executor: "unit-browser-worker",
      adapterMode: "remote_http",
      adapterNotes: ["unit runner"],
      deviceNode: null,
    };
  });

  const job = submitBrowserJob({
    sessionId: "session-browser-cancel",
    runId: "run-browser-cancel",
    actions: [
      { id: "step-1", type: "navigate", target: "https://example.com" },
      { id: "step-2", type: "verify", target: "done" },
    ],
  });

  await waitForJobStatus(job.jobId, ["running", "queued"]);
  const cancelled = cancelBrowserJob(job.jobId, "cancelled by unit test");
  assert.ok(cancelled);
  assert.equal(cancelled?.status, "cancelled");
  assert.match(String(cancelled?.error ?? ""), /cancelled by unit test/i);
  const final = await waitForJobStatus(job.jobId, ["cancelled"]);
  assert.equal(final.status, "cancelled");
});

