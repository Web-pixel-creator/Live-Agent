import type { EventListItem } from "./firestore.js";

type UsageSummary = Record<string, unknown>;

type UsageAggregateRecord = {
  key: string;
  runId: string | null;
  sessionId: string;
  createdAt: string;
  latestEventId: string | null;
  latestSource: string;
  latestEventType: string;
  usageSource: string;
  authorityRank: number;
  observationCount: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reportedTotalTokens: number | null;
  derivedTotalTokens: number;
  totalTokens: number;
  models: Set<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | null {
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

function toEpochMs(value: string | null): number {
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareIsoDesc(left: string, right: string): number {
  return toEpochMs(right) - toEpochMs(left);
}

function normalizeModels(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
}

function usageAuthorityRank(usageSource: string | null): number {
  if (usageSource === "gemini_usage_metadata") {
    return 3;
  }
  if (usageSource === "none") {
    return 1;
  }
  if (usageSource) {
    return 2;
  }
  return 0;
}

function summarizeAuthority(sourceCounts: Record<string, number>): "authoritative" | "mixed" | "fallback" | "opaque" | "missing" {
  const authoritative = sourceCounts.gemini_usage_metadata ?? 0;
  const fallback = sourceCounts.none ?? 0;
  const opaque = sourceCounts.unknown ?? 0;
  const total = authoritative + fallback + opaque;
  if (total <= 0) {
    return "missing";
  }
  if (authoritative === total) {
    return "authoritative";
  }
  if (authoritative > 0) {
    return "mixed";
  }
  if (fallback > 0 && opaque <= 0) {
    return "fallback";
  }
  return "opaque";
}

function applySyntheticUsageFallback(event: EventListItem): {
  usageSource: string | null;
  usageCalls: number;
  usageInputTokens: number;
  usageOutputTokens: number;
  usageReportedTotalTokens: number | null;
  usageDerivedTotalTokens: number;
  usageTotalTokens: number;
  usageModels: string[];
  syntheticUsageFromResponse: boolean;
} {
  let usageSource = toOptionalString(event.agentUsageSource);
  let usageCalls = parseNonNegativeInt(event.agentUsageCalls) ?? 0;
  let usageInputTokens = parseNonNegativeInt(event.agentUsageInputTokens) ?? 0;
  let usageOutputTokens = parseNonNegativeInt(event.agentUsageOutputTokens) ?? 0;
  let usageReportedTotalTokens = parseNonNegativeInt(event.agentUsageTotalTokens);
  let usageDerivedTotalTokens = usageInputTokens + usageOutputTokens;
  let usageTotalTokens = usageReportedTotalTokens ?? usageDerivedTotalTokens;
  let usageModels = normalizeModels(event.agentUsageModels);
  const syntheticUsageFromResponse =
    usageSource === null &&
    usageCalls <= 0 &&
    usageInputTokens <= 0 &&
    usageOutputTokens <= 0 &&
    (usageReportedTotalTokens ?? 0) <= 0 &&
    usageModels.length <= 0 &&
    event.type === "orchestrator.response";
  if (syntheticUsageFromResponse) {
    usageSource = "none";
    usageCalls = 1;
    usageModels = ["usage_metadata_unavailable"];
    usageInputTokens = 0;
    usageOutputTokens = 0;
    usageReportedTotalTokens = 0;
    usageDerivedTotalTokens = 0;
    usageTotalTokens = 0;
  }

  return {
    usageSource,
    usageCalls,
    usageInputTokens,
    usageOutputTokens,
    usageReportedTotalTokens,
    usageDerivedTotalTokens,
    usageTotalTokens,
    usageModels,
    syntheticUsageFromResponse,
  };
}

function buildAggregatedUsageRuns(events: EventListItem[]): UsageAggregateRecord[] {
  const aggregates = new Map<string, UsageAggregateRecord>();

  for (const event of events) {
    const {
      usageSource,
      usageCalls,
      usageInputTokens,
      usageOutputTokens,
      usageReportedTotalTokens,
      usageDerivedTotalTokens,
      usageTotalTokens,
      usageModels,
    } = applySyntheticUsageFallback(event);
    const hasUsageEvidence =
      usageSource !== null ||
      usageCalls > 0 ||
      usageInputTokens > 0 ||
      usageOutputTokens > 0 ||
      usageTotalTokens > 0 ||
      usageModels.length > 0;
    if (!hasUsageEvidence) {
      continue;
    }

    const runId = toOptionalString(event.runId);
    const key = runId ?? `${event.sessionId}:${event.eventId}`;
    const createdAt = toOptionalString(event.createdAt) ?? new Date().toISOString();
    const authorityRank = usageAuthorityRank(usageSource);
    const existing = aggregates.get(key);
    if (!existing) {
      aggregates.set(key, {
        key,
        runId,
        sessionId: event.sessionId,
        createdAt,
        latestEventId: event.eventId,
        latestSource: event.source,
        latestEventType: event.type,
        usageSource: usageSource ?? "unknown",
        authorityRank,
        observationCount: 1,
        calls: usageCalls,
        inputTokens: usageInputTokens,
        outputTokens: usageOutputTokens,
        reportedTotalTokens: usageReportedTotalTokens,
        derivedTotalTokens: usageDerivedTotalTokens,
        totalTokens: usageTotalTokens,
        models: new Set(usageModels),
      });
      continue;
    }

    existing.observationCount += 1;
    existing.calls = Math.max(existing.calls, usageCalls);
    existing.inputTokens = Math.max(existing.inputTokens, usageInputTokens);
    existing.outputTokens = Math.max(existing.outputTokens, usageOutputTokens);
    existing.derivedTotalTokens = existing.inputTokens + existing.outputTokens;
    existing.reportedTotalTokens =
      usageReportedTotalTokens === null
        ? existing.reportedTotalTokens
        : existing.reportedTotalTokens === null
          ? usageReportedTotalTokens
          : Math.max(existing.reportedTotalTokens, usageReportedTotalTokens);
    existing.totalTokens = existing.reportedTotalTokens ?? existing.derivedTotalTokens;
    for (const model of usageModels) {
      existing.models.add(model);
    }

    if (authorityRank > existing.authorityRank) {
      existing.authorityRank = authorityRank;
      existing.usageSource = usageSource ?? "unknown";
    }

    if (toEpochMs(createdAt) >= toEpochMs(existing.createdAt)) {
      existing.createdAt = createdAt;
      existing.latestEventId = event.eventId;
      existing.latestSource = event.source;
      existing.latestEventType = event.type;
    }
  }

  return Array.from(aggregates.values()).sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

function summarizeSourceCounts(entries: Array<{ usageSource: string }>): Record<string, number> {
  const sourceCounts: Record<string, number> = {
    gemini_usage_metadata: 0,
    none: 0,
    unknown: 0,
  };

  for (const entry of entries) {
    if (entry.usageSource === "gemini_usage_metadata") {
      sourceCounts.gemini_usage_metadata += 1;
    } else if (entry.usageSource === "none") {
      sourceCounts.none += 1;
    } else {
      sourceCounts.unknown += 1;
    }
  }

  return sourceCounts;
}

function buildRuntimeFallbackSummary(services: Array<Record<string, unknown>>): UsageSummary {
  const gatewayService = services.find((service) => service.name === "realtime-gateway");
  const runtimeEvidence = gatewayService && isRecord(gatewayService.agentUsage) ? gatewayService.agentUsage : null;
  if (!runtimeEvidence) {
    return {
      status: "missing",
      total: 0,
      uniqueRuns: 0,
      uniqueSessions: 0,
      totalCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      models: [],
      sourceCounts: {
        gemini_usage_metadata: 0,
        none: 0,
        unknown: 0,
      },
      latest: null,
      recent: [],
      source: "operator_summary",
      aggregationMode: "high_water_by_run",
      authority: "missing",
      authoritativeRuns: 0,
      fallbackRuns: 0,
      opaqueRuns: 0,
      derivedTotalTokens: 0,
      tokenConsistency: true,
      tokenDriftRuns: 0,
      tokenDriftTokens: 0,
      validated: false,
    };
  }

  const runtimeRecentRaw = Array.isArray(runtimeEvidence.recent)
    ? runtimeEvidence.recent.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const runtimeRecent = runtimeRecentRaw.map((item) => ({
    eventId: null,
    runId: toOptionalString(item.runId),
    sessionId: toOptionalString(item.sessionId) ?? "unknown",
    createdAt: toOptionalString(item.seenAt) ?? new Date().toISOString(),
    source: "gateway",
    eventType: "orchestrator.response",
    usageSource: toOptionalString(item.source) ?? "none",
    authority: usageAuthorityRank(toOptionalString(item.source)) >= 3 ? "authoritative" : toOptionalString(item.source) === "none" ? "fallback" : "opaque",
    aggregationMode: "gateway_runtime_snapshot",
    observationCount: 1,
    calls: parseNonNegativeInt(item.calls) ?? 0,
    inputTokens: parseNonNegativeInt(item.inputTokens) ?? 0,
    outputTokens: parseNonNegativeInt(item.outputTokens) ?? 0,
    reportedTotalTokens: parseNonNegativeInt(item.totalTokens),
    derivedTotalTokens: (parseNonNegativeInt(item.inputTokens) ?? 0) + (parseNonNegativeInt(item.outputTokens) ?? 0),
    totalTokens:
      parseNonNegativeInt(item.totalTokens) ??
      (parseNonNegativeInt(item.inputTokens) ?? 0) + (parseNonNegativeInt(item.outputTokens) ?? 0),
    models: normalizeModels(item.models),
  }));
  const runtimeLatestRaw = isRecord(runtimeEvidence.latest) ? runtimeEvidence.latest : null;
  const runtimeLatest = runtimeLatestRaw
    ? {
        eventId: null,
        runId: toOptionalString(runtimeLatestRaw.runId),
        sessionId: toOptionalString(runtimeLatestRaw.sessionId) ?? "unknown",
        createdAt: toOptionalString(runtimeLatestRaw.seenAt) ?? new Date().toISOString(),
        source: "gateway",
        eventType: "orchestrator.response",
        usageSource: toOptionalString(runtimeLatestRaw.source) ?? "none",
        authority:
          usageAuthorityRank(toOptionalString(runtimeLatestRaw.source)) >= 3
            ? "authoritative"
            : toOptionalString(runtimeLatestRaw.source) === "none"
              ? "fallback"
              : "opaque",
        aggregationMode: "gateway_runtime_snapshot",
        observationCount: 1,
        calls: parseNonNegativeInt(runtimeLatestRaw.calls) ?? 0,
        inputTokens: parseNonNegativeInt(runtimeLatestRaw.inputTokens) ?? 0,
        outputTokens: parseNonNegativeInt(runtimeLatestRaw.outputTokens) ?? 0,
        reportedTotalTokens: parseNonNegativeInt(runtimeLatestRaw.totalTokens),
        derivedTotalTokens:
          (parseNonNegativeInt(runtimeLatestRaw.inputTokens) ?? 0) +
          (parseNonNegativeInt(runtimeLatestRaw.outputTokens) ?? 0),
        totalTokens:
          parseNonNegativeInt(runtimeLatestRaw.totalTokens) ??
          (parseNonNegativeInt(runtimeLatestRaw.inputTokens) ?? 0) +
            (parseNonNegativeInt(runtimeLatestRaw.outputTokens) ?? 0),
        models: normalizeModels(runtimeLatestRaw.models),
      }
    : runtimeRecent[0] ?? null;
  const runtimeSourceCounts = isRecord(runtimeEvidence.sourceCounts) ? runtimeEvidence.sourceCounts : null;
  const runtimeModels = normalizeModels(runtimeEvidence.models);
  const runtimeInputTokens = parseNonNegativeInt(runtimeEvidence.inputTokens) ?? 0;
  const runtimeOutputTokens = parseNonNegativeInt(runtimeEvidence.outputTokens) ?? 0;
  const runtimeReportedTotalTokens = parseNonNegativeInt(runtimeEvidence.totalTokens);
  const runtimeDerivedTotalTokens = runtimeInputTokens + runtimeOutputTokens;
  const runtimeTotalTokens = runtimeReportedTotalTokens ?? runtimeDerivedTotalTokens;
  const runtimeTotal = parseNonNegativeInt(runtimeEvidence.total) ?? runtimeRecent.length;
  const runtimeUniqueRuns =
    parseNonNegativeInt(runtimeEvidence.uniqueRuns) ??
    new Set(runtimeRecent.map((item) => (typeof item.runId === "string" ? item.runId : null)).filter(Boolean)).size;
  const runtimeUniqueSessions =
    parseNonNegativeInt(runtimeEvidence.uniqueSessions) ?? new Set(runtimeRecent.map((item) => item.sessionId)).size;
  const runtimeTotalCalls =
    parseNonNegativeInt(runtimeEvidence.totalCalls) ??
    runtimeRecent.reduce((acc, item) => acc + (parseNonNegativeInt(item.calls) ?? 0), 0);
  const sourceCounts = {
    gemini_usage_metadata: parseNonNegativeInt(runtimeSourceCounts?.gemini_usage_metadata) ?? 0,
    none: parseNonNegativeInt(runtimeSourceCounts?.none) ?? 0,
    unknown: parseNonNegativeInt(runtimeSourceCounts?.unknown) ?? 0,
  };
  const authority = summarizeAuthority(sourceCounts);
  const tokenConsistency = runtimeTotalTokens >= runtimeDerivedTotalTokens;
  return {
    status: runtimeTotal > 0 ? "observed" : "missing",
    total: runtimeTotal,
    uniqueRuns: runtimeUniqueRuns,
    uniqueSessions: runtimeUniqueSessions,
    totalCalls: runtimeTotalCalls,
    inputTokens: runtimeInputTokens,
    outputTokens: runtimeOutputTokens,
    reportedTotalTokens: runtimeReportedTotalTokens,
    derivedTotalTokens: runtimeDerivedTotalTokens,
    totalTokens: runtimeTotalTokens,
    models: runtimeModels,
    sourceCounts,
    latest: runtimeLatest,
    recent: runtimeRecent.slice(0, 20),
    source: "gateway_runtime",
    aggregationMode: "gateway_runtime_snapshot",
    authority,
    authoritativeRuns: sourceCounts.gemini_usage_metadata,
    fallbackRuns: sourceCounts.none,
    opaqueRuns: sourceCounts.unknown,
    tokenConsistency,
    tokenDriftRuns: tokenConsistency ? 0 : runtimeTotal > 0 ? 1 : 0,
    tokenDriftTokens: Math.max(0, runtimeDerivedTotalTokens - runtimeTotalTokens),
    validated:
      runtimeTotal > 0 &&
      tokenConsistency &&
      runtimeModels.length > 0,
  };
}

export function summarizeAgentUsage(
  events: EventListItem[],
  services: Array<Record<string, unknown>>,
): UsageSummary {
  const aggregated = buildAggregatedUsageRuns(events);
  if (aggregated.length <= 0) {
    return buildRuntimeFallbackSummary(services);
  }

  const uniqueRuns = new Set<string>();
  const uniqueSessions = new Set<string>();
  const modelSet = new Set<string>();
  let totalCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let derivedTotalTokens = 0;
  let totalTokens = 0;
  let tokenDriftRuns = 0;
  let tokenDriftTokens = 0;

  const normalized = aggregated.map((entry) => {
    if (entry.runId) {
      uniqueRuns.add(entry.runId);
    }
    uniqueSessions.add(entry.sessionId);
    const tokenConsistency = entry.totalTokens >= entry.derivedTotalTokens;
    totalCalls += entry.calls;
    inputTokens += entry.inputTokens;
    outputTokens += entry.outputTokens;
    derivedTotalTokens += entry.derivedTotalTokens;
    totalTokens += entry.totalTokens;
    if (!tokenConsistency) {
      tokenDriftRuns += 1;
      tokenDriftTokens += Math.max(0, entry.derivedTotalTokens - entry.totalTokens);
    }
    for (const model of entry.models) {
      modelSet.add(model);
    }

    return {
      eventId: entry.latestEventId,
      runId: entry.runId,
      sessionId: entry.sessionId,
      createdAt: entry.createdAt,
      source: entry.latestSource,
      eventType: entry.latestEventType,
      usageSource: entry.usageSource,
      authority:
        entry.authorityRank >= 3 ? "authoritative" : entry.usageSource === "none" ? "fallback" : "opaque",
      aggregationMode: "high_water_by_run",
      observationCount: entry.observationCount,
      calls: entry.calls,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      reportedTotalTokens: entry.reportedTotalTokens,
      derivedTotalTokens: entry.derivedTotalTokens,
      totalTokens: entry.totalTokens,
      tokenConsistency,
      tokenDriftTokens: Math.max(0, entry.derivedTotalTokens - entry.totalTokens),
      models: Array.from(entry.models).sort((left, right) => left.localeCompare(right)),
    };
  });

  const sourceCounts = summarizeSourceCounts(
    normalized.map((item) => ({ usageSource: item.usageSource as string })),
  );
  const authority = summarizeAuthority(sourceCounts);

  return {
    status: "observed",
    total: normalized.length,
    uniqueRuns: uniqueRuns.size,
    uniqueSessions: uniqueSessions.size,
    totalCalls,
    inputTokens,
    outputTokens,
    reportedTotalTokens: totalTokens,
    derivedTotalTokens,
    totalTokens,
    models: Array.from(modelSet).sort((left, right) => left.localeCompare(right)),
    sourceCounts,
    latest: normalized[0],
    recent: normalized.slice(0, 20),
    source: "operator_summary",
    aggregationMode: "high_water_by_run",
    authority,
    authoritativeRuns: sourceCounts.gemini_usage_metadata,
    fallbackRuns: sourceCounts.none,
    opaqueRuns: sourceCounts.unknown,
    tokenConsistency: totalTokens >= derivedTotalTokens,
    tokenDriftRuns,
    tokenDriftTokens,
    validated: totalTokens >= derivedTotalTokens,
  };
}
