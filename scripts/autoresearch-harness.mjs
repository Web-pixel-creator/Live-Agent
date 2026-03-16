import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RESULTS_HEADER = "commit\tmetric\tstatus\tdescription\n";

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function sanitizeCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

function parseArgs(argv) {
  const parsed = {
    config: null,
    description: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--config") {
      parsed.config = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--description") {
      parsed.description = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizePathSpec(pathSpec) {
  if (Array.isArray(pathSpec)) {
    return pathSpec;
  }
  if (typeof pathSpec === "string") {
    return pathSpec.split(".").filter(Boolean);
  }
  throw new Error("Metric/guardrail path must be an array or dot-delimited string.");
}

function matchesWhere(candidate, where) {
  if (candidate === null || typeof candidate !== "object") {
    return false;
  }

  return Object.entries(where).every(([key, expected]) => {
    if (!(key in candidate)) {
      return false;
    }
    return candidate[key] === expected;
  });
}

export function resolvePathValue(root, pathSpec) {
  const segments = normalizePathSpec(pathSpec);
  let current = root;

  for (const segment of segments) {
    if (segment && typeof segment === "object" && !Array.isArray(segment)) {
      if ("where" in segment) {
        if (!Array.isArray(current)) {
          return undefined;
        }
        current = current.find((entry) => matchesWhere(entry, segment.where));
        continue;
      }
      throw new Error("Unsupported path segment object. Only { where: {...} } is supported.");
    }

    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function asComparableNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function evaluateGuardrails(root, guardrails = []) {
  return guardrails.map((guardrail) => {
    const actual = resolvePathValue(root, guardrail.path);
    const passed = compareValues(actual, guardrail.op, guardrail.value);
    return {
      label: guardrail.label ?? normalizePathSpec(guardrail.path).join("."),
      passed,
      actual,
      op: guardrail.op,
      expected: guardrail.value,
    };
  });
}

export function compareValues(actual, op, expected) {
  switch (op) {
    case "<":
      return Number(actual) < Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    case ">":
      return Number(actual) > Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    default:
      throw new Error(`Unsupported guardrail operator: ${op}`);
  }
}

export function parseResultsTsv(tsvSource) {
  const lines = tsvSource
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split("\t");

  return rowLines.map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function getBestKeptMetric(rows, objective) {
  const keptMetrics = rows
    .filter((row) => row.status === "keep")
    .map((row) => asComparableNumber(row.metric))
    .filter((value) => value !== null);

  if (keptMetrics.length === 0) {
    return null;
  }

  return objective === "maximize"
    ? Math.max(...keptMetrics)
    : Math.min(...keptMetrics);
}

export function determineDecision({ objective, metricValue, bestMetric, guardrailsPassed, runCrashed }) {
  if (runCrashed) {
    return {
      status: "crash",
      reason: "run_failed_or_metric_missing",
    };
  }

  if (!guardrailsPassed) {
    return {
      status: "discard",
      reason: "guardrails_failed",
    };
  }

  if (bestMetric === null) {
    return {
      status: "keep",
      reason: "baseline",
    };
  }

  if (objective === "maximize") {
    return metricValue > bestMetric
      ? { status: "keep", reason: "improved" }
      : { status: "discard", reason: "not_improved" };
  }

  return metricValue < bestMetric
    ? { status: "keep", reason: "improved" }
    : { status: "discard", reason: "not_improved" };
}

function getGitMetadata(cwd) {
  const commitProbe = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd,
    encoding: "utf8",
  });
  const statusProbe = spawnSync("git", ["status", "--porcelain"], {
    cwd,
    encoding: "utf8",
  });

  return {
    commit: commitProbe.status === 0 ? commitProbe.stdout.trim() : "unversioned",
    dirty: statusProbe.status === 0 ? statusProbe.stdout.trim().length > 0 : false,
  };
}

function appendResultsRow(resultsPath, row) {
  ensureParentDir(resultsPath);

  if (!existsSync(resultsPath)) {
    writeFileSync(resultsPath, RESULTS_HEADER, "utf8");
  }

  const line = [
    sanitizeCell(row.commit),
    sanitizeCell(row.metric),
    sanitizeCell(row.status),
    sanitizeCell(row.description),
  ].join("\t");
  appendFileSync(resultsPath, `${line}\n`, "utf8");
}

async function runCommandWithBudget(command, { cwd, budgetSeconds, logPath }) {
  ensureParentDir(logPath);

  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Math.max(1, budgetSeconds) * 1000);

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      writeFileSync(logPath, output, "utf8");
      resolvePromise({
        ok: exitCode === 0 && !timedOut,
        exitCode: exitCode ?? 1,
        signal,
        timedOut,
        logPath,
      });
    });
  });
}

async function runConfiguredExperiment(configPath, descriptionOverride) {
  const resolvedConfigPath = resolve(process.cwd(), configPath);
  const config = loadJson(resolvedConfigPath);
  const cwd = resolve(process.cwd(), config.cwd ?? ".");

  if (!config.metric?.artifactPath || !config.metric?.path || !config.metric?.objective) {
    throw new Error("Config must declare metric.artifactPath, metric.path, and metric.objective.");
  }

  const resultsPath = resolve(cwd, config.resultsPath ?? "artifacts/autoresearch/results.tsv");
  const logPath = resolve(cwd, config.logPath ?? "artifacts/autoresearch/run.log");
  const reportPath = resolve(cwd, config.reportPath ?? "artifacts/autoresearch/last-run.json");
  const metricArtifactPath = resolve(cwd, config.metric.artifactPath);

  const git = getGitMetadata(cwd);
  const description = descriptionOverride ?? config.defaultDescription ?? config.name ?? "experiment";
  const run = await runCommandWithBudget(config.runCommand, {
    cwd,
    budgetSeconds: config.budgetSeconds ?? 300,
    logPath,
  });

  let metricArtifact = null;
  let metricValue = null;
  let guardrailResults = [];

  if (run.ok && existsSync(metricArtifactPath)) {
    metricArtifact = loadJson(metricArtifactPath);
    metricValue = asComparableNumber(resolvePathValue(metricArtifact, config.metric.path));
    guardrailResults = evaluateGuardrails(metricArtifact, config.guardrails ?? []);
  }

  const existingRows = existsSync(resultsPath)
    ? parseResultsTsv(readFileSync(resultsPath, "utf8"))
    : [];
  const bestMetric = getBestKeptMetric(existingRows, config.metric.objective);
  const guardrailsPassed = guardrailResults.every((guardrail) => guardrail.passed);
  const decision = determineDecision({
    objective: config.metric.objective,
    metricValue,
    bestMetric,
    guardrailsPassed,
    runCrashed: !run.ok || metricValue === null,
  });

  appendResultsRow(resultsPath, {
    commit: git.commit,
    metric: metricValue ?? 0,
    status: decision.status,
    description,
  });

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    name: config.name ?? "autoresearch",
    sourceRepo: "karpathy/autoresearch",
    inspirationPath: resolvedConfigPath,
    git,
    description,
    run: {
      command: config.runCommand,
      budgetSeconds: config.budgetSeconds ?? 300,
      ok: run.ok,
      exitCode: run.exitCode,
      signal: run.signal,
      timedOut: run.timedOut,
      logPath,
    },
    metric: {
      label: config.metric.label ?? normalizePathSpec(config.metric.path).join("."),
      unit: config.metric.unit ?? null,
      objective: config.metric.objective,
      artifactPath: metricArtifactPath,
      currentValue: metricValue,
      bestKeptValue: bestMetric,
    },
    decision,
    guardrails: guardrailResults,
    resultsPath,
    reportPath,
  };

  ensureParentDir(reportPath);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config) {
    throw new Error("Usage: node ./scripts/autoresearch-harness.mjs --config <path> [--description <text>]");
  }

  const report = await runConfiguredExperiment(args.config, args.description);
  const summary = [
    `autoresearch: ${report.name}`,
    `decision: ${report.decision.status} (${report.decision.reason})`,
    `metric: ${report.metric.label}=${report.metric.currentValue ?? "n/a"}${report.metric.unit ? ` ${report.metric.unit}` : ""}`,
    `best_kept: ${report.metric.bestKeptValue ?? "baseline"}`,
    `results: ${report.resultsPath}`,
    `report: ${report.reportPath}`,
  ];
  console.log(summary.join("\n"));

  if (report.decision.status === "crash") {
    process.exitCode = 1;
  }
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === entryPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
