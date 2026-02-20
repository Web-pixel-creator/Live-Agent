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

function toNumber(value, fallback = Number.NaN) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
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

function renderMarkdown(params) {
  const { inputPath, success, checks, violations } = params;
  const lines = [];
  lines.push("# Perf Load Policy Check");
  lines.push("");
  lines.push(`- Input: ${inputPath}`);
  lines.push(`- Success: ${success ? "true" : "false"}`);
  lines.push(`- Checks: ${checks.length}`);
  lines.push(`- Violations: ${violations.length}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Status | Value | Expectation |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of checks) {
    lines.push(
      `| ${check.name} | ${check.passed ? "passed" : "failed"} | ${toSafeString(check.value)} | ${toSafeString(check.expectation)} |`,
    );
  }
  lines.push("");
  if (violations.length > 0) {
    lines.push("## Violations");
    lines.push("");
    for (const violation of violations) {
      lines.push(`- ${violation}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function findWorkload(summary, name) {
  const workloads = Array.isArray(summary.workloads) ? summary.workloads : [];
  return workloads.find((item) => isObject(item) && item.name === name) ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.input ?? "artifacts/perf-load/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/perf-load/policy-check.md");
  const jsonOutputPath = resolve(args.jsonOutput ?? "artifacts/perf-load/policy-check.json");

  const maxLiveP95Ms = toNumber(args.maxLiveP95Ms, 1800);
  const maxUiP95Ms = toNumber(args.maxUiP95Ms, 25000);
  const maxGatewayReplayP95Ms = toNumber(args.maxGatewayReplayP95Ms, 9000);
  const maxGatewayReplayErrorRatePct = toNumber(args.maxGatewayReplayErrorRatePct, 20);
  const maxAggregateErrorRatePct = toNumber(args.maxAggregateErrorRatePct, 10);
  const requiredUiAdapterMode = typeof args.requiredUiAdapterMode === "string" ? args.requiredUiAdapterMode : "remote_http";

  const raw = await readFile(inputPath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const summary = JSON.parse(normalized);
  if (!isObject(summary)) {
    fail("summary is not an object");
  }

  const live = findWorkload(summary, "live_voice_translation");
  const ui = findWorkload(summary, "ui_navigation_execution");
  const gatewayReplay = findWorkload(summary, "gateway_ws_request_replay");
  const aggregate = isObject(summary.aggregate) ? summary.aggregate : {};

  const checks = [];
  const violations = [];

  function addCheck(name, passed, value, expectation) {
    checks.push({ name, passed, value, expectation });
    if (!passed) {
      violations.push(`${name}: expected ${toSafeString(expectation)}, got ${toSafeString(value)}`);
    }
  }

  addCheck("summary.success", summary.success === true, summary.success, true);
  addCheck("workload.live.exists", live !== null, live ? "present" : "missing", "present");
  addCheck("workload.ui.exists", ui !== null, ui ? "present" : "missing", "present");
  addCheck(
    "workload.gateway_replay.exists",
    gatewayReplay !== null,
    gatewayReplay ? "present" : "missing",
    "present",
  );

  addCheck(
    "workload.live.p95",
    live !== null && toNumber(live?.latencyMs?.p95) <= maxLiveP95Ms,
    live?.latencyMs?.p95,
    `<= ${maxLiveP95Ms}`,
  );
  addCheck(
    "workload.ui.p95",
    ui !== null && toNumber(ui?.latencyMs?.p95) <= maxUiP95Ms,
    ui?.latencyMs?.p95,
    `<= ${maxUiP95Ms}`,
  );
  addCheck(
    "workload.gateway_replay.p95",
    gatewayReplay !== null && toNumber(gatewayReplay?.latencyMs?.p95) <= maxGatewayReplayP95Ms,
    gatewayReplay?.latencyMs?.p95,
    `<= ${maxGatewayReplayP95Ms}`,
  );
  addCheck(
    "workload.gateway_replay.errorRatePct",
    gatewayReplay !== null && toNumber(gatewayReplay?.errorRatePct) <= maxGatewayReplayErrorRatePct,
    gatewayReplay?.errorRatePct,
    `<= ${maxGatewayReplayErrorRatePct}`,
  );
  addCheck(
    "aggregate.errorRatePct",
    toNumber(aggregate.errorRatePct) <= maxAggregateErrorRatePct,
    aggregate.errorRatePct,
    `<= ${maxAggregateErrorRatePct}`,
  );
  addCheck(
    "workload.live.success",
    toNumber(live?.success) >= 1,
    live?.success,
    ">= 1",
  );
  addCheck(
    "workload.ui.success",
    toNumber(ui?.success) >= 1,
    ui?.success,
    ">= 1",
  );
  addCheck(
    "workload.gateway_replay.success",
    toNumber(gatewayReplay?.success) >= 1,
    gatewayReplay?.success,
    ">= 1",
  );
  addCheck(
    "workload.gateway_replay.contract.responseIdReusedAll",
    gatewayReplay?.contract?.responseIdReusedAll === true,
    gatewayReplay?.contract?.responseIdReusedAll,
    true,
  );
  addCheck(
    "workload.gateway_replay.contract.taskStartedExactlyOneAll",
    gatewayReplay?.contract?.taskStartedExactlyOneAll === true,
    gatewayReplay?.contract?.taskStartedExactlyOneAll,
    true,
  );
  if (requiredUiAdapterMode.trim().length > 0) {
    const adapterCount = toNumber(ui?.adapterModes?.[requiredUiAdapterMode], 0);
    addCheck(
      `workload.ui.adapterMode.${requiredUiAdapterMode}`,
      adapterCount >= 1,
      adapterCount,
      ">= 1",
    );
  }

  const success = violations.length === 0;
  const report = renderMarkdown({
    inputPath,
    success,
    checks,
    violations,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(jsonOutputPath), { recursive: true });
  await writeFile(outputPath, report, "utf8");

  const result = {
    ok: success,
    generatedAt: new Date().toISOString(),
    input: inputPath,
    output: outputPath,
    jsonOutput: jsonOutputPath,
    thresholds: {
      maxLiveP95Ms,
      maxUiP95Ms,
      maxGatewayReplayP95Ms,
      maxGatewayReplayErrorRatePct,
      maxAggregateErrorRatePct,
      requiredUiAdapterMode,
    },
    checks: checks.length,
    checkItems: checks,
    violations,
  };
  await writeFile(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  if (!success) {
    fail("Perf load policy check failed", result);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fail("Perf load policy check crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
