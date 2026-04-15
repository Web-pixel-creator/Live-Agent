import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function roundNumber(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildCostEstimate(summary, kpis) {
  const summaryCost = isObject(summary.costEstimate) ? summary.costEstimate : {};
  const currency = toOptionalString(summaryCost.currency) ?? toOptionalString(kpis.costEstimateCurrency) ?? "USD";
  const geminiLiveUsd = Math.max(
    0,
    toNumber(summaryCost.geminiLiveUsd) ?? toNumber(kpis.costEstimateGeminiLiveUsd) ?? 0,
  );
  const imagenUsd = Math.max(0, toNumber(summaryCost.imagenUsd) ?? toNumber(kpis.costEstimateImagenUsd) ?? 0);
  const veoUsd = Math.max(0, toNumber(summaryCost.veoUsd) ?? toNumber(kpis.costEstimateVeoUsd) ?? 0);
  const ttsUsd = Math.max(0, toNumber(summaryCost.ttsUsd) ?? toNumber(kpis.costEstimateTtsUsd) ?? 0);
  const partsTotal = geminiLiveUsd + imagenUsd + veoUsd + ttsUsd;
  const totalCandidate = Math.max(
    0,
    toNumber(summaryCost.totalUsd) ?? toNumber(kpis.costEstimateTotalUsd) ?? partsTotal,
  );
  const totalUsd = totalCandidate >= partsTotal ? totalCandidate : partsTotal;
  const source =
    toOptionalString(summaryCost.source) ?? toOptionalString(kpis.costEstimateSource) ?? "summary_or_kpi_default";

  return {
    currency,
    geminiLiveUsd: roundNumber(geminiLiveUsd),
    imagenUsd: roundNumber(imagenUsd),
    veoUsd: roundNumber(veoUsd),
    ttsUsd: roundNumber(ttsUsd),
    totalUsd: roundNumber(totalUsd),
    source,
  };
}

function buildTokensUsed(summary, kpis) {
  const summaryTokens = isObject(summary.tokensUsed) ? summary.tokensUsed : {};
  const input = Math.max(0, Math.trunc(toNumber(summaryTokens.input) ?? toNumber(kpis.tokensUsedInput) ?? 0));
  const output = Math.max(0, Math.trunc(toNumber(summaryTokens.output) ?? toNumber(kpis.tokensUsedOutput) ?? 0));
  const partsTotal = input + output;
  const totalCandidate = Math.max(
    0,
    Math.trunc(toNumber(summaryTokens.total) ?? toNumber(kpis.tokensUsedTotal) ?? partsTotal),
  );
  const total = totalCandidate >= partsTotal ? totalCandidate : partsTotal;
  const source =
    toOptionalString(summaryTokens.source) ?? toOptionalString(kpis.tokensUsedSource) ?? "summary_or_kpi_default";

  return {
    input,
    output,
    total,
    source,
  };
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function buildTurnEvidence(kpis, config) {
  const validated = toBoolean(kpis[config.validatedKey]) === true;
  const expectedEventSeen = toBoolean(kpis[config.expectedEventKey]) === true;
  const total = toNumber(kpis[config.totalKey]) ?? 0;
  const uniqueRuns = toNumber(kpis[config.uniqueRunsKey]) ?? 0;
  const uniqueSessions = toNumber(kpis[config.uniqueSessionsKey]) ?? 0;
  const latestSeenAt = toOptionalString(kpis[config.latestSeenAtKey]);
  const latestSeenAtIsIso = latestSeenAt !== null && isIsoTimestamp(latestSeenAt);

  const status =
    validated &&
    expectedEventSeen &&
    total >= 1 &&
    uniqueRuns >= 1 &&
    uniqueSessions >= 1 &&
    latestSeenAtIsIso
      ? "pass"
      : "fail";

  const result = {
    status,
    validated,
    expectedEventSeen,
    total,
    uniqueRuns,
    uniqueSessions,
    latestSeenAt,
    latestSeenAtIsIso,
  };

  if (config.latestTurnIdKey) {
    result.latestTurnId = toOptionalString(kpis[config.latestTurnIdKey]);
  }
  if (config.latestReasonKey) {
    result.latestReason = toOptionalString(kpis[config.latestReasonKey]);
  }
  if (config.latestScopeKey) {
    result.latestScope = toOptionalString(kpis[config.latestScopeKey]);
  }
  if (config.latestAudioEndMsKey) {
    result.latestAudioEndMs = toNumber(kpis[config.latestAudioEndMsKey]);
  }
  if (config.latestContentIndexKey) {
    result.latestContentIndex = toNumber(kpis[config.latestContentIndexKey]);
  }

  return result;
}

function buildDamageControlEvidence(kpis) {
  const diagnosticsValidated = toBoolean(kpis.damageControlDiagnosticsValidated) === true;
  const enabled = toBoolean(kpis.damageControlEnabled) === true;
  const verdict = toOptionalString(kpis.damageControlVerdict);
  const source = toOptionalString(kpis.damageControlSource);
  const matchedRuleCount = toNumber(kpis.damageControlMatchedRuleCount) ?? 0;
  const matchedRuleIds = toStringArray(kpis.damageControlMatchRuleIds);
  const allowedVerdicts = new Set(["allow", "ask", "block"]);
  const allowedSources = new Set(["default", "file", "env_json"]);

  const verdictValid = verdict !== null && allowedVerdicts.has(verdict);
  const sourceValid = source !== null && allowedSources.has(source);
  const status =
    diagnosticsValidated &&
    enabled &&
    verdictValid &&
    sourceValid &&
    matchedRuleCount >= 1 &&
    matchedRuleIds.length >= 1
      ? "pass"
      : "fail";

  return {
    status,
    diagnosticsValidated,
    enabled,
    verdict,
    source,
    matchedRuleCount,
    matchedRuleIds,
  };
}

function buildOperatorDamageControlEvidence(kpis) {
  const validated = toBoolean(kpis.operatorDamageControlSummaryValidated) === true;
  const total = toNumber(kpis.operatorDamageControlTotal) ?? 0;
  const uniqueRuns = toNumber(kpis.operatorDamageControlUniqueRuns) ?? 0;
  const uniqueSessions = toNumber(kpis.operatorDamageControlUniqueSessions) ?? 0;
  const matchedRuleCountTotal = toNumber(kpis.operatorDamageControlMatchedRuleCountTotal) ?? 0;
  const allowCount = toNumber(kpis.operatorDamageControlAllowCount) ?? 0;
  const askCount = toNumber(kpis.operatorDamageControlAskCount) ?? 0;
  const blockCount = toNumber(kpis.operatorDamageControlBlockCount) ?? 0;
  const latestVerdict = toOptionalString(kpis.operatorDamageControlLatestVerdict);
  const latestSource = toOptionalString(kpis.operatorDamageControlLatestSource);
  const latestMatchedRuleCount = toNumber(kpis.operatorDamageControlLatestMatchedRuleCount);
  const latestSeenAt = toOptionalString(kpis.operatorDamageControlLatestSeenAt);
  const latestSeenAtIsIso = latestSeenAt !== null && isIsoTimestamp(latestSeenAt);
  const verdictValid = latestVerdict !== null && ["allow", "ask", "block"].includes(latestVerdict);
  const sourceValid =
    latestSource !== null && ["default", "file", "env_json", "unknown"].includes(latestSource);
  const verdictCountsSum = allowCount + askCount + blockCount;

  const status =
    validated &&
    total >= 1 &&
    uniqueRuns >= 1 &&
    uniqueSessions >= 1 &&
    matchedRuleCountTotal >= 1 &&
    verdictCountsSum === total &&
    verdictValid &&
    sourceValid &&
    (latestMatchedRuleCount ?? 0) >= 1 &&
    latestSeenAtIsIso
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    total,
    uniqueRuns,
    uniqueSessions,
    matchedRuleCountTotal,
    verdictCounts: {
      allow: allowCount,
      ask: askCount,
      block: blockCount,
      total: verdictCountsSum,
    },
    latest: {
      verdict: latestVerdict,
      source: latestSource,
      matchedRuleCount: latestMatchedRuleCount ?? 0,
      seenAt: latestSeenAt,
      seenAtIsIso: latestSeenAtIsIso,
    },
  };
}

function buildGovernancePolicyEvidence(kpis) {
  const validated = toBoolean(kpis.governancePolicyLifecycleValidated) === true;
  const operatorActionSeen = toBoolean(kpis.governancePolicyOperatorActionSeen) === true;
  const overrideTenantSeen = toBoolean(kpis.governancePolicyOverrideTenantSeen) === true;
  const idempotencyReplayOutcome = toOptionalString(kpis.governancePolicyIdempotencyReplayOutcome);
  const versionConflictCode = toOptionalString(kpis.governancePolicyVersionConflictCode);
  const idempotencyConflictCode = toOptionalString(kpis.governancePolicyIdempotencyConflictCode);
  const tenantScopeForbiddenCode = toOptionalString(kpis.governancePolicyTenantScopeForbiddenCode);
  const summaryTemplateId = toOptionalString(kpis.governancePolicySummaryTemplateId);
  const summarySource = toOptionalString(kpis.governancePolicySummarySource);
  const complianceTemplate = toOptionalString(kpis.governancePolicyComplianceTemplate);
  const overridesTotal = toNumber(kpis.governancePolicyOverridesTotal) ?? 0;
  const idempotencyReplayOutcomeValue = idempotencyReplayOutcome ?? "";
  const versionConflictCodeValue = versionConflictCode ?? "";
  const idempotencyConflictCodeValue = idempotencyConflictCode ?? "";
  const tenantScopeForbiddenCodeValue = tenantScopeForbiddenCode ?? "";
  const summaryTemplateIdValue = summaryTemplateId ?? "";
  const summarySourceValue = summarySource ?? "";
  const complianceTemplateValue = complianceTemplate ?? "";

  const status =
    validated &&
    operatorActionSeen &&
    overrideTenantSeen &&
    idempotencyReplayOutcomeValue === "idempotent_replay" &&
    versionConflictCodeValue === "API_GOVERNANCE_POLICY_VERSION_CONFLICT" &&
    idempotencyConflictCodeValue === "API_GOVERNANCE_POLICY_IDEMPOTENCY_CONFLICT" &&
    tenantScopeForbiddenCodeValue === "API_TENANT_SCOPE_FORBIDDEN" &&
    summaryTemplateIdValue === "strict" &&
    summarySourceValue === "tenant_override" &&
    complianceTemplateValue === "strict" &&
    overridesTotal >= 1
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    operatorActionSeen,
    overrideTenantSeen,
    idempotencyReplayOutcome: idempotencyReplayOutcomeValue,
    versionConflictCode: versionConflictCodeValue,
    idempotencyConflictCode: idempotencyConflictCodeValue,
    tenantScopeForbiddenCode: tenantScopeForbiddenCodeValue,
    summaryTemplateId: summaryTemplateIdValue,
    summarySource: summarySourceValue,
    complianceTemplate: complianceTemplateValue,
    overridesTotal,
  };
}

function buildSkillsRegistryEvidence(kpis) {
  const validated = toBoolean(kpis.skillsRegistryLifecycleValidated) === true;
  const indexHasSkill = toBoolean(kpis.skillsRegistryIndexHasSkill) === true;
  const registryHasSkill = toBoolean(kpis.skillsRegistryRegistryHasSkill) === true;
  const createOutcome = toOptionalString(kpis.skillsRegistryCreateOutcome);
  const replayOutcome = toOptionalString(kpis.skillsRegistryReplayOutcome);
  const versionConflictCode = toOptionalString(kpis.skillsRegistryVersionConflictCode);
  const pluginInvalidPermissionCode = toOptionalString(kpis.skillsRegistryPluginInvalidPermissionCode);
  const indexTotal = toNumber(kpis.skillsRegistryIndexTotal) ?? 0;
  const registryTotal = toNumber(kpis.skillsRegistryTotal) ?? 0;
  const createOutcomeValue = createOutcome ?? "";
  const replayOutcomeValue = replayOutcome ?? "";
  const versionConflictCodeValue = versionConflictCode ?? "";
  const pluginInvalidPermissionCodeValue = pluginInvalidPermissionCode ?? "";

  const status =
    validated &&
    indexHasSkill &&
    registryHasSkill &&
    createOutcomeValue === "created" &&
    replayOutcomeValue === "idempotent_replay" &&
    versionConflictCodeValue === "API_SKILL_REGISTRY_VERSION_CONFLICT" &&
    pluginInvalidPermissionCodeValue === "API_SKILL_PLUGIN_PERMISSION_INVALID" &&
    indexTotal >= 1 &&
    registryTotal >= 1
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    indexHasSkill,
    registryHasSkill,
    createOutcome: createOutcomeValue,
    replayOutcome: replayOutcomeValue,
    versionConflictCode: versionConflictCodeValue,
    pluginInvalidPermissionCode: pluginInvalidPermissionCodeValue,
    indexTotal,
    registryTotal,
  };
}

function buildPluginMarketplaceEvidence(kpis) {
  const validated = toBoolean(kpis.operatorPluginMarketplaceLifecycleValidated) === true;
  const summaryStatus = toOptionalString(kpis.operatorPluginMarketplaceStatus) ?? "";
  const total = toNumber(kpis.operatorPluginMarketplaceTotal) ?? 0;
  const uniquePlugins = toNumber(kpis.operatorPluginMarketplaceUniquePlugins) ?? 0;
  const outcomeSucceeded = toNumber(kpis.operatorPluginMarketplaceOutcomeSucceeded) ?? 0;
  const outcomeDenied = toNumber(kpis.operatorPluginMarketplaceOutcomeDenied) ?? 0;
  const outcomeFailed = toNumber(kpis.operatorPluginMarketplaceOutcomeFailed) ?? 0;
  const lifecycleCreated = toNumber(kpis.operatorPluginMarketplaceLifecycleCreated) ?? 0;
  const lifecycleUpdated = toNumber(kpis.operatorPluginMarketplaceLifecycleUpdated) ?? 0;
  const lifecycleIdempotentReplay = toNumber(kpis.operatorPluginMarketplaceLifecycleIdempotentReplay) ?? 0;
  const conflictVersionConflict = toNumber(kpis.operatorPluginMarketplaceConflictVersionConflict) ?? 0;
  const conflictPluginInvalidPermission =
    toNumber(kpis.operatorPluginMarketplaceConflictPluginInvalidPermission) ?? 0;
  const signingVerified = toNumber(kpis.operatorPluginMarketplaceSigningVerified) ?? 0;
  const signingUnsigned = toNumber(kpis.operatorPluginMarketplaceSigningUnsigned) ?? 0;
  const signingNone = toNumber(kpis.operatorPluginMarketplaceSigningNone) ?? 0;
  const signingEvidenceObserved = toBoolean(kpis.operatorPluginMarketplaceSigningEvidenceObserved) === true;
  const permissionTotal = toNumber(kpis.operatorPluginMarketplacePermissionTotal) ?? 0;
  const permissionEntriesWithPermissions =
    toNumber(kpis.operatorPluginMarketplacePermissionEntriesWithPermissions) ?? 0;
  const latestOutcome = toOptionalString(kpis.operatorPluginMarketplaceLatestOutcome) ?? "";
  const latestPluginId = toOptionalString(kpis.operatorPluginMarketplaceLatestPluginId) ?? "";
  const latestVersion = toNumber(kpis.operatorPluginMarketplaceLatestVersion) ?? 0;
  const latestSigningStatus = toOptionalString(kpis.operatorPluginMarketplaceLatestSigningStatus) ?? "";
  const latestSeenAt = toOptionalString(kpis.operatorPluginMarketplaceLatestSeenAt);
  const latestSeenAtIsIso = latestSeenAt !== null && isIsoTimestamp(latestSeenAt);
  const outcomeTotal = outcomeSucceeded + outcomeDenied + outcomeFailed;
  const signingTotal = signingVerified + signingUnsigned + signingNone;

  const status =
    validated &&
    summaryStatus === "observed" &&
    total >= 1 &&
    uniquePlugins >= 1 &&
    outcomeTotal === total &&
    lifecycleCreated >= 1 &&
    lifecycleIdempotentReplay >= 1 &&
    conflictVersionConflict >= 1 &&
    conflictPluginInvalidPermission >= 1 &&
    signingTotal === total &&
    signingEvidenceObserved &&
    signingVerified + signingUnsigned >= 1 &&
    permissionTotal >= 0 &&
    permissionEntriesWithPermissions >= 0 &&
    permissionEntriesWithPermissions <= total &&
    ["succeeded", "denied", "failed"].includes(latestOutcome) &&
    ["verified", "unsigned", "none"].includes(latestSigningStatus) &&
    latestPluginId.length > 0 &&
    latestVersion >= 1 &&
    latestSeenAtIsIso
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    summaryStatus,
    total,
    uniquePlugins,
    outcomes: {
      succeeded: outcomeSucceeded,
      denied: outcomeDenied,
      failed: outcomeFailed,
      total: outcomeTotal,
    },
    lifecycle: {
      created: lifecycleCreated,
      updated: lifecycleUpdated,
      idempotentReplay: lifecycleIdempotentReplay,
    },
    conflicts: {
      versionConflict: conflictVersionConflict,
      pluginInvalidPermission: conflictPluginInvalidPermission,
    },
    signingStatusCounts: {
      verified: signingVerified,
      unsigned: signingUnsigned,
      none: signingNone,
      total: signingTotal,
    },
    signingEvidenceObserved,
    permissionTotals: {
      totalPermissions: permissionTotal,
      entriesWithPermissions: permissionEntriesWithPermissions,
    },
    latest: {
      outcome: latestOutcome,
      pluginId: latestPluginId,
      version: latestVersion,
      signingStatus: latestSigningStatus,
      seenAt: latestSeenAt,
      seenAtIsIso: latestSeenAtIsIso,
    },
  };
}

function buildDeviceNodesEvidence(kpis) {
  const lookupValidated = toBoolean(kpis.operatorDeviceNodeLookupValidated) === true;
  const versionConflictValidated = toBoolean(kpis.operatorDeviceNodeVersionConflictValidated) === true;
  const healthSummaryValidated = toBoolean(kpis.operatorDeviceNodeHealthSummaryValidated) === true;
  const updatesValidated = toBoolean(kpis.operatorDeviceNodeUpdatesValidated) === true;
  const updatesHasUpsert = toBoolean(kpis.operatorDeviceNodeUpdatesHasUpsert) === true;
  const updatesHasHeartbeat = toBoolean(kpis.operatorDeviceNodeUpdatesHasHeartbeat) === true;
  const updatesApiValidated = toBoolean(kpis.operatorDeviceNodeUpdatesApiValidated) === true;

  const lookupStatus = toOptionalString(kpis.operatorDeviceNodeLookupStatus) ?? "";
  const lookupVersion = toNumber(kpis.operatorDeviceNodeLookupVersion) ?? 0;
  const updatedVersion = toNumber(kpis.operatorDeviceNodeUpdatedVersion) ?? 0;
  const versionConflictStatusCode = toNumber(kpis.operatorDeviceNodeVersionConflictStatusCode) ?? 0;
  const versionConflictCode = toOptionalString(kpis.operatorDeviceNodeVersionConflictCode) ?? "";
  const updatesTotal = toNumber(kpis.operatorDeviceNodeUpdatesTotal) ?? 0;
  const summaryTotal = toNumber(kpis.operatorDeviceNodeSummaryTotal) ?? 0;
  const summaryDegraded = toNumber(kpis.operatorDeviceNodeSummaryDegraded) ?? 0;
  const summaryStale = toNumber(kpis.operatorDeviceNodeSummaryStale) ?? 0;
  const summaryMissingHeartbeat = toNumber(kpis.operatorDeviceNodeSummaryMissingHeartbeat) ?? 0;
  const summaryRecentContainsLookup = toBoolean(kpis.operatorDeviceNodeSummaryRecentContainsLookup) === true;

  const validated =
    lookupValidated &&
    versionConflictValidated &&
    healthSummaryValidated &&
    updatesValidated &&
    updatesApiValidated;
  const status =
    validated &&
    lookupStatus === "degraded" &&
    lookupVersion >= 1 &&
    updatedVersion >= 1 &&
    lookupVersion >= updatedVersion &&
    versionConflictStatusCode === 409 &&
    versionConflictCode === "API_DEVICE_NODE_VERSION_CONFLICT" &&
    summaryTotal >= 1 &&
    summaryDegraded >= 1 &&
    summaryStale >= 0 &&
    summaryMissingHeartbeat >= 0 &&
    updatesTotal >= 2 &&
    updatesHasUpsert &&
    updatesHasHeartbeat &&
    summaryRecentContainsLookup
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    lookupValidated,
    versionConflictValidated,
    healthSummaryValidated,
    updatesValidated,
    updatesHasUpsert,
    updatesHasHeartbeat,
    updatesApiValidated,
    lookupStatus,
    lookupVersion,
    updatedVersion,
    versionConflictStatusCode,
    versionConflictCode,
    updatesTotal,
    summaryTotal,
    summaryDegraded,
    summaryStale,
    summaryMissingHeartbeat,
    summaryRecentContainsLookup,
  };
}

function buildAgentUsageEvidence(kpis) {
  const validated = toBoolean(kpis.operatorAgentUsageSummaryValidated) === true;
  const total = toNumber(kpis.operatorAgentUsageTotal) ?? 0;
  const uniqueRuns = toNumber(kpis.operatorAgentUsageUniqueRuns) ?? 0;
  const uniqueSessions = toNumber(kpis.operatorAgentUsageUniqueSessions) ?? 0;
  const totalCalls = toNumber(kpis.operatorAgentUsageTotalCalls) ?? 0;
  const inputTokens = toNumber(kpis.operatorAgentUsageInputTokens) ?? 0;
  const outputTokens = toNumber(kpis.operatorAgentUsageOutputTokens) ?? 0;
  const totalTokens = toNumber(kpis.operatorAgentUsageTotalTokens) ?? 0;
  const models = toStringArray(kpis.operatorAgentUsageModels);
  const summarySource = toOptionalString(kpis.operatorAgentUsageSource) ?? "";
  const summaryStatus = toOptionalString(kpis.operatorAgentUsageStatus) ?? "";
  const allowedSummarySources = new Set(["operator_summary", "gateway_runtime"]);

  const status =
    validated &&
    total >= 1 &&
    uniqueRuns >= 1 &&
    uniqueSessions >= 1 &&
    totalCalls >= 0 &&
    inputTokens >= 0 &&
    outputTokens >= 0 &&
    totalTokens >= inputTokens + outputTokens &&
    models.length >= 1 &&
    allowedSummarySources.has(summarySource) &&
    summaryStatus === "observed"
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    total,
    uniqueRuns,
    uniqueSessions,
    totalCalls,
    inputTokens,
    outputTokens,
    totalTokens,
    models,
    summarySource,
    summaryStatus,
  };
}

function normalizeRuntimeGuardrailsLifecycleCounts(value) {
  const source = isObject(value) ? value : {};
  return {
    active: Math.max(0, Math.trunc(toNumber(source.active) ?? 0)),
    staged: Math.max(0, Math.trunc(toNumber(source.staged) ?? 0)),
    opened: Math.max(0, Math.trunc(toNumber(source.opened) ?? 0)),
    focused: Math.max(0, Math.trunc(toNumber(source.focused) ?? 0)),
    planned: Math.max(0, Math.trunc(toNumber(source.planned) ?? 0)),
    executed: Math.max(0, Math.trunc(toNumber(source.executed) ?? 0)),
    cleared: Math.max(0, Math.trunc(toNumber(source.cleared) ?? 0)),
    failed: Math.max(0, Math.trunc(toNumber(source.failed) ?? 0)),
  };
}

function buildRuntimeGuardrailsPath(value) {
  if (!isObject(value)) {
    return null;
  }

  const lifecycle = isObject(value.lifecycle) ? value.lifecycle : {};
  const lifecycleUpdatedAt = toOptionalString(lifecycle.updatedAt);
  const lifecycleUpdatedAtIsIso = lifecycleUpdatedAt !== null && isIsoTimestamp(lifecycleUpdatedAt);
  const title = toOptionalString(value.title);
  const kind = toOptionalString(value.kind);
  const signalKey = toOptionalString(value.signalKey);
  const signalService = toOptionalString(value.signalService);
  const summaryText = toOptionalString(value.summaryText);
  const buttonLabel = toOptionalString(value.buttonLabel);
  const lifecycleStatusCode = toOptionalString(lifecycle.statusCode);
  const lifecycleStatusText = toOptionalString(lifecycle.statusText);
  const lifecycleDetailText = toOptionalString(lifecycle.detailText);

  return {
    title,
    kind,
    signalKey,
    signalService,
    signalKeys: toStringArray(value.signalKeys),
    signalDescriptors: toStringArray(value.signalDescriptors),
    profileId: toOptionalString(value.profileId),
    phase: toOptionalString(value.phase),
    targetStatusId: toOptionalString(value.targetStatusId),
    summaryText,
    buttonLabel,
    lifecycle: {
      statusCode: lifecycleStatusCode,
      statusText: lifecycleStatusText,
      detailText: lifecycleDetailText,
      updatedAt: lifecycleUpdatedAt,
      updatedAtIsIso: lifecycleUpdatedAtIsIso,
    },
  };
}

function buildRuntimeGuardrailsSignalPathsEvidence(kpis) {
  const snapshot = isObject(kpis.operatorRuntimeGuardrailsSignalPaths) ? kpis.operatorRuntimeGuardrailsSignalPaths : {};
  const summaryStatus = toOptionalString(snapshot.status) ?? "coverage_incomplete";
  const signalsSummary = toOptionalString(snapshot.signalsSummary) ?? "n/a";
  const coverageSummary = toOptionalString(snapshot.coverageSummary) ?? "n/a";
  const sloSummary = toOptionalString(snapshot.sloSummary) ?? "n/a";
  const sandboxSummary = toOptionalString(snapshot.sandboxSummary) ?? "n/a";
  const skillsSummary = toOptionalString(snapshot.skillsSummary) ?? "n/a";
  const topSignal = toOptionalString(snapshot.topSignal) ?? "n/a";
  const historyStatus = toOptionalString(snapshot.historyStatus) ?? "n/a";
  const lifecycleCounts = normalizeRuntimeGuardrailsLifecycleCounts(snapshot.lifecycleCounts);
  const lifecycleSummary = toOptionalString(snapshot.lifecycleSummary) ?? "none";
  const paths = Array.isArray(snapshot.paths)
    ? snapshot.paths.map((entry) => buildRuntimeGuardrailsPath(entry)).filter((entry) => entry !== null)
    : [];
  const totalPaths = Math.max(0, Math.trunc(toNumber(snapshot.totalPaths) ?? paths.length));
  const primaryPath = buildRuntimeGuardrailsPath(snapshot.primaryPath);

  const lifecycleCountsConsistent =
    lifecycleCounts.active === totalPaths &&
    lifecycleCounts.staged >= 0 &&
    lifecycleCounts.opened >= 0 &&
    lifecycleCounts.focused >= 0 &&
    lifecycleCounts.planned >= 0 &&
    lifecycleCounts.executed >= 0 &&
    lifecycleCounts.cleared >= 0 &&
    lifecycleCounts.failed >= 0;
  const pathShapesValid = paths.every(
    (entry) =>
      entry.title !== null &&
      entry.kind !== null &&
      entry.summaryText !== null &&
      entry.buttonLabel !== null &&
      entry.lifecycle.statusCode !== null &&
      entry.lifecycle.statusText !== null &&
      entry.lifecycle.detailText !== null &&
      (entry.lifecycle.updatedAt === null || entry.lifecycle.updatedAtIsIso),
  );
  const primaryPathValid = totalPaths === 0 ? primaryPath === null : primaryPath !== null;
  const rawValidated =
    toBoolean(kpis.operatorRuntimeGuardrailsSignalPathsValidated) === true || toBoolean(snapshot.validated) === true;
  const validated =
    rawValidated &&
    summaryStatus.length > 0 &&
    signalsSummary.length > 0 &&
    coverageSummary.length > 0 &&
    sloSummary.length > 0 &&
    sandboxSummary.length > 0 &&
    skillsSummary.length > 0 &&
    topSignal.length > 0 &&
    historyStatus.length > 0 &&
    totalPaths === paths.length &&
    totalPaths <= 4 &&
    lifecycleCountsConsistent &&
    pathShapesValid &&
    primaryPathValid;

  return {
    status: validated ? "pass" : "fail",
    validated,
    summaryStatus,
    signalsSummary,
    coverageSummary,
    sloSummary,
    sandboxSummary,
    skillsSummary,
    topSignal,
    historyStatus,
    totalPaths,
    lifecycleCounts,
    lifecycleSummary,
    primaryPath,
    paths,
  };
}

function getNestedObjectCandidate(root, path) {
  if (!isObject(root)) {
    return null;
  }
  let current = root;
  for (const segment of path) {
    if (!isObject(current) || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return isObject(current) ? current : null;
}

function normalizeLiveTransportSnapshot(value, defaultEvidenceSource = null) {
  const typed = isObject(value) ? value : {};
  const activeMode =
    toOptionalString(typed.activeMode) ??
    toOptionalString(typed.connectionMode) ??
    toOptionalString(typed.transportMode) ??
    toOptionalString(typed.mode);
  const provider = toOptionalString(typed.provider);
  const model = toOptionalString(typed.model);
  const bootstrapState = toOptionalString(typed.bootstrapState);
  const fallbackReason =
    toOptionalString(typed.fallbackReason) ??
    toOptionalString(typed.fallbackMode) ??
    toOptionalString(typed.warning);
  const explicitEvidenceSource = toOptionalString(typed.evidenceSource);
  const hasCoreEvidence = activeMode || provider || model || bootstrapState || fallbackReason;
  const evidenceSource = explicitEvidenceSource ?? (hasCoreEvidence ? defaultEvidenceSource : null);

  if (!activeMode && !provider && !model && !bootstrapState && !fallbackReason && !evidenceSource) {
    return null;
  }

  return {
    activeMode,
    provider,
    model,
    bootstrapState,
    fallbackReason,
    evidenceSource,
  };
}

function buildLiveTransport(summary, kpis) {
  const runtimeValidated = toBoolean(kpis.transportModeValidated) === true;
  const runtimeRequestedMode = toOptionalString(kpis.gatewayTransportRequestedMode);
  const runtimeActiveMode = toOptionalString(kpis.gatewayTransportActiveMode);
  const runtimeFallbackActive = toBoolean(kpis.gatewayTransportFallbackActive);
  const runtimeEvidenceObserved =
    runtimeValidated ||
    runtimeRequestedMode !== null ||
    runtimeActiveMode !== null ||
    runtimeFallbackActive !== null;

  const sessionCandidates = [
    getNestedObjectCandidate(summary, ["liveTransport"]),
    getNestedObjectCandidate(summary, ["session", "liveTransport"]),
    getNestedObjectCandidate(summary, ["frontendLiveDirectSmoke", "replay", "liveTransport"]),
    getNestedObjectCandidate(summary, ["operatorEvidence", "operatorSessionReplay", "liveTransport"]),
    getNestedObjectCandidate(summary, ["selectedSession", "replay", "liveTransport"]),
    getNestedObjectCandidate(summary, ["replay", "selectedSession", "replay", "liveTransport"]),
  ];

  let normalizedSession = null;
  for (const candidate of sessionCandidates) {
    normalizedSession = normalizeLiveTransportSnapshot(candidate, "summary_live_transport");
    if (normalizedSession) {
      break;
    }
  }

  const connectedEventType = toOptionalString(kpis.assistantActivityConnectedEventType);
  if (!normalizedSession && connectedEventType === "gateway.connected") {
    normalizedSession = {
      activeMode: "relay",
      provider: null,
      model: null,
      bootstrapState: null,
      fallbackReason: null,
      evidenceSource: "gateway_connected_event",
    };
  }

  const sessionObserved = normalizedSession !== null || connectedEventType !== null;
  const status =
    runtimeEvidenceObserved && sessionObserved
      ? "pass"
      : runtimeEvidenceObserved || sessionObserved
        ? "partial"
        : "unavailable";

  const summaryParts = [];
  if (runtimeActiveMode) {
    summaryParts.push(`runtime=${runtimeActiveMode}`);
  } else if (runtimeRequestedMode) {
    summaryParts.push(`runtime_requested=${runtimeRequestedMode}`);
  }
  if (normalizedSession?.activeMode) {
    summaryParts.push(`session=${normalizedSession.activeMode}`);
  }
  if (normalizedSession?.evidenceSource) {
    summaryParts.push(`source=${normalizedSession.evidenceSource}`);
  }
  if (summaryParts.length === 0) {
    summaryParts.push("live transport evidence unavailable");
  }

  return {
    status,
    validated: runtimeEvidenceObserved || sessionObserved,
    runtime: {
      validated: runtimeValidated,
      requestedMode: runtimeRequestedMode,
      activeMode: runtimeActiveMode,
      fallbackActive: runtimeFallbackActive,
      evidenceSource: runtimeEvidenceObserved ? "runtime.lifecycle.endpoints" : null,
    },
    session: {
      observed: sessionObserved,
      activeMode: normalizedSession?.activeMode ?? null,
      provider: normalizedSession?.provider ?? null,
      model: normalizedSession?.model ?? null,
      bootstrapState: normalizedSession?.bootstrapState ?? null,
      fallbackReason: normalizedSession?.fallbackReason ?? null,
      evidenceSource: normalizedSession?.evidenceSource ?? null,
      connectedEventType,
    },
    summary: summaryParts.join(" | "),
  };
}

function buildCaseWikiEvidenceSignature(summary) {
  const caseWiki = isObject(summary.caseWiki) ? summary.caseWiki : {};
  const evidenceSignature = isObject(caseWiki.evidenceSignature) ? caseWiki.evidenceSignature : {};
  const signatureStatus = toOptionalString(evidenceSignature.status);
  const algorithm = toOptionalString(evidenceSignature.algorithm);
  const canonicalization = toOptionalString(evidenceSignature.canonicalization);
  const payloadHash = toOptionalString(evidenceSignature.payloadHash);
  const keyId = toOptionalString(evidenceSignature.keyId);
  const signerId = toOptionalString(evidenceSignature.signerId);
  const signedAt = toOptionalString(evidenceSignature.signedAt);
  const signaturePresent = toBoolean(evidenceSignature.signaturePresent);
  const totalArtifacts = signatureStatus !== null ? 1 : 0;
  const signedArtifacts = signatureStatus === "signed" ? 1 : 0;
  const unsignedArtifacts = signatureStatus === "unsigned" ? 1 : 0;
  const payloadHashValid = payloadHash !== null && /^sha256:[a-f0-9]{64}$/.test(payloadHash);
  const signedAtIsIso = signedAt !== null && isIsoTimestamp(signedAt);
  const signatureStatusValid = signatureStatus !== null && ["signed", "unsigned"].includes(signatureStatus);
  const algorithmValid = algorithm === "ed25519-sha256";
  const canonicalizationValid = canonicalization === "json-stable-v1";
  const signaturePresenceValid =
    (signatureStatus === "signed" && signaturePresent === true) ||
    (signatureStatus === "unsigned" && signaturePresent === false);
  const validated =
    totalArtifacts === 1 &&
    signatureStatusValid &&
    algorithmValid &&
    canonicalizationValid &&
    payloadHashValid &&
    signerId !== null &&
    signedAtIsIso &&
    signaturePresenceValid;
  const status = !validated ? "fail" : signatureStatus === "signed" ? "pass" : "warn";

  return {
    status,
    validated,
    totalArtifacts,
    signedArtifacts,
    unsignedArtifacts,
    signatureStatus,
    algorithm,
    canonicalization,
    payloadHash,
    keyId,
    signerId,
    signedAt,
    signedAtIsIso,
    signaturePresent,
    caseId: toOptionalString(caseWiki.caseId),
    sessionId: toOptionalString(caseWiki.sessionId),
    overviewStatus: toOptionalString(caseWiki.overviewStatus),
    focusKind: toOptionalString(caseWiki.focusKind),
    focusLabel: toOptionalString(caseWiki.focusLabel),
    nextAction: toOptionalString(caseWiki.nextAction),
    sourceRefsCount: Math.max(0, Math.trunc(toNumber(caseWiki.sourceRefsCount) ?? 0)),
  };
}

function buildCaseWikiRoutingContextEvidence(kpis) {
  const validated = toBoolean(kpis.caseWikiRoutingContextValidated) === true;
  const contextSource = toOptionalString(kpis.caseWikiRoutingContextSource);
  const focusId = toOptionalString(kpis.caseWikiRoutingContextFocusId);
  const blocker = toOptionalString(kpis.caseWikiRoutingContextBlocker);
  const nextAction = toOptionalString(kpis.caseWikiRoutingContextNextAction);
  const route = toOptionalString(kpis.caseWikiRoutingContextRoute);
  const mode = toOptionalString(kpis.caseWikiRoutingContextMode);
  const requestedIntent = toOptionalString(kpis.caseWikiRoutingContextRequestedIntent);
  const routedIntent = toOptionalString(kpis.caseWikiRoutingContextRoutedIntent);
  const observed =
    contextSource !== null ||
    focusId !== null ||
    blocker !== null ||
    nextAction !== null ||
    route !== null ||
    mode !== null ||
    requestedIntent !== null ||
    routedIntent !== null;
  const modeValid =
    mode !== null &&
    ["deterministic", "assistive_override", "assistive_match", "assistive_fallback"].includes(mode);
  const status =
    validated &&
    contextSource === "case_wiki" &&
    focusId !== null &&
    blocker !== null &&
    nextAction !== null &&
    route !== null &&
    requestedIntent !== null &&
    routedIntent !== null &&
    modeValid
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    contextSource,
    focusId,
    blocker,
    nextAction,
    route,
    mode,
    requestedIntent,
    routedIntent,
  };
}

function buildCaseWikiGatewayHydrationEvidence(kpis) {
  const validated = toBoolean(kpis.caseWikiGatewayHydrationValidated) === true;
  const sessionId = toOptionalString(kpis.caseWikiGatewayHydrationSessionId);
  const noteEventId = toOptionalString(kpis.caseWikiGatewayHydrationNoteEventId);
  const questionId = toOptionalString(kpis.caseWikiGatewayHydrationQuestionId);
  const questionMatched = toBoolean(kpis.caseWikiGatewayHydrationQuestionMatched);
  const noteSourceRefSeen = toBoolean(kpis.caseWikiGatewayHydrationNoteSourceRefSeen);
  const questionSuggestedNextStep = toOptionalString(kpis.caseWikiGatewayHydrationQuestionSuggestedNextStep);
  const contextSource = toOptionalString(kpis.caseWikiGatewayHydrationContextSource);
  const focusId = toOptionalString(kpis.caseWikiGatewayHydrationFocusId);
  const blocker = toOptionalString(kpis.caseWikiGatewayHydrationBlocker);
  const nextAction = toOptionalString(kpis.caseWikiGatewayHydrationNextAction);
  const route = toOptionalString(kpis.caseWikiGatewayHydrationRoute);
  const mode = toOptionalString(kpis.caseWikiGatewayHydrationMode);
  const requestedIntent = toOptionalString(kpis.caseWikiGatewayHydrationRequestedIntent);
  const routedIntent = toOptionalString(kpis.caseWikiGatewayHydrationRoutedIntent);
  const observed =
    sessionId !== null ||
    noteEventId !== null ||
    questionId !== null ||
    questionSuggestedNextStep !== null ||
    contextSource !== null ||
    focusId !== null ||
    blocker !== null ||
    nextAction !== null ||
    route !== null ||
    mode !== null ||
    requestedIntent !== null ||
    routedIntent !== null;
  const modeValid =
    mode !== null &&
    ["deterministic", "assistive_override", "assistive_match", "assistive_fallback"].includes(mode);
  const status =
    validated &&
    questionMatched === true &&
    noteSourceRefSeen === true &&
    sessionId !== null &&
    noteEventId !== null &&
    questionId !== null &&
    questionSuggestedNextStep !== null &&
    contextSource === "case_wiki" &&
    focusId !== null &&
    blocker !== null &&
    nextAction !== null &&
    route === "live-agent" &&
    requestedIntent === "conversation" &&
    routedIntent !== null &&
    modeValid
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    sessionId,
    noteEventId,
    questionId,
    questionMatched,
    noteSourceRefSeen,
    questionSuggestedNextStep,
    contextSource,
    focusId,
    blocker,
    nextAction,
    route,
    mode,
    requestedIntent,
    routedIntent,
  };
}

function buildCaseWikiContextAdoptionEvidence(kpis) {
  const validated = toBoolean(kpis.caseWikiContextAdoptionValidated) === true;
  const observedCount = Math.max(0, Math.trunc(toNumber(kpis.caseWikiContextAdoptionObservedCount) ?? 0));
  const caseWikiObservedCount = Math.max(0, Math.trunc(toNumber(kpis.caseWikiContextAdoptionCaseWikiCount) ?? 0));
  const inputOnlyObservedCount = Math.max(0, Math.trunc(toNumber(kpis.caseWikiContextAdoptionInputOnlyCount) ?? 0));
  const unknownObservedCount = Math.max(0, Math.trunc(toNumber(kpis.caseWikiContextAdoptionUnknownCount) ?? 0));
  const caseWikiRate = toNumber(kpis.caseWikiContextAdoptionRate);
  const observed = observedCount > 0;
  const countsConserved =
    caseWikiObservedCount + inputOnlyObservedCount + unknownObservedCount === observedCount;
  const rateValid =
    caseWikiRate !== null &&
    caseWikiRate >= 0 &&
    caseWikiRate <= 1 &&
    Math.abs(caseWikiRate - caseWikiObservedCount / Math.max(1, observedCount)) <= 0.0001;
  const status =
    validated &&
    observedCount >= 3 &&
    caseWikiObservedCount >= 1 &&
    inputOnlyObservedCount >= 0 &&
    unknownObservedCount === 0 &&
    countsConserved &&
    rateValid &&
    caseWikiRate >= 0.95
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    observedCount,
    caseWikiObservedCount,
    inputOnlyObservedCount,
    unknownObservedCount,
    caseWikiRate,
  };
}

function buildUiRefHealingEvidence(kpis) {
  const validated = toBoolean(kpis.uiRefHealingValidated) === true;
  const finalStatus = toOptionalString(kpis.uiRefHealingFinalStatus);
  const adapterMode = toOptionalString(kpis.uiRefHealingAdapterMode);
  const healedRefTargets = toStringArray(kpis.uiRefHealingHealedRefTargets);
  const staleRefTargets = toStringArray(kpis.uiRefHealingStaleRefTargets);
  const healedRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.uiRefHealingHealedRefCount) ?? healedRefTargets.length),
  );
  const staleRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.uiRefHealingStaleRefCount) ?? staleRefTargets.length),
  );
  const traceCount = Math.max(0, Math.trunc(toNumber(kpis.uiRefHealingTraceCount) ?? 0));
  const retries = Math.max(0, Math.trunc(toNumber(kpis.uiRefHealingRetries) ?? 0));
  const disabledSubmitSeen = toBoolean(kpis.uiRefHealingDisabledSubmitSeen);
  const enabledSubmitSeen = toBoolean(kpis.uiRefHealingEnabledSubmitSeen);
  const healingObservationSeen = toBoolean(kpis.uiRefHealingObservationSeen);
  const healingNoteSeen = toBoolean(kpis.uiRefHealingNoteSeen);
  const observed =
    finalStatus !== null ||
    adapterMode !== null ||
    healedRefCount > 0 ||
    staleRefCount > 0 ||
    traceCount > 0;
  const healedTargetsValid =
    healedRefCount >= 2 &&
    healedRefTargets.includes("email") &&
    healedRefTargets.includes("submit_primary");
  const countsConserved =
    healedRefCount === healedRefTargets.length && staleRefCount === staleRefTargets.length;
  const status =
    validated &&
    finalStatus === "completed" &&
    adapterMode === "remote_http" &&
    healedTargetsValid &&
    countsConserved &&
    staleRefCount === 0 &&
    traceCount >= 5 &&
    disabledSubmitSeen === true &&
    enabledSubmitSeen === true &&
    healingObservationSeen === true &&
    healingNoteSeen === true
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    finalStatus,
    adapterMode,
    healedRefCount,
    healedRefTargets,
    staleRefCount,
    staleRefTargets,
    traceCount,
    retries,
    disabledSubmitSeen,
    enabledSubmitSeen,
    healingObservationSeen,
    healingNoteSeen,
  };
}

function buildBrowserWorkerRecoveryEvidence(kpis) {
  const validated = toBoolean(kpis.browserWorkerRecoveryValidated) === true;
  const finalStatus = toOptionalString(kpis.browserWorkerRecoveryFinalStatus);
  const adapterMode = toOptionalString(kpis.browserWorkerRecoveryAdapterMode);
  const checkpointCount = Math.max(0, Math.trunc(toNumber(kpis.browserWorkerRecoveryCheckpointCount) ?? 0));
  const resumedCheckpointCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryResumedCheckpointCount) ?? 0),
  );
  const healedRefTargets = toStringArray(kpis.browserWorkerRecoveryHealedRefTargets);
  const healedRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryHealedRefCount) ?? healedRefTargets.length),
  );
  const staleRefTargets = toStringArray(kpis.browserWorkerRecoveryStaleRefTargets);
  const staleRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryStaleRefCount) ?? staleRefTargets.length),
  );
  const traceCount = Math.max(0, Math.trunc(toNumber(kpis.browserWorkerRecoveryTraceCount) ?? 0));
  const retryCount = Math.max(0, Math.trunc(toNumber(kpis.browserWorkerRecoveryRetryCount) ?? 0));
  const runtimeRetryCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryRuntimeRetryCount) ?? 0),
  );
  const runtimeResumedCheckpointCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryRuntimeResumedCheckpointCount) ?? 0),
  );
  const runtimeStaleRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryRuntimeStaleRefCount) ?? 0),
  );
  const runtimeHealedRefCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.browserWorkerRecoveryRuntimeHealedRefCount) ?? 0),
  );
  const checkpointReadyCleared = toBoolean(kpis.browserWorkerRecoveryCheckpointReadyCleared);
  const summary = toOptionalString(kpis.browserWorkerRecoverySummary);
  const observed =
    finalStatus !== null ||
    adapterMode !== null ||
    checkpointCount > 0 ||
    resumedCheckpointCount > 0 ||
    healedRefCount > 0 ||
    staleRefCount > 0 ||
    traceCount > 0;
  const healedTargetsValid =
    healedRefCount >= 2 &&
    healedRefTargets.includes("email") &&
    healedRefTargets.includes("submit_primary");
  const staleTargetsValid =
    staleRefCount >= healedRefCount &&
    staleRefTargets.includes("email") &&
    staleRefTargets.includes("submit_primary");
  const countsConserved =
    healedRefCount === healedRefTargets.length && staleRefCount === staleRefTargets.length;
  const status =
    validated &&
    finalStatus === "completed" &&
    adapterMode === "remote_http" &&
    checkpointCount >= 1 &&
    resumedCheckpointCount >= 1 &&
    healedTargetsValid &&
    staleTargetsValid &&
    countsConserved &&
    traceCount >= 7 &&
    checkpointReadyCleared === true &&
    runtimeResumedCheckpointCount >= resumedCheckpointCount &&
    runtimeHealedRefCount >= healedRefCount &&
    runtimeStaleRefCount >= staleRefCount
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    finalStatus,
    adapterMode,
    checkpointCount,
    resumedCheckpointCount,
    healedRefCount,
    healedRefTargets,
    staleRefCount,
    staleRefTargets,
    traceCount,
    retryCount,
    runtimeRetryCount,
    runtimeResumedCheckpointCount,
    runtimeStaleRefCount,
    runtimeHealedRefCount,
    checkpointReadyCleared,
    summary,
  };
}

function buildNavigatorVisaFlowsEvidence(kpis) {
  const validated = toBoolean(kpis.navigatorVisaFlowsValidated) === true;
  const totalFlows = Math.max(0, Math.trunc(toNumber(kpis.navigatorVisaFlowsTotal) ?? 0));
  const succeededFlows = Math.max(0, Math.trunc(toNumber(kpis.navigatorVisaFlowsSucceeded) ?? 0));
  const successRate = Math.max(0, toNumber(kpis.navigatorVisaFlowsSuccessRate) ?? 0);
  const persistentSessionCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.navigatorVisaFlowsPersistentSessionCount) ?? 0),
  );
  const replayBundleCount = Math.max(0, Math.trunc(toNumber(kpis.navigatorVisaFlowsReplayBundleCount) ?? 0));
  const verifiedCount = Math.max(0, Math.trunc(toNumber(kpis.navigatorVisaFlowsVerifiedCount) ?? 0));
  const staleRecoveryObservedCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.navigatorVisaFlowsStaleRecoveryObservedCount) ?? 0),
  );
  const healedRecoveryObservedCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.navigatorVisaFlowsHealedRecoveryObservedCount) ?? 0),
  );
  const resumedCheckpointCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.navigatorVisaFlowsResumedCheckpointCount) ?? 0),
  );
  const checkpointReadyClearedCount = Math.max(
    0,
    Math.trunc(toNumber(kpis.navigatorVisaFlowsCheckpointReadyClearedCount) ?? 0),
  );
  const scenarioNames = toStringArray(kpis.navigatorVisaFlowsScenarioNames);
  const summary = toOptionalString(kpis.navigatorVisaFlowsSummary);
  const observed =
    totalFlows > 0 ||
    succeededFlows > 0 ||
    scenarioNames.length > 0 ||
    persistentSessionCount > 0 ||
    replayBundleCount > 0 ||
    verifiedCount > 0;
  const countsConserved = succeededFlows <= totalFlows && scenarioNames.length === totalFlows;
  const status =
    validated &&
    totalFlows >= 3 &&
    succeededFlows === totalFlows &&
    successRate >= 1 &&
    countsConserved &&
    persistentSessionCount === totalFlows &&
    replayBundleCount === totalFlows &&
    verifiedCount === totalFlows &&
    staleRecoveryObservedCount === totalFlows &&
    healedRecoveryObservedCount === totalFlows &&
    resumedCheckpointCount === totalFlows &&
    checkpointReadyClearedCount === totalFlows
      ? "pass"
      : observed
        ? "fail"
        : "unavailable";

  return {
    status,
    validated,
    observed,
    totalFlows,
    succeededFlows,
    successRate,
    persistentSessionCount,
    replayBundleCount,
    verifiedCount,
    staleRecoveryObservedCount,
    healedRecoveryObservedCount,
    resumedCheckpointCount,
    checkpointReadyClearedCount,
    scenarioNames,
    summary,
  };
}

function buildProviderUsage(kpis) {
  const entries = [];
  let validated = true;
  let observed = false;

  function registerEntry(params) {
    if (!params.observed) {
      return;
    }
    observed = true;
    if (!params.valid) {
      validated = false;
      return;
    }
    entries.push(params.entry);
  }

  const storytellerTtsProvider = toOptionalString(kpis.storytellerTtsProvider);
  const storytellerTtsModel = toOptionalString(kpis.storytellerTtsModel);
  const storytellerTtsDefaultProvider = toOptionalString(kpis.storytellerTtsDefaultProvider);
  const storytellerTtsDefaultModel = toOptionalString(kpis.storytellerTtsDefaultModel);
  const storytellerTtsSelectionReason = toOptionalString(kpis.storytellerTtsSelectionReason);
  const storytellerTtsSecondaryProvider = toOptionalString(kpis.storytellerTtsSecondaryProvider);
  const storytellerTtsSecondaryModel = toOptionalString(kpis.storytellerTtsSecondaryModel);
  const storytellerTtsMetadataValidated = toBoolean(kpis.storytellerTtsMetadataValidated) === true;

  const hasStorytellerTtsMetadata =
    storytellerTtsProvider !== null &&
    storytellerTtsModel !== null &&
    storytellerTtsDefaultProvider !== null &&
    storytellerTtsDefaultModel !== null &&
    storytellerTtsSelectionReason !== null;
  const storytellerTtsObserved =
    hasStorytellerTtsMetadata ||
    storytellerTtsMetadataValidated ||
    storytellerTtsSecondaryProvider !== null ||
    storytellerTtsSecondaryModel !== null;
  const storytellerTtsSecondaryActive =
    hasStorytellerTtsMetadata && storytellerTtsProvider !== storytellerTtsDefaultProvider;
  registerEntry({
    observed: storytellerTtsObserved,
    valid: storytellerTtsMetadataValidated && hasStorytellerTtsMetadata,
    entry: {
      route: "storyteller-agent",
      capability: "tts",
      defaultProvider: storytellerTtsDefaultProvider,
      defaultModel: storytellerTtsDefaultModel,
      selectedProvider: storytellerTtsProvider,
      selectedModel: storytellerTtsModel,
      selectionReason: storytellerTtsSelectionReason,
      secondaryProvider: storytellerTtsSecondaryProvider,
      secondaryModel: storytellerTtsSecondaryModel,
      secondaryActive: storytellerTtsSecondaryActive,
    },
  });

  const storytellerImageEditProvider = toOptionalString(kpis.storytellerImageEditProvider);
  const storytellerImageEditModel = toOptionalString(kpis.storytellerImageEditModel);
  const storytellerImageEditDefaultProvider = toOptionalString(kpis.storytellerImageEditDefaultProvider);
  const storytellerImageEditDefaultModel = toOptionalString(kpis.storytellerImageEditDefaultModel);
  const storytellerImageEditMode = toOptionalString(kpis.storytellerImageEditMode);
  const storytellerImageEditSelectionReason = toOptionalString(kpis.storytellerImageEditSelectionReason);
  const storytellerImageEditRequested = toBoolean(kpis.storytellerImageEditRequested);
  const storytellerImageEditApplied = toBoolean(kpis.storytellerImageEditApplied);
  const storytellerImageEditMetadataValidated = toBoolean(kpis.storytellerImageEditMetadataValidated) === true;
  const hasStorytellerImageEditMetadata =
    storytellerImageEditProvider !== null &&
    storytellerImageEditModel !== null &&
    storytellerImageEditDefaultProvider !== null &&
    storytellerImageEditDefaultModel !== null &&
    storytellerImageEditSelectionReason !== null &&
    storytellerImageEditRequested === true &&
    storytellerImageEditApplied === true;
  const storytellerImageEditDisabled = storytellerImageEditMode === "disabled";
  const storytellerImageEditObserved =
    (storytellerImageEditRequested === true && !storytellerImageEditDisabled) ||
    storytellerImageEditApplied === true ||
    storytellerImageEditMetadataValidated;

  registerEntry({
    observed: storytellerImageEditObserved,
    valid: storytellerImageEditMetadataValidated && hasStorytellerImageEditMetadata,
    entry: {
      route: "storyteller-agent",
      capability: "image_edit",
      defaultProvider: storytellerImageEditDefaultProvider,
      defaultModel: storytellerImageEditDefaultModel,
      selectedProvider: storytellerImageEditProvider,
      selectedModel: storytellerImageEditModel,
      selectionReason: storytellerImageEditSelectionReason,
      secondaryProvider: null,
      secondaryModel: null,
      secondaryActive: false,
    },
  });

  const researchProvider = toOptionalString(kpis.researchProvider);
  const researchModel = toOptionalString(kpis.researchModel);
  const researchDefaultProvider = toOptionalString(kpis.researchDefaultProvider);
  const researchDefaultModel = toOptionalString(kpis.researchDefaultModel);
  const researchSelectionReason = toOptionalString(kpis.researchSelectionReason);
  const researchCitationCount = Math.max(0, Math.trunc(toNumber(kpis.researchCitationCount) ?? 0));
  const researchSourceUrlCount = Math.max(0, Math.trunc(toNumber(kpis.researchSourceUrlCount) ?? 0));
  const researchMetadataValidated = toBoolean(kpis.researchMetadataValidated) === true;
  const hasResearchMetadata =
    researchProvider !== null &&
    researchModel !== null &&
    researchDefaultProvider !== null &&
    researchDefaultModel !== null &&
    researchSelectionReason !== null &&
    researchCitationCount >= 2 &&
    researchSourceUrlCount >= 2;
  const researchObserved =
    hasResearchMetadata || researchMetadataValidated || researchCitationCount >= 1 || researchSourceUrlCount >= 1;
  registerEntry({
    observed: researchObserved,
    valid: researchMetadataValidated && hasResearchMetadata,
    entry: {
      route: "live-agent",
      capability: "research",
      defaultProvider: researchDefaultProvider,
      defaultModel: researchDefaultModel,
      selectedProvider: researchProvider,
      selectedModel: researchModel,
      selectionReason: researchSelectionReason,
      secondaryProvider: null,
      secondaryModel: null,
      secondaryActive: false,
      citationCount: researchCitationCount,
      sourceUrlCount: researchSourceUrlCount,
    },
  });

  const assistiveRouterProvider = toOptionalString(kpis.assistiveRouterProvider);
  const assistiveRouterModel = toOptionalString(kpis.assistiveRouterModel);
  const assistiveRouterDefaultProvider = toOptionalString(kpis.assistiveRouterDefaultProvider);
  const assistiveRouterDefaultModel = toOptionalString(kpis.assistiveRouterDefaultModel);
  const assistiveRouterSelectionReason = toOptionalString(kpis.assistiveRouterSelectionReason);
  const assistiveRouterBudgetPolicy = toOptionalString(kpis.assistiveRouterBudgetPolicy);
  const assistiveRouterPromptCaching = toOptionalString(kpis.assistiveRouterPromptCaching);
  const assistiveRouterWatchlistEnabled = toBoolean(kpis.assistiveRouterWatchlistEnabled);
  const assistiveRouterProviderMetadataValidated = toBoolean(kpis.assistiveRouterProviderMetadataValidated) === true;
  const hasAssistiveRouterMetadata =
    assistiveRouterProvider !== null &&
    assistiveRouterModel !== null &&
    assistiveRouterDefaultProvider !== null &&
    assistiveRouterDefaultModel !== null &&
    assistiveRouterSelectionReason !== null &&
    assistiveRouterBudgetPolicy !== null &&
    assistiveRouterPromptCaching !== null &&
    assistiveRouterWatchlistEnabled !== null;
  const assistiveRouterObserved =
    hasAssistiveRouterMetadata ||
    assistiveRouterProviderMetadataValidated ||
    assistiveRouterProvider !== null ||
    assistiveRouterModel !== null;

  registerEntry({
    observed: assistiveRouterObserved,
    valid: assistiveRouterProviderMetadataValidated && hasAssistiveRouterMetadata,
    entry: {
      route: "orchestrator",
      capability: "routing_reasoning",
      defaultProvider: assistiveRouterDefaultProvider,
      defaultModel: assistiveRouterDefaultModel,
      selectedProvider: assistiveRouterProvider,
      selectedModel: assistiveRouterModel,
      selectionReason: assistiveRouterSelectionReason,
      budgetPolicy: assistiveRouterBudgetPolicy,
      promptCaching: assistiveRouterPromptCaching,
      watchlistEnabled: assistiveRouterWatchlistEnabled,
      secondaryProvider: null,
      secondaryModel: null,
      secondaryActive:
        assistiveRouterProvider !== null &&
        assistiveRouterDefaultProvider !== null &&
        assistiveRouterProvider !== assistiveRouterDefaultProvider,
    },
  });

  const activeSecondaryProviders = entries.filter((entry) => entry.secondaryActive === true).length;

  return {
    status: observed && validated && entries.length > 0 ? "pass" : "fail",
    validated: observed && validated && entries.length > 0,
    activeSecondaryProviders,
    entries,
  };
}

function fail(message, details) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message,
      details: details ?? null,
    })}\n`,
  );
  process.exit(1);
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(normalized);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = resolve(args.policy ?? "artifacts/demo-e2e/policy-check.json");
  const summaryPath = resolve(args.summary ?? "artifacts/demo-e2e/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/demo-e2e/badge.json");
  const detailsPath = resolve(args.detailsOutput ?? "artifacts/demo-e2e/badge-details.json");

  const policy = await readJson(policyPath);
  const summary = await readJson(summaryPath);

  if (!isObject(policy) || !isObject(summary)) {
    fail("Invalid input JSON for badge generation", { policyPath, summaryPath });
  }

  const ok = policy.ok === true;
  const checks = toNumber(policy.checks) ?? 0;
  const violations = Array.isArray(policy.violations) ? policy.violations.length : 0;
  const kpis = isObject(summary.kpis) ? summary.kpis : {};
  const roundTripMs = toNumber(kpis.gatewayWsRoundTripMs);
  const costEstimate = buildCostEstimate(summary, kpis);
  const tokensUsed = buildTokensUsed(summary, kpis);

  const operatorTurnTruncationEvidence = buildTurnEvidence(kpis, {
    validatedKey: "operatorTurnTruncationSummaryValidated",
    expectedEventKey: "operatorTurnTruncationExpectedEventSeen",
    totalKey: "operatorTurnTruncationTotal",
    uniqueRunsKey: "operatorTurnTruncationUniqueRuns",
    uniqueSessionsKey: "operatorTurnTruncationUniqueSessions",
    latestSeenAtKey: "operatorTurnTruncationLatestSeenAt",
    latestTurnIdKey: "operatorTurnTruncationLatestTurnId",
    latestReasonKey: "operatorTurnTruncationLatestReason",
    latestAudioEndMsKey: "operatorTurnTruncationLatestAudioEndMs",
    latestContentIndexKey: "operatorTurnTruncationLatestContentIndex",
  });
  const operatorTurnDeleteEvidence = buildTurnEvidence(kpis, {
    validatedKey: "operatorTurnDeleteSummaryValidated",
    expectedEventKey: "operatorTurnDeleteExpectedEventSeen",
    totalKey: "operatorTurnDeleteTotal",
    uniqueRunsKey: "operatorTurnDeleteUniqueRuns",
    uniqueSessionsKey: "operatorTurnDeleteUniqueSessions",
    latestSeenAtKey: "operatorTurnDeleteLatestSeenAt",
    latestTurnIdKey: "operatorTurnDeleteLatestTurnId",
    latestReasonKey: "operatorTurnDeleteLatestReason",
    latestScopeKey: "operatorTurnDeleteLatestScope",
  });
  const damageControlEvidence = buildDamageControlEvidence(kpis);
  const operatorDamageControlEvidence = buildOperatorDamageControlEvidence(kpis);
  const governancePolicyEvidence = buildGovernancePolicyEvidence(kpis);
  const skillsRegistryEvidence = buildSkillsRegistryEvidence(kpis);
  const pluginMarketplaceEvidence = buildPluginMarketplaceEvidence(kpis);
  const deviceNodesEvidence = buildDeviceNodesEvidence(kpis);
  const agentUsageEvidence = buildAgentUsageEvidence(kpis);
  const runtimeGuardrailsSignalPathsEvidence = buildRuntimeGuardrailsSignalPathsEvidence(kpis);
  const liveTransport = buildLiveTransport(summary, kpis);
  const caseWikiEvidenceSignature = buildCaseWikiEvidenceSignature(summary);
  const caseWikiRoutingContext = buildCaseWikiRoutingContextEvidence(kpis);
  const caseWikiGatewayHydration = buildCaseWikiGatewayHydrationEvidence(kpis);
  const caseWikiContextAdoption = buildCaseWikiContextAdoptionEvidence(kpis);
  const uiRefHealing = buildUiRefHealingEvidence(kpis);
  const browserWorkerRecovery = buildBrowserWorkerRecoveryEvidence(kpis);
  const navigatorVisaFlows = buildNavigatorVisaFlowsEvidence(kpis);
  const providerUsage = buildProviderUsage(kpis);

  let color = "red";
  if (ok) {
    color = "brightgreen";
  } else if (violations <= 2) {
    color = "orange";
  }

  const messageParts = [ok ? "pass" : "fail", `${checks} checks`];
  if (roundTripMs !== null) {
    messageParts.push(`${roundTripMs}ms ws`);
  }

  const badge = {
    schemaVersion: 1,
    label: "Demo KPI Gate",
    message: messageParts.join(" | "),
    color,
    cacheSeconds: 300,
  };

  const details = {
    generatedAt: new Date().toISOString(),
    ok,
    policyPath,
    summaryPath,
    checks,
    violations,
    roundTripMs,
    costEstimate,
    tokensUsed,
    liveTransport,
    providerUsage,
    evidence: {
      sourceSummaryGeneratedAt: toOptionalString(summary.generatedAt),
      operatorTurnTruncation: operatorTurnTruncationEvidence,
      operatorTurnDelete: operatorTurnDeleteEvidence,
      damageControl: damageControlEvidence,
      operatorDamageControl: operatorDamageControlEvidence,
      governancePolicy: governancePolicyEvidence,
      skillsRegistry: skillsRegistryEvidence,
      pluginMarketplace: pluginMarketplaceEvidence,
      deviceNodes: deviceNodesEvidence,
      agentUsage: agentUsageEvidence,
      runtimeGuardrailsSignalPaths: runtimeGuardrailsSignalPathsEvidence,
      caseWikiEvidenceSignature,
      caseWikiRoutingContext,
      caseWikiGatewayHydration,
      caseWikiContextAdoption,
      uiRefHealing,
      browserWorkerRecovery,
      navigatorVisaFlows,
    },
    badge,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(detailsPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(badge, null, 2)}\n`, "utf8");
  await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      output: outputPath,
      detailsOutput: detailsPath,
      badge,
    })}\n`,
  );
}

main().catch((error) => {
  fail("Badge generation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
