import test from "node:test";
import assert from "node:assert/strict";
import { buildStoryQueueMetricRecords } from "../../agents/orchestrator/src/story-queue-telemetry.js";

test("story queue telemetry emits expected base queue metrics", () => {
  const metrics = buildStoryQueueMetricRecords({
    runtime: {
      enabled: true,
      started: true,
      startedAt: "2026-02-22T00:00:00.000Z",
      concurrency: 2,
      pollMs: 120,
      maxAttempts: 3,
      backoffBaseMs: 800,
      backoffMaxMs: 20000,
    },
    queue: {
      queued: 2,
      running: 1,
      retryWaiting: 3,
      completed: 10,
      failed: 1,
      deadLetter: 1,
      backlog: 5,
      oldestQueuedAgeMs: 4200,
    },
    workers: [
      {
        workerId: "worker-1",
        activeJobId: "job-1",
        processedJobs: 12,
        failedJobs: 1,
      },
      {
        workerId: "worker-2",
        activeJobId: null,
        processedJobs: 9,
        failedJobs: 0,
      },
    ],
    quotas: [
      {
        model: "veo-3.1",
        perWindow: 2,
        windowMs: 1000,
        used: 1,
        available: 1,
      },
    ],
  });

  const byType = new Map(metrics.map((record) => [record.metricType, record]));
  assert.equal(byType.get("storyteller.media.queue.backlog")?.value, 5);
  assert.equal(byType.get("storyteller.media.queue.retry_waiting")?.value, 3);
  assert.equal(byType.get("storyteller.media.queue.dead_letter")?.value, 1);
  assert.equal(byType.get("storyteller.media.queue.oldest_age_ms")?.value, 4200);
  assert.equal(byType.get("storyteller.media.queue.worker_busy_count")?.value, 1);
  assert.equal(byType.get("storyteller.media.queue.worker_utilization_pct")?.value, 50);
});

test("story queue telemetry clamps invalid values and zero worker ratio", () => {
  const metrics = buildStoryQueueMetricRecords({
    runtime: {
      enabled: true,
      started: true,
      startedAt: "2026-02-22T00:00:00.000Z",
      concurrency: 1,
      pollMs: 120,
      maxAttempts: 3,
      backoffBaseMs: 800,
      backoffMaxMs: 20000,
    },
    queue: {
      queued: -1,
      running: Number.NaN,
      retryWaiting: -2,
      completed: 0,
      failed: -5,
      deadLetter: -8,
      backlog: -3,
      oldestQueuedAgeMs: null,
    },
    workers: [],
    quotas: [
      {
        model: "veo-3.1",
        perWindow: 0,
        windowMs: -100,
        used: -1,
        available: -2,
      },
    ],
  });

  const byType = new Map(metrics.map((record) => [record.metricType, record]));
  assert.equal(byType.get("storyteller.media.queue.backlog")?.value, 0);
  assert.equal(byType.get("storyteller.media.queue.retry_waiting")?.value, 0);
  assert.equal(byType.get("storyteller.media.queue.dead_letter")?.value, 0);
  assert.equal(byType.get("storyteller.media.queue.oldest_age_ms")?.value, 0);
  assert.equal(byType.get("storyteller.media.queue.worker_utilization_pct")?.value, 0);
});

test("story queue telemetry emits quota metrics per model with labels", () => {
  const metrics = buildStoryQueueMetricRecords({
    runtime: {
      enabled: true,
      started: true,
      startedAt: "2026-02-22T00:00:00.000Z",
      concurrency: 2,
      pollMs: 120,
      maxAttempts: 3,
      backoffBaseMs: 800,
      backoffMaxMs: 20000,
    },
    queue: {
      queued: 0,
      running: 0,
      retryWaiting: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      backlog: 0,
      oldestQueuedAgeMs: 0,
    },
    workers: [],
    quotas: [
      {
        model: "veo-3.1",
        perWindow: 4,
        windowMs: 1000,
        used: 1,
        available: 3,
      },
      {
        model: "imagen-4",
        perWindow: 2,
        windowMs: 1000,
        used: 2,
        available: 0,
      },
    ],
  });

  const quotaUtilization = metrics.filter((record) => record.metricType === "storyteller.media.quota.utilization_pct");
  const quotaAvailable = metrics.filter((record) => record.metricType === "storyteller.media.quota.available_slots");
  assert.equal(quotaUtilization.length, 2);
  assert.equal(quotaAvailable.length, 2);

  const veoUtilization = quotaUtilization.find((item) => item.labels?.model === "veo-3.1");
  const imagenUtilization = quotaUtilization.find((item) => item.labels?.model === "imagen-4");
  assert.equal(veoUtilization?.value, 25);
  assert.equal(imagenUtilization?.value, 100);

  const imagenAvailable = quotaAvailable.find((item) => item.labels?.model === "imagen-4");
  assert.equal(imagenAvailable?.value, 0);
  assert.equal(imagenAvailable?.labels?.windowMs, 1000);
});

