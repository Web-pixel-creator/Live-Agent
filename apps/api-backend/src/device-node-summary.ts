import type { DeviceNodeRecord } from "./firestore.js";

export type DeviceNodeHealthSummary = {
  total: number;
  statusCounts: {
    online: number;
    degraded: number;
    offline: number;
  };
  staleCount: number;
  missingHeartbeatCount: number;
  staleThresholdMs: number;
  lastSeenMaxAgeMs: number | null;
  recent: Array<{
    nodeId: string;
    status: DeviceNodeRecord["status"];
    kind: DeviceNodeRecord["kind"];
    platform: string;
    version: number;
    lastSeenAt: string | null;
  }>;
};

function parseIsoToMs(value: string | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function buildDeviceNodeHealthSummary(
  nodes: DeviceNodeRecord[],
  params?: {
    nowMs?: number;
    staleThresholdMs?: number;
    recentLimit?: number;
  },
): DeviceNodeHealthSummary {
  const nowMs = Number.isFinite(params?.nowMs ?? Number.NaN) ? Number(params?.nowMs) : Date.now();
  const staleThresholdMs = clampPositiveInt(params?.staleThresholdMs ?? 300_000, 300_000);
  const recentLimit = clampPositiveInt(params?.recentLimit ?? 25, 25);
  const normalized = Array.isArray(nodes) ? nodes : [];

  let online = 0;
  let degraded = 0;
  let offline = 0;
  let stale = 0;
  let missingHeartbeat = 0;
  let maxAgeMs: number | null = null;

  for (const node of normalized) {
    if (node.status === "degraded") {
      degraded += 1;
    } else if (node.status === "offline") {
      offline += 1;
    } else {
      online += 1;
    }

    const lastSeenMs = parseIsoToMs(node.lastSeenAt);
    if (lastSeenMs === null) {
      stale += 1;
      missingHeartbeat += 1;
      continue;
    }

    const ageMs = Math.max(0, nowMs - lastSeenMs);
    if (maxAgeMs === null || ageMs > maxAgeMs) {
      maxAgeMs = ageMs;
    }
    if (ageMs > staleThresholdMs) {
      stale += 1;
    }
  }

  const recent = normalized
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, recentLimit)
    .map((node) => ({
      nodeId: node.nodeId,
      status: node.status,
      kind: node.kind,
      platform: node.platform,
      version: node.version,
      lastSeenAt: node.lastSeenAt,
    }));

  return {
    total: normalized.length,
    statusCounts: {
      online,
      degraded,
      offline,
    },
    staleCount: stale,
    missingHeartbeatCount: missingHeartbeat,
    staleThresholdMs,
    lastSeenMaxAgeMs: maxAgeMs,
    recent,
  };
}
