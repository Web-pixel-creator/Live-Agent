import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { listDeviceNodes } from "../apps/api-backend/src/firestore.ts";
import { buildRuntimeSurfaceInventorySnapshot } from "../apps/api-backend/src/runtime-surface-inventory.ts";
import { buildRuntimeSurfaceReadinessSnapshot } from "../apps/api-backend/src/runtime-surface-readiness.ts";

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

function toBool(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBaseUrl(value, fallback) {
  const candidate = toOptionalString(value) ?? fallback;
  return candidate.replace(/\/+$/, "");
}

async function probeJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const checkedAt = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();
    let payload = null;
    try {
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        checkedAt,
        latencyMs,
        statusCode: response.status,
        type: "http_error",
        message: `HTTP ${response.status}`,
        payload,
      };
    }
    return {
      ok: true,
      checkedAt,
      latencyMs,
      statusCode: response.status,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      type: message.toLowerCase().includes("abort") ? "timeout" : "network_error",
      message,
      payload: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectOperatorServices(env) {
  const apiBaseUrl = toBaseUrl(env.API_BASE_URL, "http://localhost:8081");
  const gatewayBaseUrl = toBaseUrl(env.API_GATEWAY_BASE_URL, "http://localhost:8080");
  const orchestratorBaseUrl = toBaseUrl(
    env.API_ORCHESTRATOR_BASE_URL ?? env.ORCHESTRATOR_BASE_URL,
    "http://localhost:8082",
  );
  const uiExecutorBaseUrl = toBaseUrl(
    env.API_UI_EXECUTOR_BASE_URL ?? env.UI_EXECUTOR_BASE_URL,
    "http://localhost:8090",
  );
  const services = [
    { name: "ui-executor", baseUrl: uiExecutorBaseUrl },
    { name: "realtime-gateway", baseUrl: gatewayBaseUrl },
    { name: "api-backend", baseUrl: apiBaseUrl },
    { name: "orchestrator", baseUrl: orchestratorBaseUrl },
  ];
  const timeoutMs = 4500;
  const summaries = [];

  for (const service of services) {
    const [healthProbe, statusProbe, metricsProbe] = await Promise.all([
      probeJsonWithTimeout(`${service.baseUrl}/healthz`, timeoutMs),
      probeJsonWithTimeout(`${service.baseUrl}/status`, timeoutMs),
      probeJsonWithTimeout(`${service.baseUrl}/metrics`, timeoutMs),
    ]);
    const health = healthProbe.ok ? healthProbe.payload : null;
    const status = statusProbe.ok ? statusProbe.payload : null;
    const metricsResponse = metricsProbe.ok ? metricsProbe.payload : null;
    const probeFailures = [
      { probe: healthProbe, endpoint: "healthz" },
      { probe: statusProbe, endpoint: "status" },
      { probe: metricsProbe, endpoint: "metrics" },
    ]
      .filter((entry) => entry.probe.ok !== true)
      .map((entry) => ({
        endpoint: entry.endpoint,
        checkedAt: entry.probe.checkedAt,
        latencyMs: entry.probe.latencyMs,
        type: entry.probe.type ?? "network_error",
        statusCode: entry.probe.statusCode ?? null,
        message: entry.probe.message ?? "probe failed",
      }));

    const runtime = isRecord(status) && isRecord(status.runtime) ? status.runtime : null;
    const profile = runtime && isRecord(runtime.profile) ? runtime.profile : null;
    const metricsSummary =
      isRecord(metricsResponse) && isRecord(metricsResponse.metrics) ? metricsResponse.metrics : null;
    const startupFailureCount = probeFailures.length;
    const startupBlockingFailure = startupFailureCount >= 2;
    const startupStatus = startupFailureCount <= 0 ? "healthy" : startupBlockingFailure ? "critical" : "degraded";

    summaries.push({
      name: service.name,
      baseUrl: service.baseUrl,
      healthy: isRecord(health) ? health.ok === true : false,
      mode:
        (isRecord(status) ? toOptionalString(status.mode) : null) ??
        (isRecord(health) ? toOptionalString(health.mode) : null),
      state: runtime ? runtime.state ?? null : null,
      ready: runtime ? runtime.ready ?? null : null,
      draining: runtime ? runtime.draining ?? null : null,
      startedAt: runtime ? runtime.startedAt ?? null : null,
      uptimeSec: runtime ? runtime.uptimeSec ?? null : null,
      lastWarmupAt: runtime ? runtime.lastWarmupAt ?? null : null,
      lastDrainAt: runtime ? runtime.lastDrainAt ?? null : null,
      version: runtime ? runtime.version ?? null : null,
      turnTruncation: runtime ? runtime.turnTruncation ?? null : null,
      turnDelete: runtime ? runtime.turnDelete ?? null : null,
      damageControl: runtime ? runtime.damageControl ?? null : null,
      agentUsage: runtime ? runtime.agentUsage ?? null : null,
      transport: runtime ? runtime.transport ?? null : null,
      workflow: runtime ? runtime.workflow ?? null : null,
      sandbox: runtime ? runtime.sandbox ?? null : null,
      browserWorkers: runtime ? runtime.browserWorkers ?? null : null,
      analytics: runtime ? runtime.analytics ?? null : null,
      governance: runtime ? runtime.governance ?? null : null,
      profile,
      strictPlaywright:
        (isRecord(status) ? status.strictPlaywright ?? null : null) ??
        (isRecord(health) ? health.strictPlaywright ?? null : null),
      simulateIfUnavailable:
        (isRecord(status) ? status.simulateIfUnavailable ?? null : null) ??
        (isRecord(health) ? health.simulateIfUnavailable ?? null : null),
      forceSimulation:
        (isRecord(status) ? status.forceSimulation ?? null : null) ??
        (isRecord(health) ? health.forceSimulation ?? null : null),
      playwrightAvailable: isRecord(health) ? health.playwrightAvailable ?? null : null,
      registeredDeviceNodes:
        (isRecord(status) ? status.registeredDeviceNodes ?? null : null) ??
        (isRecord(health) ? health.registeredDeviceNodes ?? null : null),
      storage: isRecord(health) ? health.storage ?? null : null,
      metrics: metricsSummary
        ? {
            totalCount: metricsSummary.totalCount ?? null,
            errorRatePct: metricsSummary.errorRatePct ?? null,
            p95Ms: isRecord(metricsSummary.latencyMs) ? metricsSummary.latencyMs.p95 ?? null : null,
          }
        : null,
      startupStatus,
      startupFailureCount,
      startupBlockingFailure,
      startupFailures: probeFailures,
    });
  }

  return summaries;
}

async function collectDeviceNodes(env) {
  const limit = Math.max(1, Math.min(500, Number(env.OPERATOR_DEVICE_NODE_SUMMARY_LIMIT ?? 200) || 200));
  return listDeviceNodes({
    limit,
    includeOffline: true,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const offline = toBool(args.offline, false);
  const outputPath = resolve(args.output ?? "artifacts/runtime/runtime-surface-snapshot.json");
  const collectionWarnings = [];

  let services = [];
  let deviceNodes = [];

  if (!offline) {
    try {
      services = await collectOperatorServices(process.env);
    } catch (error) {
      collectionWarnings.push({
        source: "services",
        message: error instanceof Error ? error.message : String(error),
      });
      services = [];
    }
    try {
      deviceNodes = await collectDeviceNodes(process.env);
    } catch (error) {
      collectionWarnings.push({
        source: "device_nodes",
        message: error instanceof Error ? error.message : String(error),
      });
      deviceNodes = [];
    }
  }

  const inventory = await buildRuntimeSurfaceInventorySnapshot({
    env: process.env,
    cwd,
  });
  const readiness = await buildRuntimeSurfaceReadinessSnapshot({
    env: process.env,
    cwd,
    services,
    deviceNodes,
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "repo_owned_runtime_surface_snapshot",
    mode: offline ? "offline" : "live",
    outputPath,
    collectionWarnings,
    inventory,
    readiness,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      ok: true,
      outputPath,
      mode: snapshot.mode,
      status: readiness.status,
      routes: inventory.summary.totalRoutes,
      playbooks: inventory.summary.totalPlaybooks,
      warnings: collectionWarnings.length,
    }),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
});
