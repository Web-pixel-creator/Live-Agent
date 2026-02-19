import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

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

function pickScenarioDetails(data) {
  if (!isObject(data)) {
    return "-";
  }

  const preferredKeys = [
    "responseStatus",
    "responseRoute",
    "roundTripMs",
    "status",
    "allSatisfied",
    "requiresUserConfirmation",
    "timelineSegments",
    "approvalId",
    "decision",
    "adapterMode",
    "delegatedRoute",
    "code",
    "statusCode",
    "latestDecision",
    "total",
  ];

  const pairs = [];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      pairs.push(`${key}=${toSafeString(data[key])}`);
    }
    if (pairs.length >= 3) {
      break;
    }
  }

  if (pairs.length === 0) {
    return "-";
  }
  return pairs.join(", ");
}

function renderScenariosTable(scenarios) {
  const header = [
    "| Scenario | Status | Elapsed (ms) | Details |",
    "| --- | --- | ---: | --- |",
  ];

  for (const item of scenarios) {
    const name = toSafeString(item?.name);
    const status = toSafeString(item?.status);
    const elapsedMs = toSafeString(item?.elapsedMs);
    const details =
      status === "passed"
        ? pickScenarioDetails(item?.data)
        : `error=${toSafeString(item?.error)}`;
    header.push(`| ${name} | ${status} | ${elapsedMs} | ${details} |`);
  }

  return header.join("\n");
}

function renderKpiTable(kpis) {
  const lines = [
    "| KPI | Value |",
    "| --- | --- |",
  ];

  const entries = isObject(kpis) ? Object.entries(kpis) : [];
  for (const [key, value] of entries) {
    lines.push(`| ${key} | ${toSafeString(value)} |`);
  }

  if (entries.length === 0) {
    lines.push("| - | - |");
  }

  return lines.join("\n");
}

function buildMarkdown(summary) {
  const generatedAt = toSafeString(summary.generatedAt);
  const success = Boolean(summary.success);
  const fatalError = summary.fatalError ? toSafeString(summary.fatalError) : null;
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];
  const kpis = isObject(summary.kpis) ? summary.kpis : {};
  const sessionId = toSafeString(summary?.session?.sessionId);
  const nodeVersion = toSafeString(summary?.environment?.nodeVersion);
  const psVersion = toSafeString(summary?.environment?.powershellVersion);

  const lines = [];
  lines.push("# Demo E2E Report");
  lines.push("");
  lines.push(`- Generated at: ${generatedAt}`);
  lines.push(`- Success: ${success ? "true" : "false"}`);
  lines.push(`- Session ID: ${sessionId}`);
  lines.push(`- Node: ${nodeVersion}`);
  lines.push(`- PowerShell: ${psVersion}`);
  if (fatalError) {
    lines.push(`- Fatal error: ${fatalError}`);
  }
  lines.push("");
  lines.push("## Scenarios");
  lines.push("");
  lines.push(renderScenariosTable(scenarios));
  lines.push("");
  lines.push("## KPIs");
  lines.push("");
  lines.push(renderKpiTable(kpis));
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.input ?? "artifacts/demo-e2e/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/demo-e2e/summary.md");

  const raw = await readFile(inputPath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const summary = JSON.parse(normalized);

  const markdown = buildMarkdown(summary);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      input: inputPath,
      output: outputPath,
    })}\n`,
  );
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
