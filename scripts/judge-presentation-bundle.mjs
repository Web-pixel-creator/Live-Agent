import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function parseArgs(argv) {
  const options = {
    outputMarkdown: "artifacts/judge-visual-evidence/presentation.md",
    summary: "artifacts/demo-e2e/summary.json",
    policy: "artifacts/demo-e2e/policy-check.json",
    badge: "artifacts/demo-e2e/badge.json",
    badgeDetails: "artifacts/demo-e2e/badge-details.json",
    releaseEvidence: "artifacts/release-evidence/report.json",
    gcpCloudRunSummary: null,
    gcpRuntimeProof: null,
    submissionRefreshStatus: null,
    railwayDeploySummary: null,
    repoPublishSummary: null,
    visualManifest: "artifacts/judge-visual-evidence/manifest.json",
    visualGallery: "artifacts/judge-visual-evidence/gallery.md",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--outputMarkdown") {
      options.outputMarkdown = String(argv[++index] ?? options.outputMarkdown);
      continue;
    }
    if (arg === "--summary") {
      options.summary = String(argv[++index] ?? options.summary);
      continue;
    }
    if (arg === "--policy") {
      options.policy = String(argv[++index] ?? options.policy);
      continue;
    }
    if (arg === "--badge") {
      options.badge = String(argv[++index] ?? options.badge);
      continue;
    }
    if (arg === "--badgeDetails") {
      options.badgeDetails = String(argv[++index] ?? options.badgeDetails);
      continue;
    }
    if (arg === "--releaseEvidence") {
      options.releaseEvidence = String(argv[++index] ?? options.releaseEvidence);
      continue;
    }
    if (arg === "--gcpCloudRunSummary") {
      options.gcpCloudRunSummary = String(argv[++index] ?? options.gcpCloudRunSummary);
      continue;
    }
    if (arg === "--gcpRuntimeProof") {
      options.gcpRuntimeProof = String(argv[++index] ?? options.gcpRuntimeProof);
      continue;
    }
    if (arg === "--submissionRefreshStatus") {
      options.submissionRefreshStatus = String(argv[++index] ?? options.submissionRefreshStatus);
      continue;
    }
    if (arg === "--railwayDeploySummary") {
      options.railwayDeploySummary = String(argv[++index] ?? options.railwayDeploySummary);
      continue;
    }
    if (arg === "--repoPublishSummary") {
      options.repoPublishSummary = String(argv[++index] ?? options.repoPublishSummary);
      continue;
    }
    if (arg === "--visualManifest") {
      options.visualManifest = String(argv[++index] ?? options.visualManifest);
      continue;
    }
    if (arg === "--visualGallery") {
      options.visualGallery = String(argv[++index] ?? options.visualGallery);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function toAbsolutePath(pathLike) {
  if (!pathLike) {
    return null;
  }
  if (isAbsolute(pathLike)) {
    return pathLike;
  }
  return resolve(process.cwd(), pathLike);
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return { present: false, parsed: false, value: null, parseError: null };
  }
  try {
    return {
      present: true,
      parsed: true,
      value: JSON.parse(readFileSync(filePath, "utf8")),
      parseError: null,
    };
  } catch (error) {
    return {
      present: true,
      parsed: false,
      value: null,
      parseError: String(error?.message ?? error),
    };
  }
}

function toStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
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

function toRelativePath(fromFile, toFile) {
  if (!toFile) {
    return null;
  }
  const raw = relative(dirname(fromFile), toFile);
  return raw.split(sep).join("/");
}

function hasPassedScenario(summary, scenarioName) {
  const scenarios = Array.isArray(summary?.scenarios) ? summary.scenarios : [];
  return scenarios.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      String(entry.name ?? "") === scenarioName &&
      String(entry.status ?? "").toLowerCase() === "passed",
  );
}

function deriveDeviceNodeUpdatesStatus(visualManifest, badgeDetails) {
  const fromVisual = visualManifest?.badgeEvidence?.deviceNodeUpdates;
  const normalizedVisual = toStatus(fromVisual);
  if (normalizedVisual !== "unavailable") {
    return normalizedVisual;
  }

  const nodeEvidence = badgeDetails?.evidence?.deviceNodes;
  if (!nodeEvidence || typeof nodeEvidence !== "object") {
    return "unavailable";
  }
  const updatesValidated = nodeEvidence.updatesValidated === true;
  const updatesHasUpsert = nodeEvidence.updatesHasUpsert === true;
  const updatesHasHeartbeat = nodeEvidence.updatesHasHeartbeat === true;
  const updatesApiValidated = nodeEvidence.updatesApiValidated === true;
  const updatesTotal = Number(nodeEvidence.updatesTotal ?? 0);
  if (
    updatesValidated &&
    updatesHasUpsert &&
    updatesHasHeartbeat &&
    updatesApiValidated &&
    Number.isFinite(updatesTotal) &&
    updatesTotal >= 2
  ) {
    return "pass";
  }
  if (updatesValidated || updatesHasUpsert || updatesHasHeartbeat || updatesApiValidated || updatesTotal > 0) {
    return "fail";
  }
  return "unavailable";
}

function toProviderEntrySummary(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    route: String(entry.route ?? "n/a"),
    capability: String(entry.capability ?? "n/a"),
    selectedProvider: String(entry.selectedProvider ?? "n/a"),
    selectedModel: String(entry.selectedModel ?? "n/a"),
    defaultProvider: String(entry.defaultProvider ?? "n/a"),
    selectionReason: String(entry.selectionReason ?? "n/a"),
    secondaryActive: entry.secondaryActive === true ? "yes" : "no",
  };
}

function summarizePrimaryPath(primaryPath) {
  if (!primaryPath || typeof primaryPath !== "object") {
    return "n/a";
  }

  const title = String(primaryPath.title ?? "n/a");
  const kind = String(primaryPath.kind ?? "n/a");
  const phase = String(primaryPath.phase ?? "n/a");
  return `${title} (${kind} / ${phase})`;
}

function sanitizeDeployProvenanceRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      id: String(row?.id ?? "").trim(),
      title: String(row?.title ?? "").trim(),
      summary: String(row?.summary ?? "").trim(),
    }))
    .filter((row) => row.title.length > 0 && row.summary.length > 0);
}

function buildDeployProvenanceRows(deployProvenance) {
  const rows = [];
  const gcpCloudRun = deployProvenance.gcpCloudRun;
  const gcpRuntimeProof = deployProvenance.gcpRuntimeProof;
  const submissionRefreshStatus = deployProvenance.submissionRefreshStatus;
  const railwayDeploy = deployProvenance.railwayDeploy;
  const repoPublish = deployProvenance.repoPublish;

  if (gcpCloudRun.present) {
    rows.push({
      id: "gcpCloudRun",
      title: "GCP Cloud Run",
      summary: `status ${gcpCloudRun.status}; services ${gcpCloudRun.serviceCount}; gateway ${gcpCloudRun.gatewayUrl}; api ${gcpCloudRun.apiUrl}; orchestrator ${gcpCloudRun.orchestratorUrl}`,
    });
  }

  if (gcpRuntimeProof.present) {
    rows.push({
      id: "gcpRuntimeProof",
      title: "GCP runtime proof",
      summary: `status ${gcpRuntimeProof.status}; Cloud Run URL proof ${gcpRuntimeProof.cloudRunUrlProof}; Firestore proof ${gcpRuntimeProof.firestoreProof}; BigQuery rows proof ${gcpRuntimeProof.bigQueryRowsProof}; observability screenshots proof ${gcpRuntimeProof.observabilityScreenshotsProof}`,
    });
  }

  if (submissionRefreshStatus.present) {
    rows.push({
      id: "submissionRefreshStatus",
      title: "Submission refresh",
      summary: `status ${submissionRefreshStatus.status}; blocker ${submissionRefreshStatus.blockingReason}`,
    });
  }

  if (railwayDeploy.present) {
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

  if (repoPublish.present) {
    rows.push({
      id: "repoPublish",
      title: "Repo publish",
      summary: [
        `verification ${repoPublish.verificationScript}`,
        repoPublish.releaseEvidenceValidated === "true"
          ? "release evidence validated"
          : "release evidence not validated",
        `Railway deploy ${repoPublish.railwayDeployEnabledLabel}`,
        `frontend deploy ${repoPublish.railwayFrontendDeployEnabledLabel}`,
      ].join("; "),
    });
  }

  return rows;
}

function summarizeDeployProvenance(
  visualManifest,
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
  const railwayPublicBadge = railwayDeploySummary?.checks?.publicBadge ?? {};
  const repoPublishVerification = repoPublishSummary?.verification ?? {};
  const repoPublishSteps = repoPublishSummary?.steps ?? {};

  const deployProvenance = {
    available: Boolean(
      gcpCloudRunSummary || gcpRuntimeProof || submissionRefreshStatus || railwayDeploySummary || repoPublishSummary,
    ),
    rows: [],
    gcpCloudRun: {
      present: gcpCloudRunSummaryRead.present && gcpCloudRunSummaryRead.parsed,
      status: toOptionalText(gcpCloudRunSummary?.status),
      serviceCount: Number(gcpCloudRunSummary?.serviceCount ?? 0),
      gatewayUrl: toOptionalText(gcpCloudRunSummary?.gatewayUrl),
      apiUrl: toOptionalText(gcpCloudRunSummary?.apiUrl),
      orchestratorUrl: toOptionalText(gcpCloudRunSummary?.orchestratorUrl),
    },
    gcpRuntimeProof: {
      present: gcpRuntimeProofRead.present && gcpRuntimeProofRead.parsed,
      status: toOptionalText(gcpRuntimeProof?.status),
      blockingReason: toOptionalText(gcpRuntimeProof?.blockingReason),
      cloudRunUrlProof: gcpRuntimeProof?.judgeProof?.cloudRunUrlProof === true,
      firestoreProof: gcpRuntimeProof?.judgeProof?.firestoreProof === true,
      bigQueryRowsProof: gcpRuntimeProof?.judgeProof?.bigQueryRowsProof === true,
      observabilityScreenshotsProof: gcpRuntimeProof?.judgeProof?.observabilityScreenshotsProof === true,
    },
    submissionRefreshStatus: {
      present: submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed,
      status: toOptionalText(submissionRefreshStatus?.status),
      blockingReason: toOptionalText(submissionRefreshStatus?.blockingReason),
    },
    railwayDeploy: {
      present: railwayDeploySummaryRead.present && railwayDeploySummaryRead.parsed,
      status: toOptionalText(railwayDeploySummary?.status),
      deploymentId: toOptionalText(railwayDeploySummary?.deploymentId),
      effectivePublicUrl: toOptionalText(railwayDeploySummary?.effectivePublicUrl),
      badgeEndpoint: toOptionalText(railwayPublicBadge?.badgeEndpoint),
      badgeDetailsEndpoint: toOptionalText(railwayPublicBadge?.badgeDetailsEndpoint),
    },
    repoPublish: {
      present: repoPublishSummaryRead.present && repoPublishSummaryRead.parsed,
      verificationScript: toOptionalText(repoPublishVerification?.script),
      releaseEvidenceValidated: repoPublishVerification?.releaseEvidenceArtifactsValidated === true ? "true" : "false",
      railwayDeployEnabled: repoPublishSteps?.railwayDeployEnabled === true ? "true" : "false",
      railwayFrontendDeployEnabled: repoPublishSteps?.railwayFrontendDeployEnabled === true ? "true" : "false",
      railwayDeployEnabledLabel: toEnabledLabel(repoPublishSteps?.railwayDeployEnabled),
      railwayFrontendDeployEnabledLabel: toEnabledLabel(repoPublishSteps?.railwayFrontendDeployEnabled),
    },
  };

  const rowsFromVisualManifest = sanitizeDeployProvenanceRows(visualManifest?.deployProvenance?.rows);
  deployProvenance.rows =
    rowsFromVisualManifest.length > 0 ? rowsFromVisualManifest : buildDeployProvenanceRows(deployProvenance);
  deployProvenance.available = deployProvenance.rows.length > 0 || deployProvenance.available;

  return deployProvenance;
}

function toMarkdown(bundle) {
  const lines = [];
  lines.push("# Judge Presentation Bundle");
  lines.push("");
  lines.push(`- Generated at: ${bundle.generatedAt}`);
  lines.push(`- Bundle status: ${bundle.bundleStatus}`);
  lines.push(`- Policy gate: ${bundle.policyStatus}`);
  lines.push(`- Badge: ${bundle.badgeLabel} -> ${bundle.badgeMessage} (${bundle.badgeColor})`);
  lines.push("");

  lines.push("## Challenge Category Coverage");
  lines.push("");
  lines.push("| Category | Evidence Scenario | Status |");
  lines.push("|---|---|---|");
  for (const row of bundle.categories) {
    lines.push(`| ${row.category} | ${row.scenario} | ${row.status} |`);
  }
  lines.push("");

  lines.push("## Critical Evidence Lanes");
  lines.push("");
  lines.push("| Lane | Status |");
  lines.push("|---|---|");
  for (const row of bundle.evidenceLanes) {
    lines.push(`| ${row.lane} | ${row.status} |`);
  }
  lines.push("");

  lines.push("## KPI Snapshot");
  lines.push("");
  lines.push(`- Policy checks: ${bundle.policyChecks}`);
  lines.push(`- Policy violations: ${bundle.policyViolations}`);
  lines.push(`- WebSocket roundtrip (ms): ${bundle.gatewayRoundTripMs}`);
  lines.push(`- Cost estimate total (USD): ${bundle.costTotalUsd}`);
  lines.push(`- Tokens used total: ${bundle.tokensUsedTotal}`);
  lines.push("");

  lines.push("## Runtime Guardrails Snapshot");
  lines.push("");
  lines.push(`- Status: ${bundle.runtimeGuardrails.status}`);
  lines.push(`- Summary: ${bundle.runtimeGuardrails.summaryStatus}`);
  lines.push(`- Total paths: ${bundle.runtimeGuardrails.totalPaths}`);
  lines.push(`- Primary path: ${bundle.runtimeGuardrails.primaryPathSummary}`);
  lines.push("");

  lines.push("## Provider Adapter Snapshot");
  lines.push("");
  lines.push(`- Status: ${bundle.providerUsage.status}`);
  lines.push(`- Active secondary providers: ${bundle.providerUsage.activeSecondaryProviders}`);
  lines.push("");
  lines.push("| Route | Capability | Provider | Model | Default Provider | Selection Reason | Secondary Active |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const row of bundle.providerUsage.entries) {
    lines.push(
      `| ${row.route} | ${row.capability} | ${row.selectedProvider} | ${row.selectedModel} | ${row.defaultProvider} | ${row.selectionReason} | ${row.secondaryActive} |`,
    );
  }

  if (bundle.deployProvenance.rows.length > 0) {
    lines.push("");
    lines.push("## Deploy / Publish Provenance");
    lines.push("");
    for (const row of bundle.deployProvenance.rows) {
      lines.push(`- ${row.title}: ${row.summary}`);
    }
  }
  lines.push("");

  lines.push("## Visual Assets");
  lines.push("");
  lines.push(`- Visual manifest: [manifest.json](${bundle.artifacts.visualManifestRel})`);
  lines.push(`- Visual checklist: [manifest.md](${bundle.artifacts.visualChecklistRel})`);
  lines.push(`- Screenshot gallery: [gallery.md](${bundle.artifacts.visualGalleryRel})`);
  lines.push("");

  lines.push("## Artifact Links");
  lines.push("");
  lines.push(`- Demo summary: [summary.json](${bundle.artifacts.summaryRel})`);
  lines.push(`- Policy report: [policy-check.json](${bundle.artifacts.policyRel})`);
  lines.push(`- Badge details: [badge-details.json](${bundle.artifacts.badgeDetailsRel})`);
  lines.push(`- Release evidence report: [report.json](${bundle.artifacts.releaseEvidenceRel})`);
  lines.push("");

  lines.push("## Submission Follow-Up");
  lines.push("");
  lines.push(`- GCP cloud proof checklist: [cloud-proof-checklist.md](${bundle.artifacts.cloudProofChecklistRel})`);
  lines.push(`- Runtime proof placeholder: [gcp-runtime-proof.md](${bundle.artifacts.gcpRuntimeProofMarkdownRel})`);
  lines.push(`- Submission refresh status: [submission-refresh-status.md](${bundle.artifacts.submissionRefreshStatusRel})`);
  lines.push(`- Submission refresh state: \`${bundle.submissionFollowUp.submissionRefreshStatus}\``);
  lines.push(`- Submission refresh blocker: ${bundle.submissionFollowUp.submissionRefreshBlockingReason}`);
  lines.push(`- Video shot list: [video-shot-list.md](${bundle.artifacts.videoShotListRel})`);
  lines.push(`- 4-minute script: [video-script-4min.md](${bundle.artifacts.videoScriptRel})`);
  lines.push(`- Screen checklist: [screen-checklist.md](${bundle.artifacts.screenChecklistRel})`);
  lines.push(
    `- Submission-safe summary gate: \`liveApiEnabled=${bundle.submissionFollowUp.submissionSafeSummaryGate.liveApiEnabled}\`, \`translationProvider=${bundle.submissionFollowUp.submissionSafeSummaryGate.translationProvider}\`, \`storytellerMediaMode=${bundle.submissionFollowUp.submissionSafeSummaryGate.storytellerMediaMode}\`, \`uiExecutorForceSimulation=${bundle.submissionFollowUp.submissionSafeSummaryGate.uiExecutorForceSimulation}\``,
  );
  lines.push("");

  if (bundle.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const note of bundle.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputMarkdownPath = toAbsolutePath(options.outputMarkdown);
  const summaryPath = toAbsolutePath(options.summary);
  const policyPath = toAbsolutePath(options.policy);
  const badgePath = toAbsolutePath(options.badge);
  const badgeDetailsPath = toAbsolutePath(options.badgeDetails);
  const releaseEvidencePath = toAbsolutePath(options.releaseEvidence);
  const gcpCloudRunSummaryPath = toAbsolutePath(options.gcpCloudRunSummary);
  const gcpRuntimeProofPath = toAbsolutePath(options.gcpRuntimeProof);
  const submissionRefreshStatusPath = toAbsolutePath(options.submissionRefreshStatus);
  const railwayDeploySummaryPath = toAbsolutePath(options.railwayDeploySummary);
  const repoPublishSummaryPath = toAbsolutePath(options.repoPublishSummary);
  const visualManifestPath = toAbsolutePath(options.visualManifest);
  const visualGalleryPath = toAbsolutePath(options.visualGallery);

  const summaryRead = readJsonIfExists(summaryPath);
  const policyRead = readJsonIfExists(policyPath);
  const badgeRead = readJsonIfExists(badgePath);
  const badgeDetailsRead = readJsonIfExists(badgeDetailsPath);
  const releaseEvidenceRead = readJsonIfExists(releaseEvidencePath);
  const gcpCloudRunSummaryRead = gcpCloudRunSummaryPath ? readJsonIfExists(gcpCloudRunSummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const gcpRuntimeProofRead = gcpRuntimeProofPath ? readJsonIfExists(gcpRuntimeProofPath) : { present: false, parsed: false, value: null, parseError: null };
  const submissionRefreshStatusRead = submissionRefreshStatusPath ? readJsonIfExists(submissionRefreshStatusPath) : { present: false, parsed: false, value: null, parseError: null };
  const railwayDeploySummaryRead = railwayDeploySummaryPath ? readJsonIfExists(railwayDeploySummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const repoPublishSummaryRead = repoPublishSummaryPath ? readJsonIfExists(repoPublishSummaryPath) : { present: false, parsed: false, value: null, parseError: null };
  const visualManifestRead = readJsonIfExists(visualManifestPath);

  const summary = summaryRead.value ?? {};
  const policy = policyRead.value ?? {};
  const badge = badgeRead.value ?? {};
  const badgeDetails = badgeDetailsRead.value ?? {};
  const visualManifest = visualManifestRead.value ?? {};
  const releaseEvidence = releaseEvidenceRead.value ?? {};
  const runtimeGuardrails = badgeDetails?.evidence?.runtimeGuardrailsSignalPaths ?? {};
  const providerUsage = badgeDetails?.providerUsage ?? releaseEvidence?.providerUsage ?? {};
  const deployProvenance = summarizeDeployProvenance(
    visualManifest,
    gcpCloudRunSummaryRead,
    gcpRuntimeProofRead,
    submissionRefreshStatusRead,
    railwayDeploySummaryRead,
    repoPublishSummaryRead,
  );
  const gcpRuntimeProof = gcpRuntimeProofRead.value ?? {};
  const submissionSafeSummaryGate =
    gcpRuntimeProof?.submissionSafeSummaryGate && typeof gcpRuntimeProof.submissionSafeSummaryGate === "object"
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

  const categories = [
    {
      category: "Live Agent",
      scenario: "live.negotiation",
      status: hasPassedScenario(summary, "live.negotiation") ? "pass" : "fail",
    },
    {
      category: "Creative Storyteller",
      scenario: "storyteller.pipeline",
      status: hasPassedScenario(summary, "storyteller.pipeline") ? "pass" : "fail",
    },
    {
      category: "UI Navigator",
      scenario: "ui.approval.approve_resume",
      status: hasPassedScenario(summary, "ui.approval.approve_resume") ? "pass" : "fail",
    },
  ];

  const evidenceLanes = [
    { lane: "operatorTurnTruncation", status: toStatus(badgeDetails?.evidence?.operatorTurnTruncation?.status) },
    { lane: "operatorTurnDelete", status: toStatus(badgeDetails?.evidence?.operatorTurnDelete?.status) },
    { lane: "operatorDamageControl", status: toStatus(badgeDetails?.evidence?.operatorDamageControl?.status) },
    { lane: "governancePolicy", status: toStatus(badgeDetails?.evidence?.governancePolicy?.status) },
    { lane: "skillsRegistry", status: toStatus(badgeDetails?.evidence?.skillsRegistry?.status) },
    { lane: "pluginMarketplace", status: toStatus(badgeDetails?.evidence?.pluginMarketplace?.status) },
    { lane: "deviceNodes", status: toStatus(badgeDetails?.evidence?.deviceNodes?.status) },
    { lane: "agentUsage", status: toStatus(badgeDetails?.evidence?.agentUsage?.status) },
    { lane: "runtimeGuardrailsSignalPaths", status: toStatus(runtimeGuardrails?.status) },
    { lane: "providerUsage", status: toStatus(providerUsage?.status) },
    { lane: "deviceNodeUpdates", status: deriveDeviceNodeUpdatesStatus(visualManifest, badgeDetails) },
  ];

  const categoryPass = categories.every((row) => row.status === "pass");
  const lanePass = evidenceLanes.every((row) => row.status === "pass");
  const policyOk = policy?.ok === true;
  const bundleStatus = categoryPass && lanePass && policyOk ? "pass" : "warn";

  const notes = [];
  for (const source of [
    { name: "summary", read: summaryRead, optional: false },
    { name: "policy", read: policyRead, optional: false },
    { name: "badge", read: badgeRead, optional: false },
    { name: "badgeDetails", read: badgeDetailsRead, optional: false },
    { name: "releaseEvidence", read: releaseEvidenceRead, optional: false },
    { name: "gcpCloudRunSummary", read: gcpCloudRunSummaryRead, optional: true },
    { name: "gcpRuntimeProof", read: gcpRuntimeProofRead, optional: true },
    { name: "submissionRefreshStatus", read: submissionRefreshStatusRead, optional: true },
    { name: "railwayDeploySummary", read: railwayDeploySummaryRead, optional: true },
    { name: "repoPublishSummary", read: repoPublishSummaryRead, optional: true },
    { name: "visualManifest", read: visualManifestRead, optional: false },
  ]) {
    if (!source.read.present) {
      if (!source.optional) {
        notes.push(`${source.name} source is missing`);
      }
      continue;
    }
    if (!source.read.parsed) {
      notes.push(`${source.name} source parse error: ${source.read.parseError}`);
    }
  }
  if (!existsSync(visualGalleryPath)) {
    notes.push("visualGallery source is missing");
  }

  const bundle = {
    generatedAt: new Date().toISOString(),
    bundleStatus,
    policyStatus: policyOk ? "pass" : "fail",
    policyChecks: Number(policy?.checks ?? 0),
    policyViolations: Array.isArray(policy?.violations) ? policy.violations.length : Number(policy?.violations ?? 0),
    badgeLabel: String(badge?.label ?? "n/a"),
    badgeMessage: String(badge?.message ?? "n/a"),
    badgeColor: String(badge?.color ?? "n/a"),
    gatewayRoundTripMs: Number(summary?.kpis?.gatewayWsRoundTripMs ?? 0),
    costTotalUsd: Number(badgeDetails?.costEstimate?.totalUsd ?? summary?.costEstimate?.totalUsd ?? 0),
    tokensUsedTotal: Number(badgeDetails?.tokensUsed?.total ?? summary?.tokensUsed?.total ?? 0),
    runtimeGuardrails: {
      status: toStatus(runtimeGuardrails?.status),
      summaryStatus: String(runtimeGuardrails?.summaryStatus ?? "n/a"),
      totalPaths: Number(runtimeGuardrails?.totalPaths ?? 0),
      primaryPathSummary: summarizePrimaryPath(runtimeGuardrails?.primaryPath),
    },
    providerUsage: {
      status: toStatus(providerUsage?.status),
      activeSecondaryProviders: Number(providerUsage?.activeSecondaryProviders ?? 0),
      entries: Array.isArray(providerUsage?.entries)
        ? providerUsage.entries.map(toProviderEntrySummary).filter(Boolean)
        : [],
    },
    deployProvenance,
    submissionFollowUp: {
      submissionSafeSummaryGate,
      submissionRefreshStatus:
        submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed
          ? toOptionalText(submissionRefreshStatusRead.value?.status)
          : "missing",
      submissionRefreshBlockingReason:
        submissionRefreshStatusRead.present && submissionRefreshStatusRead.parsed
          ? toOptionalText(submissionRefreshStatusRead.value?.blockingReason)
          : "submission refresh wrapper has not been run yet.",
    },
    categories,
    evidenceLanes,
    artifacts: {
      summaryRel: toRelativePath(outputMarkdownPath, summaryPath),
      policyRel: toRelativePath(outputMarkdownPath, policyPath),
      badgeDetailsRel: toRelativePath(outputMarkdownPath, badgeDetailsPath),
      releaseEvidenceRel: toRelativePath(outputMarkdownPath, releaseEvidencePath),
      cloudProofChecklistRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/judge-visual-evidence/cloud-proof-checklist.md"),
      ),
      gcpRuntimeProofMarkdownRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/release-evidence/gcp-runtime-proof.md"),
      ),
      submissionRefreshStatusRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/release-evidence/submission-refresh-status.md"),
      ),
      videoShotListRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/release-evidence/video-shot-list.md"),
      ),
      videoScriptRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/release-evidence/video-script-4min.md"),
      ),
      screenChecklistRel: toRelativePath(
        outputMarkdownPath,
        resolve(process.cwd(), "artifacts/release-evidence/screen-checklist.md"),
      ),
      railwayDeploySummaryRel: toRelativePath(outputMarkdownPath, railwayDeploySummaryPath),
      repoPublishSummaryRel: toRelativePath(outputMarkdownPath, repoPublishSummaryPath),
      visualManifestRel: toRelativePath(outputMarkdownPath, visualManifestPath),
      visualChecklistRel: toRelativePath(
        outputMarkdownPath,
        resolve(dirname(visualManifestPath), "manifest.md"),
      ),
      visualGalleryRel: toRelativePath(outputMarkdownPath, visualGalleryPath),
    },
    notes,
    releaseEvidenceStatus: releaseEvidence?.statuses ?? {},
  };

  mkdirSync(dirname(outputMarkdownPath), { recursive: true });
  writeFileSync(outputMarkdownPath, toMarkdown(bundle), { encoding: "utf8" });
  console.log(`[judge-presentation-bundle] Markdown: ${outputMarkdownPath}`);
  console.log(`[judge-presentation-bundle] Status: ${bundle.bundleStatus}`);
}

main();
