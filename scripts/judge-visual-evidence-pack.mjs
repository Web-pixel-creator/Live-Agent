import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    outputJson: "artifacts/judge-visual-evidence/manifest.json",
    outputMarkdown: "artifacts/judge-visual-evidence/manifest.md",
    badgeDetails: "artifacts/demo-e2e/badge-details.json",
    summary: "artifacts/demo-e2e/summary.json",
    gcpCloudRunSummary: null,
    gcpRuntimeProof: null,
    submissionRefreshStatus: null,
    railwayDeploySummary: null,
    repoPublishSummary: null,
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
    if (arg === "--gcpCloudRunSummary") {
      options.gcpCloudRunSummary = argv[++i];
      continue;
    }
    if (arg === "--gcpRuntimeProof") {
      options.gcpRuntimeProof = argv[++i];
      continue;
    }
    if (arg === "--submissionRefreshStatus") {
      options.submissionRefreshStatus = argv[++i];
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
  if (!maybeRelative) {
    return null;
  }
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
  const gcpCloudRun = deployProvenance.gcpCloudRun;
  const gcpRuntimeProof = deployProvenance.gcpRuntimeProof;
  const submissionRefreshStatus = deployProvenance.submissionRefreshStatus;
  const railwayDeploy = deployProvenance.railwayDeploy;
  const repoPublish = deployProvenance.repoPublish;

  if (gcpCloudRun.available) {
    rows.push({
      id: "gcpCloudRun",
      title: "GCP Cloud Run",
      summary: `status ${gcpCloudRun.status}; services ${gcpCloudRun.serviceCount}; gateway ${gcpCloudRun.gatewayUrl}; api ${gcpCloudRun.apiUrl}; orchestrator ${gcpCloudRun.orchestratorUrl}`,
    });
  }

  if (gcpRuntimeProof.available) {
    rows.push({
      id: "gcpRuntimeProof",
      title: "GCP runtime proof",
      summary: `status ${gcpRuntimeProof.status}; Cloud Run URL proof ${gcpRuntimeProof.cloudRunUrlProof}; Firestore proof ${gcpRuntimeProof.firestoreProof}; BigQuery rows proof ${gcpRuntimeProof.bigQueryRowsProof}; observability screenshots proof ${gcpRuntimeProof.observabilityScreenshotsProof}`,
    });
  }

  if (submissionRefreshStatus.available) {
    rows.push({
      id: "submissionRefreshStatus",
      title: "Submission refresh",
      summary: `status ${submissionRefreshStatus.status}; blocker ${submissionRefreshStatus.blockingReason}`,
    });
  }

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

function collectDeployProvenance(
  gcpCloudRunSummaryRead,
  gcpRuntimeProofRead,
  submissionRefreshStatusRead,
  railwayDeploySummaryRead,
  repoPublishSummaryRead,
) {
  const gcpCloudRunSummary =
    gcpCloudRunSummaryRead.present && gcpCloudRunSummaryRead.parsed ? gcpCloudRunSummaryRead.value : null;
  const gcpRuntimeProof =
    gcpRuntimeProofRead.present && gcpRuntimeProofRead.parsed ? gcpRuntimeProofRead.value : null;
  const submissionRefreshStatus =
    submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed ? submissionRefreshStatusRead.value : null;
  const railwayDeploySummary =
    railwayDeploySummaryRead.present && railwayDeploySummaryRead.parsed ? railwayDeploySummaryRead.value : null;
  const repoPublishSummary =
    repoPublishSummaryRead.present && repoPublishSummaryRead.parsed ? repoPublishSummaryRead.value : null;
  const railwayChecks = railwayDeploySummary?.checks?.publicBadge ?? {};
  const repoPublishVerification = repoPublishSummary?.verification ?? {};
  const repoPublishSteps = repoPublishSummary?.steps ?? {};

  const deployProvenance = {
    available: Boolean(
      gcpCloudRunSummary || gcpRuntimeProof || submissionRefreshStatus || railwayDeploySummary || repoPublishSummary,
    ),
    rows: [],
    gcpCloudRun: {
      available: gcpCloudRunSummaryRead.present && gcpCloudRunSummaryRead.parsed,
      status: toOptionalText(gcpCloudRunSummary?.status),
      serviceCount: Number(gcpCloudRunSummary?.serviceCount ?? 0),
      gatewayUrl: toOptionalText(gcpCloudRunSummary?.gatewayUrl),
      apiUrl: toOptionalText(gcpCloudRunSummary?.apiUrl),
      orchestratorUrl: toOptionalText(gcpCloudRunSummary?.orchestratorUrl),
    },
    gcpRuntimeProof: {
      available: gcpRuntimeProofRead.present && gcpRuntimeProofRead.parsed,
      status: toOptionalText(gcpRuntimeProof?.status),
      blockingReason: toOptionalText(gcpRuntimeProof?.blockingReason),
      cloudRunUrlProof: gcpRuntimeProof?.judgeProof?.cloudRunUrlProof === true,
      firestoreProof: gcpRuntimeProof?.judgeProof?.firestoreProof === true,
      bigQueryRowsProof: gcpRuntimeProof?.judgeProof?.bigQueryRowsProof === true,
      observabilityScreenshotsProof: gcpRuntimeProof?.judgeProof?.observabilityScreenshotsProof === true,
    },
    submissionRefreshStatus: {
      available: submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed,
      status: toOptionalText(submissionRefreshStatus?.status),
      blockingReason: toOptionalText(submissionRefreshStatus?.blockingReason),
    },
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

  lines.push("");
  lines.push("## Submission Follow-Up");
  lines.push("");
  lines.push(`- GCP cloud proof checklist: \`artifacts/judge-visual-evidence/cloud-proof-checklist.md\``);
  lines.push(`- Cloud Run proof target: \`artifacts/deploy/gcp-cloud-run-summary.json\``);
  lines.push(`- Runtime proof target: \`artifacts/release-evidence/gcp-runtime-proof.md\``);
  lines.push(`- Submission refresh target: \`artifacts/release-evidence/submission-refresh-status.json\``);
  lines.push(`- Submission refresh state: \`${manifest.submissionFollowUp.submissionRefreshStatus}\``);
  lines.push(`- Submission refresh blocker: ${manifest.submissionFollowUp.submissionRefreshBlockingReason}`);
  lines.push(
    `- This visual pack should be regenerated after the GCP deploy so the screenshots and badge evidence match the deployed runtime instead of the current local/stale mix.`,
  );
  lines.push(
    `- The refreshed judged pack should also confirm \`liveApiEnabled=${manifest.submissionFollowUp.submissionSafeSummaryGate.liveApiEnabled}\`, \`translationProvider=${manifest.submissionFollowUp.submissionSafeSummaryGate.translationProvider}\`, \`storytellerMediaMode=${manifest.submissionFollowUp.submissionSafeSummaryGate.storytellerMediaMode}\`, and \`uiExecutorForceSimulation=${manifest.submissionFollowUp.submissionSafeSummaryGate.uiExecutorForceSimulation}\`.`,
  );
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const badgeDetailsPath = toAbsolutePath(options.badgeDetails);
  const summaryPath = toAbsolutePath(options.summary);
  const gcpCloudRunSummaryPath = toAbsolutePath(options.gcpCloudRunSummary);
  const gcpRuntimeProofPath = toAbsolutePath(options.gcpRuntimeProof);
  const submissionRefreshStatusPath = toAbsolutePath(options.submissionRefreshStatus);
  const railwayDeploySummaryPath = toAbsolutePath(options.railwayDeploySummary);
  const repoPublishSummaryPath = toAbsolutePath(options.repoPublishSummary);
  const screenshotDir = toAbsolutePath(options.screenshotDir);
  const outputJsonPath = toAbsolutePath(options.outputJson);
  const outputMarkdownPath = toAbsolutePath(options.outputMarkdown);

  const badgeDetailsRead = readJsonIfExists(badgeDetailsPath);
  const summaryRead = readJsonIfExists(summaryPath);
  const gcpCloudRunSummaryRead = gcpCloudRunSummaryPath ? readJsonIfExists(gcpCloudRunSummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const gcpRuntimeProofRead = gcpRuntimeProofPath ? readJsonIfExists(gcpRuntimeProofPath) : { present: false, parsed: false, value: null, parseError: null };
  const submissionRefreshStatusRead = submissionRefreshStatusPath ? readJsonIfExists(submissionRefreshStatusPath) : { present: false, parsed: false, value: null, parseError: null };
  const railwayDeploySummaryRead = railwayDeploySummaryPath ? readJsonIfExists(railwayDeploySummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const repoPublishSummaryRead = repoPublishSummaryPath ? readJsonIfExists(repoPublishSummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const badgeEvidence = collectBadgeEvidence(badgeDetailsRead.value ?? {});
  const deployProvenance = collectDeployProvenance(
    gcpCloudRunSummaryRead,
    gcpRuntimeProofRead,
    submissionRefreshStatusRead,
    railwayDeploySummaryRead,
    repoPublishSummaryRead,
  );
  const gcpRuntimeProof = gcpRuntimeProofRead.value ?? {};
  const submissionSafeSummaryGate = gcpRuntimeProof?.submissionSafeSummaryGate && typeof gcpRuntimeProof.submissionSafeSummaryGate === "object"
    ? {
        liveApiEnabled: gcpRuntimeProof.submissionSafeSummaryGate.liveApiEnabled === true,
        translationProvider: String(gcpRuntimeProof.submissionSafeSummaryGate.translationProvider ?? "not_fallback"),
        storytellerMediaMode: String(gcpRuntimeProof.submissionSafeSummaryGate.storytellerMediaMode ?? "not_simulated"),
        uiExecutorForceSimulation: gcpRuntimeProof.submissionSafeSummaryGate.uiExecutorForceSimulation === true,
      }
    : {
        liveApiEnabled: true,
        translationProvider: "not_fallback",
        storytellerMediaMode: "not_simulated",
        uiExecutorForceSimulation: false,
      };

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
      gcpCloudRunSummaryPath,
      gcpCloudRunSummaryPresent: gcpCloudRunSummaryRead.present,
      gcpCloudRunSummaryParsed: gcpCloudRunSummaryRead.parsed,
      gcpCloudRunSummaryParseError: gcpCloudRunSummaryRead.parseError,
      gcpRuntimeProofPath,
      gcpRuntimeProofPresent: gcpRuntimeProofRead.present,
      gcpRuntimeProofParsed: gcpRuntimeProofRead.parsed,
      gcpRuntimeProofParseError: gcpRuntimeProofRead.parseError,
      submissionRefreshStatusPath,
      submissionRefreshStatusPresent: submissionRefreshStatusRead.present,
      submissionRefreshStatusParsed: submissionRefreshStatusRead.parsed,
      submissionRefreshStatusParseError: submissionRefreshStatusRead.parseError,
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
    submissionFollowUp: {
      cloudRunProofPath: gcpCloudRunSummaryPath,
      runtimeProofPath: gcpRuntimeProofPath,
      submissionRefreshStatusPath,
      submissionRefreshStatus:
        submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed
          ? toOptionalText(submissionRefreshStatusRead.value?.status)
          : "missing",
      submissionRefreshBlockingReason:
        submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed
          ? toOptionalText(submissionRefreshStatusRead.value?.blockingReason)
          : "submission refresh wrapper has not been run yet.",
      cloudProofChecklistPath: resolve(process.cwd(), "artifacts/judge-visual-evidence/cloud-proof-checklist.md"),
      submissionSafeSummaryGate,
    },
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
