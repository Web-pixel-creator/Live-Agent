import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    outputJson: "artifacts/judge-visual-evidence/manifest.json",
    outputMarkdown: "artifacts/judge-visual-evidence/manifest.md",
    badgeDetails: "artifacts/demo-e2e/badge-details.json",
    summary: "artifacts/demo-e2e/summary.json",
    railwayDeploySummary: "artifacts/deploy/railway-deploy-summary.json",
    repoPublishSummary: "artifacts/deploy/repo-publish-summary.json",
    screenshotDir: "artifacts/judge-visual-evidence/screenshots",
    strict: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }
    if (arg === "--outputJson") {
      options.outputJson = argv[++i];
      continue;
    }
    if (arg === "--outputMarkdown") {
      options.outputMarkdown = argv[++i];
      continue;
    }
    if (arg === "--badgeDetails") {
      options.badgeDetails = argv[++i];
      continue;
    }
    if (arg === "--summary") {
      options.summary = argv[++i];
      continue;
    }
    if (arg === "--railwayDeploySummary") {
      options.railwayDeploySummary = argv[++i];
      continue;
    }
    if (arg === "--repoPublishSummary") {
      options.repoPublishSummary = argv[++i];
      continue;
    }
    if (arg === "--screenshotDir") {
      options.screenshotDir = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function toAbsolutePath(maybeRelative) {
  if (isAbsolute(maybeRelative)) {
    return maybeRelative;
  }
  return resolve(process.cwd(), maybeRelative);
}

function ensureParentDir(filePath) {
  const parent = dirname(filePath);
  mkdirSync(parent, { recursive: true });
}

function readJsonIfExists(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    return { present: true, parsed: true, value: parsed, parseError: null };
  } catch (error) {
    if (String(error?.code) === "ENOENT") {
      return { present: false, parsed: false, value: null, parseError: null };
    }
    return {
      present: true,
      parsed: false,
      value: null,
      parseError: String(error?.message ?? error),
    };
  }
}

function toStatusValue(value) {
  if (typeof value !== "string") {
    return "unavailable";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "pass" || normalized === "fail") {
    return normalized;
  }
  return "unavailable";
}

function toOptionalText(value) {
  if (typeof value !== "string") {
    return "unavailable";
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unavailable";
}

function toEnabledLabel(value) {
  if (value === true) {
    return "enabled";
  }
  if (value === false) {
    return "disabled";
  }
  return "n/a";
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
  if (updatesTotal > 0 || updatesHasUpsert || updatesHasHeartbeat || updatesValidated || updatesApiValidated) {
    return "fail";
  }
  return "unavailable";
}

function buildDeployProvenanceRows(deployProvenance) {
  const rows = [];
  const railwayDeploy = deployProvenance.railwayDeploy;
  const repoPublish = deployProvenance.repoPublish;

  if (railwayDeploy.available) {
    rows.push({
      id: "railwayDeploy",
      title: "Railway deploy",
      summary: `status ${railwayDeploy.status}; deployment ${railwayDeploy.deploymentId}; public URL ${railwayDeploy.effectivePublicUrl}`,
    });

    const badgeParts = [];
    if (railwayDeploy.badgeEndpoint !== "unavailable") {
      badgeParts.push(`badge ${railwayDeploy.badgeEndpoint}`);
    }
    if (railwayDeploy.badgeDetailsEndpoint !== "unavailable") {
      badgeParts.push(`badge-details ${railwayDeploy.badgeDetailsEndpoint}`);
    }
    if (badgeParts.length > 0) {
      rows.push({
        id: "railwayBadge",
        title: "Public badge",
        summary: badgeParts.join("; "),
      });
    }
  }

  if (repoPublish.available) {
    rows.push({
      id: "repoPublish",
      title: "Repo publish",
      summary: [
        `verification ${repoPublish.verificationScript}`,
        repoPublish.releaseEvidenceValidated ? "release evidence validated" : "release evidence not validated",
        `Railway deploy ${repoPublish.railwayDeployEnabledLabel}`,
        `frontend deploy ${repoPublish.railwayFrontendDeployEnabledLabel}`,
      ].join("; "),
    });
  }

  return rows;
}

function collectDeployProvenance(railwayDeploySummaryRead, repoPublishSummaryRead) {
  const railwayDeploySummary =
    railwayDeploySummaryRead.present && railwayDeploySummaryRead.parsed ? railwayDeploySummaryRead.value : null;
  const repoPublishSummary =
    repoPublishSummaryRead.present && repoPublishSummaryRead.parsed ? repoPublishSummaryRead.value : null;
  const railwayChecks = railwayDeploySummary?.checks?.publicBadge ?? {};
  const repoPublishVerification = repoPublishSummary?.verification ?? {};
  const repoPublishSteps = repoPublishSummary?.steps ?? {};

  const deployProvenance = {
    available: Boolean(railwayDeploySummary || repoPublishSummary),
    rows: [],
    railwayDeploy: {
      available: railwayDeploySummaryRead.present && railwayDeploySummaryRead.parsed,
      status: toOptionalText(railwayDeploySummary?.status),
      deploymentId: toOptionalText(railwayDeploySummary?.deploymentId),
      effectivePublicUrl: toOptionalText(railwayDeploySummary?.effectivePublicUrl),
      badgeEndpoint: toOptionalText(railwayChecks?.badgeEndpoint),
      badgeDetailsEndpoint: toOptionalText(railwayChecks?.badgeDetailsEndpoint),
    },
    repoPublish: {
      available: repoPublishSummaryRead.present && repoPublishSummaryRead.parsed,
      verificationScript: toOptionalText(repoPublishVerification?.script),
      releaseEvidenceValidated: repoPublishVerification?.releaseEvidenceArtifactsValidated === true,
      railwayDeployEnabled: repoPublishSteps?.railwayDeployEnabled === true,
      railwayFrontendDeployEnabled: repoPublishSteps?.railwayFrontendDeployEnabled === true,
      railwayDeployEnabledLabel: toEnabledLabel(repoPublishSteps?.railwayDeployEnabled),
      railwayFrontendDeployEnabledLabel: toEnabledLabel(repoPublishSteps?.railwayFrontendDeployEnabled),
    },
  };

  deployProvenance.rows = buildDeployProvenanceRows(deployProvenance);
  return deployProvenance;
}

function collectBadgeEvidence(badgeDetailsJson) {
  const evidence = badgeDetailsJson?.evidence && typeof badgeDetailsJson.evidence === "object"
    ? badgeDetailsJson.evidence
    : {};
  const deviceNodesEvidence = evidence.deviceNodes && typeof evidence.deviceNodes === "object" ? evidence.deviceNodes : {};
  const providerUsage = badgeDetailsJson?.providerUsage && typeof badgeDetailsJson.providerUsage === "object"
    ? badgeDetailsJson.providerUsage
    : {};

  return {
    operatorTurnTruncation: toStatusValue(evidence.operatorTurnTruncation?.status),
    operatorTurnDelete: toStatusValue(evidence.operatorTurnDelete?.status),
    operatorDamageControl: toStatusValue(evidence.operatorDamageControl?.status),
    governancePolicy: toStatusValue(evidence.governancePolicy?.status),
    skillsRegistry: toStatusValue(evidence.skillsRegistry?.status),
    pluginMarketplace: toStatusValue(evidence.pluginMarketplace?.status),
    deviceNodes: toStatusValue(evidence.deviceNodes?.status),
    agentUsage: toStatusValue(evidence.agentUsage?.status),
    runtimeGuardrailsSignalPaths: toStatusValue(evidence.runtimeGuardrailsSignalPaths?.status),
    providerUsage: toStatusValue(providerUsage.status),
    deviceNodeUpdates: deriveDeviceNodeUpdatesStatus(deviceNodesEvidence),
    costEstimatePresent: badgeDetailsJson?.costEstimate && typeof badgeDetailsJson.costEstimate === "object",
    tokensUsedPresent: badgeDetailsJson?.tokensUsed && typeof badgeDetailsJson.tokensUsed === "object",
  };
}

function buildChecklist() {
  return [
    {
      id: "live_console_main",
      title: "Live Console - Connection + Live Controls",
      fileName: "live-console-main.png",
      section: "Live Agent",
    },
    {
      id: "operator_console_evidence",
      title: "Operator Console - Evidence Widgets",
      fileName: "operator-console-evidence.png",
      section: "Operator",
    },
    {
      id: "storyteller_timeline",
      title: "Storyteller Timeline",
      fileName: "storyteller-timeline.png",
      section: "Creative Storyteller",
    },
    {
      id: "approval_pending",
      title: "Approval Flow - Pending",
      fileName: "approval-flow-pending.png",
      section: "UI Navigator",
    },
    {
      id: "approval_approved",
      title: "Approval Flow - Approved Resume",
      fileName: "approval-flow-approved.png",
      section: "UI Navigator",
    },
    {
      id: "observability_dashboard",
      title: "Observability Dashboard",
      fileName: "observability-dashboard.png",
      section: "Observability",
    },
    {
      id: "observability_alert_gateway_latency",
      title: "Alert Policy - Gateway P95 Latency",
      fileName: "observability-alert-gateway-latency.png",
      section: "Observability",
    },
    {
      id: "observability_alert_service_error_rate",
      title: "Alert Policy - Service Error Rate",
      fileName: "observability-alert-service-error-rate.png",
      section: "Observability",
    },
    {
      id: "observability_alert_orchestrator_persistence",
      title: "Alert Policy - Orchestrator Persistence Failures",
      fileName: "observability-alert-orchestrator-persistence.png",
      section: "Observability",
    },
  ];
}

function evaluateChecklist(screenshotDir, checklist) {
  return checklist.map((item) => {
    const fullPath = resolve(screenshotDir, item.fileName);
    let present = false;
    let sizeBytes = 0;
    try {
      const st = statSync(fullPath);
      if (st.isFile() && st.size > 0) {
        present = true;
        sizeBytes = st.size;
      }
    } catch {
      present = false;
    }
    return {
      ...item,
      path: fullPath,
      present,
      sizeBytes,
      status: present ? "present" : "missing",
    };
  });
}

function writeUtf8NoBom(filePath, content) {
  ensureParentDir(filePath);
  writeFileSync(filePath, content, { encoding: "utf8" });
}

function toMarkdown(manifest) {
  const lines = [];
  lines.push("# Judge Visual Evidence Pack");
  lines.push("");
  lines.push(`- Generated at: ${manifest.generatedAt}`);
  lines.push(`- Overall status: ${manifest.overallStatus}`);
  lines.push(`- Missing required captures: ${manifest.summary.missingRequiredCaptures}`);
  lines.push(`- Missing critical badge evidence: ${manifest.summary.missingCriticalBadgeEvidence}`);
  lines.push("");
  lines.push("## Screenshot Checklist");
  lines.push("");
  lines.push("| ID | Section | File | Status | Size (bytes) |");
  lines.push("|---|---|---|---|---:|");
  for (const item of manifest.screenshotChecklist) {
    lines.push(`| ${item.id} | ${item.section} | ${item.fileName} | ${item.status} | ${item.sizeBytes} |`);
  }
  lines.push("");
  lines.push("## Badge Evidence Status");
  lines.push("");
  lines.push("| Lane | Status |");
  lines.push("|---|---|");
  for (const lane of manifest.criticalBadgeLanes) {
    const value = manifest.badgeEvidence[lane] ?? "unavailable";
    lines.push(`| ${lane} | ${value} |`);
  }
  lines.push(`| costEstimatePresent | ${manifest.badgeEvidence.costEstimatePresent} |`);
  lines.push(`| tokensUsedPresent | ${manifest.badgeEvidence.tokensUsedPresent} |`);

  if (manifest.deployProvenance.rows.length > 0) {
    lines.push("");
    lines.push("## Deploy / Publish Provenance");
    lines.push("");
    for (const row of manifest.deployProvenance.rows) {
      lines.push(`- ${row.title}: ${row.summary}`);
    }
  }
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const badgeDetailsPath = toAbsolutePath(options.badgeDetails);
  const summaryPath = toAbsolutePath(options.summary);
  const railwayDeploySummaryPath = toAbsolutePath(options.railwayDeploySummary);
  const repoPublishSummaryPath = toAbsolutePath(options.repoPublishSummary);
  const screenshotDir = toAbsolutePath(options.screenshotDir);
  const outputJsonPath = toAbsolutePath(options.outputJson);
  const outputMarkdownPath = toAbsolutePath(options.outputMarkdown);

  const badgeDetailsRead = readJsonIfExists(badgeDetailsPath);
  const summaryRead = readJsonIfExists(summaryPath);
  const railwayDeploySummaryRead = readJsonIfExists(railwayDeploySummaryPath);
  const repoPublishSummaryRead = readJsonIfExists(repoPublishSummaryPath);
  const badgeEvidence = collectBadgeEvidence(badgeDetailsRead.value ?? {});
  const deployProvenance = collectDeployProvenance(railwayDeploySummaryRead, repoPublishSummaryRead);

  const checklist = evaluateChecklist(screenshotDir, buildChecklist());
  const missingRequiredCaptures = checklist.filter((item) => item.present !== true).length;

  const criticalBadgeLanes = [
    "operatorTurnTruncation",
    "operatorTurnDelete",
    "operatorDamageControl",
    "governancePolicy",
    "skillsRegistry",
    "pluginMarketplace",
    "deviceNodes",
    "agentUsage",
    "runtimeGuardrailsSignalPaths",
    "providerUsage",
    "deviceNodeUpdates",
  ];

  const missingCriticalBadgeEvidence = criticalBadgeLanes.reduce((sum, key) => {
    const status = badgeEvidence[key];
    return status === "pass" ? sum : sum + 1;
  }, 0);

  const overallStatus =
    missingRequiredCaptures === 0 && missingCriticalBadgeEvidence === 0 ? "pass" : "fail";

  const manifest = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sources: {
      badgeDetailsPath,
      badgeDetailsPresent: badgeDetailsRead.present,
      badgeDetailsParsed: badgeDetailsRead.parsed,
      badgeDetailsParseError: badgeDetailsRead.parseError,
      summaryPath,
      summaryPresent: summaryRead.present,
      summaryParsed: summaryRead.parsed,
      summaryParseError: summaryRead.parseError,
      railwayDeploySummaryPath,
      railwayDeploySummaryPresent: railwayDeploySummaryRead.present,
      railwayDeploySummaryParsed: railwayDeploySummaryRead.parsed,
      railwayDeploySummaryParseError: railwayDeploySummaryRead.parseError,
      repoPublishSummaryPath,
      repoPublishSummaryPresent: repoPublishSummaryRead.present,
      repoPublishSummaryParsed: repoPublishSummaryRead.parsed,
      repoPublishSummaryParseError: repoPublishSummaryRead.parseError,
      screenshotDir,
    },
    strictMode: options.strict === true,
    criticalBadgeLanes,
    badgeEvidence,
    deployProvenance,
    screenshotChecklist: checklist,
    summary: {
      requiredCaptures: checklist.length,
      presentCaptures: checklist.length - missingRequiredCaptures,
      missingRequiredCaptures,
      missingCriticalBadgeEvidence,
      deployProvenanceRows: deployProvenance.rows.length,
    },
    overallStatus,
  };

  writeUtf8NoBom(outputJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeUtf8NoBom(outputMarkdownPath, `${toMarkdown(manifest)}\n`);

  console.log(`[judge-visual-evidence-pack] JSON: ${outputJsonPath}`);
  console.log(`[judge-visual-evidence-pack] Markdown: ${outputMarkdownPath}`);
  console.log(
    `[judge-visual-evidence-pack] Status: ${overallStatus} (missing_captures=${missingRequiredCaptures}, missing_badge=${missingCriticalBadgeEvidence})`,
  );

  if (options.strict === true && overallStatus !== "pass") {
    process.exitCode = 1;
  }
}

main();
