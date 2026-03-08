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
    pluginMarketplace: "pass",
    deviceNodes: "pass",
    agentUsage: "pass",
    runtimeGuardrailsSignalPaths: "pass",
    providerUsage: "pass",
    ...statusOverrides,
  };

  return {
    providerUsage: {
      status: laneStatus.providerUsage,
      validated: laneStatus.providerUsage === "pass",
      activeSecondaryProviders: 1,
      entries: [
        {
          route: "storyteller-agent",
          capability: "tts",
          selectedProvider: "deepgram",
          selectedModel: "aura-2",
          defaultProvider: "gemini_api",
          selectionReason: "provider_override",
          secondaryActive: true,
        },
      ],
    },
    evidence: {
      operatorTurnTruncation: { status: laneStatus.operatorTurnTruncation },
      operatorTurnDelete: { status: laneStatus.operatorTurnDelete },
      operatorDamageControl: { status: laneStatus.operatorDamageControl },
      governancePolicy: { status: laneStatus.governancePolicy },
      skillsRegistry: { status: laneStatus.skillsRegistry },
      pluginMarketplace: { status: laneStatus.pluginMarketplace },
      runtimeGuardrailsSignalPaths: {
        status: laneStatus.runtimeGuardrailsSignalPaths,
        summaryStatus: "critical signals=1",
        totalPaths: 1,
      },
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
  const railwayDeploySummaryPath = join(baseDir, "railway-deploy-summary.json");
  const repoPublishSummaryPath = join(baseDir, "repo-publish-summary.json");
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
  writeFileSync(
    railwayDeploySummaryPath,
    JSON.stringify(
      {
        status: "success",
        deploymentId: "railway-deploy-123",
        effectivePublicUrl: "https://live-agent.example.test",
        checks: {
          publicBadge: {
            badgeEndpoint: "https://live-agent.example.test/demo-e2e/badge.json",
            badgeDetailsEndpoint: "https://live-agent.example.test/demo-e2e/badge-details.json",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    repoPublishSummaryPath,
    JSON.stringify(
      {
        verification: {
          script: "verify:release",
          releaseEvidenceArtifactsValidated: true,
        },
        steps: {
          railwayDeployEnabled: true,
          railwayFrontendDeployEnabled: false,
        },
      },
      null,
      2,
    ),
  );

  const result = runVisualPack([
    "--strict",
    "--badgeDetails",
    badgePath,
    "--summary",
    summaryPath,
    "--railwayDeploySummary",
    railwayDeploySummaryPath,
    "--repoPublishSummary",
    repoPublishSummaryPath,
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
  assert.equal(manifest.badgeEvidence.pluginMarketplace, "pass");
  assert.equal(manifest.badgeEvidence.runtimeGuardrailsSignalPaths, "pass");
  assert.equal(manifest.badgeEvidence.providerUsage, "pass");
  assert.equal(manifest.badgeEvidence.deviceNodeUpdates, "pass");
  assert.equal(manifest.deployProvenance.railwayDeploy.status, "success");
  assert.equal(manifest.deployProvenance.railwayDeploy.available, true);
  assert.equal(manifest.deployProvenance.railwayDeploy.deploymentId, "railway-deploy-123");
  assert.equal(manifest.deployProvenance.repoPublish.verificationScript, "verify:release");
  assert.equal(manifest.deployProvenance.repoPublish.available, true);
  assert.equal(manifest.deployProvenance.repoPublish.releaseEvidenceValidated, true);
  assert.equal(manifest.summary.deployProvenanceRows, 3);

  const markdown = readFileSync(outMd, "utf8");
  for (const token of [
    "## Deploy / Publish Provenance",
    "Railway deploy: status success; deployment railway-deploy-123; public URL https://live-agent.example.test",
    "Public badge: badge https://live-agent.example.test/demo-e2e/badge.json; badge-details https://live-agent.example.test/demo-e2e/badge-details.json",
    "Repo publish: verification verify:release; release evidence validated; Railway deploy enabled; frontend deploy disabled",
  ]) {
    assert.ok(markdown.includes(token), `visual pack markdown missing token: ${token}`);
  }
  assert.ok(!markdown.includes("Railway deploy summary present:"), "markdown should avoid verbose presence lines");
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

test("judge visual evidence pack keeps deploy provenance optional for local strict flows", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-visual-pack-optional-"));
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

  assert.equal(result.status, 0, `expected strict visual pack to pass without optional deploy summaries, stderr=${result.stderr}`);
  const manifest = JSON.parse(readFileSync(outJson, "utf8"));
  const markdown = readFileSync(outMd, "utf8");

  assert.equal(manifest.overallStatus, "pass");
  assert.equal(manifest.summary.deployProvenanceRows, 0);
  assert.deepEqual(manifest.deployProvenance.rows, []);
  assert.equal(manifest.deployProvenance.available, false);
  assert.ok(!markdown.includes("## Deploy / Publish Provenance"), "optional provenance section should be omitted when absent");
  assert.ok(!markdown.includes("unavailable"), "optional provenance should not add unavailable noise to markdown");
});
