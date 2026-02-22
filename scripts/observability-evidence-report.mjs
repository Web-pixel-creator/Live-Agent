import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
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

function toBool(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return fallback;
}

function buildChecks(summary, thresholds) {
  const monitoring = isObject(summary.monitoring) ? summary.monitoring : {};
  const bigQuery = isObject(summary.bigQuery) ? summary.bigQuery : {};

  const checks = [];

  const dashboardsFound = toNumber(monitoring.dashboardsFound, 0);
  checks.push({
    name: "monitoring.dashboardsFound",
    passed: dashboardsFound >= thresholds.minMatchingDashboards,
    value: dashboardsFound,
    expectation: `>= ${thresholds.minMatchingDashboards}`,
  });

  const alertsFound = toNumber(monitoring.alertsFound, 0);
  checks.push({
    name: "monitoring.alertsFound",
    passed: alertsFound >= thresholds.minMatchingAlerts,
    value: alertsFound,
    expectation: `>= ${thresholds.minMatchingAlerts}`,
  });

  const monitoringError = typeof monitoring.error === "string" && monitoring.error.length > 0 ? monitoring.error : null;
  checks.push({
    name: "monitoring.error",
    passed: !monitoringError,
    value: monitoringError ?? "none",
    expectation: "none",
  });

  const datasetExists = bigQuery.datasetExists === true;
  checks.push({
    name: "bigQuery.datasetExists",
    passed: thresholds.requireBigQueryDataset ? datasetExists : true,
    value: datasetExists,
    expectation: thresholds.requireBigQueryDataset ? true : "optional",
  });

  const sampledRows = toNumber(bigQuery.sampledRows, 0);
  checks.push({
    name: "bigQuery.sampledRows",
    passed: sampledRows >= thresholds.minBigQueryRows,
    value: sampledRows,
    expectation: `>= ${thresholds.minBigQueryRows}`,
  });

  const bigQueryError = typeof bigQuery.error === "string" && bigQuery.error.length > 0 ? bigQuery.error : null;
  checks.push({
    name: "bigQuery.error",
    passed: thresholds.allowBigQueryError ? true : !bigQueryError,
    value: bigQueryError ?? "none",
    expectation: thresholds.allowBigQueryError ? "optional" : "none",
  });

  const violations = checks
    .filter((item) => !item.passed)
    .map((item) => `${item.name}: expected ${item.expectation}, got ${toSafeString(item.value)}`);

  return {
    checks,
    violations,
    ok: violations.length === 0,
  };
}

function renderCheckTable(checks) {
  const lines = [
    "| Check | Passed | Value | Expectation |",
    "| --- | --- | --- | --- |",
  ];
  for (const check of checks) {
    lines.push(
      `| ${check.name} | ${check.passed ? "yes" : "no"} | ${toSafeString(check.value)} | ${toSafeString(check.expectation)} |`,
    );
  }
  return lines.join("\n");
}

function renderFileList(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return "- none";
  }
  return files.map((filePath) => `- ${filePath}`).join("\n");
}

function buildMarkdown(summary, report) {
  const monitoring = isObject(summary.monitoring) ? summary.monitoring : {};
  const bigQuery = isObject(summary.bigQuery) ? summary.bigQuery : {};

  const lines = [];
  lines.push("# Judge Observability Evidence");
  lines.push("");
  lines.push(`- Generated At: ${toSafeString(report.generatedAt)}`);
  lines.push(`- Source Summary: ${toSafeString(report.input)}`);
  lines.push(`- Overall Status: ${report.ok ? "pass" : "fail"}`);
  lines.push(`- Checks: ${report.checks.length}`);
  lines.push(`- Violations: ${report.violations.length}`);
  lines.push("");

  lines.push("## Checks");
  lines.push("");
  lines.push(renderCheckTable(report.checks));
  lines.push("");

  lines.push("## Monitoring Snapshot");
  lines.push("");
  lines.push(`- Dashboard Name: ${toSafeString(monitoring.dashboardName)}`);
  lines.push(`- Alert Prefix: ${toSafeString(monitoring.alertNamePrefix)}`);
  lines.push(`- Dashboards Found: ${toSafeString(monitoring.dashboardsFound)}`);
  lines.push(`- Alerts Found: ${toSafeString(monitoring.alertsFound)}`);
  lines.push(`- Error: ${toSafeString(monitoring.error ?? "none")}`);
  lines.push("- Files:");
  lines.push(renderFileList(monitoring.files));
  lines.push("");

  lines.push("## BigQuery Snapshot");
  lines.push("");
  lines.push(`- Dataset Exists: ${toSafeString(bigQuery.datasetExists)}`);
  lines.push(`- Tables Found: ${toSafeString(bigQuery.tablesFound)}`);
  lines.push(`- Sampled Table: ${toSafeString(bigQuery.sampledTable)}`);
  lines.push(`- Sampled Rows: ${toSafeString(bigQuery.sampledRows)}`);
  lines.push(`- Error: ${toSafeString(bigQuery.error ?? "none")}`);
  lines.push("- Files:");
  lines.push(renderFileList(bigQuery.files));
  lines.push("");

  if (report.violations.length > 0) {
    lines.push("## Violations");
    lines.push("");
    for (const violation of report.violations) {
      lines.push(`- ${violation}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.input ?? "artifacts/observability/observability-evidence-summary.json");
  const outputPath = resolve(args.output ?? "artifacts/observability/judge-observability.md");
  const jsonOutputPath = resolve(args.jsonOutput ?? "artifacts/observability/judge-observability.json");

  const thresholds = {
    minMatchingDashboards: Math.max(0, Math.floor(toNumber(args.minMatchingDashboards, 1))),
    minMatchingAlerts: Math.max(0, Math.floor(toNumber(args.minMatchingAlerts, 3))),
    requireBigQueryDataset: toBool(args.requireBigQueryDataset, true),
    minBigQueryRows: Math.max(0, Math.floor(toNumber(args.minBigQueryRows, 1))),
    allowBigQueryError: toBool(args.allowBigQueryError, false),
  };

  const raw = await readFile(inputPath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const summary = JSON.parse(normalized);

  const evaluated = buildChecks(summary, thresholds);
  const report = {
    ok: evaluated.ok,
    generatedAt: new Date().toISOString(),
    input: inputPath,
    output: outputPath,
    jsonOutput: jsonOutputPath,
    thresholds,
    checks: evaluated.checks,
    violations: evaluated.violations,
    summary,
  };

  const markdown = buildMarkdown(summary, report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");
  await mkdir(dirname(jsonOutputPath), { recursive: true });
  await writeFile(jsonOutputPath, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write(`${JSON.stringify({
    ok: report.ok,
    input: report.input,
    output: report.output,
    jsonOutput: report.jsonOutput,
    checks: report.checks.length,
    violations: report.violations.length,
  })}\n`);

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exit(1);
});
