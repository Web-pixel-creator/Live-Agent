import type { SkillsCatalogSnapshot, SkillsRuntimeSummary } from "@mla/skills";

type DiagnosticsSeverity = "info" | "warn" | "critical";

type RuntimeSignal = {
  key: string;
  service: string | null;
  severity: DiagnosticsSeverity;
  message: string;
  value: string | number | boolean | null;
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

function toNonNegativeInt(value: unknown): number | null {
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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function pushSignal(signals: RuntimeSignal[], signal: RuntimeSignal): void {
  signals.push(signal);
}

export function buildRuntimeDiagnosticsSummary(params: {
  services: Array<Record<string, unknown>>;
  skillsCatalog: SkillsCatalogSnapshot;
  skillsRuntimeSummary?: SkillsRuntimeSummary | null;
}): Record<string, unknown> {
  const generatedAt = new Date().toISOString();
  const services = params.services;
  const skillsCatalog = params.skillsCatalog;
  const skillsRuntimeSummary = params.skillsRuntimeSummary ?? null;
  const signals: RuntimeSignal[] = [];

  let healthyServices = 0;
  let readyServices = 0;
  let drainingServices = 0;
  let runtimeVisible = 0;
  let metricsVisible = 0;
  let startupFailureServices = 0;
  let startupBlockingServices = 0;

  for (const service of services) {
    if (service.healthy === true) {
      healthyServices += 1;
    }
    if (service.ready === true) {
      readyServices += 1;
    }
    if (service.draining === true) {
      drainingServices += 1;
      pushSignal(signals, {
        key: "service_draining",
        service: toNonEmptyString(service.name),
        severity: "warn",
        message: "Service is currently draining and not fully ready for new work.",
        value: true,
      });
    }
    if (isRecord(service.profile)) {
      runtimeVisible += 1;
    }
    if (isRecord(service.metrics)) {
      metricsVisible += 1;
    }
    const startupFailureCount = toNonNegativeInt(service.startupFailureCount) ?? 0;
    if (startupFailureCount > 0) {
      startupFailureServices += 1;
      pushSignal(signals, {
        key: "startup_failures_present",
        service: toNonEmptyString(service.name),
        severity: service.startupBlockingFailure === true ? "critical" : "warn",
        message:
          service.startupBlockingFailure === true
            ? "Service has blocking startup probe failures."
            : "Service has recent startup probe failures.",
        value: startupFailureCount,
      });
    }
    if (service.startupBlockingFailure === true) {
      startupBlockingServices += 1;
    }
  }

  const gateway = getService(services, "realtime-gateway");
  const orchestrator = getService(services, "orchestrator");
  const uiExecutor = getService(services, "ui-executor");
  const apiBackend = getService(services, "api-backend");

  const gatewayTransport = gateway && isRecord(gateway.transport) ? gateway.transport : null;
  const orchestratorWorkflow = orchestrator && isRecord(orchestrator.workflow) ? orchestrator.workflow : null;
  const orchestratorAssistiveRouter =
    orchestratorWorkflow && isRecord(orchestratorWorkflow.assistiveRouter) ? orchestratorWorkflow.assistiveRouter : null;
  const uiExecutorSandbox = uiExecutor && isRecord(uiExecutor.sandbox) ? uiExecutor.sandbox : null;
  const uiExecutorBrowserWorkers = uiExecutor && isRecord(uiExecutor.browserWorkers) ? uiExecutor.browserWorkers : null;
  const uiExecutorBrowserWorkerQueue =
    uiExecutorBrowserWorkers && isRecord(uiExecutorBrowserWorkers.queue) ? uiExecutorBrowserWorkers.queue : null;
  const apiGovernance = apiBackend && isRecord(apiBackend.governance) ? apiBackend.governance : null;
  const uiExecutorSandboxMode = uiExecutorSandbox ? toNonEmptyString(uiExecutorSandbox.mode) ?? "off" : null;
  const uiExecutorSandboxNetworkPolicy = uiExecutorSandbox
    ? toNonEmptyString(uiExecutorSandbox.networkPolicy)
    : null;
  const uiExecutorSandboxSetupMarker =
    uiExecutorSandbox && isRecord(uiExecutorSandbox.setupMarker) ? uiExecutorSandbox.setupMarker : null;
  const uiExecutorSandboxSetupStatus = toNonEmptyString(uiExecutorSandboxSetupMarker?.status);
  const uiExecutorSandboxAllowedOriginsCount = uiExecutorSandbox
    ? toNonNegativeInt(uiExecutorSandbox.allowedOriginsCount)
    : null;
  const uiExecutorSandboxAllowedReadRootsCount = uiExecutorSandbox
    ? toNonNegativeInt(uiExecutorSandbox.allowedReadRootsCount)
    : null;
  const uiExecutorSandboxAllowedWriteRootsCount = uiExecutorSandbox
    ? toNonNegativeInt(uiExecutorSandbox.allowedWriteRootsCount)
    : null;
  const uiExecutorSandboxBlockFileUrls = uiExecutorSandbox ? toBoolean(uiExecutorSandbox.blockFileUrls) : null;
  const uiExecutorSandboxAllowLoopbackHosts = uiExecutorSandbox
    ? toBoolean(uiExecutorSandbox.allowLoopbackHosts)
    : null;

  if (gatewayTransport && toBoolean(gatewayTransport.fallbackActive) === true) {
    pushSignal(signals, {
      key: "gateway_transport_fallback",
      service: "realtime-gateway",
      severity: "warn",
      message: "Gateway transport fallback is active.",
      value: toNonEmptyString(gatewayTransport.activeMode) ?? "websocket",
    });
  }

  if (orchestratorWorkflow && toBoolean(orchestratorWorkflow.usingLastKnownGood) === true) {
    pushSignal(signals, {
      key: "workflow_last_known_good",
      service: "orchestrator",
      severity: "warn",
      message: "Orchestrator workflow store is using last-known-good configuration.",
      value: true,
    });
  }

  if (
    orchestratorWorkflow &&
    isRecord(orchestratorWorkflow.controlPlaneOverride) &&
    orchestratorWorkflow.controlPlaneOverride.active === true
  ) {
    pushSignal(signals, {
      key: "workflow_control_plane_override_active",
      service: "orchestrator",
      severity: "warn",
      message: "Orchestrator workflow control-plane override is active.",
      value: toNonEmptyString(orchestratorWorkflow.controlPlaneOverride.reason) ?? true,
    });
  }

  if (
    orchestratorAssistiveRouter &&
    toBoolean(orchestratorAssistiveRouter.enabled) === true &&
    toBoolean(orchestratorAssistiveRouter.apiKeyConfigured) !== true
  ) {
    pushSignal(signals, {
      key: "assistive_router_missing_api_key",
      service: "orchestrator",
      severity: "critical",
      message: "Assistive router is enabled but API key is not configured.",
      value: false,
    });
  }

  if (
    orchestratorAssistiveRouter &&
    toBoolean(orchestratorAssistiveRouter.enabled) === true &&
    toNonEmptyString(orchestratorAssistiveRouter.provider) === "moonshot" &&
    toBoolean(orchestratorAssistiveRouter.watchlistEnabled) !== true
  ) {
    pushSignal(signals, {
      key: "assistive_router_watchlist_disabled",
      service: "orchestrator",
      severity: "warn",
      message: "Assistive router watchlist provider is configured without an explicit watchlist enablement.",
      value: false,
    });
  }

  if (uiExecutor && toBoolean(uiExecutor.forceSimulation) === true) {
    pushSignal(signals, {
      key: "ui_executor_force_simulation",
      service: "ui-executor",
      severity: "warn",
      message: "UI executor is forcing simulation mode.",
      value: true,
    });
  }

  if ((toNonNegativeInt(uiExecutorBrowserWorkerQueue?.failed) ?? 0) > 0) {
    pushSignal(signals, {
      key: "ui_executor_browser_worker_failed",
      service: "ui-executor",
      severity: "warn",
      message: "UI executor browser worker has failed jobs awaiting triage.",
      value: toNonNegativeInt(uiExecutorBrowserWorkerQueue?.failed),
    });
  }

  if ((toNonNegativeInt(uiExecutorBrowserWorkerQueue?.paused) ?? 0) > 0) {
    pushSignal(signals, {
      key: "ui_executor_browser_worker_checkpoint_ready",
      service: "ui-executor",
      severity: "warn",
      message: "UI executor browser worker has paused jobs waiting for operator resume.",
      value: toNonNegativeInt(uiExecutorBrowserWorkerQueue?.paused),
    });
  }

  if (uiExecutorSandbox) {
    const sandboxMode = uiExecutorSandboxMode ?? "off";
    if (sandboxMode !== "enforce") {
      pushSignal(signals, {
        key: "ui_executor_sandbox_not_enforce",
        service: "ui-executor",
        severity: sandboxMode === "audit" ? "warn" : "critical",
        message: "UI executor sandbox mode is weaker than enforce.",
        value: sandboxMode,
      });
    }
    const setupStatus = uiExecutorSandboxSetupStatus;
    if (setupStatus === "missing" || setupStatus === "stale") {
      pushSignal(signals, {
        key: "ui_executor_sandbox_setup_marker",
        service: "ui-executor",
        severity: "warn",
        message: "UI executor sandbox setup marker is not current.",
        value: setupStatus,
      });
    }
    if (sandboxMode !== "off" && (uiExecutorSandboxAllowedReadRootsCount ?? 0) <= 0) {
      pushSignal(signals, {
        key: "ui_executor_sandbox_read_roots_missing",
        service: "ui-executor",
        severity: "warn",
        message: "UI executor sandbox has no protected read roots configured.",
        value: uiExecutorSandboxAllowedReadRootsCount ?? 0,
      });
    }
    if (sandboxMode !== "off" && (uiExecutorSandboxAllowedWriteRootsCount ?? 0) <= 0) {
      pushSignal(signals, {
        key: "ui_executor_sandbox_write_roots_missing",
        service: "ui-executor",
        severity: "warn",
        message: "UI executor sandbox has no protected write roots configured.",
        value: uiExecutorSandboxAllowedWriteRootsCount ?? 0,
      });
    }
    if (sandboxMode === "enforce" && uiExecutorSandboxNetworkPolicy === "allow_all") {
      pushSignal(signals, {
        key: "ui_executor_sandbox_network_open",
        service: "ui-executor",
        severity: "critical",
        message: "UI executor sandbox network policy still allows unrestricted egress.",
        value: uiExecutorSandboxNetworkPolicy,
      });
    }
    if (sandboxMode !== "off" && uiExecutorSandboxBlockFileUrls === false) {
      pushSignal(signals, {
        key: "ui_executor_sandbox_file_urls_allowed",
        service: "ui-executor",
        severity: "warn",
        message: "UI executor sandbox allows file:// access.",
        value: false,
      });
    }
    if (sandboxMode !== "off" && uiExecutorSandboxAllowLoopbackHosts === true) {
      pushSignal(signals, {
        key: "ui_executor_sandbox_loopback_allowed",
        service: "ui-executor",
        severity: "warn",
        message: "UI executor sandbox allows loopback hosts.",
        value: true,
      });
    }
  }

  if (skillsCatalog.warnings.length > 0) {
    pushSignal(signals, {
      key: "skills_catalog_warnings",
      service: null,
      severity: "warn",
      message: "Repo-owned skills catalog contains warnings.",
      value: skillsCatalog.warnings.length,
    });
  }

  const status =
    signals.some((item) => item.severity === "critical")
      ? "critical"
      : signals.some((item) => item.severity === "warn")
        ? "degraded"
        : "healthy";

  const validated =
    services.length >= 4 &&
    runtimeVisible >= 4 &&
    metricsVisible >= 4 &&
    gateway !== null &&
    orchestrator !== null &&
    uiExecutor !== null &&
    apiBackend !== null;

  return {
    generatedAt,
    status,
    validated,
    servicesCoverage: {
      total: services.length,
      healthy: healthyServices,
      ready: readyServices,
      draining: drainingServices,
      runtimeVisible,
      metricsVisible,
      startupFailureServices,
      startupBlockingServices,
    },
    gateway: {
      requestedTransportMode: gatewayTransport ? toNonEmptyString(gatewayTransport.requestedMode) : null,
      activeTransportMode: gatewayTransport ? toNonEmptyString(gatewayTransport.activeMode) : null,
      fallbackActive: gatewayTransport ? toBoolean(gatewayTransport.fallbackActive) : null,
      webrtcStage:
        gatewayTransport && isRecord(gatewayTransport.webrtc) && isRecord(gatewayTransport.webrtc.rollout)
          ? toNonEmptyString(gatewayTransport.webrtc.rollout.stage)
          : null,
      webrtcReady:
        gatewayTransport && isRecord(gatewayTransport.webrtc) ? toBoolean(gatewayTransport.webrtc.ready) : null,
      transportReason:
        gatewayTransport && isRecord(gatewayTransport.webrtc) ? toNonEmptyString(gatewayTransport.webrtc.reason) : null,
      turnTruncationValidated:
        gateway && isRecord(gateway.turnTruncation) ? toBoolean(gateway.turnTruncation.validated) : null,
      turnDeleteValidated: gateway && isRecord(gateway.turnDelete) ? toBoolean(gateway.turnDelete.validated) : null,
      damageControlValidated:
        gateway && isRecord(gateway.damageControl) ? toBoolean(gateway.damageControl.validated) : null,
      agentUsageValidated: gateway && isRecord(gateway.agentUsage) ? toBoolean(gateway.agentUsage.validated) : null,
    },
    orchestrator: {
      workflowSourceKind: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.sourceKind) : null,
      workflowSourcePath: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.sourcePath) : null,
      workflowUsingLastKnownGood: orchestratorWorkflow ? toBoolean(orchestratorWorkflow.usingLastKnownGood) : null,
      workflowFingerprint: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.fingerprint) : null,
      workflowLoadedAt: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.loadedAt) : null,
      workflowLastAttemptAt: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.lastAttemptAt) : null,
      workflowLastError: orchestratorWorkflow ? toNonEmptyString(orchestratorWorkflow.lastError) : null,
      workflowControlPlaneOverrideActive:
        orchestratorWorkflow && isRecord(orchestratorWorkflow.controlPlaneOverride)
          ? toBoolean(orchestratorWorkflow.controlPlaneOverride.active)
          : null,
      workflowControlPlaneOverrideUpdatedAt:
        orchestratorWorkflow && isRecord(orchestratorWorkflow.controlPlaneOverride)
          ? toNonEmptyString(orchestratorWorkflow.controlPlaneOverride.updatedAt)
          : null,
      workflowControlPlaneOverrideReason:
        orchestratorWorkflow && isRecord(orchestratorWorkflow.controlPlaneOverride)
          ? toNonEmptyString(orchestratorWorkflow.controlPlaneOverride.reason)
          : null,
      assistiveRouterEnabled: orchestratorAssistiveRouter ? toBoolean(orchestratorAssistiveRouter.enabled) : null,
      assistiveRouterApiKeyConfigured:
        orchestratorAssistiveRouter ? toBoolean(orchestratorAssistiveRouter.apiKeyConfigured) : null,
      assistiveRouterProvider: orchestratorAssistiveRouter ? toNonEmptyString(orchestratorAssistiveRouter.provider) : null,
      assistiveRouterModel: orchestratorAssistiveRouter ? toNonEmptyString(orchestratorAssistiveRouter.model) : null,
      assistiveRouterAllowIntents: orchestratorAssistiveRouter ? toStringList(orchestratorAssistiveRouter.allowIntents) : [],
      assistiveRouterTimeoutMs: orchestratorAssistiveRouter ? toNonNegativeInt(orchestratorAssistiveRouter.timeoutMs) : null,
      assistiveRouterMinConfidence:
        orchestratorAssistiveRouter ? toFiniteNumber(orchestratorAssistiveRouter.minConfidence) : null,
      assistiveRouterBudgetPolicy:
        orchestratorAssistiveRouter ? toNonEmptyString(orchestratorAssistiveRouter.budgetPolicy) : null,
      assistiveRouterPromptCaching:
        orchestratorAssistiveRouter ? toNonEmptyString(orchestratorAssistiveRouter.promptCaching) : null,
      assistiveRouterWatchlistEnabled:
        orchestratorAssistiveRouter ? toBoolean(orchestratorAssistiveRouter.watchlistEnabled) : null,
    },
    uiExecutor: {
      forceSimulation: uiExecutor ? toBoolean(uiExecutor.forceSimulation) : null,
      strictPlaywright: uiExecutor ? toBoolean(uiExecutor.strictPlaywright) : null,
      simulateIfUnavailable: uiExecutor ? toBoolean(uiExecutor.simulateIfUnavailable) : null,
      registeredDeviceNodes: uiExecutor ? toNonNegativeInt(uiExecutor.registeredDeviceNodes) : null,
      sandboxMode: uiExecutorSandboxMode,
      sandboxNetworkPolicy: uiExecutorSandboxNetworkPolicy,
      sandboxAllowedOriginsCount: uiExecutorSandboxAllowedOriginsCount,
      sandboxAllowedReadRootsCount: uiExecutorSandboxAllowedReadRootsCount,
      sandboxAllowedWriteRootsCount: uiExecutorSandboxAllowedWriteRootsCount,
      sandboxBlockFileUrls: uiExecutorSandboxBlockFileUrls,
      sandboxAllowLoopbackHosts: uiExecutorSandboxAllowLoopbackHosts,
      sandboxSetupStatus: uiExecutorSandboxSetupStatus,
      sandboxWarnings:
        uiExecutorSandbox && Array.isArray(uiExecutorSandbox.warnings)
          ? uiExecutorSandbox.warnings.filter((item): item is string => typeof item === "string")
          : [],
      browserWorkerEnabled:
        uiExecutorBrowserWorkers && isRecord(uiExecutorBrowserWorkers.runtime)
          ? toBoolean(uiExecutorBrowserWorkers.runtime.enabled)
          : null,
      browserWorkerRunning: uiExecutorBrowserWorkerQueue ? toNonNegativeInt(uiExecutorBrowserWorkerQueue.running) : null,
      browserWorkerPaused: uiExecutorBrowserWorkerQueue ? toNonNegativeInt(uiExecutorBrowserWorkerQueue.paused) : null,
      browserWorkerFailed: uiExecutorBrowserWorkerQueue ? toNonNegativeInt(uiExecutorBrowserWorkerQueue.failed) : null,
      browserWorkerCheckpointReady:
        uiExecutorBrowserWorkerQueue ? toNonNegativeInt(uiExecutorBrowserWorkerQueue.checkpointReady) : null,
    },
    apiBackend: {
      complianceTemplate: apiGovernance ? toNonEmptyString(apiGovernance.complianceTemplate) : null,
      complianceFallbackApplied:
        apiGovernance ? toBoolean(apiGovernance.complianceTemplateFallbackApplied) : null,
      allowTenantHeaderOverride:
        apiGovernance ? toBoolean(apiGovernance.allowTenantHeaderOverride) : null,
    },
    skillsCatalog: {
      source: skillsCatalog.source,
      warnings: skillsCatalog.warnings.length,
      personas: skillsCatalog.personas.length,
      recipes: skillsCatalog.recipes.length,
      readyPersonas: skillsCatalog.personas.filter((item) => item.ready).length,
      readyRecipes: skillsCatalog.recipes.filter((item) => item.ready).length,
      configPath: skillsCatalog.configPath,
    },
    skillsRuntime: skillsRuntimeSummary
      ? {
          enabled: skillsRuntimeSummary.enabled,
          agentId: skillsRuntimeSummary.agentId,
          activeCount: skillsRuntimeSummary.activeCount,
          skippedCount: skillsRuntimeSummary.skippedCount,
          securityBlockedCount: skillsRuntimeSummary.securityBlockedCount,
          trustBlockedCount: skillsRuntimeSummary.trustBlockedCount,
          loadedAt: skillsRuntimeSummary.loadedAt,
        }
      : null,
    activeSignals: signals,
  };
}
