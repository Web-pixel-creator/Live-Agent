import {
  listAuthProfileSnapshots,
  type AuthProfileSnapshot,
} from "@mla/skills";
import type { DeviceNodeRecord } from "./firestore.js";

type BootstrapCheckStatus = "ok" | "warn" | "fail";

type ProviderStatus = {
  id: string;
  label: string;
  category: "primary" | "secondary" | "watchlist";
  required: boolean;
  configured: boolean;
  status: "configured" | "deferred" | "missing_required" | "not_configured";
  envKeys: string[];
  activeEnvKey: string | null;
};

type BootstrapCheck = {
  id: string;
  status: BootstrapCheckStatus;
  title: string;
  message: string;
  hint: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function toCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function getService(services: Array<Record<string, unknown>>, name: string): Record<string, unknown> | null {
  return services.find((item) => item.name === name) ?? null;
}

function hasAnyEnv(env: NodeJS.ProcessEnv, keys: string[]): { configured: boolean; activeEnvKey: string | null } {
  for (const key of keys) {
    if (toNonEmptyString(env[key])) {
      return {
        configured: true,
        activeEnvKey: key,
      };
    }
  }
  return {
    configured: false,
    activeEnvKey: null,
  };
}

function buildProviderStatuses(
  env: NodeJS.ProcessEnv,
  localFirstLike: boolean,
  liveGatewayAuthConfigured: boolean,
): ProviderStatus[] {
  const providers = [
    {
      id: "gemini-primary",
      label: "Gemini / Live API",
      category: "primary" as const,
      required: true,
      envKeys: [
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_GENAI_API_KEY",
        "LIVE_AGENT_GEMINI_API_KEY",
        "STORYTELLER_GEMINI_API_KEY",
        "UI_NAVIGATOR_GEMINI_API_KEY",
        "LIVE_API_API_KEY",
      ],
    },
    {
      id: "deepgram-tts",
      label: "Deepgram Aura-2",
      category: "secondary" as const,
      required: false,
      envKeys: ["DEEPGRAM_API_KEY"],
    },
    {
      id: "fal-image-edit",
      label: "fal image-edit",
      category: "secondary" as const,
      required: false,
      envKeys: ["FAL_KEY", "FAL_API_KEY"],
    },
    {
      id: "perplexity-research",
      label: "Perplexity Sonar",
      category: "secondary" as const,
      required: false,
      envKeys: ["PERPLEXITY_API_KEY", "LIVE_AGENT_RESEARCH_API_KEY"],
    },
    {
      id: "openai-reasoning",
      label: "OpenAI reasoning",
      category: "secondary" as const,
      required: false,
      envKeys: ["OPENAI_API_KEY"],
    },
    {
      id: "anthropic-reasoning",
      label: "Anthropic reasoning",
      category: "secondary" as const,
      required: false,
      envKeys: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "deepseek-reasoning",
      label: "DeepSeek reasoning",
      category: "secondary" as const,
      required: false,
      envKeys: ["DEEPSEEK_API_KEY"],
    },
    {
      id: "moonshot-watchlist",
      label: "Moonshot / Kimi watchlist",
      category: "watchlist" as const,
      required: false,
      envKeys: ["MOONSHOT_API_KEY"],
    },
  ];

  return providers.map((provider) => {
    const availability = hasAnyEnv(env, provider.envKeys);
    const configured = availability.configured || (provider.id === "gemini-primary" && liveGatewayAuthConfigured);
    const activeEnvKey =
      availability.activeEnvKey ??
      (provider.id === "gemini-primary" && liveGatewayAuthConfigured ? "LIVE_API_AUTH_PROFILES_JSON" : null);
    const status = availability.configured
      ? "configured"
      : provider.id === "gemini-primary" && liveGatewayAuthConfigured
        ? "configured"
      : provider.required
        ? localFirstLike
          ? "deferred"
          : "missing_required"
        : "not_configured";
    return {
      ...provider,
      configured,
      status,
      activeEnvKey,
    };
  });
}

function summarizeAuthProfiles(snapshots: AuthProfileSnapshot[]) {
  const directOverrides = snapshots.filter((item) => item.directValueConfigured).length;
  const explicitCredentialSelections = snapshots.filter((item) => item.explicitCredentialName).length;
  const activeCredentialCount = snapshots.filter(
    (item) => item.effectiveResolution.source === "credential_store" && item.activeCredentialName,
  ).length;
  const warnings = snapshots.reduce((count, item) => count + item.warnings.length, 0);
  const ready = snapshots.filter(
    (item) =>
      item.directValueConfigured ||
      item.explicitCredentialName ||
      (item.effectiveResolution.source === "credential_store" && item.activeCredentialName),
  ).length;
  return {
    total: snapshots.length,
    ready,
    directOverrides,
    explicitCredentialSelections,
    activeCredentialCount,
    warnings,
  };
}

function buildFallbackSummary(params: {
  env: NodeJS.ProcessEnv;
  services: Array<Record<string, unknown>>;
}): {
  liveTextFallbackReady: boolean;
  storyFallbackReady: boolean;
  uiSimulationFallbackReady: boolean;
  localFirstReady: boolean;
  readyCount: number;
  total: number;
} {
  const uiExecutor = getService(params.services, "ui-executor");
  const uiExecutorRuntime = uiExecutor && isRecord(uiExecutor.profile) ? uiExecutor.profile : null;
  const uiExecutorForceSimulation = uiExecutor?.forceSimulation === true;
  const uiExecutorSimulateIfUnavailable = uiExecutor?.simulateIfUnavailable === true;
  const localFirstReady =
    toBoolean(params.env.LOCAL_FIRST_PROFILE) === true ||
    toNonEmptyString(params.env.RUNTIME_PROFILE)?.toLowerCase() === "local-first" ||
    toNonEmptyString(params.env.APP_ENV)?.toLowerCase() === "dev";
  const liveTextFallbackReady = true;
  const storyMediaMode = toNonEmptyString(params.env.STORYTELLER_MEDIA_MODE)?.toLowerCase() ?? "fallback";
  const storyFallbackReady = storyMediaMode === "fallback" || storyMediaMode === "simulated";
  const uiExecutorProfileKind = toNonEmptyString(uiExecutorRuntime?.profile)?.toLowerCase();
  const uiSimulationFallbackReady =
    uiExecutorForceSimulation ||
    uiExecutorSimulateIfUnavailable ||
    toNonEmptyString(params.env.UI_NAVIGATOR_EXECUTOR_MODE)?.toLowerCase() === "simulated" ||
    uiExecutorProfileKind === "local-first";
  const items = [liveTextFallbackReady, storyFallbackReady, uiSimulationFallbackReady, localFirstReady];
  return {
    liveTextFallbackReady,
    storyFallbackReady,
    uiSimulationFallbackReady,
    localFirstReady,
    readyCount: items.filter(Boolean).length,
    total: items.length,
  };
}

function buildUiExecutorHardeningCheck(services: Array<Record<string, unknown>>): BootstrapCheck | null {
  const uiExecutor = getService(services, "ui-executor");
  const sandbox = uiExecutor && isRecord(uiExecutor.sandbox) ? uiExecutor.sandbox : null;
  if (!sandbox) {
    return null;
  }

  const mode = toNonEmptyString(sandbox.mode) ?? "off";
  const networkPolicy = toNonEmptyString(sandbox.networkPolicy) ?? "allow_all";
  const setupMarker = isRecord(sandbox.setupMarker) ? sandbox.setupMarker : null;
  const setupStatus = toNonEmptyString(setupMarker?.status) ?? "unconfigured";
  const readRoots = toCount(sandbox.allowedReadRootsCount);
  const writeRoots = toCount(sandbox.allowedWriteRootsCount);
  const blockFileUrls = toBoolean(sandbox.blockFileUrls);
  const allowLoopbackHosts = toBoolean(sandbox.allowLoopbackHosts);

  const issues: string[] = [];
  if (mode !== "enforce") {
    issues.push(`mode=${mode}`);
  }
  if (networkPolicy === "allow_all") {
    issues.push(`network=${networkPolicy}`);
  }
  if (setupStatus !== "current") {
    issues.push(`setup=${setupStatus}`);
  }
  if (readRoots <= 0) {
    issues.push("read_roots=0");
  }
  if (writeRoots <= 0) {
    issues.push("write_roots=0");
  }
  if (blockFileUrls === false) {
    issues.push("file_urls=allowed");
  }
  if (allowLoopbackHosts === true) {
    issues.push("loopback=allowed");
  }

  const status: BootstrapCheckStatus =
    mode === "off" || setupStatus === "missing" || setupStatus === "stale" || readRoots <= 0 || writeRoots <= 0
      ? "fail"
      : issues.length > 0
        ? "warn"
        : "ok";

  return {
    id: "ui_executor_hardening",
    status,
    title: "UI executor hardening",
    message:
      issues.length <= 0
        ? "Sandbox/network/setup posture is aligned for runtime hardening."
        : `Sandbox posture requires attention (${issues.join(", ")}).`,
    hint:
      issues.length <= 0
        ? null
        : "Keep ui-executor in enforce mode with restrictive network policy, current setup marker, and configured write roots for local artifact refs.",
  };
}

function buildChecks(params: {
  env: NodeJS.ProcessEnv;
  services: Array<Record<string, unknown>>;
  providerStatuses: ProviderStatus[];
  authProfiles: AuthProfileSnapshot[];
  deviceNodes: DeviceNodeRecord[];
  fallbackSummary: ReturnType<typeof buildFallbackSummary>;
}): BootstrapCheck[] {
  const checks: BootstrapCheck[] = [];
  const primaryGemini = params.providerStatuses.find((item) => item.id === "gemini-primary") ?? null;
  const localFirstLike = params.fallbackSummary.localFirstReady;
  checks.push({
    id: "provider_gemini_primary",
    status:
      primaryGemini?.configured === true
        ? "ok"
        : localFirstLike
          ? "warn"
          : "fail",
    title: "Primary Gemini provider",
    message:
      primaryGemini?.configured === true
        ? `Configured via ${primaryGemini.activeEnvKey}.`
        : localFirstLike
          ? "Primary Gemini provider is not configured, but local-first fallback posture is active."
          : "Primary Gemini provider is missing.",
    hint:
      primaryGemini?.configured === true
        ? null
        : "Set GEMINI_API_KEY or service-scoped Gemini key before judged or production flows.",
  });

  const masterKeyConfigured = Boolean(toNonEmptyString(params.env.CREDENTIAL_STORE_MASTER_KEY));
  checks.push({
    id: "credential_store_master_key",
    status: masterKeyConfigured ? "ok" : "warn",
    title: "Credential store master key",
    message: masterKeyConfigured
      ? "Credential store master key is configured."
      : "Credential store master key is not configured.",
    hint: masterKeyConfigured
      ? null
      : "Set CREDENTIAL_STORE_MASTER_KEY before relying on repo-owned credential rotation.",
  });

  const authProfileReadyCount = params.authProfiles.filter(
    (item) =>
      item.directValueConfigured ||
      item.explicitCredentialName ||
      (item.effectiveResolution.source === "credential_store" && item.activeCredentialName),
  ).length;
  const authProfileWarnings = params.authProfiles.reduce((count, item) => count + item.warnings.length, 0);
  checks.push({
    id: "auth_profile_rotation",
    status:
      authProfileReadyCount >= params.authProfiles.length && authProfileWarnings === 0
        ? "ok"
        : authProfileReadyCount > 0
          ? "warn"
          : "fail",
    title: "Auth-profile rotation",
    message: `Ready ${authProfileReadyCount}/${params.authProfiles.length} auth-profile targets; warnings=${authProfileWarnings}.`,
    hint:
      authProfileReadyCount >= params.authProfiles.length
        ? null
        : "Bind active auth profiles for skills, live gateway, and device-node indexes or keep explicit env credentials during bootstrap.",
  });

  const onlineNodes = params.deviceNodes.filter((item) => item.status === "online");
  const readyNodes = onlineNodes.filter((item) => toNonEmptyString(item.executorUrl));
  const trustedNodes = onlineNodes.filter((item) => item.trustLevel === "reviewed" || item.trustLevel === "trusted");
  checks.push({
    id: "device_node_readiness",
    status: readyNodes.length > 0 && trustedNodes.length > 0 ? "ok" : params.deviceNodes.length > 0 ? "warn" : "fail",
    title: "Device-node readiness",
    message: `Registered=${params.deviceNodes.length}, online=${onlineNodes.length}, ready=${readyNodes.length}, trusted=${trustedNodes.length}.`,
    hint:
      readyNodes.length > 0 && trustedNodes.length > 0
        ? null
        : "Register at least one reviewed/trusted online device node with an executor URL for remote UI flows.",
  });

  checks.push({
    id: "fallback_paths",
    status: params.fallbackSummary.readyCount >= 3 ? "ok" : params.fallbackSummary.readyCount >= 2 ? "warn" : "fail",
    title: "Fallback posture",
    message: `Fallback paths ready ${params.fallbackSummary.readyCount}/${params.fallbackSummary.total}.`,
    hint:
      params.fallbackSummary.readyCount >= 3
        ? null
        : "Keep text fallback, story fallback media mode, and UI simulation fallback available for controlled degradation.",
  });

  const uiExecutorHardeningCheck = buildUiExecutorHardeningCheck(params.services);
  if (uiExecutorHardeningCheck) {
    checks.push(uiExecutorHardeningCheck);
  }

  return checks;
}

export function buildRuntimeBootstrapDoctorSnapshot(params: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  services: Array<Record<string, unknown>>;
  deviceNodes: DeviceNodeRecord[];
}): Record<string, unknown> {
  const env = params.env ?? process.env;
  const authProfiles = listAuthProfileSnapshots({
    env,
    cwd: params.cwd,
  });
  const liveGatewayAuthConfigured = authProfiles.some(
    (item) =>
      item.category === "live_gateway" &&
      (item.directValueConfigured ||
        item.explicitCredentialName ||
        (item.effectiveResolution.source === "credential_store" && item.activeCredentialName)),
  );
  const localFirstLike =
    toBoolean(env.LOCAL_FIRST_PROFILE) === true ||
    toNonEmptyString(env.RUNTIME_PROFILE)?.toLowerCase() === "local-first" ||
    toNonEmptyString(env.APP_ENV)?.toLowerCase() === "dev";
  const providerStatuses = buildProviderStatuses(env, localFirstLike, liveGatewayAuthConfigured);
  const fallbackSummary = buildFallbackSummary({
    env,
    services: params.services,
  });
  const deviceNodes = params.deviceNodes;
  const onlineNodes = deviceNodes.filter((item) => item.status === "online");
  const readyNodes = onlineNodes.filter((item) => toNonEmptyString(item.executorUrl));
  const trustedNodes = onlineNodes.filter((item) => item.trustLevel === "reviewed" || item.trustLevel === "trusted");
  const authProfileSummary = summarizeAuthProfiles(authProfiles);
  const checks = buildChecks({
    env,
    services: params.services,
    providerStatuses,
    authProfiles,
    deviceNodes,
    fallbackSummary,
  });
  const failedChecks = checks.filter((item) => item.status === "fail").length;
  const warnChecks = checks.filter((item) => item.status === "warn").length;
  const status = failedChecks > 0 ? "critical" : warnChecks > 0 ? "degraded" : "healthy";
  const topCheck = checks.find((item) => item.status === "fail") ?? checks.find((item) => item.status === "warn") ?? checks[0] ?? null;
  const providerSummary = {
    total: providerStatuses.length,
    configured: providerStatuses.filter((item) => item.configured).length,
    primaryReady: providerStatuses.filter((item) => item.category === "primary" && item.configured).length,
    primaryMissing: providerStatuses.filter((item) => item.category === "primary" && item.status === "missing_required").length,
    secondaryConfigured: providerStatuses.filter((item) => item.category === "secondary" && item.configured).length,
    watchlistConfigured: providerStatuses.filter((item) => item.category === "watchlist" && item.configured).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    status,
    summary: {
      providers: providerSummary,
      authProfiles: authProfileSummary,
      deviceNodes: {
        total: deviceNodes.length,
        online: onlineNodes.length,
        ready: readyNodes.length,
        trusted: trustedNodes.length,
      },
      fallbackPaths: fallbackSummary,
      checks: {
        total: checks.length,
        ok: checks.filter((item) => item.status === "ok").length,
        warn: warnChecks,
        fail: failedChecks,
      },
      topCheck,
    },
    runtime: {
      nodeEnv: toNonEmptyString(env.NODE_ENV) ?? "development",
      appEnv: toNonEmptyString(env.APP_ENV) ?? null,
      runtimeProfile: toNonEmptyString(env.RUNTIME_PROFILE) ?? null,
      localFirstProfile: localFirstLike,
      firestoreEnabled: toBoolean(env.FIRESTORE_ENABLED),
      googleCloudProjectConfigured: Boolean(toNonEmptyString(env.GOOGLE_CLOUD_PROJECT)),
      liveApiEnabled: toBoolean(env.LIVE_API_ENABLED),
      gatewayTransportMode: toNonEmptyString(env.GATEWAY_TRANSPORT_MODE) ?? "websocket",
      storytellerMediaMode: toNonEmptyString(env.STORYTELLER_MEDIA_MODE) ?? "fallback",
      uiNavigatorExecutorMode: toNonEmptyString(env.UI_NAVIGATOR_EXECUTOR_MODE) ?? "simulated",
      uiExecutorBrowserWorkerEnabled: toBoolean(env.UI_EXECUTOR_BROWSER_WORKER_ENABLED),
      credentialStoreFile: toNonEmptyString(env.CREDENTIAL_STORE_FILE) ?? ".credentials/store.json",
      authProfileStoreFile: toNonEmptyString(env.AUTH_PROFILE_STORE_FILE) ?? ".credentials/auth-profiles.json",
    },
    providers: providerStatuses,
    authProfiles: authProfiles.map((profile) => ({
      profileId: profile.profileId,
      namespace: profile.namespace,
      label: profile.label,
      category: profile.category,
      directValueConfigured: profile.directValueConfigured,
      explicitCredentialName: profile.explicitCredentialName,
      configuredProfileId: profile.configuredProfileId,
      storedActiveCredentialName: profile.storedProfile?.activeCredentialName ?? null,
      activeCredentialName: profile.activeCredentialName,
      effectiveSource: profile.effectiveResolution.selectionSource,
      effectiveResolved: profile.effectiveResolution.source !== "missing",
      availableCredentialNames: profile.availableCredentials.map((item) => item.name),
      availableCredentials: profile.availableCredentials,
      rotation: profile.rotation,
      warnings: profile.warnings,
    })),
    deviceNodes: {
      total: deviceNodes.length,
      online: onlineNodes.length,
      ready: readyNodes.length,
      trusted: trustedNodes.length,
      recent: deviceNodes.slice(0, 10).map((item) => ({
        nodeId: item.nodeId,
        displayName: item.displayName,
        status: item.status,
        trustLevel: item.trustLevel,
        executorUrlConfigured: Boolean(toNonEmptyString(item.executorUrl)),
        lastSeenAt: item.lastSeenAt,
        updatedAt: item.updatedAt,
      })),
    },
    fallbackPaths: {
      liveTextFallbackReady: fallbackSummary.liveTextFallbackReady,
      storyFallbackReady: fallbackSummary.storyFallbackReady,
      uiSimulationFallbackReady: fallbackSummary.uiSimulationFallbackReady,
      localFirstReady: fallbackSummary.localFirstReady,
      readyCount: fallbackSummary.readyCount,
      total: fallbackSummary.total,
    },
    checks,
  };
}
