import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

function parseArgs(argv) {
  const options = {
    outputMarkdown: "artifacts/judge-visual-evidence/gallery.md",
    captureManifest: "artifacts/judge-visual-evidence/screenshots/_capture-manifest.json",
    packManifest: "artifacts/judge-visual-evidence/manifest.json",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--outputMarkdown") {
      options.outputMarkdown = String(argv[++index] ?? options.outputMarkdown);
      continue;
    }
    if (arg === "--captureManifest") {
      options.captureManifest = String(argv[++index] ?? options.captureManifest);
      continue;
    }
    if (arg === "--packManifest") {
      options.packManifest = String(argv[++index] ?? options.packManifest);
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

function readJsonIfExists(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    return { present: true, parsed: true, value: JSON.parse(raw), parseError: null };
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

function toStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pass" || normalized === "fail") {
    return normalized;
  }
  return "unavailable";
}

function collectLaneRows(packManifest) {
  const evidence =
    packManifest && typeof packManifest === "object" && packManifest.badgeEvidence && typeof packManifest.badgeEvidence === "object"
      ? packManifest.badgeEvidence
      : {};
  return [
    { lane: "operatorTurnTruncation", status: toStatus(evidence.operatorTurnTruncation) },
    { lane: "operatorTurnDelete", status: toStatus(evidence.operatorTurnDelete) },
    { lane: "operatorDamageControl", status: toStatus(evidence.operatorDamageControl) },
    { lane: "governancePolicy", status: toStatus(evidence.governancePolicy) },
    { lane: "skillsRegistry", status: toStatus(evidence.skillsRegistry) },
    { lane: "deviceNodes", status: toStatus(evidence.deviceNodes) },
    { lane: "agentUsage", status: toStatus(evidence.agentUsage) },
    { lane: "deviceNodeUpdates", status: toStatus(evidence.deviceNodeUpdates) },
  ];
}

function buildShotSpecs() {
  return [
    {
      id: "live_console_main",
      fileName: "live-console-main.png",
      title: "Live Console",
      focus: "Realtime connection, voice controls, setup overrides, interruption path.",
    },
    {
      id: "operator_console_evidence",
      fileName: "operator-console-evidence.png",
      title: "Operator Console",
      focus: "Judge-facing evidence widgets and recovery controls.",
    },
    {
      id: "storyteller_timeline",
      fileName: "storyteller-timeline.png",
      title: "Story Timeline",
      focus: "Interactive timeline for Creative Storyteller output segments.",
    },
    {
      id: "approval_pending",
      fileName: "approval-flow-pending.png",
      title: "Approval Pending",
      focus: "Human-in-the-loop checkpoint for sensitive UI actions.",
    },
    {
      id: "approval_approved",
      fileName: "approval-flow-approved.png",
      title: "Approval Approved",
      focus: "Resume flow after operator decision.",
    },
    {
      id: "observability_dashboard",
      fileName: "observability-dashboard.png",
      title: "Observability Dashboard",
      focus: "Operational health KPIs and runtime readiness summary.",
    },
    {
      id: "observability_alert_gateway_latency",
      fileName: "observability-alert-gateway-latency.png",
      title: "Alert: Gateway P95 Latency",
      focus: "Latency alert policy evidence.",
    },
    {
      id: "observability_alert_service_error_rate",
      fileName: "observability-alert-service-error-rate.png",
      title: "Alert: Service Error Rate",
      focus: "Error-rate alert policy evidence.",
    },
    {
      id: "observability_alert_orchestrator_persistence",
      fileName: "observability-alert-orchestrator-persistence.png",
      title: "Alert: Orchestrator Persistence",
      focus: "Persistence-failure alert policy evidence.",
    },
  ];
}

function toRelativePath(fromFile, toFile) {
  const raw = relative(dirname(fromFile), toFile);
  if (!raw || raw.length === 0) {
    return ".";
  }
  return raw.split(sep).join("/");
}

function findCapturePathByFileName(captureManifest, fileName) {
  const output =
    captureManifest && typeof captureManifest === "object" && captureManifest.output && typeof captureManifest.output === "object"
      ? captureManifest.output
      : {};
  for (const value of Object.values(output)) {
    if (typeof value === "string" && basename(value).toLowerCase() === fileName.toLowerCase()) {
      return value;
    }
  }
  return null;
}

function toMarkdown(model) {
  const lines = [];
  lines.push("# Judge Visual Gallery");
  lines.push("");
  lines.push(`- Generated at: ${model.generatedAt}`);
  lines.push(`- Capture manifest: ${model.captureManifestPresent ? "present" : "missing"}`);
  lines.push(`- Pack manifest: ${model.packManifestPresent ? "present" : "missing"}`);
  lines.push(`- Screenshots present: ${model.presentShots}/${model.totalShots}`);
  lines.push("");
  lines.push("## Critical Evidence Lanes");
  lines.push("");
  lines.push("| Lane | Status |");
  lines.push("|---|---|");
  for (const row of model.lanes) {
    lines.push(`| ${row.lane} | ${row.status} |`);
  }
  lines.push("");
  lines.push("## Screenshot Gallery");
  lines.push("");

  for (const shot of model.shots) {
    lines.push(`### ${shot.title}`);
    lines.push("");
    lines.push(`- ID: \`${shot.id}\``);
    lines.push(`- File: \`${shot.fileName}\``);
    lines.push(`- Focus: ${shot.focus}`);
    lines.push(`- Status: ${shot.status}${shot.sizeBytes > 0 ? ` (${shot.sizeBytes} bytes)` : ""}`);
    lines.push("");
    if (shot.present && shot.relativePath) {
      lines.push(`![${shot.title}](${shot.relativePath})`);
      lines.push("");
    } else {
      lines.push("_Missing screenshot artifact._");
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputMarkdownPath = toAbsolutePath(options.outputMarkdown);
  const captureManifestPath = toAbsolutePath(options.captureManifest);
  const packManifestPath = toAbsolutePath(options.packManifest);

  const captureManifestRead = readJsonIfExists(captureManifestPath);
  const packManifestRead = readJsonIfExists(packManifestPath);
  const captureManifest = captureManifestRead.value ?? {};
  const packManifest = packManifestRead.value ?? {};

  const shots = buildShotSpecs().map((shot) => {
    const maybePath = findCapturePathByFileName(captureManifest, shot.fileName);
    const resolvedPath = maybePath ? toAbsolutePath(maybePath) : null;
    const present = resolvedPath ? existsSync(resolvedPath) : false;
    const sizeBytes = present ? statSync(resolvedPath).size : 0;
    const relativePath = present ? toRelativePath(outputMarkdownPath, resolvedPath) : null;
    return {
      ...shot,
      path: resolvedPath,
      relativePath,
      present,
      sizeBytes,
      status: present ? "present" : "missing",
    };
  });

  const presentShots = shots.filter((shot) => shot.present).length;
  const lanes = collectLaneRows(packManifest);
  const model = {
    generatedAt: new Date().toISOString(),
    captureManifestPath,
    captureManifestPresent: captureManifestRead.present && captureManifestRead.parsed,
    captureManifestParseError: captureManifestRead.parseError,
    packManifestPath,
    packManifestPresent: packManifestRead.present && packManifestRead.parsed,
    packManifestParseError: packManifestRead.parseError,
    totalShots: shots.length,
    presentShots,
    lanes,
    shots,
  };

  mkdirSync(dirname(outputMarkdownPath), { recursive: true });
  writeFileSync(outputMarkdownPath, toMarkdown(model), { encoding: "utf8" });
  console.log(`[judge-visual-gallery] Markdown: ${outputMarkdownPath}`);
  console.log(`[judge-visual-gallery] Screenshots: ${presentShots}/${shots.length}`);
}

main();
