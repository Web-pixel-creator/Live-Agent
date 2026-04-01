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

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function expectIncludes(source, tokens, label, violations) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      violations.push(`${label} missing token: ${token}`);
    }
  }
}

function expectScript(packageScripts, name, expectedCommand, violations) {
  const actual = typeof packageScripts?.[name] === "string" ? packageScripts[name] : "";
  if (actual !== expectedCommand) {
    violations.push(`package.json scripts.${name} expected "${expectedCommand}", got "${actual || "missing"}"`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotPath = resolve(args.snapshot ?? "artifacts/runtime/runtime-surface-snapshot.json");
  const manifestPath = resolve(args.manifest ?? "configs/runtime-surface-manifest.json");
  const packagePath = resolve(args.package ?? "package.json");
  const readmePath = resolve(args.readme ?? "README.md");
  const architecturePath = resolve(args.architecture ?? "docs/architecture.md");
  const operatorGuidePath = resolve(args.operatorGuide ?? "docs/operator-guide.md");
  const outputPath = resolve(args.output ?? "artifacts/runtime/runtime-surface-doc-drift.json");

  const [snapshot, manifest, packageJson, readme, architecture, operatorGuide] = await Promise.all([
    readJson(snapshotPath),
    readJson(manifestPath),
    readJson(packagePath),
    readFile(readmePath, "utf8"),
    readFile(architecturePath, "utf8"),
    readFile(operatorGuidePath, "utf8"),
  ]);

  const violations = [];

  if (snapshot?.source !== "repo_owned_runtime_surface_snapshot") {
    violations.push(
      `snapshot.source expected repo_owned_runtime_surface_snapshot, got ${String(snapshot?.source ?? "missing")}`,
    );
  }
  if (manifest?.source !== "repo_owned_runtime_surface_manifest") {
    violations.push(
      `manifest.source expected repo_owned_runtime_surface_manifest, got ${String(manifest?.source ?? "missing")}`,
    );
  }
  if (snapshot?.inventory?.source !== "repo_owned_runtime_surface_inventory") {
    violations.push(
      `snapshot.inventory.source expected repo_owned_runtime_surface_inventory, got ${String(snapshot?.inventory?.source ?? "missing")}`,
    );
  }
  if (snapshot?.readiness?.source !== "repo_owned_runtime_surface_readiness") {
    violations.push(
      `snapshot.readiness.source expected repo_owned_runtime_surface_readiness, got ${String(snapshot?.readiness?.source ?? "missing")}`,
    );
  }

  const scripts = isRecord(packageJson?.scripts) ? packageJson.scripts : {};
  expectScript(
    scripts,
    "runtime:surface:snapshot",
    "node --import tsx ./scripts/runtime-surface-snapshot.mjs --output ./artifacts/runtime/runtime-surface-snapshot.json",
    violations,
  );
  expectScript(
    scripts,
    "runtime:surface:parity",
    "node ./scripts/runtime-surface-parity-check.mjs --snapshot ./artifacts/runtime/runtime-surface-snapshot.json --manifest ./configs/runtime-surface-manifest.json --output ./artifacts/runtime/runtime-surface-parity.json",
    violations,
  );
  expectScript(
    scripts,
    "runtime:surface:doc-drift",
    "node ./scripts/runtime-surface-doc-drift-check.mjs --snapshot ./artifacts/runtime/runtime-surface-snapshot.json --manifest ./configs/runtime-surface-manifest.json --readme ./README.md --architecture ./docs/architecture.md --operatorGuide ./docs/operator-guide.md --package ./package.json --output ./artifacts/runtime/runtime-surface-doc-drift.json",
    violations,
  );

  expectIncludes(
    readme,
    [
      "GET /v1/runtime/surface",
      "GET /v1/runtime/surface/readiness",
      "npm run runtime:surface:snapshot",
      "artifacts/runtime/runtime-surface-snapshot.json",
      "npm run runtime:surface:parity",
      "configs/runtime-surface-manifest.json",
      "artifacts/runtime/runtime-surface-parity.json",
      "npm run runtime:surface:doc-drift",
      "artifacts/runtime/runtime-surface-doc-drift.json",
      "Runtime Surface",
    ],
    "README.md",
    violations,
  );
  expectIncludes(
    architecture,
    [
      "runtime surface contract",
      "scripts/runtime-surface-snapshot.mjs",
      "scripts/runtime-surface-parity-check.mjs",
      "scripts/runtime-surface-doc-drift-check.mjs",
      "configs/runtime-surface-manifest.json",
      "artifacts/runtime/runtime-surface-snapshot.json",
    ],
    "docs/architecture.md",
    violations,
  );
  expectIncludes(
    operatorGuide,
    [
      "Runtime surface inventory note:",
      "Runtime surface readiness note:",
      "Runtime surface artifact note:",
      "Runtime surface parity note:",
      "Runtime surface doc drift note:",
      "npm run runtime:surface:doc-drift",
      "artifacts/runtime/runtime-surface-doc-drift.json",
      "Runtime Surface",
    ],
    "docs/operator-guide.md",
    violations,
  );

  const result = {
    ok: violations.length === 0,
    generatedAt: new Date().toISOString(),
    source: "repo_owned_runtime_surface_doc_drift",
    snapshotPath,
    manifestPath,
    packagePath,
    readmePath,
    architecturePath,
    operatorGuidePath,
    checked: {
      packageScripts: 3,
      readmeTokens: 10,
      architectureTokens: 6,
      operatorGuideTokens: 8,
    },
    violations,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
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
