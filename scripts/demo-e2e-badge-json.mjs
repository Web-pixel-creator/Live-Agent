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

function buildDeviceNodesEvidence(kpis) {
  const lookupValidated = toBoolean(kpis.operatorDeviceNodeLookupValidated) === true;
  const versionConflictValidated = toBoolean(kpis.operatorDeviceNodeVersionConflictValidated) === true;
  const healthSummaryValidated = toBoolean(kpis.operatorDeviceNodeHealthSummaryValidated) === true;

  const lookupStatus = toOptionalString(kpis.operatorDeviceNodeLookupStatus) ?? "";
  const lookupVersion = toNumber(kpis.operatorDeviceNodeLookupVersion) ?? 0;
  const updatedVersion = toNumber(kpis.operatorDeviceNodeUpdatedVersion) ?? 0;
  const versionConflictStatusCode = toNumber(kpis.operatorDeviceNodeVersionConflictStatusCode) ?? 0;
  const versionConflictCode = toOptionalString(kpis.operatorDeviceNodeVersionConflictCode) ?? "";
  const summaryTotal = toNumber(kpis.operatorDeviceNodeSummaryTotal) ?? 0;
  const summaryDegraded = toNumber(kpis.operatorDeviceNodeSummaryDegraded) ?? 0;
  const summaryStale = toNumber(kpis.operatorDeviceNodeSummaryStale) ?? 0;
  const summaryMissingHeartbeat = toNumber(kpis.operatorDeviceNodeSummaryMissingHeartbeat) ?? 0;
  const summaryRecentContainsLookup = toBoolean(kpis.operatorDeviceNodeSummaryRecentContainsLookup) === true;

  const validated = lookupValidated && versionConflictValidated && healthSummaryValidated;
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
    summaryRecentContainsLookup
      ? "pass"
      : "fail";

  return {
    status,
    validated,
    lookupValidated,
    versionConflictValidated,
    healthSummaryValidated,
    lookupStatus,
    lookupVersion,
    updatedVersion,
    versionConflictStatusCode,
    versionConflictCode,
    summaryTotal,
    summaryDegraded,
    summaryStale,
    summaryMissingHeartbeat,
    summaryRecentContainsLookup,
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
  const deviceNodesEvidence = buildDeviceNodesEvidence(kpis);

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
    evidence: {
      sourceSummaryGeneratedAt: toOptionalString(summary.generatedAt),
      operatorTurnTruncation: operatorTurnTruncationEvidence,
      operatorTurnDelete: operatorTurnDeleteEvidence,
      damageControl: damageControlEvidence,
      operatorDamageControl: operatorDamageControlEvidence,
      governancePolicy: governancePolicyEvidence,
      skillsRegistry: skillsRegistryEvidence,
      deviceNodes: deviceNodesEvidence,
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
