import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const options = {
    skipFast: false,
    skipPolicy: false,
    skipBadge: false,
    skipVisualJudge: false,
    outputJson: "artifacts/demo-e2e/epic-summary.json",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] ?? "");
    if (arg === "--skipFast") {
      options.skipFast = true;
      continue;
    }
    if (arg === "--skipPolicy") {
      options.skipPolicy = true;
      continue;
    }
    if (arg === "--skipBadge") {
      options.skipBadge = true;
      continue;
    }
    if (arg === "--skipVisualJudge") {
      options.skipVisualJudge = true;
      continue;
    }
    if (arg === "--outputJson") {
      options.outputJson = String(argv[++i] ?? options.outputJson);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJsonOrNull(pathValue) {
  try {
    return JSON.parse(readFileSync(pathValue, "utf8"));
  } catch {
    return null;
  }
}

function runNpmScript(scriptName) {
  const npmCli = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCli, ["run", scriptName], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: npm run ${scriptName}`);
  }
}

function toStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pass" || normalized === "fail") {
    return normalized;
  }
  return "unavailable";
}

function deriveDeviceNodeUpdatesStatus(deviceNodesEvidence) {
  if (!deviceNodesEvidence || typeof deviceNodesEvidence !== "object") {
    return "unavailable";
  }
  const updatesValidated = deviceNodesEvidence.updatesValidated === true;
  const updatesHasUpsert = deviceNodesEvidence.updatesHasUpsert === true;
  const updatesHasHeartbeat = deviceNodesEvidence.updatesHasHeartbeat === true;
  const updatesApiValidated = deviceNodesEvidence.updatesApiValidated === true;
  const updatesTotalRaw = Number(deviceNodesEvidence.updatesTotal ?? 0);
  const updatesTotal = Number.isFinite(updatesTotalRaw) ? Math.max(0, Math.floor(updatesTotalRaw)) : 0;

  if (updatesValidated && updatesHasUpsert && updatesHasHeartbeat && updatesApiValidated && updatesTotal >= 2) {
    return "pass";
  }
  if (updatesValidated || updatesHasUpsert || updatesHasHeartbeat || updatesApiValidated || updatesTotal > 0) {
    return "fail";
  }
  return "unavailable";
}

function ensureParentDir(pathValue) {
  mkdirSync(dirname(pathValue), { recursive: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const steps = [
    { name: "demo:e2e:fast", skip: options.skipFast },
    { name: "demo:e2e:policy", skip: options.skipPolicy },
    { name: "demo:e2e:badge", skip: options.skipBadge },
    { name: "demo:e2e:visual:judge", skip: options.skipVisualJudge },
  ];

  const startedAt = new Date().toISOString();
  for (const step of steps) {
    if (step.skip) {
      console.log(`[demo:epic] Skip: npm run ${step.name}`);
      continue;
    }
    console.log(`[demo:epic] Run: npm run ${step.name}`);
    runNpmScript(step.name);
  }

  const requiredArtifactPaths = [
    "artifacts/demo-e2e/summary.json",
    "artifacts/demo-e2e/policy-check.json",
    "artifacts/demo-e2e/badge.json",
    "artifacts/demo-e2e/badge-details.json",
    "artifacts/judge-visual-evidence/manifest.json",
    "artifacts/judge-visual-evidence/gallery.md",
    "artifacts/judge-visual-evidence/presentation.md",
  ].map((item) => resolve(process.cwd(), item));

  const missingArtifacts = requiredArtifactPaths.filter((item) => !existsSync(item));
  if (missingArtifacts.length > 0) {
    throw new Error(`[demo:epic] Missing required artifacts: ${missingArtifacts.join(", ")}`);
  }

  const policyPath = resolve(process.cwd(), "artifacts/demo-e2e/policy-check.json");
  const badgeDetailsPath = resolve(process.cwd(), "artifacts/demo-e2e/badge-details.json");
  const policy = readJsonOrNull(policyPath);
  const badgeDetails = readJsonOrNull(badgeDetailsPath);

  if (!policy || policy.ok !== true) {
    throw new Error("[demo:epic] Policy gate is not passing (`policy-check.json -> ok=true` required).");
  }

  const evidence = badgeDetails?.evidence ?? {};
  const evidenceStatus = {
    operatorTurnTruncation: toStatus(evidence?.operatorTurnTruncation?.status),
    operatorTurnDelete: toStatus(evidence?.operatorTurnDelete?.status),
    operatorDamageControl: toStatus(evidence?.operatorDamageControl?.status),
    governancePolicy: toStatus(evidence?.governancePolicy?.status),
    skillsRegistry: toStatus(evidence?.skillsRegistry?.status),
    deviceNodes: toStatus(evidence?.deviceNodes?.status),
    agentUsage: toStatus(evidence?.agentUsage?.status),
    deviceNodeUpdates: deriveDeviceNodeUpdatesStatus(evidence?.deviceNodes),
  };

  const failedEvidence = Object.entries(evidenceStatus)
    .filter(([, status]) => status !== "pass")
    .map(([lane]) => lane);
  if (failedEvidence.length > 0) {
    throw new Error(`[demo:epic] Critical evidence lanes are not pass: ${failedEvidence.join(", ")}`);
  }

  const outputPath = resolve(process.cwd(), options.outputJson);
  ensureParentDir(outputPath);
  const summary = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    startedAt,
    commands: steps,
    policyOk: true,
    evidenceStatus,
    artifactsChecked: requiredArtifactPaths.map((pathValue) => relative(process.cwd(), pathValue).split(sep).join("/")),
  };
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8" });

  console.log(`[demo:epic] Epic flow passed. Summary: ${outputPath}`);
}

main();
