import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts", "perf-load-policy-check.mjs");

function createPassingPerfSummary(): Record<string, unknown> {
  return {
    success: true,
    workloads: [
      {
        name: "live_voice_translation",
        latencyMs: { p95: 1200 },
        success: 4,
      },
      {
        name: "ui_navigation_execution",
        latencyMs: { p95: 6000 },
        success: 4,
        adapterModes: {
          remote_http: 4,
        },
      },
      {
        name: "gateway_ws_request_replay",
        latencyMs: { p95: 2500 },
        errorRatePct: 0,
        success: 3,
        contract: {
          responseIdReusedAll: true,
          taskStartedExactlyOneAll: true,
        },
      },
    ],
    aggregate: {
      errorRatePct: 0,
    },
  };
}

function runPolicyCheck(
  summary: Record<string, unknown>,
): {
  exitCode: number;
  stdout: string;
  stderr: string;
  outputJson: Record<string, unknown> | null;
} {
  const tempDir = mkdtempSync(join(tmpdir(), "mla-perf-policy-"));
  try {
    const inputPath = join(tempDir, "summary.json");
    const outputPath = join(tempDir, "policy.md");
    const jsonOutputPath = join(tempDir, "policy.json");
    writeFileSync(inputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [scriptPath, "--input", inputPath, "--output", outputPath, "--jsonOutput", jsonOutputPath],
      { encoding: "utf8" },
    );

    let outputJson: Record<string, unknown> | null = null;
    try {
      const rawJson = readFileSync(jsonOutputPath, "utf8");
      outputJson = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      outputJson = null;
    }

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      outputJson,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("perf-load-policy-check passes for healthy summary", () => {
  const result = runPolicyCheck(createPassingPerfSummary());
  assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  assert.ok(result.outputJson);
  assert.equal(result.outputJson?.ok, true);
  assert.equal(result.outputJson?.checks, 15);
});

test("perf-load-policy-check fails when required ui adapter mode is missing", () => {
  const summary = createPassingPerfSummary();
  const workloads = Array.isArray(summary.workloads) ? summary.workloads : [];
  const uiWorkload = workloads.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { name?: string }).name === "ui_navigation_execution",
  ) as { adapterModes?: Record<string, number> } | undefined;
  if (uiWorkload) {
    uiWorkload.adapterModes = {};
  }

  const result = runPolicyCheck(summary);
  assert.equal(result.exitCode, 1);
  const output = `${result.stderr}\n${result.stdout}`;
  assert.match(output, /workload\.ui\.adapterMode\.remote_http/i);
});

test("perf-load-policy-check fails when gateway replay contract is broken", () => {
  const summary = createPassingPerfSummary();
  const workloads = Array.isArray(summary.workloads) ? summary.workloads : [];
  const replayWorkload = workloads.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { name?: string }).name === "gateway_ws_request_replay",
  ) as { contract?: { responseIdReusedAll?: boolean; taskStartedExactlyOneAll?: boolean } } | undefined;
  if (replayWorkload && replayWorkload.contract) {
    replayWorkload.contract.taskStartedExactlyOneAll = false;
  }

  const result = runPolicyCheck(summary);
  assert.equal(result.exitCode, 1);
  const output = `${result.stderr}\n${result.stdout}`;
  assert.match(output, /workload\.gateway_replay\.contract\.taskStartedExactlyOneAll/i);
});
