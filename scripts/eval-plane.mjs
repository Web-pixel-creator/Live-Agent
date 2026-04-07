#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
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

function collectPromptfooText(value, sink = []) {
  if (sink.length > 500) {
    return sink;
  }
  if (typeof value === "string") {
    sink.push(value);
    return sink;
  }
  if (!value || typeof value !== "object") {
    return sink;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPromptfooText(item, sink);
    }
    return sink;
  }
  for (const item of Object.values(value)) {
    collectPromptfooText(item, sink);
  }
  return sink;
}

function isTransientProviderErrorText(text) {
  return /(?:\b503\b|UNAVAILABLE|high demand|No candidates returned|RESOURCE_EXHAUSTED|rate limit|timeout)/i.test(text);
}

function readPromptfooTransientFailure(outputPath) {
  if (!existsSync(outputPath)) {
    return { transient: false, reason: "missing_output" };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(outputPath, "utf8"));
  } catch {
    return { transient: false, reason: "invalid_output_json" };
  }

  const stats = parsed?.results?.stats ?? {};
  const failures = Number(stats.failures ?? stats.failed ?? 0);
  const errors = Number(stats.errors ?? 0);
  const text = collectPromptfooText(parsed).join("\n");
  const hasTransientProviderError = isTransientProviderErrorText(text);

  return {
    transient: hasTransientProviderError && failures === 0 && errors > 0,
    reason: hasTransientProviderError ? "provider_transient_error" : "non_transient_failure",
    stats: {
      failures,
      errors,
    },
  };
}

function quoteCmdArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=\\-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function buildPromptfooCommand({ configPath, outputPath }) {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = ["-y", "promptfoo@latest", "eval", "-c", configPath, "-o", outputPath, "--no-cache"];
  const displayCommand = [npxCommand, ...args].join(" ");

  if (process.platform === "win32") {
    return {
      executable: "cmd.exe",
      args: ["/d", "/s", "/c", [npxCommand, ...args].map(quoteCmdArgument).join(" ")],
      displayCommand,
    };
  }

  return {
    executable: npxCommand,
    args,
    displayCommand,
  };
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
  const maxTransientRetries = toPositiveInteger(env.EVAL_PLANE_MAX_TRANSIENT_RETRIES, 2);
  let hasFailure = false;

  for (const suite of selected) {
    const configPath = resolve(cwd, suite.configPath);
    const outputPath = resolve(cwd, suite.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    const command = buildPromptfooCommand({ configPath, outputPath });

    if (args.dryRun) {
      console.log(command.displayCommand);
      runSummary.suites.push({
        id: suite.id,
        name: suite.name,
        configPath,
        outputPath,
        command: command.displayCommand,
        dryRun: true,
      });
      continue;
    }

    console.log(`[eval-plane] running ${suite.id}`);
    const suiteStartedAt = Date.now();
    const attempts = [];
    let result;
    let exitCode = 1;
    let spawnError = null;
    let transientFailure = { transient: false, reason: "not_checked" };

    for (let attempt = 1; attempt <= maxTransientRetries + 1; attempt += 1) {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }

      const attemptStartedAt = Date.now();
      result = spawnSync(command.executable, command.args, {
        cwd,
        env,
        stdio: "inherit",
      });
      const attemptDurationMs = Date.now() - attemptStartedAt;
      spawnError = result.error
        ? {
            name: result.error.name,
            code: result.error.code ?? null,
            message: result.error.message,
          }
        : null;
      exitCode = typeof result.status === "number" ? result.status : 1;
      transientFailure =
        exitCode !== 0 && !spawnError
          ? readPromptfooTransientFailure(outputPath)
          : { transient: false, reason: spawnError ? "spawn_error" : "passed" };

      attempts.push({
        attempt,
        durationMs: attemptDurationMs,
        exitCode,
        signal: result.signal ?? null,
        error: spawnError,
        transientFailure,
      });

      if (spawnError) {
        console.error(`[eval-plane] runner spawn failed for ${suite.id}: ${spawnError.message}`);
      }
      if (exitCode === 0 || !transientFailure.transient || attempt > maxTransientRetries) {
        break;
      }
      console.warn(
        `[eval-plane] transient provider failure for ${suite.id}; retrying attempt ${attempt + 1} of ${
          maxTransientRetries + 1
        }`,
      );
    }
    const durationMs = Date.now() - suiteStartedAt;

    if (exitCode !== 0) {
      hasFailure = true;
    }
    runSummary.suites.push({
      id: suite.id,
      name: suite.name,
      configPath,
      outputPath,
      command: command.displayCommand,
      durationMs,
      exitCode,
      signal: result?.signal ?? null,
      error: spawnError,
      transientFailure,
      attempts,
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
