import type { getStoryCacheSnapshot } from "@mla/storyteller-agent";
import type { StoryQueueMetricRecord } from "./story-queue-telemetry.js";

type StoryCacheSnapshot = ReturnType<typeof getStoryCacheSnapshot>;

function clampNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function clampPercent(value: unknown): number {
  const normalized = clampNonNegativeNumber(value);
  if (normalized > 100) {
    return 100;
  }
  return normalized;
}

export function buildStoryCacheMetricRecords(snapshot: StoryCacheSnapshot): StoryQueueMetricRecord[] {
  const totals = snapshot.totals;
  const scopes = snapshot.scopes;
  const memoryApproxBytes = snapshot.memory.approxBytes;

  const records: StoryQueueMetricRecord[] = [
    {
      metricType: "storyteller.cache.entries",
      value: clampNonNegativeNumber(totals.entries),
      unit: "1",
      labels: {
        signal: "entries",
      },
    },
    {
      metricType: "storyteller.cache.hit_rate_pct",
      value: clampPercent(totals.hitRatePct),
      unit: "%",
      labels: {
        signal: "hit_rate_pct",
      },
    },
    {
      metricType: "storyteller.cache.hits_total",
      value: clampNonNegativeNumber(totals.hits),
      unit: "1",
      labels: {
        signal: "hits_total",
      },
    },
    {
      metricType: "storyteller.cache.misses_total",
      value: clampNonNegativeNumber(totals.misses),
      unit: "1",
      labels: {
        signal: "misses_total",
      },
    },
    {
      metricType: "storyteller.cache.writes_total",
      value: clampNonNegativeNumber(totals.writes),
      unit: "1",
      labels: {
        signal: "writes_total",
      },
    },
    {
      metricType: "storyteller.cache.evictions_total",
      value: clampNonNegativeNumber(totals.evictions),
      unit: "1",
      labels: {
        signal: "evictions_total",
      },
    },
    {
      metricType: "storyteller.cache.invalidations_total",
      value: clampNonNegativeNumber(totals.invalidations),
      unit: "1",
      labels: {
        signal: "invalidations_total",
      },
    },
    {
      metricType: "storyteller.cache.memory_approx_bytes",
      value: clampNonNegativeNumber(memoryApproxBytes),
      unit: "By",
      labels: {
        signal: "memory_approx_bytes",
      },
    },
  ];

  const scopeEntries: Record<keyof StoryCacheSnapshot["scopes"], number> = {
    plan: clampNonNegativeNumber(scopes.plan),
    branch: clampNonNegativeNumber(scopes.branch),
    asset: clampNonNegativeNumber(scopes.asset),
  };

  for (const [scope, value] of Object.entries(scopeEntries)) {
    records.push({
      metricType: "storyteller.cache.scope_entries",
      value,
      unit: "1",
      labels: {
        scope,
        signal: "scope_entries",
      },
    });
  }

  return records;
}
