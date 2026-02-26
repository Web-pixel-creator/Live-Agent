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

function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function buildTurnEvidence(kpis, config) {
  const validated = toBoolean(kpis[config.validatedKey]) === true;
  const expectedEventSeen = toBoolean(kpis[config.expectedEventKey]) === true;
  const total = toNumber(kpis[config.totalKey]) ?? 0;
  const uniqueRuns = toNumber(kpis[config.uniqueRunsKey]) ?? 0;
  const uniqueSessions = toNumber(kpis[config.uniqueSessionsKey]) ?? 0;
  const latestSeenAt = toOptionalString(kpis[config.latestSeenAtKey]);
  const latestSeenAtIsIso = latestSeenAt !== null && isIsoTimestamp(latestSeenAt);

  const status =
    validated &&
    expectedEventSeen &&
    total >= 1 &&
    uniqueRuns >= 1 &&
    uniqueSessions >= 1 &&
    latestSeenAtIsIso
      ? "pass"
      : "fail";

  const result = {
    status,
    validated,
    expectedEventSeen,
    total,
    uniqueRuns,
    uniqueSessions,
    latestSeenAt,
    latestSeenAtIsIso,
  };

  if (config.latestTurnIdKey) {
    result.latestTurnId = toOptionalString(kpis[config.latestTurnIdKey]);
  }
  if (config.latestReasonKey) {
    result.latestReason = toOptionalString(kpis[config.latestReasonKey]);
  }
  if (config.latestScopeKey) {
    result.latestScope = toOptionalString(kpis[config.latestScopeKey]);
  }
  if (config.latestAudioEndMsKey) {
    result.latestAudioEndMs = toNumber(kpis[config.latestAudioEndMsKey]);
  }
  if (config.latestContentIndexKey) {
    result.latestContentIndex = toNumber(kpis[config.latestContentIndexKey]);
  }

  return result;
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

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(normalized);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = resolve(args.policy ?? "artifacts/demo-e2e/policy-check.json");
  const summaryPath = resolve(args.summary ?? "artifacts/demo-e2e/summary.json");
  const outputPath = resolve(args.output ?? "artifacts/demo-e2e/badge.json");
  const detailsPath = resolve(args.detailsOutput ?? "artifacts/demo-e2e/badge-details.json");

  const policy = await readJson(policyPath);
  const summary = await readJson(summaryPath);

  if (!isObject(policy) || !isObject(summary)) {
    fail("Invalid input JSON for badge generation", { policyPath, summaryPath });
  }

  const ok = policy.ok === true;
  const checks = toNumber(policy.checks) ?? 0;
  const violations = Array.isArray(policy.violations) ? policy.violations.length : 0;
  const kpis = isObject(summary.kpis) ? summary.kpis : {};
  const roundTripMs = toNumber(kpis.gatewayWsRoundTripMs);

  const operatorTurnTruncationEvidence = buildTurnEvidence(kpis, {
    validatedKey: "operatorTurnTruncationSummaryValidated",
    expectedEventKey: "operatorTurnTruncationExpectedEventSeen",
    totalKey: "operatorTurnTruncationTotal",
    uniqueRunsKey: "operatorTurnTruncationUniqueRuns",
    uniqueSessionsKey: "operatorTurnTruncationUniqueSessions",
    latestSeenAtKey: "operatorTurnTruncationLatestSeenAt",
    latestTurnIdKey: "operatorTurnTruncationLatestTurnId",
    latestReasonKey: "operatorTurnTruncationLatestReason",
    latestAudioEndMsKey: "operatorTurnTruncationLatestAudioEndMs",
    latestContentIndexKey: "operatorTurnTruncationLatestContentIndex",
  });
  const operatorTurnDeleteEvidence = buildTurnEvidence(kpis, {
    validatedKey: "operatorTurnDeleteSummaryValidated",
    expectedEventKey: "operatorTurnDeleteExpectedEventSeen",
    totalKey: "operatorTurnDeleteTotal",
    uniqueRunsKey: "operatorTurnDeleteUniqueRuns",
    uniqueSessionsKey: "operatorTurnDeleteUniqueSessions",
    latestSeenAtKey: "operatorTurnDeleteLatestSeenAt",
    latestTurnIdKey: "operatorTurnDeleteLatestTurnId",
    latestReasonKey: "operatorTurnDeleteLatestReason",
    latestScopeKey: "operatorTurnDeleteLatestScope",
  });

  let color = "red";
  if (ok) {
    color = "brightgreen";
  } else if (violations <= 2) {
    color = "orange";
  }

  const messageParts = [ok ? "pass" : "fail", `${checks} checks`];
  if (roundTripMs !== null) {
    messageParts.push(`${roundTripMs}ms ws`);
  }

  const badge = {
    schemaVersion: 1,
    label: "Demo KPI Gate",
    message: messageParts.join(" | "),
    color,
    cacheSeconds: 300,
  };

  const details = {
    generatedAt: new Date().toISOString(),
    ok,
    policyPath,
    summaryPath,
    checks,
    violations,
    roundTripMs,
    evidence: {
      sourceSummaryGeneratedAt: toOptionalString(summary.generatedAt),
      operatorTurnTruncation: operatorTurnTruncationEvidence,
      operatorTurnDelete: operatorTurnDeleteEvidence,
    },
    badge,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(detailsPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(badge, null, 2)}\n`, "utf8");
  await writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      output: outputPath,
      detailsOutput: detailsPath,
      badge,
    })}\n`,
  );
}

main().catch((error) => {
  fail("Badge generation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
