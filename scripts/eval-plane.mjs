#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";

const cwd = process.cwd();
const manifestPath = resolve(cwd, "configs", "evals", "eval-manifest.json");

function parseArgs(argv) {
  const args = {
    suite: "all",
    dryRun: false,
    gate: false,
    list: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--suite" || item === "-s") {
      args.suite = argv[index + 1] ?? "all";
      index += 1;
      continue;
    }
    if (item === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (item === "--gate") {
      args.gate = true;
      continue;
    }
    if (item === "--list") {
      args.list = true;
      continue;
    }
  }
  return args;
}

function ensureGoogleKeyAlias(env) {
  const copied = { ...env };
  if (!copied.GOOGLE_API_KEY) {
    copied.GOOGLE_API_KEY = copied.GEMINI_API_KEY ?? copied.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  }
  return copied;
}

function selectSuites(manifestSuites, selection) {
  if (selection === "all") {
    return { selected: manifestSuites, missing: [] };
  }
  const requested = selection
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const selected = manifestSuites.filter((suite) => requested.includes(suite.id));
  const missing = requested.filter((item) => !manifestSuites.some((suite) => suite.id === item));
  return { selected, missing };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const suites = Array.isArray(manifest.suites) ? manifest.suites : [];

  if (args.list) {
    for (const suite of suites) {
      console.log(`${suite.id}\t${suite.configPath}`);
    }
    return;
  }

  const { selected, missing } = selectSuites(suites, args.suite);
  if (missing.length > 0) {
    console.error(`Unknown eval suite(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  if (selected.length === 0) {
    console.error("No eval suites selected.");
    process.exit(1);
  }

  const runSummary = {
    generatedAt: new Date().toISOString(),
    manifestPath,
    suiteSelection: args.suite,
    gate: args.gate,
    dryRun: args.dryRun,
    suites: [],
  };

  const env = ensureGoogleKeyAlias(process.env);
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  let hasFailure = false;

  for (const suite of selected) {
    const configPath = resolve(cwd, suite.configPath);
    const outputPath = resolve(cwd, suite.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    const command = [npxCommand, "-y", "promptfoo@latest", "eval", "-c", configPath, "-o", outputPath, "--no-cache"];

    if (args.dryRun) {
      console.log(command.join(" "));
      runSummary.suites.push({
        id: suite.id,
        name: suite.name,
        configPath,
        outputPath,
        command: command.join(" "),
        dryRun: true,
      });
      continue;
    }

    console.log(`[eval-plane] running ${suite.id}`);
    const startedAt = Date.now();
    const result = spawnSync(command[0], command.slice(1), {
      cwd,
      env,
      stdio: "inherit",
    });
    const durationMs = Date.now() - startedAt;
    const exitCode = typeof result.status === "number" ? result.status : 1;
    if (exitCode !== 0) {
      hasFailure = true;
    }
    runSummary.suites.push({
      id: suite.id,
      name: suite.name,
      configPath,
      outputPath,
      command: command.join(" "),
      durationMs,
      exitCode,
      signal: result.signal ?? null,
      passed: exitCode === 0,
    });
  }

  const summaryPath = resolve(cwd, "artifacts", "evals", "latest-run.json");
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(runSummary, null, 2)}\n`, "utf8");
  console.log(`[eval-plane] summary written to ${summaryPath}`);

  if (hasFailure) {
    process.exit(1);
  }
}

main();
