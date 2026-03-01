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

function toRelativePath(fromFile, toFile) {
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
  const visualManifestPath = toAbsolutePath(options.visualManifest);
  const visualGalleryPath = toAbsolutePath(options.visualGallery);

  const summaryRead = readJsonIfExists(summaryPath);
  const policyRead = readJsonIfExists(policyPath);
  const badgeRead = readJsonIfExists(badgePath);
  const badgeDetailsRead = readJsonIfExists(badgeDetailsPath);
  const releaseEvidenceRead = readJsonIfExists(releaseEvidencePath);
  const visualManifestRead = readJsonIfExists(visualManifestPath);

  const summary = summaryRead.value ?? {};
  const policy = policyRead.value ?? {};
  const badge = badgeRead.value ?? {};
  const badgeDetails = badgeDetailsRead.value ?? {};
  const visualManifest = visualManifestRead.value ?? {};
  const releaseEvidence = releaseEvidenceRead.value ?? {};

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
    { lane: "deviceNodes", status: toStatus(badgeDetails?.evidence?.deviceNodes?.status) },
    { lane: "agentUsage", status: toStatus(badgeDetails?.evidence?.agentUsage?.status) },
    { lane: "deviceNodeUpdates", status: deriveDeviceNodeUpdatesStatus(visualManifest, badgeDetails) },
  ];

  const categoryPass = categories.every((row) => row.status === "pass");
  const lanePass = evidenceLanes.every((row) => row.status === "pass");
  const policyOk = policy?.ok === true;
  const bundleStatus = categoryPass && lanePass && policyOk ? "pass" : "warn";

  const notes = [];
  for (const source of [
    { name: "summary", read: summaryRead },
    { name: "policy", read: policyRead },
    { name: "badge", read: badgeRead },
    { name: "badgeDetails", read: badgeDetailsRead },
    { name: "releaseEvidence", read: releaseEvidenceRead },
    { name: "visualManifest", read: visualManifestRead },
  ]) {
    if (!source.read.present) {
      notes.push(`${source.name} source is missing`);
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
    categories,
    evidenceLanes,
    artifacts: {
      summaryRel: toRelativePath(outputMarkdownPath, summaryPath),
      policyRel: toRelativePath(outputMarkdownPath, policyPath),
      badgeDetailsRel: toRelativePath(outputMarkdownPath, badgeDetailsPath),
      releaseEvidenceRel: toRelativePath(outputMarkdownPath, releaseEvidencePath),
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
