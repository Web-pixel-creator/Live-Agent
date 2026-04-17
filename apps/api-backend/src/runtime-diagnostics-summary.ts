import type { SkillsCatalogSnapshot, SkillsRuntimeSummary } from "@mla/skills";
import type { EventListItem } from "./firestore.js";
import type { OperatorTraceSummary } from "./operator-traces.js";
import {
  buildRuntimeEvidenceSigningPosture,
  type RuntimeEvidenceSignerConfig,
} from "./runtime-evidence-signer.js";

type DiagnosticsSeverity = "info" | "warn" | "critical";

type RuntimeSignal = {
  key: string;
  service: string | null;
  severity: DiagnosticsSeverity;
  message: string;
  value: string | number | boolean | null;
};

export type RuntimeDiagnosticsSloThresholds = {
  liveFirstAudioP95Ms: number;
  navigatorStepP95Ms: number;
  caseWikiQueryP95Ms: number;
};

type RuntimeSloMetricKey = "liveFirstAudioP95" | "navigatorStepP95" | "caseWikiQueryP95";

type RuntimeSloMetric = {
  key: RuntimeSloMetricKey;
  service: "realtime-gateway" | "ui-executor" | "api-backend";
  label: string;
  p95Ms: number | null;
  thresholdMs: number;
  sampleCount: number;
  status: "pass" | "breach" | "missing";
  source: string;
  latestSeenAt: string | null;
};

type RuntimeDiagnosticsCaseWikiIngressSource =
  | "preserved_input_case_wiki"
  | "gateway_hydrated_case_wiki";

const DEFAULT_RUNTIME_DIAGNOSTICS_SLO_THRESHOLDS: RuntimeDiagnosticsSloThresholds = {
  liveFirstAudioP95Ms: 2500,
  navigatorStepP95Ms: 25000,
  caseWikiQueryP95Ms: 1500,
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

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = toNonNegativeInt(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
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

function computeP95(values: number[]): number | null {
  const normalized = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Math.floor(value))
    .sort((left, right) => left - right);
  if (normalized.length === 0) {
    return null;
  }
  const idx = Math.max(0, Math.min(normalized.length - 1, Math.floor((normalized.length - 1) * 0.95)));
  return normalized[idx] ?? null;
}

function latestSeenAtForEvents(
  events: readonly EventListItem[],
  predicate: (event: EventListItem) => boolean,
): string | null {
  return (
    events
      .filter(predicate)
      .map((event) => toNonEmptyString(event.createdAt))
      .filter((item): item is string => item !== null)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  );
}

function normalizeCaseWikiIngressSource(
  value: unknown,
): RuntimeDiagnosticsCaseWikiIngressSource | null {
  const normalized = toNonEmptyString(value);
  return normalized === "preserved_input_case_wiki" || normalized === "gateway_hydrated_case_wiki"
    ? normalized
    : null;
}

function extractEventRoutingRecord(event: EventListItem): Record<string, unknown> | null {
  const payload = isRecord(event.payload) ? event.payload : null;
  const output = isRecord(payload?.output) ? payload.output : null;
  return isRecord(output?.routing) ? output.routing : null;
}

function extractEventCaseWikiIngressSource(
  event: EventListItem,
): RuntimeDiagnosticsCaseWikiIngressSource | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const caseWikiIngress = isRecord(metadata?.caseWikiIngress) ? metadata.caseWikiIngress : null;
  return normalizeCaseWikiIngressSource(caseWikiIngress?.source);
}

function extractEventRoutingContextSource(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return (
    toNonEmptyString(metadata?.routingContextSource) ??
    toNonEmptyString(routing?.contextSource) ??
    (extractEventCaseWikiIngressSource(event) ? "case_wiki" : null)
  );
}

function extractEventRoutingContextIngressSource(
  event: EventListItem,
): RuntimeDiagnosticsCaseWikiIngressSource | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return (
    normalizeCaseWikiIngressSource(metadata?.routingContextIngressSource) ??
    normalizeCaseWikiIngressSource(routing?.contextIngressSource) ??
    extractEventCaseWikiIngressSource(event)
  );
}

function extractEventRoutingContextFocusId(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return toNonEmptyString(metadata?.routingContextFocusId) ?? toNonEmptyString(routing?.contextFocusId);
}

function extractEventRoutingContextBlocker(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return toNonEmptyString(metadata?.routingContextBlocker) ?? toNonEmptyString(routing?.contextBlocker);
}

function extractEventRoutingContextNextAction(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return toNonEmptyString(metadata?.routingContextNextAction) ?? toNonEmptyString(routing?.contextNextAction);
}

function extractEventRoutingMode(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return toNonEmptyString(metadata?.routingMode) ?? toNonEmptyString(routing?.mode);
}

function extractEventRoutingRequestedIntent(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return (
    toNonEmptyString(metadata?.routingRequestedIntent) ??
    toNonEmptyString(routing?.requestedIntent) ??
    toNonEmptyString(event.intent)
  );
}

function extractEventRoutingRoutedIntent(event: EventListItem): string | null {
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const routing = extractEventRoutingRecord(event);
  return toNonEmptyString(metadata?.routingRoutedIntent) ?? toNonEmptyString(routing?.routedIntent);
}

function buildLatestCaseWikiRoutingContext(events: readonly EventListItem[]): Record<string, unknown> {
  const latestCaseWikiEvent =
    [...events]
      .filter((event) => {
        const contextSource = extractEventRoutingContextSource(event);
        return contextSource === "case_wiki" || extractEventRoutingContextIngressSource(event) !== null;
      })
      .sort(
        (left, right) =>
          (Date.parse(toNonEmptyString(right.createdAt) ?? "") || 0) -
          (Date.parse(toNonEmptyString(left.createdAt) ?? "") || 0),
      )[0] ?? null;

  return {
    observed: latestCaseWikiEvent !== null,
    updatedAt: latestCaseWikiEvent ? toNonEmptyString(latestCaseWikiEvent.createdAt) : null,
    contextSource: latestCaseWikiEvent ? extractEventRoutingContextSource(latestCaseWikiEvent) : null,
    ingressSource: latestCaseWikiEvent ? extractEventRoutingContextIngressSource(latestCaseWikiEvent) : null,
    focusId: latestCaseWikiEvent ? extractEventRoutingContextFocusId(latestCaseWikiEvent) : null,
    blocker: latestCaseWikiEvent ? extractEventRoutingContextBlocker(latestCaseWikiEvent) : null,
    nextAction: latestCaseWikiEvent ? extractEventRoutingContextNextAction(latestCaseWikiEvent) : null,
    route:
      latestCaseWikiEvent
        ? toNonEmptyString(latestCaseWikiEvent.route) ?? toNonEmptyString(extractEventRoutingRecord(latestCaseWikiEvent)?.route)
        : null,
    mode: latestCaseWikiEvent ? extractEventRoutingMode(latestCaseWikiEvent) : null,
    requestedIntent: latestCaseWikiEvent ? extractEventRoutingRequestedIntent(latestCaseWikiEvent) : null,
    routedIntent: latestCaseWikiEvent ? extractEventRoutingRoutedIntent(latestCaseWikiEvent) : null,
  };
}

function normalizeServiceMetrics(service: Record<string, unknown> | null): Record<string, unknown> | null {
  return service && isRecord(service.metrics) ? service.metrics : null;
}

function buildSloMetric(params: {
  key: RuntimeSloMetricKey;
  service: RuntimeSloMetric["service"];
  label: string;
  values: number[];
  thresholdMs: number;
  source: string;
  latestSeenAt: string | null;
  sampleCount?: number | null;
}): RuntimeSloMetric {
  const p95Ms = computeP95(params.values);
  const observedSampleCount = params.values.filter((value) => Number.isFinite(value) && value >= 0).length;
  return {
    key: params.key,
    service: params.service,
    label: params.label,
    p95Ms,
    thresholdMs: params.thresholdMs,
    sampleCount: p95Ms === null ? 0 : (params.sampleCount ?? observedSampleCount),
    status: p95Ms === null ? "missing" : p95Ms <= params.thresholdMs ? "pass" : "breach",
    source: params.source,
    latestSeenAt: params.latestSeenAt,
  };
}

function getServiceTotalP95Metric(
  service: Record<string, unknown> | null,
  fallbackLatestSeenAt: string | null,
): { values: number[]; sampleCount: number; source: string; latestSeenAt: string | null } {
  const metrics = normalizeServiceMetrics(service);
  const p95Ms = toFiniteNumber(metrics?.p95Ms);
  if (p95Ms === null) {
    return { values: [], sampleCount: 0, source: "missing", latestSeenAt: null };
  }
  const sampleCount = toNonNegativeInt(metrics?.totalCount) ?? 1;
  return {
    values: [p95Ms],
    sampleCount,
    source: `${toNonEmptyString(service?.name) ?? "service"}.metrics.p95Ms`,
    latestSeenAt: fallbackLatestSeenAt,
  };
}

function getServiceOperationP95Metric(
  service: Record<string, unknown> | null,
  operationName: string,
): { values: number[]; sampleCount: number; source: string; latestSeenAt: string | null } {
  const metrics = normalizeServiceMetrics(service);
  const operations = Array.isArray(metrics?.operations)
    ? metrics.operations.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const operation = operations.find((item) => toNonEmptyString(item.operation) === operationName) ?? null;
  const operationLatency = operation && isRecord(operation.latencyMs) ? operation.latencyMs : null;
  const p95Ms = toFiniteNumber(operationLatency?.p95);
  if (p95Ms === null) {
    return { values: [], sampleCount: 0, source: "missing", latestSeenAt: null };
  }
  return {
    values: [p95Ms],
    sampleCount: toNonNegativeInt(operation?.count) ?? 1,
    source: `${toNonEmptyString(service?.name) ?? "service"}.metrics.operations.${operationName}.p95`,
    latestSeenAt: toNonEmptyString(operation?.lastUpdatedAt),
  };
}

function buildRuntimeSloSummary(params: {
  services: Array<Record<string, unknown>>;
  events: readonly EventListItem[];
  thresholds: RuntimeDiagnosticsSloThresholds;
}): Record<string, unknown> {
  const gateway = getService(params.services, "realtime-gateway");
  const uiExecutor = getService(params.services, "ui-executor");
  const apiBackend = getService(params.services, "api-backend");

  const liveFirstAudioEvents = params.events.filter(
    (event) => toNonEmptyString(event.type) === "live.first_audio",
  );
  const liveFirstAudioValues = liveFirstAudioEvents
    .map((event) => toNonNegativeInt(event.liveFirstAudioMs))
    .filter((item): item is number => item !== null);
  const liveMetricFallback = getServiceTotalP95Metric(gateway, latestSeenAtForEvents(params.events, () => true));
  const liveMetric = buildSloMetric({
    key: "liveFirstAudioP95",
    service: "realtime-gateway",
    label: "Live first audio p95",
    values: liveFirstAudioValues.length > 0 ? liveFirstAudioValues : liveMetricFallback.values,
    thresholdMs: params.thresholds.liveFirstAudioP95Ms,
    source: liveFirstAudioValues.length > 0 ? "runtime_events.live.first_audio.firstAudioMs" : liveMetricFallback.source,
    latestSeenAt:
      liveFirstAudioValues.length > 0
        ? latestSeenAtForEvents(liveFirstAudioEvents, () => true)
        : liveMetricFallback.latestSeenAt,
    sampleCount: liveFirstAudioValues.length > 0 ? liveFirstAudioValues.length : liveMetricFallback.sampleCount,
  });

  const navigatorEvents = params.events.filter((event) => {
    const route = toNonEmptyString(event.route);
    const source = toNonEmptyString(event.source);
    return route === "ui-navigator-agent" || source === "ui-navigator-agent" || source === "ui-executor";
  });
  const navigatorValues = navigatorEvents
    .map((event) => toNonNegativeInt(event.latencyMs))
    .filter((item): item is number => item !== null);
  const navigatorFallback = getServiceTotalP95Metric(uiExecutor, latestSeenAtForEvents(navigatorEvents, () => true));
  const navigatorMetric = buildSloMetric({
    key: "navigatorStepP95",
    service: "ui-executor",
    label: "Navigator step p95",
    values: navigatorValues.length > 0 ? navigatorValues : navigatorFallback.values,
    thresholdMs: params.thresholds.navigatorStepP95Ms,
    source: navigatorValues.length > 0 ? "runtime_events.ui_navigator.latencyMs" : navigatorFallback.source,
    latestSeenAt:
      navigatorValues.length > 0
        ? latestSeenAtForEvents(navigatorEvents, (event) => toNonNegativeInt(event.latencyMs) !== null)
        : navigatorFallback.latestSeenAt,
    sampleCount: navigatorValues.length > 0 ? navigatorValues.length : navigatorFallback.sampleCount,
  });

  const caseWikiMetricRaw = getServiceOperationP95Metric(apiBackend, "GET /v1/runtime/case-wiki");
  const caseWikiMetric = buildSloMetric({
    key: "caseWikiQueryP95",
    service: "api-backend",
    label: "Case Wiki query p95",
    values: caseWikiMetricRaw.values,
    thresholdMs: params.thresholds.caseWikiQueryP95Ms,
    source: caseWikiMetricRaw.source,
    latestSeenAt: caseWikiMetricRaw.latestSeenAt,
    sampleCount: caseWikiMetricRaw.sampleCount,
  });

  const metrics = [liveMetric, navigatorMetric, caseWikiMetric];
  const breachCount = metrics.filter((item) => item.status === "breach").length;
  const missingCount = metrics.filter((item) => item.status === "missing").length;
  const observedCount = metrics.length - missingCount;
  const summary =
    metrics
      .map((item) => `${item.key}=${item.p95Ms === null ? "missing" : `${item.p95Ms}ms/${item.thresholdMs}ms`}`)
      .join(" | ") || "missing";

  return {
    status: breachCount > 0 ? "breach" : observedCount > 0 ? "pass" : "missing",
    validated: breachCount === 0,
    summary,
    breachCount,
    observedCount,
    missingCount,
    thresholds: {
      ...params.thresholds,
    },
    metrics,
  };
}

export function resolveRuntimeDiagnosticsSloThresholds(env: NodeJS.ProcessEnv): RuntimeDiagnosticsSloThresholds {
  return {
    liveFirstAudioP95Ms: toPositiveInt(
      env.RUNTIME_SLO_LIVE_FIRST_AUDIO_P95_MS,
      DEFAULT_RUNTIME_DIAGNOSTICS_SLO_THRESHOLDS.liveFirstAudioP95Ms,
    ),
    navigatorStepP95Ms: toPositiveInt(
      env.RUNTIME_SLO_NAVIGATOR_STEP_P95_MS,
      DEFAULT_RUNTIME_DIAGNOSTICS_SLO_THRESHOLDS.navigatorStepP95Ms,
    ),
    caseWikiQueryP95Ms: toPositiveInt(
      env.RUNTIME_SLO_CASE_WIKI_QUERY_P95_MS,
      DEFAULT_RUNTIME_DIAGNOSTICS_SLO_THRESHOLDS.caseWikiQueryP95Ms,
    ),
  };
}

export function buildRuntimeDiagnosticsSummary(params: {
  services: Array<Record<string, unknown>>;
  skillsCatalog: SkillsCatalogSnapshot;
  skillsRuntimeSummary?: SkillsRuntimeSummary | null;
  operatorTraceSummary?: OperatorTraceSummary | null;
  events?: readonly EventListItem[];
  sloThresholds?: RuntimeDiagnosticsSloThresholds;
  evidenceSigner?: RuntimeEvidenceSignerConfig | null;
}): Record<string, unknown> {
  const generatedAt = new Date().toISOString();
  const services = params.services;
  const skillsCatalog = params.skillsCatalog;
  const skillsRuntimeSummary = params.skillsRuntimeSummary ?? null;
  const operatorTraceSummary = params.operatorTraceSummary ?? null;
  const signals: RuntimeSignal[] = [];
  const latestCaseWikiRoutingContext = buildLatestCaseWikiRoutingContext(params.events ?? []);
  const slo = buildRuntimeSloSummary({
    services,
    events: params.events ?? [],
    thresholds: params.sloThresholds ?? DEFAULT_RUNTIME_DIAGNOSTICS_SLO_THRESHOLDS,
  });

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
  const evidenceSigning = buildRuntimeEvidenceSigningPosture(params.evidenceSigner);

  const gatewayTransport = gateway && isRecord(gateway.transport) ? gateway.transport : null;
  const orchestratorWorkflow = orchestrator && isRecord(orchestrator.workflow) ? orchestrator.workflow : null;
  const orchestratorWorkflowState =
    orchestratorWorkflow && isRecord(orchestratorWorkflow.workflowState) ? orchestratorWorkflow.workflowState : null;
  const orchestratorAssistiveRouter =
    orchestratorWorkflow && isRecord(orchestratorWorkflow.assistiveRouter) ? orchestratorWorkflow.assistiveRouter : null;
  const uiExecutorSandbox = uiExecutor && isRecord(uiExecutor.sandbox) ? uiExecutor.sandbox : null;
  const uiExecutorBrowserWorkers = uiExecutor && isRecord(uiExecutor.browserWorkers) ? uiExecutor.browserWorkers : null;
  const uiExecutorBrowserWorkerQueue =
    uiExecutorBrowserWorkers && isRecord(uiExecutorBrowserWorkers.queue) ? uiExecutorBrowserWorkers.queue : null;
  const uiExecutorBrowserWorkerRecovery =
    uiExecutorBrowserWorkers && isRecord(uiExecutorBrowserWorkers.recovery) ? uiExecutorBrowserWorkers.recovery : null;
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

  if (evidenceSigning.enabled && !evidenceSigning.canSign) {
    pushSignal(signals, {
      key: "evidence_signing_key_unavailable",
      service: "api-backend",
      severity: "critical",
      message: "Runtime evidence signing is enabled but the signing key is missing or invalid.",
      value: evidenceSigning.keyState,
    });
  }

  const operatorBottlenecks = Array.isArray(operatorTraceSummary?.bottlenecks)
    ? operatorTraceSummary.bottlenecks.filter((item) => item && typeof item === "object")
    : [];
  const awaitingApprovalBottleneck = operatorBottlenecks.find((item) => item.key === "awaiting_approval");
  const verificationFailedBottleneck = operatorBottlenecks.find((item) => item.key === "verification_failed");
  const browserRunIncompleteBottleneck = operatorBottlenecks.find((item) => item.key === "browser_run_incomplete");
  const escalationRequiredBottleneck = operatorBottlenecks.find((item) => item.key === "escalation_required");

  if (awaitingApprovalBottleneck && awaitingApprovalBottleneck.count > 0) {
    pushSignal(signals, {
      key: "operator_stage_awaiting_approval",
      service: "orchestrator",
      severity: "warn",
      message: "Operator trace summary shows runs waiting for approval.",
      value: awaitingApprovalBottleneck.count,
    });
  }

  if (verificationFailedBottleneck && verificationFailedBottleneck.count > 0) {
    pushSignal(signals, {
      key: "operator_stage_verification_failed",
      service: "orchestrator",
      severity: "critical",
      message: "Operator trace summary shows verification failures or incomplete verification.",
      value: verificationFailedBottleneck.count,
    });
  }

  if (browserRunIncompleteBottleneck && browserRunIncompleteBottleneck.count > 0) {
    pushSignal(signals, {
      key: "operator_stage_browser_run_incomplete",
      service: "ui-executor",
      severity: "warn",
      message: "Operator trace summary shows browser runs that are still incomplete.",
      value: browserRunIncompleteBottleneck.count,
    });
  }

  if (escalationRequiredBottleneck && escalationRequiredBottleneck.count > 0) {
    pushSignal(signals, {
      key: "operator_stage_escalation_required",
      service: "orchestrator",
      severity: "critical",
      message: "Operator trace summary shows runs that need escalation.",
      value: escalationRequiredBottleneck.count,
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

  const sloMetrics = Array.isArray(slo.metrics)
    ? slo.metrics.filter((item): item is RuntimeSloMetric => isRecord(item) && item.status === "breach")
    : [];
  for (const metric of sloMetrics) {
    pushSignal(signals, {
      key: `runtime_slo_${metric.key}_breach`,
      service: metric.service,
      severity: "warn",
      message: `Runtime latency SLO breached: ${metric.label} exceeded ${metric.thresholdMs}ms.`,
      value: metric.p95Ms,
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
      workflowExecutionStatus: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.status) : null,
      workflowCurrentStage: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.currentStage) : null,
      workflowActiveRole: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.activeRole) : null,
      workflowRunId: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.runId) : null,
      workflowSessionId: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.sessionId) : null,
      workflowTaskId: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.taskId) : null,
      workflowIntent: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.intent) : null,
      workflowRoute: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.route) : null,
      workflowReason: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.reason) : null,
      workflowUpdatedAt: orchestratorWorkflowState ? toNonEmptyString(orchestratorWorkflowState.updatedAt) : null,
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
      latestCaseWikiRoutingContext,
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
      browserWorkerRetryCount:
        uiExecutorBrowserWorkerRecovery ? toNonNegativeInt(uiExecutorBrowserWorkerRecovery.retryCount) : null,
      browserWorkerResumedCheckpointCount:
        uiExecutorBrowserWorkerRecovery
          ? toNonNegativeInt(uiExecutorBrowserWorkerRecovery.resumedCheckpointCount)
          : null,
      browserWorkerStaleRefCount:
        uiExecutorBrowserWorkerRecovery ? toNonNegativeInt(uiExecutorBrowserWorkerRecovery.staleRefCount) : null,
      browserWorkerHealedRefCount:
        uiExecutorBrowserWorkerRecovery ? toNonNegativeInt(uiExecutorBrowserWorkerRecovery.healedRefCount) : null,
    },
    apiBackend: {
      complianceTemplate: apiGovernance ? toNonEmptyString(apiGovernance.complianceTemplate) : null,
      complianceFallbackApplied:
        apiGovernance ? toBoolean(apiGovernance.complianceTemplateFallbackApplied) : null,
      allowTenantHeaderOverride:
        apiGovernance ? toBoolean(apiGovernance.allowTenantHeaderOverride) : null,
      evidenceSigning,
    },
    slo,
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
