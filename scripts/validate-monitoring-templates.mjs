import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const monitoringDir = resolve(repoRoot, "infra", "monitoring");

function fail(message) {
  console.error(`[monitoring-validate] ${message}`);
  process.exit(1);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function parseJsonWithTemplatePlaceholders(raw, path) {
  const rendered = raw
    .replaceAll("__NOTIFICATION_CHANNELS__", "[]")
    .replaceAll("__PROJECT_ID__", "demo-project");
  try {
    return JSON.parse(rendered);
  } catch (error) {
    fail(`Invalid JSON template after placeholder substitution in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureFile(path) {
  try {
    const st = statSync(path);
    if (!st.isFile()) {
      fail(`Expected file but found non-file path: ${path}`);
    }
  } catch {
    fail(`Missing required file: ${path}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const requiredFiles = [
  "README.md",
  "dashboard.telemetry-kpis.json",
  "alert-policy.gateway-latency.json",
  "alert-policy.service-errors.json",
  "alert-policy.orchestrator-persist-failures.json",
  "alert-policy.story-media-queue-health.json",
  "alert-policy.story-cache-health.json",
];

for (const file of requiredFiles) {
  ensureFile(join(monitoringDir, file));
}

const dashboardPath = join(monitoringDir, "dashboard.telemetry-kpis.json");
const dashboardRaw = readText(dashboardPath);
const dashboard = parseJsonWithTemplatePlaceholders(dashboardRaw, dashboardPath);

assert(typeof dashboard.displayName === "string" && dashboard.displayName.length > 0, "Dashboard displayName must be set.");
assert(dashboard.mosaicLayout && typeof dashboard.mosaicLayout === "object", "Dashboard mosaicLayout is required.");
assert(Array.isArray(dashboard.mosaicLayout.tiles), "Dashboard mosaicLayout.tiles must be an array.");
assert(dashboard.mosaicLayout.tiles.length >= 1, "Dashboard should define at least one tile.");

const alertFiles = readdirSync(monitoringDir).filter((file) => file.startsWith("alert-policy.") && file.endsWith(".json"));
assert(alertFiles.length >= 3, "Expected at least 3 alert policy templates.");

for (const file of alertFiles) {
  const fullPath = join(monitoringDir, file);
  const raw = readText(fullPath);
  assert(raw.includes("__NOTIFICATION_CHANNELS__"), `Alert template missing __NOTIFICATION_CHANNELS__ placeholder: ${file}`);

  const policy = parseJsonWithTemplatePlaceholders(raw, fullPath);
  assert(typeof policy.displayName === "string" && policy.displayName.length > 0, `${file}: displayName is required.`);
  assert(Array.isArray(policy.conditions) && policy.conditions.length >= 1, `${file}: at least one condition is required.`);
  assert(Array.isArray(policy.notificationChannels), `${file}: notificationChannels must render as array.`);

  for (const [index, condition] of policy.conditions.entries()) {
    assert(condition.conditionThreshold, `${file}: condition ${index} missing conditionThreshold.`);
    assert(
      typeof condition.conditionThreshold.filter === "string" && condition.conditionThreshold.filter.length > 0,
      `${file}: condition ${index} filter is required.`,
    );
    assert(
      Array.isArray(condition.conditionThreshold.aggregations) &&
        condition.conditionThreshold.aggregations.length >= 1,
      `${file}: condition ${index} must define aggregations.`,
    );
  }
}

console.log(`[monitoring-validate] OK (${alertFiles.length} alert templates + dashboard validated)`);
