import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeDiagnosticsSummary } from "../../apps/api-backend/src/runtime-diagnostics-summary.js";
import type { SkillsCatalogSnapshot, SkillsRuntimeSummary } from "../../shared/skills/src/index.js";

const baseCatalog: SkillsCatalogSnapshot = {
  version: 1,
  updatedAt: "2026-03-06T00:00:00.000Z",
  source: "path",
  configPath: "configs/skills.catalog.json",
  agentId: null,
  activeSkillIds: [],
  repoKnownSkillIds: [],
  warnings: [],
  personas: [],
  recipes: [],
};

const baseRuntimeSummary: SkillsRuntimeSummary = {
  enabled: true,
  agentId: "live-agent",
  sourcePrecedence: ["workspace"],
  allowedSources: ["workspace"],
  activeCount: 1,
  activeSkills: [
    {
      id: "calendar-assistant",
      source: "workspace",
      priority: 320,
      version: 1,
      trustLevel: "reviewed",
    },
  ],
  skippedCount: 0,
  securityMode: "enforce",
  minTrustLevel: "untrusted",
  securityBlockedCount: 0,
  trustBlockedCount: 0,
  loadedAt: "2026-03-06T00:00:00.000Z",
};

test("runtime diagnostics summary stays healthy when all guardrails are nominal", () => {
  const summary = buildRuntimeDiagnosticsSummary({
    services: [
      {
        name: "realtime-gateway",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        transport: {
          requestedMode: "websocket",
          activeMode: "websocket",
          fallbackActive: false,
          webrtc: {
            ready: false,
            reason: "disabled",
            rollout: { stage: "disabled" },
          },
        },
        turnTruncation: { validated: true },
        turnDelete: { validated: true },
        damageControl: { validated: true },
        agentUsage: { validated: true },
      },
      {
        name: "orchestrator",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        workflow: {
          sourceKind: "file",
          sourcePath: "configs/orchestrator.workflow.json",
          usingLastKnownGood: false,
          fingerprint: "wf-healthy",
          loadedAt: "2026-03-06T00:00:00.000Z",
          lastAttemptAt: "2026-03-06T00:00:00.000Z",
          workflowState: {
            status: "running",
            currentStage: "planning",
            activeRole: "planner",
            runId: "run-workflow-healthy",
            sessionId: "session-workflow-healthy",
            taskId: "task-workflow-healthy",
            intent: "conversation",
            route: "live-agent",
            reason: "planning request",
            updatedAt: "2026-03-06T00:00:01.000Z",
          },
          controlPlaneOverride: {
            active: false,
            updatedAt: null,
            reason: null,
          },
          assistiveRouter: {
            enabled: false,
            provider: "gemini_api",
            apiKeyConfigured: false,
            model: "gemini-3-flash",
            allowIntents: ["conversation", "translation"],
            timeoutMs: 2500,
            minConfidence: 0.75,
            budgetPolicy: "judged_default",
            promptCaching: "none",
            watchlistEnabled: false,
          },
        },
      },
      {
        name: "ui-executor",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        forceSimulation: false,
        strictPlaywright: true,
        simulateIfUnavailable: false,
        registeredDeviceNodes: 2,
        sandbox: {
          mode: "enforce",
          networkPolicy: "same_origin",
          allowedOriginsCount: 1,
          allowedReadRootsCount: 1,
          allowedWriteRootsCount: 1,
          blockFileUrls: true,
          allowLoopbackHosts: false,
          setupMarker: {
            status: "current",
          },
          warnings: [],
        },
      },
      {
        name: "api-backend",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        governance: {
          complianceTemplate: "strict",
          complianceTemplateFallbackApplied: false,
          allowTenantHeaderOverride: true,
        },
      },
    ],
    skillsCatalog: baseCatalog,
    skillsRuntimeSummary: baseRuntimeSummary,
  });

  assert.equal(summary.status, "healthy");
  assert.equal(summary.validated, true);
  assert.equal(summary.servicesCoverage.total, 4);
  assert.equal(summary.servicesCoverage.runtimeVisible, 4);
  assert.equal(summary.gateway.fallbackActive, false);
  assert.equal(summary.uiExecutor.sandboxMode, "enforce");
  assert.equal(summary.uiExecutor.sandboxNetworkPolicy, "same_origin");
  assert.equal(summary.uiExecutor.sandboxAllowedWriteRootsCount, 1);
  assert.equal(summary.uiExecutor.sandboxBlockFileUrls, true);
  assert.equal(summary.uiExecutor.sandboxAllowLoopbackHosts, false);
  assert.equal(summary.skillsRuntime?.activeCount, 1);
  assert.equal(summary.orchestrator.workflowControlPlaneOverrideActive, false);
  assert.equal(summary.orchestrator.assistiveRouterProvider, "gemini_api");
  assert.equal(summary.orchestrator.assistiveRouterBudgetPolicy, "judged_default");
  assert.equal(summary.orchestrator.assistiveRouterPromptCaching, "none");
  assert.equal(summary.orchestrator.assistiveRouterWatchlistEnabled, false);
  assert.equal(summary.orchestrator.workflowExecutionStatus, "running");
  assert.equal(summary.orchestrator.workflowCurrentStage, "planning");
  assert.equal(summary.orchestrator.workflowActiveRole, "planner");
  assert.equal(summary.orchestrator.workflowRoute, "live-agent");
  assert.deepEqual(summary.orchestrator.assistiveRouterAllowIntents, ["conversation", "translation"]);
  assert.deepEqual(summary.activeSignals, []);
});

test("runtime diagnostics summary highlights active degradation signals", () => {
  const summary = buildRuntimeDiagnosticsSummary({
    services: [
      {
        name: "realtime-gateway",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 1,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        transport: {
          requestedMode: "webrtc",
          activeMode: "websocket",
          fallbackActive: true,
          webrtc: {
            ready: false,
            reason: "rollout_disabled",
            rollout: { stage: "spike" },
          },
        },
      },
      {
        name: "orchestrator",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        workflow: {
          sourceKind: "file",
          sourcePath: "configs/orchestrator.workflow.json",
          usingLastKnownGood: true,
          fingerprint: "wf-degraded",
          loadedAt: "2026-03-06T00:05:00.000Z",
          lastAttemptAt: "2026-03-06T00:06:00.000Z",
          controlPlaneOverride: {
            active: true,
            updatedAt: "2026-03-06T00:06:00.000Z",
            reason: "force deterministic fallback",
          },
          assistiveRouter: {
            enabled: true,
            provider: "moonshot",
            apiKeyConfigured: false,
            model: "kimi-k2.5",
            allowIntents: ["conversation"],
            timeoutMs: 1800,
            minConfidence: 0.6,
            budgetPolicy: "watchlist_experimental",
            promptCaching: "watchlist_only",
            watchlistEnabled: false,
          },
        },
      },
      {
        name: "ui-executor",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        forceSimulation: true,
        sandbox: {
          mode: "audit",
          networkPolicy: "allow_all",
          allowedOriginsCount: 0,
          allowedReadRootsCount: 1,
          allowedWriteRootsCount: 0,
          blockFileUrls: false,
          allowLoopbackHosts: true,
          setupMarker: {
            status: "stale",
          },
          warnings: ["sandbox warning"],
        },
      },
      {
        name: "api-backend",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
      },
    ],
    skillsCatalog: {
      ...baseCatalog,
      warnings: ["missing default recipe"],
    },
  });

  assert.equal(summary.status, "critical");
  assert.ok(
    Array.isArray(summary.activeSignals) &&
      summary.activeSignals.some((item) => item.key === "gateway_transport_fallback"),
  );
  assert.ok(summary.activeSignals.some((item) => item.key === "workflow_last_known_good"));
  assert.ok(summary.activeSignals.some((item) => item.key === "workflow_control_plane_override_active"));
  assert.ok(summary.activeSignals.some((item) => item.key === "assistive_router_missing_api_key"));
  assert.ok(summary.activeSignals.some((item) => item.key === "assistive_router_watchlist_disabled"));
  assert.ok(summary.activeSignals.some((item) => item.key === "ui_executor_force_simulation"));
  assert.ok(summary.activeSignals.some((item) => item.key === "ui_executor_sandbox_file_urls_allowed"));
  assert.ok(summary.activeSignals.some((item) => item.key === "ui_executor_sandbox_loopback_allowed"));
  assert.ok(summary.activeSignals.some((item) => item.key === "skills_catalog_warnings"));
  assert.equal(summary.orchestrator.workflowControlPlaneOverrideActive, true);
  assert.equal(summary.orchestrator.workflowControlPlaneOverrideReason, "force deterministic fallback");
  assert.equal(summary.orchestrator.workflowFingerprint, "wf-degraded");
  assert.equal(summary.orchestrator.assistiveRouterProvider, "moonshot");
  assert.equal(summary.orchestrator.assistiveRouterTimeoutMs, 1800);
  assert.equal(summary.orchestrator.assistiveRouterMinConfidence, 0.6);
  assert.equal(summary.orchestrator.assistiveRouterBudgetPolicy, "watchlist_experimental");
  assert.equal(summary.orchestrator.assistiveRouterPromptCaching, "watchlist_only");
  assert.equal(summary.orchestrator.assistiveRouterWatchlistEnabled, false);
  assert.deepEqual(summary.orchestrator.assistiveRouterAllowIntents, ["conversation"]);
  assert.equal(summary.uiExecutor.sandboxAllowedWriteRootsCount, 0);
  assert.equal(summary.uiExecutor.sandboxBlockFileUrls, false);
  assert.equal(summary.uiExecutor.sandboxAllowLoopbackHosts, true);
});

test("runtime diagnostics summary flags unrestricted ui-executor egress in enforce mode", () => {
  const summary = buildRuntimeDiagnosticsSummary({
    services: [
      {
        name: "realtime-gateway",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
      },
      {
        name: "orchestrator",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
      },
      {
        name: "ui-executor",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
        sandbox: {
          mode: "enforce",
          networkPolicy: "allow_all",
          allowedOriginsCount: 0,
          allowedReadRootsCount: 1,
          allowedWriteRootsCount: 1,
          blockFileUrls: true,
          allowLoopbackHosts: false,
          setupMarker: {
            status: "current",
          },
          warnings: [],
        },
      },
      {
        name: "api-backend",
        healthy: true,
        ready: true,
        draining: false,
        startupFailureCount: 0,
        startupBlockingFailure: false,
        profile: {},
        metrics: {},
      },
    ],
    skillsCatalog: baseCatalog,
  });

  assert.equal(summary.status, "critical");
  assert.ok(summary.activeSignals.some((item) => item.key === "ui_executor_sandbox_network_open"));
  assert.equal(summary.uiExecutor.sandboxNetworkPolicy, "allow_all");
});
