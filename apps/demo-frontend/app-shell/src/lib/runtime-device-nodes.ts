import { CURRENT_OPERATOR, type EdgeNode, type NodeStatus } from "@/data/nodes";
import { fetchRuntimeApi } from "@/lib/runtime-api";

export type RuntimeDeviceNodeStatus = "online" | "offline" | "degraded";
export type RuntimeDeviceNodeKind = "desktop" | "mobile";

export type RuntimeDeviceNodeRecord = {
  nodeId: string;
  displayName: string;
  kind: RuntimeDeviceNodeKind;
  platform: string;
  executorUrl: string | null;
  status: RuntimeDeviceNodeStatus;
  capabilities: string[];
  trustLevel: string;
  version: number;
  lastSeenAt: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNodeStatus(status: RuntimeDeviceNodeStatus): NodeStatus {
  if (status === "offline") {
    return "offline";
  }
  if (status === "degraded") {
    return "degraded";
  }
  return "healthy";
}

function normalizeNodeKind(kind: RuntimeDeviceNodeKind): EdgeNode["kind"] {
  return kind === "mobile" ? "mobile_capture" : "partner_terminal";
}

function buildHeartbeatHistory(seed: string, status: NodeStatus): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  const baseline = status === "offline" ? 0.26 : status === "degraded" ? 0.68 : 0.96;
  return Array.from({ length: 24 }, (_, index) => {
    const wobble =
      (Math.sin((hash + index) * 0.43) + Math.cos((hash - index) * 0.19)) * 0.035;
    const dip =
      status === "offline"
        ? index > 19
          ? 0.3
          : 0.18
        : status === "degraded" && index > 17
          ? 0.14
          : 0;
    return Math.max(0, Math.min(1, Number((baseline + wobble - dip).toFixed(3))));
  });
}

function deriveHeartbeatAgoSec(record: RuntimeDeviceNodeRecord, status: NodeStatus): number {
  const lastSeenMs = record.lastSeenAt ? Date.parse(record.lastSeenAt) : Number.NaN;
  if (Number.isFinite(lastSeenMs)) {
    return Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000));
  }
  if (status === "offline") {
    return 7_200;
  }
  if (status === "degraded") {
    return 420;
  }
  return 18;
}

export function mapRuntimeDeviceNode(record: RuntimeDeviceNodeRecord): EdgeNode {
  const metadata = isRecord(record.metadata) ? record.metadata : null;
  const status = normalizeNodeStatus(record.status);
  const city =
    toOptionalString(metadata?.city) ??
    toOptionalString(metadata?.locationCity) ??
    (record.kind === "mobile" ? "Field capture" : "Remote endpoint");
  const country =
    (toOptionalString(metadata?.country) ?? toOptionalString(metadata?.countryCode) ?? "US").toUpperCase();
  const tz = toOptionalString(metadata?.tz) ?? toOptionalString(metadata?.timezone) ?? "UTC";
  const owner =
    toOptionalString(metadata?.owner) ??
    toOptionalString(metadata?.updatedBy) ??
    toOptionalString(record.updatedBy) ??
    CURRENT_OPERATOR;
  const uptime7d =
    toOptionalNumber(metadata?.uptime7d) ??
    (status === "offline" ? 0.82 : status === "degraded" ? 0.93 : 0.99);
  const queueDepth =
    toOptionalNumber(metadata?.queueDepth) ??
    toOptionalNumber(metadata?.pendingUploads) ??
    (status === "offline" ? 6 : status === "degraded" ? 3 : 0);
  const errorRate24h =
    toOptionalNumber(metadata?.errorRate24h) ??
    (status === "offline" ? 0.04 : status === "degraded" ? 0.028 : 0.005);
  const throughput24h =
    toOptionalNumber(metadata?.throughput24h) ??
    Math.max(0, record.capabilities.length * 24);
  const firmware =
    toOptionalString(metadata?.firmware) ??
    `registry ${Math.max(1, Math.floor(record.version))}`;
  const lastIncidentLabel = toOptionalString(
    isRecord(metadata?.lastIncident) ? metadata?.lastIncident.label : null,
  );
  const lastIncidentAt = toOptionalString(
    isRecord(metadata?.lastIncident) ? metadata?.lastIncident.at : null,
  );

  return {
    id: record.nodeId,
    label: record.displayName,
    kind: normalizeNodeKind(record.kind),
    city,
    country,
    tz,
    owner,
    status,
    heartbeatAgoSec: deriveHeartbeatAgoSec(record, status),
    uptime7d,
    queueDepth,
    errorRate24h,
    throughput24h,
    firmware,
    lastIncident:
      lastIncidentLabel && lastIncidentAt
        ? { label: lastIncidentLabel, at: lastIncidentAt }
        : status === "offline" || status === "degraded"
          ? {
              label:
                status === "offline"
                  ? "Registry heartbeat missing"
                  : "Registry reported degraded heartbeat",
              at: record.updatedAt,
            }
          : undefined,
    heartbeatHistory:
      Array.isArray(metadata?.heartbeatHistory) &&
      metadata.heartbeatHistory.every((value) => typeof value === "number" && Number.isFinite(value))
        ? metadata.heartbeatHistory.slice(0, 24)
        : buildHeartbeatHistory(record.nodeId, status),
  };
}

export async function fetchRuntimeDeviceNodes(
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeDeviceNodeRecord[]> {
  const response = await fetchRuntimeApi(
    "/v1/device-nodes?includeOffline=true&limit=200",
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(`device_nodes_${response.status}`);
  }
  const payload = (await response.json()) as { data?: RuntimeDeviceNodeRecord[] };
  return Array.isArray(payload.data) ? payload.data : [];
}
