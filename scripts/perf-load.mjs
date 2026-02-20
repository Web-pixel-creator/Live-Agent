import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

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

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function toPositiveInt(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toSafeString(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : "-";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, p));
  const rank = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function computeLatencyStats(values) {
  const latencies = values.filter((value) => Number.isFinite(value)).map((value) => Number(value));
  if (latencies.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      p50: null,
      p95: null,
      p99: null,
    };
  }

  const sorted = [...latencies].sort((left, right) => left - right);
  const sum = sorted.reduce((acc, value) => acc + value, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function clampConcurrency(concurrency, total) {
  if (total <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(total, concurrency));
}

async function runWithConcurrency(total, concurrency, runner) {
  const effectiveConcurrency = clampConcurrency(concurrency, total);
  const results = new Array(total);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) {
        return;
      }
      results[index] = await runner(index);
    }
  }

  const workers = [];
  for (let i = 0; i < effectiveConcurrency; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function runNodeJsonCommand(args, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        rejectPromise(new Error(`Command timed out after ${timeoutMs}ms: ${args.join(" ")}`));
        return;
      }
      if (code !== 0) {
        const reason = stderr.trim().length > 0 ? stderr.trim() : stdout.trim();
        rejectPromise(new Error(`Command failed (exit ${code}): ${reason}`));
        return;
      }

      const lines = stdout
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length === 0) {
        rejectPromise(new Error("Command produced empty output"));
        return;
      }
      const lastLine = lines[lines.length - 1];
      try {
        const parsed = JSON.parse(lastLine);
        resolvePromise(parsed);
      } catch {
        rejectPromise(new Error(`Command did not return valid JSON: ${lastLine}`));
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureHealth(baseUrl, label, attempts = 6, delayMs = 500) {
  const url = `${baseUrl.replace(/\/+$/, "")}/healthz`;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        lastError = new Error(`${label} health check returned HTTP ${response.status}`);
      } else {
        const payload = await response.json().catch(() => null);
        if (!isObject(payload) || payload.ok !== true) {
          lastError = new Error(`${label} health check returned invalid payload`);
        } else {
          return payload;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  throw new Error(`${label} health check failed: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

function createOrchestratorRequest({ sessionId, runId, userId, intent, input }) {
  return {
    id: randomUUID(),
    userId,
    sessionId,
    runId,
    type: "orchestrator.request",
    source: "frontend",
    ts: new Date().toISOString(),
    payload: {
      intent,
      input,
    },
  };
}

function summarizeWorkload(name, results) {
  const success = results.filter((item) => item.ok);
  const failures = results.filter((item) => !item.ok);
  const latencyStats = computeLatencyStats(success.map((item) => item.latencyMs));
  const errorRatePct = results.length > 0 ? (failures.length / results.length) * 100 : 100;

  return {
    name,
    total: results.length,
    success: success.length,
    failed: failures.length,
    errorRatePct,
    latencyMs: latencyStats,
    failures: failures.slice(0, 10).map((item) => ({
      iteration: item.iteration,
      error: item.error ?? "unknown",
    })),
  };
}

function buildMarkdown(summary) {
  const lines = [];
  lines.push("# Performance Load Report");
  lines.push("");
  lines.push(`- Generated at: ${toSafeString(summary.generatedAt)}`);
  lines.push(`- Success: ${summary.success === true ? "true" : "false"}`);
  lines.push(`- Aggregate error rate: ${toSafeString(summary.aggregate?.errorRatePct)}%`);
  lines.push("");
  lines.push("## Thresholds");
  lines.push("");
  lines.push("| Threshold | Value |");
  lines.push("| --- | --- |");
  lines.push(`| maxLiveP95Ms | ${toSafeString(summary.thresholds?.maxLiveP95Ms)} |`);
  lines.push(`| maxUiP95Ms | ${toSafeString(summary.thresholds?.maxUiP95Ms)} |`);
  lines.push(`| maxGatewayReplayP95Ms | ${toSafeString(summary.thresholds?.maxGatewayReplayP95Ms)} |`);
  lines.push(`| maxGatewayReplayErrorRatePct | ${toSafeString(summary.thresholds?.maxGatewayReplayErrorRatePct)} |`);
  lines.push(`| maxAggregateErrorRatePct | ${toSafeString(summary.thresholds?.maxAggregateErrorRatePct)} |`);
  lines.push("");
  lines.push("## Workloads");
  lines.push("");
  lines.push("| Workload | Total | Success | Failed | Error % | p50 (ms) | p95 (ms) | p99 (ms) |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const workload of summary.workloads ?? []) {
    lines.push(
      `| ${toSafeString(workload.name)} | ${toSafeString(workload.total)} | ${toSafeString(workload.success)} | ${toSafeString(workload.failed)} | ${toSafeString(workload.errorRatePct?.toFixed?.(2) ?? workload.errorRatePct)} | ${toSafeString(workload.latencyMs?.p50)} | ${toSafeString(workload.latencyMs?.p95)} | ${toSafeString(workload.latencyMs?.p99)} |`,
    );
  }
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Status | Value | Expectation |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of summary.checks ?? []) {
    lines.push(
      `| ${toSafeString(check.name)} | ${check.passed ? "passed" : "failed"} | ${toSafeString(check.value)} | ${toSafeString(check.expectation)} |`,
    );
  }
  lines.push("");
  if (Array.isArray(summary.violations) && summary.violations.length > 0) {
    lines.push("## Violations");
    lines.push("");
    for (const violation of summary.violations) {
      lines.push(`- ${violation}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function addCheck(checks, violations, name, passed, value, expectation) {
  checks.push({ name, passed, value, expectation });
  if (!passed) {
    violations.push(`${name}: expected ${toSafeString(expectation)}, got ${toSafeString(value)}`);
  }
}

async function runLiveVoiceLoad(options) {
  const orchestrateUrl = `${options.orchestratorBaseUrl.replace(/\/+$/, "")}/orchestrate`;
  const results = await runWithConcurrency(options.liveIterations, options.liveConcurrency, async (iteration) => {
    const sessionId = `perf-live-session-${iteration}-${randomUUID()}`;
    const runId = `perf-live-run-${iteration}-${randomUUID()}`;
    const userId = `perf-live-user-${iteration % 7}`;
    const request = createOrchestratorRequest({
      sessionId,
      runId,
      userId,
      intent: "translation",
      input: {
        text: "Live load test translation request for latency measurement.",
        targetLanguage: "ru",
      },
    });
    const startedAt = Date.now();

    try {
      const response = await fetch(orchestrateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => null);
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          latencyMs: null,
          iteration,
          error: `HTTP ${response.status}`,
        };
      }

      const status = isObject(payload) && isObject(payload.payload) ? payload.payload.status : null;
      const route = isObject(payload) && isObject(payload.payload) ? payload.payload.route : null;
      const hasTranslation =
        isObject(payload) && isObject(payload.payload) && isObject(payload.payload.output) && isObject(payload.payload.output.translation);

      const ok = status === "completed" && route === "live-agent" && hasTranslation;
      return {
        ok,
        latencyMs: ok ? latencyMs : null,
        iteration,
        error: ok ? null : `unexpected status/route/translation ${toSafeString(status)}/${toSafeString(route)}/${hasTranslation}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: null,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const summary = summarizeWorkload("live_voice_translation", results);
  summary.path = "orchestrator_http";
  return summary;
}

async function runUiNavigationLoad(options) {
  const orchestrateUrl = `${options.orchestratorBaseUrl.replace(/\/+$/, "")}/orchestrate`;
  const results = await runWithConcurrency(options.uiIterations, options.uiConcurrency, async (iteration) => {
    const sessionId = `perf-ui-session-${iteration}-${randomUUID()}`;
    const runId = `perf-ui-run-${iteration}-${randomUUID()}`;
    const userId = `perf-ui-user-${iteration % 5}`;

    const request = createOrchestratorRequest({
      sessionId,
      runId,
      userId,
      intent: "ui_task",
      input: {
        goal: "Open a page and verify the visible header.",
        url: "https://example.com",
        screenshotRef: `ui://perf/${runId}`,
        maxSteps: 4,
        visualTesting: {
          enabled: false,
        },
      },
    });

    const startedAt = Date.now();
    try {
      const response = await fetch(orchestrateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => null);
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          latencyMs: null,
          iteration,
          error: `HTTP ${response.status}`,
          details: payload,
        };
      }
      const status = isObject(payload) && isObject(payload.payload) ? payload.payload.status : null;
      const route = isObject(payload) && isObject(payload.payload) ? payload.payload.route : null;
      const adapterMode =
        isObject(payload) && isObject(payload.payload) && isObject(payload.payload.output) && isObject(payload.payload.output.execution)
          ? payload.payload.output.execution.adapterMode
          : null;
      const completed = status === "completed" && route === "ui-navigator-agent";
      return {
        ok: completed,
        latencyMs: completed ? latencyMs : null,
        iteration,
        adapterMode: typeof adapterMode === "string" ? adapterMode : null,
        error: completed ? null : `unexpected status/route ${toSafeString(status)}/${toSafeString(route)}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: null,
        iteration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const summary = summarizeWorkload("ui_navigation_execution", results);
  const adapterModes = {};
  for (const item of results) {
    if (!item.ok || typeof item.adapterMode !== "string" || item.adapterMode.length === 0) {
      continue;
    }
    adapterModes[item.adapterMode] = (adapterModes[item.adapterMode] ?? 0) + 1;
  }
  summary.adapterModes = adapterModes;
  return summary;
}

async function runGatewayReplayLoad(options) {
  const scriptPath = resolve("scripts/gateway-ws-replay-check.mjs");
  const results = await runWithConcurrency(
    options.gatewayReplayIterations,
    options.gatewayReplayConcurrency,
    async (iteration) => {
      const sessionId = `perf-gateway-replay-session-${iteration}-${randomUUID()}`;
      const runId = `perf-gateway-replay-run-${iteration}-${randomUUID()}`;
      const userId = `perf-gateway-user-${iteration % 5}`;
      const idempotencyKey = `idem-${runId}`;
      const startedAt = Date.now();
      try {
        const payload = await runNodeJsonCommand(
          [
            scriptPath,
            "--url",
            options.gatewayWsUrl,
            "--sessionId",
            sessionId,
            "--runId",
            runId,
            "--userId",
            userId,
            "--idempotencyKey",
            idempotencyKey,
            "--timeoutMs",
            String(options.gatewayReplayTimeoutMs),
          ],
          options.gatewayReplayTimeoutMs,
        );
        const replayEventCount = toFiniteNumber(
          isObject(payload) ? payload.replayEventCount : null,
          0,
        );
        const taskStartedCount = toPositiveInt(
          isObject(payload) ? payload.taskStartedCount : null,
          0,
        );
        const responseIdReused = isObject(payload) ? payload.responseIdReused === true : false;
        const ok =
          isObject(payload) &&
          payload.ok === true &&
          replayEventCount >= 1 &&
          taskStartedCount === 1 &&
          responseIdReused;
        return {
          ok,
          latencyMs: ok ? Date.now() - startedAt : null,
          iteration,
          replayEventCount,
          taskStartedCount,
          responseIdReused,
          error: ok ? null : "replay contract validation failed",
        };
      } catch (error) {
        return {
          ok: false,
          latencyMs: null,
          iteration,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  const summary = summarizeWorkload("gateway_ws_request_replay", results);
  const successful = results.filter((item) => item.ok);
  let replayEventMin = null;
  for (const item of successful) {
    const count = toFiniteNumber(item.replayEventCount, Number.NaN);
    if (!Number.isFinite(count)) {
      continue;
    }
    if (replayEventMin === null || count < replayEventMin) {
      replayEventMin = count;
    }
  }
  summary.contract = {
    replayEventMin,
    responseIdReusedAll: successful.every((item) => item.responseIdReused === true),
    taskStartedExactlyOneAll: successful.every((item) => item.taskStartedCount === 1),
  };
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const outputPath = resolve(args.output ?? "artifacts/perf-load/summary.json");
  const markdownPath = resolve(args.markdownOutput ?? "artifacts/perf-load/summary.md");

  const options = {
    gatewayWsUrl: args.gatewayWsUrl ?? "ws://127.0.0.1:8080/realtime",
    gatewayBaseUrl: args.gatewayBaseUrl ?? "http://127.0.0.1:8080",
    orchestratorBaseUrl: args.orchestratorBaseUrl ?? "http://127.0.0.1:8082",
    apiBaseUrl: args.apiBaseUrl ?? "http://127.0.0.1:8081",
    liveIterations: toPositiveInt(args.liveIterations, 20),
    liveConcurrency: toPositiveInt(args.liveConcurrency, 4),
    liveTimeoutMs: toPositiveInt(args.liveTimeoutMs, 12000),
    uiIterations: toPositiveInt(args.uiIterations, 20),
    uiConcurrency: toPositiveInt(args.uiConcurrency, 4),
    gatewayReplayIterations: toPositiveInt(args.gatewayReplayIterations, 8),
    gatewayReplayConcurrency: toPositiveInt(args.gatewayReplayConcurrency, 2),
    gatewayReplayTimeoutMs: toPositiveInt(args.gatewayReplayTimeoutMs, 18000),
    maxLiveP95Ms: toPositiveInt(args.maxLiveP95Ms, 1800),
    maxUiP95Ms: toPositiveInt(args.maxUiP95Ms, 25000),
    maxGatewayReplayP95Ms: toPositiveInt(args.maxGatewayReplayP95Ms, 9000),
    maxGatewayReplayErrorRatePct: toFiniteNumber(args.maxGatewayReplayErrorRatePct, 20),
    maxAggregateErrorRatePct: toFiniteNumber(args.maxAggregateErrorRatePct, 10),
    requiredUiAdapterMode: args.requiredUiAdapterMode ?? "remote_http",
    skipHealthChecks: args.skipHealthChecks === "true",
  };

  if (!options.skipHealthChecks) {
    await ensureHealth(options.gatewayBaseUrl, "realtime-gateway");
    await ensureHealth(options.apiBaseUrl, "api-backend");
    await ensureHealth(options.orchestratorBaseUrl, "orchestrator");
  }

  const liveWorkload = await runLiveVoiceLoad(options);
  const uiWorkload = await runUiNavigationLoad(options);
  const gatewayReplayWorkload = await runGatewayReplayLoad(options);
  const workloads = [liveWorkload, uiWorkload, gatewayReplayWorkload];

  const aggregateTotal = workloads.reduce((acc, workload) => acc + workload.total, 0);
  const aggregateFailed = workloads.reduce((acc, workload) => acc + workload.failed, 0);
  const aggregateErrorRatePct = aggregateTotal > 0 ? (aggregateFailed / aggregateTotal) * 100 : 100;

  const checks = [];
  const violations = [];
  addCheck(
    checks,
    violations,
    "live_voice_translation.p95",
    Number.isFinite(liveWorkload.latencyMs.p95) && liveWorkload.latencyMs.p95 <= options.maxLiveP95Ms,
    liveWorkload.latencyMs.p95,
    `<= ${options.maxLiveP95Ms}`,
  );
  addCheck(
    checks,
    violations,
    "ui_navigation_execution.p95",
    Number.isFinite(uiWorkload.latencyMs.p95) && uiWorkload.latencyMs.p95 <= options.maxUiP95Ms,
    uiWorkload.latencyMs.p95,
    `<= ${options.maxUiP95Ms}`,
  );
  addCheck(
    checks,
    violations,
    "gateway_ws_request_replay.p95",
    Number.isFinite(gatewayReplayWorkload.latencyMs.p95) &&
      gatewayReplayWorkload.latencyMs.p95 <= options.maxGatewayReplayP95Ms,
    gatewayReplayWorkload.latencyMs.p95,
    `<= ${options.maxGatewayReplayP95Ms}`,
  );
  addCheck(
    checks,
    violations,
    "gateway_ws_request_replay.errorRatePct",
    gatewayReplayWorkload.errorRatePct <= options.maxGatewayReplayErrorRatePct,
    gatewayReplayWorkload.errorRatePct,
    `<= ${options.maxGatewayReplayErrorRatePct}`,
  );
  addCheck(
    checks,
    violations,
    "aggregate.errorRatePct",
    aggregateErrorRatePct <= options.maxAggregateErrorRatePct,
    aggregateErrorRatePct,
    `<= ${options.maxAggregateErrorRatePct}`,
  );
  addCheck(
    checks,
    violations,
    "live_voice_translation.successCount",
    liveWorkload.success >= 1,
    liveWorkload.success,
    ">= 1",
  );
  addCheck(
    checks,
    violations,
    "gateway_ws_request_replay.successCount",
    gatewayReplayWorkload.success >= 1,
    gatewayReplayWorkload.success,
    ">= 1",
  );
  addCheck(
    checks,
    violations,
    "gateway_ws_request_replay.contract.responseIdReusedAll",
    gatewayReplayWorkload.contract?.responseIdReusedAll === true,
    gatewayReplayWorkload.contract?.responseIdReusedAll,
    true,
  );
  addCheck(
    checks,
    violations,
    "gateway_ws_request_replay.contract.taskStartedExactlyOneAll",
    gatewayReplayWorkload.contract?.taskStartedExactlyOneAll === true,
    gatewayReplayWorkload.contract?.taskStartedExactlyOneAll,
    true,
  );
  addCheck(
    checks,
    violations,
    "ui_navigation_execution.successCount",
    uiWorkload.success >= 1,
    uiWorkload.success,
    ">= 1",
  );
  if (typeof options.requiredUiAdapterMode === "string" && options.requiredUiAdapterMode.trim().length > 0) {
    const adapterCount = Number(uiWorkload.adapterModes?.[options.requiredUiAdapterMode] ?? 0);
    addCheck(
      checks,
      violations,
      `ui_navigation_execution.adapterMode.${options.requiredUiAdapterMode}`,
      adapterCount >= 1,
      adapterCount,
      ">= 1",
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    success: violations.length === 0,
    options: {
      liveIterations: options.liveIterations,
      liveConcurrency: options.liveConcurrency,
      uiIterations: options.uiIterations,
      uiConcurrency: options.uiConcurrency,
      gatewayReplayIterations: options.gatewayReplayIterations,
      gatewayReplayConcurrency: options.gatewayReplayConcurrency,
      gatewayReplayTimeoutMs: options.gatewayReplayTimeoutMs,
      liveTimeoutMs: options.liveTimeoutMs,
      requiredUiAdapterMode: options.requiredUiAdapterMode,
      skipHealthChecks: options.skipHealthChecks,
    },
    thresholds: {
      maxLiveP95Ms: options.maxLiveP95Ms,
      maxUiP95Ms: options.maxUiP95Ms,
      maxGatewayReplayP95Ms: options.maxGatewayReplayP95Ms,
      maxGatewayReplayErrorRatePct: options.maxGatewayReplayErrorRatePct,
      maxAggregateErrorRatePct: options.maxAggregateErrorRatePct,
    },
    workloads,
    aggregate: {
      total: aggregateTotal,
      failed: aggregateFailed,
      errorRatePct: aggregateErrorRatePct,
    },
    checks,
    violations,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${buildMarkdown(summary)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: summary.success,
      output: outputPath,
      markdownOutput: markdownPath,
      checks: checks.length,
      violations: violations.length,
    })}\n`,
  );

  if (!summary.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
});
