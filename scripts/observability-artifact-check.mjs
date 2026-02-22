import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

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

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function validateSummaryShape(summary, strict) {
  const violations = [];
  if (!summary || typeof summary !== "object") {
    violations.push("summary is not a JSON object");
    return violations;
  }
  if (toNonEmptyString(summary.generatedAt) === null) {
    violations.push("summary.generatedAt is missing");
  }
  if (toNonEmptyString(summary.projectId) === null) {
    violations.push("summary.projectId is missing");
  }
  if (!summary.monitoring || typeof summary.monitoring !== "object") {
    violations.push("summary.monitoring block is missing");
  }
  if (!summary.bigQuery || typeof summary.bigQuery !== "object") {
    violations.push("summary.bigQuery block is missing");
  }
  if (strict) {
    if (typeof summary.monitoring?.dashboardsFound !== "number") {
      violations.push("summary.monitoring.dashboardsFound is not numeric");
    }
    if (typeof summary.monitoring?.alertsFound !== "number") {
      violations.push("summary.monitoring.alertsFound is not numeric");
    }
  }
  return violations;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseDir = resolve(args.baseDir ?? "artifacts/observability");
  const strict = toBool(args.strict, true);
  const requiredFilesRaw =
    args.required ??
    "observability-evidence-summary.json,observability-evidence-summary.md,judge-observability.md,judge-observability.json";
  const requiredFiles = requiredFilesRaw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const missing = [];
  for (const relativeFile of requiredFiles) {
    const fullPath = resolve(baseDir, relativeFile);
    if (!(await fileExists(fullPath))) {
      missing.push(fullPath);
    }
  }

  const summaryPath = resolve(baseDir, "observability-evidence-summary.json");
  const shapeViolations = [];
  if (await fileExists(summaryPath)) {
    try {
      const raw = await readFile(summaryPath, "utf8");
      const summary = JSON.parse(raw.replace(/^\uFEFF/, ""));
      shapeViolations.push(...validateSummaryShape(summary, strict));
    } catch (error) {
      shapeViolations.push(
        `failed to parse summary JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const violations = [];
  if (missing.length > 0) {
    violations.push(...missing.map((path) => `missing file: ${path}`));
  }
  if (shapeViolations.length > 0) {
    violations.push(...shapeViolations);
  }

  const result = {
    ok: violations.length === 0,
    generatedAt: new Date().toISOString(),
    baseDir,
    requiredFiles,
    missingCount: missing.length,
    violations,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
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
