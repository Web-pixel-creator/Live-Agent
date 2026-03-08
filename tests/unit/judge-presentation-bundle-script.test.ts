import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

function runPresentationBundle(args) {
  const scriptPath = resolve(process.cwd(), "scripts", "judge-presentation-bundle.mjs");
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("judge presentation bundle includes runtime guardrails and provider adapter snapshots", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-presentation-bundle-"));
  const summaryPath = join(baseDir, "summary.json");
  const policyPath = join(baseDir, "policy-check.json");
  const badgePath = join(baseDir, "badge.json");
  const badgeDetailsPath = join(baseDir, "badge-details.json");
  const releaseEvidencePath = join(baseDir, "report.json");
  const railwayDeploySummaryPath = join(baseDir, "railway-deploy-summary.json");
  const repoPublishSummaryPath = join(baseDir, "repo-publish-summary.json");
  const visualManifestPath = join(baseDir, "manifest.json");
  const visualGalleryPath = join(baseDir, "gallery.md");
  const outputMarkdownPath = join(baseDir, "presentation.md");

  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        scenarios: [
          { name: "live.negotiation", status: "passed" },
          { name: "storyteller.pipeline", status: "passed" },
          { name: "ui.approval.approve_resume", status: "passed" },
        ],
        kpis: {
          gatewayWsRoundTripMs: 37,
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    policyPath,
    JSON.stringify(
      {
        ok: true,
        checks: 281,
        violations: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    badgePath,
    JSON.stringify(
      {
        label: "Demo KPI Gate",
        message: "pass | 281 checks | 37ms ws",
        color: "brightgreen",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    badgeDetailsPath,
    JSON.stringify(
      {
        costEstimate: { totalUsd: 0.53 },
        tokensUsed: { total: 22640 },
        providerUsage: {
          status: "pass",
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
          operatorTurnTruncation: { status: "pass" },
          operatorTurnDelete: { status: "pass" },
          operatorDamageControl: { status: "pass" },
          governancePolicy: { status: "pass" },
          skillsRegistry: { status: "pass" },
          pluginMarketplace: { status: "pass" },
          deviceNodes: {
            status: "pass",
            updatesValidated: true,
            updatesHasUpsert: true,
            updatesHasHeartbeat: true,
            updatesApiValidated: true,
            updatesTotal: 3,
          },
          agentUsage: { status: "pass" },
          runtimeGuardrailsSignalPaths: {
            status: "pass",
            summaryStatus: "critical signals=2",
            totalPaths: 2,
            primaryPath: {
              title: "Recovery drill - ui-executor-sandbox-audit",
              kind: "runtime_drill",
              phase: "recovery",
            },
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    releaseEvidencePath,
    JSON.stringify(
      {
        statuses: {
          runtimeGuardrailsSignalPathsStatus: "pass",
        },
      },
      null,
      2,
    ),
  );
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
  writeFileSync(
    visualManifestPath,
    JSON.stringify(
      {
        badgeEvidence: {
          deviceNodeUpdates: "pass",
        },
      },
      null,
      2,
    ),
  );
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(visualGalleryPath, "# Gallery\n");

  const result = runPresentationBundle([
    "--summary",
    summaryPath,
    "--policy",
    policyPath,
    "--badge",
    badgePath,
    "--badgeDetails",
    badgeDetailsPath,
    "--releaseEvidence",
    releaseEvidencePath,
    "--railwayDeploySummary",
    railwayDeploySummaryPath,
    "--repoPublishSummary",
    repoPublishSummaryPath,
    "--visualManifest",
    visualManifestPath,
    "--visualGallery",
    visualGalleryPath,
    "--outputMarkdown",
    outputMarkdownPath,
  ]);

  assert.equal(result.status, 0, `expected presentation bundle to pass, stderr=${result.stderr}`);
  const markdown = readFileSync(outputMarkdownPath, "utf8");

  for (const token of [
    "Runtime Guardrails Snapshot",
    "Provider Adapter Snapshot",
    "Deploy / Publish Provenance",
    "runtimeGuardrailsSignalPaths",
    "providerUsage",
    "critical signals=2",
    "Recovery drill - ui-executor-sandbox-audit (runtime_drill / recovery)",
    "storyteller-agent",
    "deepgram",
    "aura-2",
    "provider_override",
    "Railway deploy: status success; deployment railway-deploy-123; public URL https://live-agent.example.test",
    "Public badge: badge https://live-agent.example.test/demo-e2e/badge.json; badge-details https://live-agent.example.test/demo-e2e/badge-details.json",
    "Repo publish: verification verify:release; release evidence validated; Railway deploy enabled; frontend deploy disabled",
    "railway-deploy-123",
    "https://live-agent.example.test/demo-e2e/badge.json",
    "verify:release",
  ]) {
    assert.ok(markdown.includes(token), `presentation markdown missing token: ${token}`);
  }
  assert.ok(
    !markdown.includes("Railway deploy summary present:"),
    "presentation markdown should avoid verbose deploy presence lines",
  );
  assert.ok(
    !markdown.includes("Railway deploy summary: [railway-deploy-summary.json]("),
    "presentation markdown should not link raw railway deploy summary JSON",
  );
  assert.ok(
    !markdown.includes("Repo publish summary: [repo-publish-summary.json]("),
    "presentation markdown should not link raw repo publish summary JSON",
  );
});

test("judge presentation bundle reuses compact deploy provenance from visual manifest when raw summaries are absent", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-presentation-bundle-aligned-"));
  const summaryPath = join(baseDir, "summary.json");
  const policyPath = join(baseDir, "policy-check.json");
  const badgePath = join(baseDir, "badge.json");
  const badgeDetailsPath = join(baseDir, "badge-details.json");
  const releaseEvidencePath = join(baseDir, "report.json");
  const visualManifestPath = join(baseDir, "manifest.json");
  const visualGalleryPath = join(baseDir, "gallery.md");
  const outputMarkdownPath = join(baseDir, "presentation.md");

  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        scenarios: [
          { name: "live.negotiation", status: "passed" },
          { name: "storyteller.pipeline", status: "passed" },
          { name: "ui.approval.approve_resume", status: "passed" },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(policyPath, JSON.stringify({ ok: true, checks: 12, violations: [] }, null, 2));
  writeFileSync(
    badgePath,
    JSON.stringify({ label: "Demo KPI Gate", message: "pass", color: "brightgreen" }, null, 2),
  );
  writeFileSync(
    badgeDetailsPath,
    JSON.stringify(
      {
        providerUsage: {
          status: "pass",
          activeSecondaryProviders: 0,
          entries: [],
        },
        evidence: {
          operatorTurnTruncation: { status: "pass" },
          operatorTurnDelete: { status: "pass" },
          operatorDamageControl: { status: "pass" },
          governancePolicy: { status: "pass" },
          skillsRegistry: { status: "pass" },
          pluginMarketplace: { status: "pass" },
          deviceNodes: {
            status: "pass",
            updatesValidated: true,
            updatesHasUpsert: true,
            updatesHasHeartbeat: true,
            updatesApiValidated: true,
            updatesTotal: 2,
          },
          agentUsage: { status: "pass" },
          runtimeGuardrailsSignalPaths: {
            status: "pass",
            summaryStatus: "critical signals=1",
            totalPaths: 1,
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(releaseEvidencePath, JSON.stringify({ statuses: {} }, null, 2));
  writeFileSync(
    visualManifestPath,
    JSON.stringify(
      {
        badgeEvidence: {
          deviceNodeUpdates: "pass",
        },
        deployProvenance: {
          rows: [
            {
              id: "railwayDeploy",
              title: "Railway deploy",
              summary: "status success; deployment railway-aligned-456; public URL https://judge.example.test",
            },
            {
              id: "repoPublish",
              title: "Repo publish",
              summary: "verification verify:release; release evidence validated; Railway deploy enabled; frontend deploy disabled",
            },
          ],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(visualGalleryPath, "# Gallery\n");

  const result = runPresentationBundle([
    "--summary",
    summaryPath,
    "--policy",
    policyPath,
    "--badge",
    badgePath,
    "--badgeDetails",
    badgeDetailsPath,
    "--releaseEvidence",
    releaseEvidencePath,
    "--visualManifest",
    visualManifestPath,
    "--visualGallery",
    visualGalleryPath,
    "--outputMarkdown",
    outputMarkdownPath,
  ]);

  assert.equal(result.status, 0, `expected presentation bundle to pass without raw deploy summaries, stderr=${result.stderr}`);
  const markdown = readFileSync(outputMarkdownPath, "utf8");

  assert.ok(markdown.includes("## Deploy / Publish Provenance"));
  assert.ok(markdown.includes("Railway deploy: status success; deployment railway-aligned-456; public URL https://judge.example.test"));
  assert.ok(markdown.includes("Repo publish: verification verify:release; release evidence validated; Railway deploy enabled; frontend deploy disabled"));
  assert.ok(!markdown.includes("railway-deploy-summary.json"), "raw deploy summary JSON should stay out of judge-facing markdown");
  assert.ok(!markdown.includes("repo-publish-summary.json"), "raw repo publish JSON should stay out of judge-facing markdown");
  assert.ok(!markdown.includes("railwayDeploySummary source is missing"), "optional missing deploy summary should not add notes");
  assert.ok(!markdown.includes("repoPublishSummary source is missing"), "optional missing publish summary should not add notes");
});

test("judge presentation bundle omits optional provenance section for ordinary local judge flows", () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mla-presentation-bundle-local-"));
  const summaryPath = join(baseDir, "summary.json");
  const policyPath = join(baseDir, "policy-check.json");
  const badgePath = join(baseDir, "badge.json");
  const badgeDetailsPath = join(baseDir, "badge-details.json");
  const releaseEvidencePath = join(baseDir, "report.json");
  const visualManifestPath = join(baseDir, "manifest.json");
  const visualGalleryPath = join(baseDir, "gallery.md");
  const outputMarkdownPath = join(baseDir, "presentation.md");

  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        scenarios: [
          { name: "live.negotiation", status: "passed" },
          { name: "storyteller.pipeline", status: "passed" },
          { name: "ui.approval.approve_resume", status: "passed" },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(policyPath, JSON.stringify({ ok: true, checks: 18, violations: [] }, null, 2));
  writeFileSync(
    badgePath,
    JSON.stringify({ label: "Demo KPI Gate", message: "pass", color: "brightgreen" }, null, 2),
  );
  writeFileSync(
    badgeDetailsPath,
    JSON.stringify(
      {
        providerUsage: {
          status: "pass",
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
          operatorTurnTruncation: { status: "pass" },
          operatorTurnDelete: { status: "pass" },
          operatorDamageControl: { status: "pass" },
          governancePolicy: { status: "pass" },
          skillsRegistry: { status: "pass" },
          pluginMarketplace: { status: "pass" },
          deviceNodes: {
            status: "pass",
            updatesValidated: true,
            updatesHasUpsert: true,
            updatesHasHeartbeat: true,
            updatesApiValidated: true,
            updatesTotal: 2,
          },
          agentUsage: { status: "pass" },
          runtimeGuardrailsSignalPaths: {
            status: "pass",
            summaryStatus: "critical signals=1",
            totalPaths: 1,
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(releaseEvidencePath, JSON.stringify({ statuses: {} }, null, 2));
  writeFileSync(
    visualManifestPath,
    JSON.stringify(
      {
        badgeEvidence: {
          deviceNodeUpdates: "pass",
        },
        deployProvenance: {
          rows: [],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(visualGalleryPath, "# Gallery\n");

  const result = runPresentationBundle([
    "--summary",
    summaryPath,
    "--policy",
    policyPath,
    "--badge",
    badgePath,
    "--badgeDetails",
    badgeDetailsPath,
    "--releaseEvidence",
    releaseEvidencePath,
    "--visualManifest",
    visualManifestPath,
    "--visualGallery",
    visualGalleryPath,
    "--outputMarkdown",
    outputMarkdownPath,
  ]);

  assert.equal(result.status, 0, `expected presentation bundle to pass for local judge flow, stderr=${result.stderr}`);
  const markdown = readFileSync(outputMarkdownPath, "utf8");

  assert.ok(!markdown.includes("## Deploy / Publish Provenance"), "optional provenance section should be omitted");
  assert.ok(!markdown.includes("unavailable"), "optional provenance should not add unavailable noise");
  assert.ok(!markdown.includes("railway-deploy-summary.json"), "missing deploy summary should not appear as a raw artifact link");
  assert.ok(!markdown.includes("repo-publish-summary.json"), "missing repo publish summary should not appear as a raw artifact link");
});
