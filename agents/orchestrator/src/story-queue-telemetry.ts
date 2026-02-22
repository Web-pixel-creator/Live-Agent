import type { getMediaJobQueueSnapshot } from "@mla/storyteller-agent";

type StoryMediaWorkerSnapshot = ReturnType<typeof getMediaJobQueueSnapshot>;

export type StoryQueueMetricRecord = {
  metricType: string;
  value: number;
  unit: string;
  labels?: Record<string, string | number | boolean>;
};

function clampNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function round(value: number, digits = 3): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function safeRatioPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return round((numerator / denominator) * 100, 2);
}

export function buildStoryQueueMetricRecords(snapshot: StoryMediaWorkerSnapshot): StoryQueueMetricRecord[] {
  const queue = snapshot.queue;
  const workers = snapshot.workers;
  const quotas = snapshot.quotas;

  const backlog = clampNonNegativeNumber(queue.backlog);
  const retryWaiting = clampNonNegativeNumber(queue.retryWaiting);
  const deadLetter = clampNonNegativeNumber(queue.deadLetter);
  const running = clampNonNegativeNumber(queue.running);
  const failed = clampNonNegativeNumber(queue.failed);
  const oldestQueuedAgeMs = clampNonNegativeNumber(queue.oldestQueuedAgeMs ?? 0);

  const workerCount = workers.length;
  const busyWorkers = workers.filter((worker) => typeof worker.activeJobId === "string" && worker.activeJobId.length > 0).length;
  const workerBusyRatioPct = safeRatioPercent(busyWorkers, workerCount);

  const records: StoryQueueMetricRecord[] = [
    {
      metricType: "storyteller.media.queue.backlog",
      value: backlog,
      unit: "1",
      labels: {
        signal: "backlog",
      },
    },
    {
      metricType: "storyteller.media.queue.retry_waiting",
      value: retryWaiting,
      unit: "1",
      labels: {
        signal: "retry_waiting",
      },
    },
    {
      metricType: "storyteller.media.queue.dead_letter",
      value: deadLetter,
      unit: "1",
      labels: {
        signal: "dead_letter",
      },
    },
    {
      metricType: "storyteller.media.queue.running",
      value: running,
      unit: "1",
      labels: {
        signal: "running",
      },
    },
    {
      metricType: "storyteller.media.queue.failed",
      value: failed,
      unit: "1",
      labels: {
        signal: "failed",
      },
    },
    {
      metricType: "storyteller.media.queue.oldest_age_ms",
      value: oldestQueuedAgeMs,
      unit: "ms",
      labels: {
        signal: "oldest_age_ms",
      },
    },
    {
      metricType: "storyteller.media.queue.worker_busy_count",
      value: busyWorkers,
      unit: "1",
      labels: {
        signal: "worker_busy_count",
      },
    },
    {
      metricType: "storyteller.media.queue.worker_utilization_pct",
      value: workerBusyRatioPct,
      unit: "%",
      labels: {
        signal: "worker_utilization_pct",
      },
    },
  ];

  for (const quota of quotas) {
    const perWindow = clampNonNegativeNumber(quota.perWindow);
    const used = clampNonNegativeNumber(quota.used);
    const available = clampNonNegativeNumber(quota.available);
    const utilizationPct = safeRatioPercent(used, Math.max(1, perWindow));
    records.push({
      metricType: "storyteller.media.quota.utilization_pct",
      value: utilizationPct,
      unit: "%",
      labels: {
        model: quota.model,
        windowMs: clampNonNegativeNumber(quota.windowMs),
        signal: "quota_utilization_pct",
      },
    });
    records.push({
      metricType: "storyteller.media.quota.available_slots",
      value: available,
      unit: "1",
      labels: {
        model: quota.model,
        windowMs: clampNonNegativeNumber(quota.windowMs),
        signal: "quota_available_slots",
      },
    });
  }

  return records;
}
