import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const REQUIRED_SCREENSHOTS = [
  "live-console-main.png",
  "operator-console-evidence.png",
  "storyteller-timeline.png",
  "approval-flow-pending.png",
  "approval-flow-approved.png",
  "observability-dashboard.png",
  "observability-alert-gateway-latency.png",
  "observability-alert-service-error-rate.png",
  "observability-alert-orchestrator-persistence.png",
];

function makeBadgeDetails(statusOverrides = {}) {
  const laneStatus = {
    operatorTurnTruncation: "pass",
    operatorTurnDelete: "pass",
    operatorDamageControl: "pass",
    governancePolicy: "pass",
    skillsRegistry: "pass",
    deviceNodes: "pass",
    agentUsage: "pass",
    ...statusOverrides,
  };

  return {
    evidence: {
      operatorTurnTruncation: { status: laneStatus.operatorTurnTruncation },
      operatorTurnDelete: { status: laneStatus.operatorTurnDelete },
      operatorDamageControl: { status: laneStatus.operatorDamageControl },
      governancePolicy: { status: laneStatus.governancePolicy },
      skillsRegistry: { status: laneStatus.skillsRegistry },
      deviceNodes: {
        status: laneStatus.deviceNodes,
        updatesValidated: true,
        updatesHasUpsert: true,
        updatesHasHeartbeat: true,
        updatesApiValidated: true,
        updatesTotal: 2,
      },
      agentUsage: { status: laneStatus.agentUsage },
    },
    costEstimate: {
      totalUsd: 0.42,
    },
    tokensUsed: {
      total: 1200,
    },
  };
}

function runVisualPack(args) {
  const scriptPath = resolve(process.cwd(), "scripts", "judge-visual-evidence-pack.mjs");
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("judge visual evidence pack strict mode passes when required captures and badge lanes are present", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-visual-pack-pass-"));
  const screenshotsDir = join(baseDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  for (const fileName of REQUIRED_SCREENSHOTS) {
    writeFileSync(join(screenshotsDir, fileName), Buffer.from("fake-png-bytes"));
  }

  const badgePath = join(baseDir, "badge-details.json");
  const summaryPath = join(baseDir, "summary.json");
  const outJson = join(baseDir, "manifest.json");
  const outMd = join(baseDir, "manifest.md");

  writeFileSync(badgePath, JSON.stringify(makeBadgeDetails(), null, 2));
  writeFileSync(summaryPath, JSON.stringify({ ok: true }, null, 2));

  const result = runVisualPack([
    "--strict",
    "--badgeDetails",
    badgePath,
    "--summary",
    summaryPath,
    "--screenshotDir",
    screenshotsDir,
    "--outputJson",
    outJson,
    "--outputMarkdown",
    outMd,
  ]);

  assert.equal(result.status, 0, `expected strict visual pack to pass, stderr=${result.stderr}`);
  const manifest = JSON.parse(readFileSync(outJson, "utf8"));
  assert.equal(manifest.overallStatus, "pass");
  assert.equal(manifest.summary.missingRequiredCaptures, 0);
  assert.equal(manifest.summary.missingCriticalBadgeEvidence, 0);
  assert.equal(manifest.badgeEvidence.deviceNodeUpdates, "pass");
});

test("judge visual evidence pack strict mode fails when captures are missing", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-visual-pack-fail-"));
  const screenshotsDir = join(baseDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  for (const fileName of REQUIRED_SCREENSHOTS.slice(0, REQUIRED_SCREENSHOTS.length - 1)) {
    writeFileSync(join(screenshotsDir, fileName), Buffer.from("fake-png-bytes"));
  }

  const badgePath = join(baseDir, "badge-details.json");
  const summaryPath = join(baseDir, "summary.json");
  const outJson = join(baseDir, "manifest.json");
  const outMd = join(baseDir, "manifest.md");

  writeFileSync(badgePath, JSON.stringify(makeBadgeDetails(), null, 2));
  writeFileSync(summaryPath, JSON.stringify({ ok: true }, null, 2));

  const result = runVisualPack([
    "--strict",
    "--badgeDetails",
    badgePath,
    "--summary",
    summaryPath,
    "--screenshotDir",
    screenshotsDir,
    "--outputJson",
    outJson,
    "--outputMarkdown",
    outMd,
  ]);

  assert.notEqual(result.status, 0, "expected strict visual pack to fail when screenshot is missing");
  const manifest = JSON.parse(readFileSync(outJson, "utf8"));
  assert.equal(manifest.overallStatus, "fail");
  assert.ok(manifest.summary.missingRequiredCaptures >= 1);
});
