import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("autoresearch integration stays aligned across scripts, docs, and config", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const readmePath = resolve(process.cwd(), "README.md");
  const localDevPath = resolve(process.cwd(), "docs", "local-development.md");
  const docPath = resolve(process.cwd(), "docs", "autoresearch.md");
  const configPath = resolve(process.cwd(), "configs", "autoresearch", "runtime-perf.json");
  const programPath = resolve(process.cwd(), "configs", "autoresearch", "runtime-perf.program.md");

  const packageSource = readFileSync(packagePath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const localDevSource = readFileSync(localDevPath, "utf8");
  const docSource = readFileSync(docPath, "utf8");
  const configSource = readFileSync(configPath, "utf8");
  const programSource = readFileSync(programPath, "utf8");

  assert.match(packageSource, /"autoresearch:runtime-perf": "node \.\/scripts\/autoresearch-harness\.mjs --config \.\/configs\/autoresearch\/runtime-perf\.json"/);

  for (const source of [readmeSource, localDevSource, docSource]) {
    assert.ok(source.includes("npm run autoresearch:runtime-perf"), "docs missing runtime-perf command");
  }

  assert.ok(readmeSource.includes("Autoresearch"), "README missing autoresearch section");
  assert.ok(readmeSource.includes("docs/autoresearch.md"), "README missing docs index entry");

  assert.ok(docSource.includes("karpathy/autoresearch"), "doc missing source repo reference");
  assert.ok(docSource.includes("fixed validation budget"), "doc missing fixed-budget concept");
  assert.ok(docSource.includes("keep"), "doc missing keep/discard/crash contract");

  assert.ok(configSource.includes('"objective": "minimize"'), "runtime-perf config missing objective");
  assert.ok(configSource.includes('"live_voice_translation"'), "runtime-perf config missing workload selector");
  assert.ok(programSource.includes("One runtime or script file at a time"), "program missing single-target rule");
  assert.ok(programSource.includes("keep"), "program missing keep/discard guidance");
});
