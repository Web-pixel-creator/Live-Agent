import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts", "autoresearch-harness.mjs");
const scriptModuleUrl = pathToFileURL(scriptPath).href;

test("autoresearch harness resolves metric paths with array where selectors", async () => {
  const { resolvePathValue } = await import(scriptModuleUrl);
  const source = {
    workloads: [
      { name: "live_voice_translation", latencyMs: { p95: 35.75 } },
      { name: "ui_navigation_execution", latencyMs: { p95: 11 } },
    ],
  };

  const value = resolvePathValue(source, [
    "workloads",
    { where: { name: "live_voice_translation" } },
    "latencyMs",
    "p95",
  ]);

  assert.equal(value, 35.75);
});

test("autoresearch harness evaluates guardrails with mixed numeric and boolean checks", async () => {
  const { evaluateGuardrails } = await import(scriptModuleUrl);
  const source = {
    aggregate: { errorRatePct: 0 },
    workloads: [
      {
        name: "gateway_ws_request_replay",
        contract: {
          responseIdReusedAll: true,
        },
      },
    ],
  };

  const results = evaluateGuardrails(source, [
    {
      label: "aggregate.errorRatePct",
      path: ["aggregate", "errorRatePct"],
      op: "<=",
      value: 0,
    },
    {
      label: "gateway_ws_request_replay.contract.responseIdReusedAll",
      path: ["workloads", { where: { name: "gateway_ws_request_replay" } }, "contract", "responseIdReusedAll"],
      op: "==",
      value: true,
    },
  ]);

  assert.equal(results.length, 2);
  assert.equal(results.every((entry: { passed: boolean }) => entry.passed), true);
});

test("autoresearch harness CLI records keep baseline and writes report artifacts", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "mla-autoresearch-"));
  try {
    const summaryPath = join(tempDir, "summary.json");
    const generatorPath = join(tempDir, "generate-summary.mjs");
    const configPath = join(tempDir, "config.json");
    const reportPath = join(tempDir, "out", "last-run.json");
    const resultsPath = join(tempDir, "out", "results.tsv");
    const logPath = join(tempDir, "out", "run.log");

    writeFileSync(
      generatorPath,
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(summaryPath)}, JSON.stringify({ aggregate: { errorRatePct: 0 }, workloads: [{ name: "live_voice_translation", latencyMs: { p95: 42 } }] }, null, 2));`,
      ].join("\n"),
      "utf8",
    );

    writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          name: "runtime-perf-test",
          cwd: tempDir,
          runCommand: `${JSON.stringify(process.execPath)} ${JSON.stringify(generatorPath)}`,
          budgetSeconds: 30,
          metric: {
            label: "live_voice_translation.p95",
            artifactPath: summaryPath,
            path: ["workloads", { where: { name: "live_voice_translation" } }, "latencyMs", "p95"],
            objective: "minimize",
            unit: "ms",
          },
          guardrails: [
            {
              label: "aggregate.errorRatePct",
              path: ["aggregate", "errorRatePct"],
              op: "<=",
              value: 0,
            },
          ],
          resultsPath,
          reportPath,
          logPath,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = spawnSync(process.execPath, [scriptPath, "--config", configPath, "--description", "baseline"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      decision: { status: string; reason: string };
      metric: { currentValue: number; bestKeptValue: number | null };
    };
    assert.equal(report.decision.status, "keep");
    assert.equal(report.decision.reason, "baseline");
    assert.equal(report.metric.currentValue, 42);
    assert.equal(report.metric.bestKeptValue, null);

    const resultsTsv = readFileSync(resultsPath, "utf8");
    assert.match(resultsTsv, /^commit\tmetric\tstatus\tdescription/m);
    assert.match(resultsTsv, /\t42\tkeep\tbaseline/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
