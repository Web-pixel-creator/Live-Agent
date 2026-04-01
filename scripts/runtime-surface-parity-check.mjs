import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toCount(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function collectIds(items, key) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }
      const value = item[key];
      return typeof value === "string" ? value.trim() : "";
    })
    .filter((item) => item.length > 0);
}

function diffRequired(required, actualSet, label) {
  return required
    .filter((item) => !actualSet.has(item))
    .map((item) => `${label} missing required entry: ${item}`);
}

function validateSummaryCount(summary, key, expected) {
  const actual = toCount(isRecord(summary) ? summary[key] : 0);
  if (actual !== expected) {
    return [`summary.${key} expected ${expected}, got ${actual}`];
  }
  return [];
}

function validateMinimum(summary, key, minimum) {
  const actual = toCount(isRecord(summary) ? summary[key] : 0);
  if (actual < minimum) {
    return [`summary.${key} expected >= ${minimum}, got ${actual}`];
  }
  return [];
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotPath = resolve(args.snapshot ?? "artifacts/runtime/runtime-surface-snapshot.json");
  const manifestPath = resolve(args.manifest ?? "configs/runtime-surface-manifest.json");
  const outputPath = args.output ? resolve(args.output) : null;

  const snapshot = await readJson(snapshotPath);
  const manifest = await readJson(manifestPath);

  const violations = [];

  if (snapshot?.source !== "repo_owned_runtime_surface_snapshot") {
    violations.push(`snapshot.source expected repo_owned_runtime_surface_snapshot, got ${String(snapshot?.source ?? "missing")}`);
  }
  if (manifest?.source !== "repo_owned_runtime_surface_manifest") {
    violations.push(`manifest.source expected repo_owned_runtime_surface_manifest, got ${String(manifest?.source ?? "missing")}`);
  }

  const inventory = isRecord(snapshot?.inventory) ? snapshot.inventory : null;
  const readiness = isRecord(snapshot?.readiness) ? snapshot.readiness : null;
  if (!inventory) {
    violations.push("snapshot.inventory is missing");
  }
  if (!readiness) {
    violations.push("snapshot.readiness is missing");
  }
  if (inventory?.source !== "repo_owned_runtime_surface_inventory") {
    violations.push(`inventory.source expected repo_owned_runtime_surface_inventory, got ${String(inventory?.source ?? "missing")}`);
  }
  if (readiness?.source !== "repo_owned_runtime_surface_readiness") {
    violations.push(`readiness.source expected repo_owned_runtime_surface_readiness, got ${String(readiness?.source ?? "missing")}`);
  }

  const requiredAgentIds = toStringArray(manifest?.requiredAgentIds);
  const requiredRouteIntents = toStringArray(manifest?.requiredRouteIntents);
  const requiredControlPlaneIds = toStringArray(manifest?.requiredControlPlaneIds);
  const requiredEvidenceIds = toStringArray(manifest?.requiredEvidenceIds);
  const requiredUiCapabilityIds = toStringArray(manifest?.requiredUiCapabilityIds);
  const requiredReadyPlaybookIds = toStringArray(manifest?.requiredReadyPlaybookIds);

  const agentIds = new Set(collectIds(inventory?.agents, "agentId"));
  const routeIntents = new Set(collectIds(inventory?.routes, "intent"));
  const controlPlaneIds = new Set(collectIds(inventory?.controlPlane, "id"));
  const evidenceIds = new Set(collectIds(inventory?.evidence, "id"));
  const uiCapabilityIds = new Set(collectIds(inventory?.uiCapabilities, "id"));
  const readyPlaybookIds = new Set(
    (Array.isArray(inventory?.playbooks) ? inventory.playbooks : [])
      .filter((item) => isRecord(item) && item.ready === true)
      .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
      .filter((item) => item.length > 0),
  );

  violations.push(...diffRequired(requiredAgentIds, agentIds, "agents"));
  violations.push(...diffRequired(requiredRouteIntents, routeIntents, "routes"));
  violations.push(...diffRequired(requiredControlPlaneIds, controlPlaneIds, "controlPlane"));
  violations.push(...diffRequired(requiredEvidenceIds, evidenceIds, "evidence"));
  violations.push(...diffRequired(requiredUiCapabilityIds, uiCapabilityIds, "uiCapabilities"));
  violations.push(...diffRequired(requiredReadyPlaybookIds, readyPlaybookIds, "playbooks.ready"));

  const summaryManifest = isRecord(manifest?.summary) ? manifest.summary : {};
  const inventorySummary = isRecord(inventory?.summary) ? inventory.summary : {};
  violations.push(...validateSummaryCount(inventorySummary, "totalAgents", toCount(summaryManifest.totalAgents)));
  violations.push(...validateSummaryCount(inventorySummary, "totalRoutes", toCount(summaryManifest.totalRoutes)));
  violations.push(
    ...validateSummaryCount(
      inventorySummary,
      "totalControlPlaneSurfaces",
      toCount(summaryManifest.totalControlPlaneSurfaces),
    ),
  );
  violations.push(
    ...validateSummaryCount(inventorySummary, "totalEvidenceLanes", toCount(summaryManifest.totalEvidenceLanes)),
  );
  violations.push(
    ...validateSummaryCount(inventorySummary, "totalUiCapabilities", toCount(summaryManifest.totalUiCapabilities)),
  );
  violations.push(...validateMinimum(inventorySummary, "totalPlaybooks", toCount(summaryManifest.minimumPlaybooks)));

  const readinessStatus = typeof readiness?.status === "string" ? readiness.status.trim() : "";
  if (!["ready", "degraded", "critical"].includes(readinessStatus)) {
    violations.push(`readiness.status expected ready|degraded|critical, got ${readinessStatus || "missing"}`);
  }

  const result = {
    ok: violations.length === 0,
    generatedAt: new Date().toISOString(),
    snapshotPath,
    manifestPath,
    checked: {
      agents: requiredAgentIds.length,
      routes: requiredRouteIntents.length,
      controlPlane: requiredControlPlaneIds.length,
      evidence: requiredEvidenceIds.length,
      uiCapabilities: requiredUiCapabilityIds.length,
      readyPlaybooks: requiredReadyPlaybookIds.length,
    },
    violations,
  };

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
});
