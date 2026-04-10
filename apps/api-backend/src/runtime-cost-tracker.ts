import type { CaseWikiCostSummary } from "@mla/contracts";
import { summarizeAgentUsage } from "./agent-usage-summary.js";
import type { EventListItem } from "./firestore.js";

export type RuntimeCostTrackerConfig = {
  pricePer1kInputUsd: number;
  pricePer1kOutputUsd: number;
  pricePerLiveMinuteUsd: number;
  pricePerUiExecutorMinuteUsd: number;
  pricePerStorageMbUsd: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function parseNonNegativeFloat(value: string | null | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundObserved(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 1000) / 1000;
}

function toEpochMs(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => toNonEmptyString(item))
            .filter((item): item is string => item !== null),
        ),
      )
    : [];
}

function formatEventGroupKey(event: EventListItem): string {
  return toNonEmptyString(event.runId) ?? `event:${event.eventId}`;
}

function estimateSpanMinutes(
  events: readonly EventListItem[],
  predicate: (event: EventListItem) => boolean,
): number {
  const groups = new Map<string, { earliestMs: number; latestMs: number }>();
  for (const event of events) {
    if (!predicate(event)) {
      continue;
    }
    const createdAtMs = toEpochMs(toNonEmptyString(event.createdAt));
    if (createdAtMs <= 0) {
      continue;
    }
    const groupKey = formatEventGroupKey(event);
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        earliestMs: createdAtMs,
        latestMs: createdAtMs,
      });
      continue;
    }
    existing.earliestMs = Math.min(existing.earliestMs, createdAtMs);
    existing.latestMs = Math.max(existing.latestMs, createdAtMs);
  }

  let totalMinutes = 0;
  for (const group of groups.values()) {
    totalMinutes += Math.max(0, (group.latestMs - group.earliestMs) / 60_000);
  }
  return roundObserved(totalMinutes);
}

function isLiveLaneEvent(event: EventListItem): boolean {
  return (
    toNonEmptyString(event.route) === "live-agent" ||
    toNonEmptyString(event.source) === "live-agent" ||
    toNonEmptyString(event.liveTransportMode) !== null ||
    toNonEmptyString(event.liveTransportProvider) !== null
  );
}

function isUiLaneEvent(event: EventListItem): boolean {
  return (
    toNonEmptyString(event.route) === "ui-navigator-agent" ||
    toNonEmptyString(event.source) === "ui-executor" ||
    toNonEmptyString(event.source) === "ui-navigator-agent"
  );
}

function estimateStorageMb(events: readonly EventListItem[]): number {
  if (events.length <= 0) {
    return 0;
  }
  return roundObserved(Buffer.byteLength(JSON.stringify(events), "utf8") / (1024 * 1024));
}

function buildDerivedSourceRefs(params: {
  events: readonly EventListItem[];
  providedRefs?: readonly string[] | null;
  sessionId?: string | null;
}): string[] {
  const refs = new Set<string>();
  for (const ref of params.providedRefs ?? []) {
    const normalized = toNonEmptyString(ref);
    if (normalized) {
      refs.add(normalized);
    }
  }
  const normalizedSessionId = toNonEmptyString(params.sessionId);
  if (normalizedSessionId) {
    refs.add(`session:${normalizedSessionId}`);
  }
  const latestEvent = [...params.events].sort(
    (left, right) => toEpochMs(toNonEmptyString(right.createdAt)) - toEpochMs(toNonEmptyString(left.createdAt)),
  )[0];
  const latestRunId = latestEvent ? toNonEmptyString(latestEvent.runId) : null;
  if (latestRunId) {
    refs.add(`run:${latestRunId}`);
  }
  if (latestEvent) {
    refs.add(`event:${latestEvent.eventId}`);
  }
  return Array.from(refs).slice(0, 6);
}

export function resolveRuntimeCostTrackerConfig(env: NodeJS.ProcessEnv): RuntimeCostTrackerConfig {
  return {
    pricePer1kInputUsd: parseNonNegativeFloat(env.OPERATOR_COST_PER_1K_INPUT_USD, 0),
    pricePer1kOutputUsd: parseNonNegativeFloat(env.OPERATOR_COST_PER_1K_OUTPUT_USD, 0),
    pricePerLiveMinuteUsd: parseNonNegativeFloat(env.RUNTIME_COST_PER_LIVE_MINUTE_USD, 0),
    pricePerUiExecutorMinuteUsd: parseNonNegativeFloat(env.RUNTIME_COST_PER_UI_EXECUTOR_MINUTE_USD, 0),
    pricePerStorageMbUsd: parseNonNegativeFloat(env.RUNTIME_COST_PER_STORAGE_MB_USD, 0),
  };
}

export function buildRuntimeCostSummary(params: {
  agentUsage: Record<string, unknown>;
  config: RuntimeCostTrackerConfig;
  events?: readonly EventListItem[];
  source?: "operator_summary" | "case_wiki";
  sessionId?: string | null;
  sourceRefs?: readonly string[] | null;
}): CaseWikiCostSummary {
  const events = Array.isArray(params.events) ? params.events : [];
  const inputTokens = parseNonNegativeInt(params.agentUsage.inputTokens) ?? 0;
  const outputTokens = parseNonNegativeInt(params.agentUsage.outputTokens) ?? 0;
  const derivedTotalTokens =
    parseNonNegativeInt(params.agentUsage.derivedTotalTokens) ?? inputTokens + outputTokens;
  const totalTokens = parseNonNegativeInt(params.agentUsage.totalTokens) ?? derivedTotalTokens;
  const usageTotal = parseNonNegativeInt(params.agentUsage.total) ?? 0;
  const usageSource = toNonEmptyString(params.agentUsage.source) ?? "operator_summary";
  const usageStatus = toNonEmptyString(params.agentUsage.status) ?? (usageTotal > 0 ? "observed" : "missing");
  const usageAuthority = toNonEmptyString(params.agentUsage.authority) ?? "missing";
  const usageAggregationMode = toNonEmptyString(params.agentUsage.aggregationMode) ?? "high_water_by_run";
  const usageLatest = isRecord(params.agentUsage.latest) ? params.agentUsage.latest : null;
  const usageLatestSeenAt =
    toNonEmptyString(usageLatest?.createdAt) ??
    [...events]
      .map((item) => toNonEmptyString(item.createdAt))
      .filter((item): item is string => item !== null)
      .sort((left, right) => toEpochMs(right) - toEpochMs(left))[0] ??
    null;
  const usageModels = normalizeStringList(params.agentUsage.models);
  const sourceCounts =
    isRecord(params.agentUsage.sourceCounts) ? params.agentUsage.sourceCounts : null;
  const unknownSourceCount = parseNonNegativeInt(sourceCounts?.unknown) ?? 0;

  const liveMinutes = estimateSpanMinutes(events, isLiveLaneEvent);
  const uiExecutorMinutes = estimateSpanMinutes(events, isUiLaneEvent);
  const storageMb = estimateStorageMb(events);

  const inputUsd = roundUsd((inputTokens / 1000) * params.config.pricePer1kInputUsd);
  const outputUsd = roundUsd((outputTokens / 1000) * params.config.pricePer1kOutputUsd);
  const liveUsd = roundUsd(liveMinutes * params.config.pricePerLiveMinuteUsd);
  const uiExecutorUsd = roundUsd(uiExecutorMinutes * params.config.pricePerUiExecutorMinuteUsd);
  const storageUsd = roundUsd(storageMb * params.config.pricePerStorageMbUsd);
  const totalUsd = roundUsd(inputUsd + outputUsd + liveUsd + uiExecutorUsd + storageUsd);

  const pricingConfigured =
    params.config.pricePer1kInputUsd > 0 ||
    params.config.pricePer1kOutputUsd > 0 ||
    params.config.pricePerLiveMinuteUsd > 0 ||
    params.config.pricePerUiExecutorMinuteUsd > 0 ||
    params.config.pricePerStorageMbUsd > 0;
  const tokenConsistency = totalTokens >= derivedTotalTokens;
  const tokenDriftTokens = Math.max(0, derivedTotalTokens - totalTokens);
  const runtimeComponentsObserved = liveMinutes > 0 || uiExecutorMinutes > 0 || storageMb > 0;
  const hasObservedCostSignal =
    usageTotal > 0 ||
    totalTokens > 0 ||
    runtimeComponentsObserved ||
    events.length > 0;
  const source = params.source ?? "operator_summary";
  const estimationMode = pricingConfigured
    ? runtimeComponentsObserved &&
      (params.config.pricePerLiveMinuteUsd > 0 ||
        params.config.pricePerUiExecutorMinuteUsd > 0 ||
        params.config.pricePerStorageMbUsd > 0)
      ? "runtime_rate_estimate"
      : "token_rate_estimate"
    : "tokens_only";
  const observationMode = runtimeComponentsObserved ? "event_span_estimate" : "usage_rollup";
  const sourceRefs = buildDerivedSourceRefs({
    events,
    providedRefs: params.sourceRefs ?? null,
    sessionId: params.sessionId ?? null,
  });
  const totalComponentsUsd = inputUsd + outputUsd + liveUsd + uiExecutorUsd + storageUsd;

  return {
    status: hasObservedCostSignal ? "observed" : "missing",
    source,
    summaryStatus: usageStatus,
    summarySource: usageSource,
    summaryAuthority: usageAuthority,
    aggregationMode: usageAggregationMode,
    estimationMode,
    observationMode,
    pricingConfigured,
    currency: "USD",
    inputTokens,
    outputTokens,
    derivedTotalTokens,
    totalTokens,
    tokenConsistency,
    tokenDriftTokens,
    inputUsd,
    outputUsd,
    liveUsd,
    uiExecutorUsd,
    storageUsd,
    totalUsd,
    liveMinutes,
    uiExecutorMinutes,
    storageMb,
    pricePer1kInputUsd: roundUsd(params.config.pricePer1kInputUsd),
    pricePer1kOutputUsd: roundUsd(params.config.pricePer1kOutputUsd),
    pricePerLiveMinuteUsd: roundUsd(params.config.pricePerLiveMinuteUsd),
    pricePerUiExecutorMinuteUsd: roundUsd(params.config.pricePerUiExecutorMinuteUsd),
    pricePerStorageMbUsd: roundUsd(params.config.pricePerStorageMbUsd),
    models: usageModels,
    uniqueModels: usageModels.length,
    unknownSourceCount,
    latestSeenAt: usageLatestSeenAt,
    sourceRefs,
    validated: tokenConsistency && totalUsd >= totalComponentsUsd - 0.000001,
  };
}

export function buildRuntimeCaseCostSummary(params: {
  events: readonly EventListItem[];
  config: RuntimeCostTrackerConfig;
  sessionId?: string | null;
  sourceRefs?: readonly string[] | null;
}): CaseWikiCostSummary {
  return buildRuntimeCostSummary({
    agentUsage: summarizeAgentUsage([...params.events], []),
    config: params.config,
    events: params.events,
    source: "case_wiki",
    sessionId: params.sessionId ?? null,
    sourceRefs: params.sourceRefs ?? null,
  });
}
