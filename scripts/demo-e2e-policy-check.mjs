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

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
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
  lines.push("# Demo E2E KPI Policy Check");
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const inputPath = resolve(args.input ?? "artifacts/demo-e2e/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/demo-e2e/policy-check.md");
  const jsonOutputPath = resolve(args.jsonOutput ?? "artifacts/demo-e2e/policy-check.json");

  const maxGatewayWsRoundTripMs = Number.isFinite(toNumber(args.maxGatewayWsRoundTripMs))
    ? toNumber(args.maxGatewayWsRoundTripMs)
    : 1800;
  const minApprovalsRecorded = Number.isFinite(toNumber(args.minApprovalsRecorded))
    ? toNumber(args.minApprovalsRecorded)
    : 1;
  const expectedUiAdapterMode = args.expectedUiAdapterMode ?? "remote_http";
  const allowedUiAdapterModes = toStringArray(args.allowedUiAdapterModes ?? expectedUiAdapterMode);
  const allowedGatewayInterruptEvents = toStringArray(
    args.allowedGatewayInterruptEvents ?? "live.interrupt.requested,live.bridge.unavailable",
  );
  const allowedTranslationProviders = toStringArray(args.allowedTranslationProviders ?? "fallback,gemini");
  const requiredScenarios = toStringArray(
    args.requiredScenarios ??
      [
        "live.translation",
        "live.negotiation",
        "storyteller.pipeline",
        "ui.approval.request",
        "ui.approval.reject",
        "ui.approval.approve_resume",
        "multi_agent.delegation",
        "gateway.websocket.roundtrip",
        "gateway.websocket.task_progress",
        "gateway.websocket.interrupt_signal",
        "gateway.websocket.invalid_envelope",
        "api.approvals.list",
        "api.approvals.resume.invalid_intent",
        "runtime.lifecycle.endpoints",
        "runtime.metrics.endpoints",
      ].join(","),
  );

  const raw = await readFile(inputPath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const summary = JSON.parse(normalized);

  if (!isObject(summary)) {
    fail("summary.json is not an object");
  }

  const kpis = isObject(summary.kpis) ? summary.kpis : {};
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];
  const scenarioByName = new Map(
    scenarios.map((item) => [isObject(item) ? String(item.name) : "", item]).filter(([name]) => name.length > 0),
  );

  const checks = [];
  const violations = [];

  function addCheck(name, passed, value, expectation) {
    checks.push({ name, passed, value, expectation });
    if (!passed) {
      violations.push(`${name}: expected ${toSafeString(expectation)}, got ${toSafeString(value)}`);
    }
  }

  addCheck("summary.success", summary.success === true, summary.success, true);

  for (const scenarioName of requiredScenarios) {
    const found = scenarioByName.get(scenarioName);
    const status = isObject(found) ? found.status : null;
    addCheck(`scenario.${scenarioName}`, status === "passed", status, "passed");
  }

  addCheck(
    "kpi.negotiationConstraintsSatisfied",
    kpis.negotiationConstraintsSatisfied === true,
    kpis.negotiationConstraintsSatisfied,
    true,
  );
  addCheck(
    "kpi.negotiationRequiresUserConfirmation",
    kpis.negotiationRequiresUserConfirmation === true,
    kpis.negotiationRequiresUserConfirmation,
    true,
  );
  addCheck(
    "kpi.gatewayWsResponseStatus",
    kpis.gatewayWsResponseStatus === "completed",
    kpis.gatewayWsResponseStatus,
    "completed",
  );
  addCheck(
    "kpi.gatewayInterruptHandled",
    kpis.gatewayInterruptHandled === true,
    kpis.gatewayInterruptHandled,
    true,
  );
  addCheck(
    "kpi.gatewayInterruptEventType",
    allowedGatewayInterruptEvents.includes(String(kpis.gatewayInterruptEventType)),
    kpis.gatewayInterruptEventType,
    allowedGatewayInterruptEvents.join(" | "),
  );
  addCheck(
    "kpi.gatewayWsInvalidEnvelopeCode",
    kpis.gatewayWsInvalidEnvelopeCode === "GATEWAY_INVALID_ENVELOPE",
    kpis.gatewayWsInvalidEnvelopeCode,
    "GATEWAY_INVALID_ENVELOPE",
  );
  addCheck(
    "kpi.approvalsInvalidIntentStatusCode",
    toNumber(kpis.approvalsInvalidIntentStatusCode) === 400,
    kpis.approvalsInvalidIntentStatusCode,
    400,
  );
  addCheck(
    "kpi.approvalsRecorded",
    toNumber(kpis.approvalsRecorded) >= minApprovalsRecorded,
    kpis.approvalsRecorded,
    `>= ${minApprovalsRecorded}`,
  );
  addCheck(
    "kpi.uiAdapterMode",
    allowedUiAdapterModes.includes(String(kpis.uiAdapterMode)),
    kpis.uiAdapterMode,
    allowedUiAdapterModes.join(" | "),
  );
  addCheck(
    "kpi.gatewayWsRoundTripMs",
    toNumber(kpis.gatewayWsRoundTripMs) <= maxGatewayWsRoundTripMs,
    kpis.gatewayWsRoundTripMs,
    `<= ${maxGatewayWsRoundTripMs}`,
  );
  addCheck(
    "kpi.taskProgressEventsObserved",
    toNumber(kpis.taskProgressEventsObserved) >= 1,
    kpis.taskProgressEventsObserved,
    ">= 1",
  );
  addCheck(
    "kpi.activeTasksVisible",
    toNumber(kpis.activeTasksVisible) >= 1,
    kpis.activeTasksVisible,
    ">= 1",
  );
  addCheck(
    "kpi.translationProvider",
    allowedTranslationProviders.includes(String(kpis.translationProvider)),
    kpis.translationProvider,
    allowedTranslationProviders.join(" | "),
  );
  addCheck(
    "kpi.lifecycleEndpointsValidated",
    kpis.lifecycleEndpointsValidated === true,
    kpis.lifecycleEndpointsValidated,
    true,
  );
  addCheck(
    "kpi.metricsEndpointsValidated",
    kpis.metricsEndpointsValidated === true,
    kpis.metricsEndpointsValidated,
    true,
  );
  addCheck(
    "kpi.metricsServicesValidated",
    toNumber(kpis.metricsServicesValidated) >= 3,
    kpis.metricsServicesValidated,
    ">= 3",
  );

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
      maxGatewayWsRoundTripMs,
      minApprovalsRecorded,
      expectedUiAdapterMode,
      allowedUiAdapterModes,
      allowedGatewayInterruptEvents,
      allowedTranslationProviders,
      requiredScenarios,
    },
    checks: checks.length,
    checkItems: checks,
    violations,
  };

  await writeFile(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  if (!success) {
    fail("KPI policy check failed", result);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fail("KPI policy check crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
