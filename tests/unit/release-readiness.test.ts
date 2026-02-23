import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const releaseScriptPath = resolve(process.cwd(), "scripts", "release-readiness.ps1");

function resolvePowerShellBinary(): string | null {
  const candidates = process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const powershellBin = resolvePowerShellBinary();
const skipIfNoPowerShell = powershellBin ? false : "PowerShell binary is not available";

function createPassingSummary(
  overrides: Partial<{
    pressureLevel: string;
    queueTotal: number;
    queueStale: number;
    queuePending: number;
    gatewayRoundTripMs: number;
    gatewayInterruptLatencyMs: number | null;
    gatewayInterruptEventType: string;
    serviceStartMaxAttempts: number | string;
    serviceStartRetryBackoffMs: number | string;
  }> = {},
): Record<string, unknown> {
  return {
    success: true,
    scenarios: [
      { name: "gateway.websocket.binding_mismatch", status: "passed" },
      { name: "gateway.websocket.draining_rejection", status: "passed" },
      { name: "api.sessions.versioning", status: "passed" },
    ],
    kpis: {
      gatewayWsBindingMismatchValidated: true,
      gatewayWsDrainingValidated: true,
      sessionVersioningValidated: true,
      operatorTaskQueueSummaryValidated: true,
      operatorTaskQueuePressureLevel: overrides.pressureLevel ?? "healthy",
      operatorTaskQueueTotal: overrides.queueTotal ?? 1,
      operatorTaskQueueStaleCount: overrides.queueStale ?? 0,
      operatorTaskQueuePendingApproval: overrides.queuePending ?? 0,
      gatewayWsRoundTripMs: overrides.gatewayRoundTripMs ?? 120,
      gatewayInterruptLatencyMs: overrides.gatewayInterruptLatencyMs ?? 120,
      gatewayInterruptEventType: overrides.gatewayInterruptEventType ?? "live.interrupt.requested",
    },
    options: {
      serviceStartMaxAttempts: overrides.serviceStartMaxAttempts ?? "2",
      serviceStartRetryBackoffMs: overrides.serviceStartRetryBackoffMs ?? "1200",
    },
  };
}

function runReleaseReadiness(summary: Record<string, unknown>): { exitCode: number; stdout: string; stderr: string } {
  if (!powershellBin) {
    throw new Error("PowerShell binary is not available");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mla-release-readiness-"));
  try {
    const summaryPath = join(tempDir, "summary.json");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    const result = spawnSync(
      powershellBin,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        releaseScriptPath,
        "-SkipBuild",
        "-SkipUnitTests",
        "-SkipMonitoringTemplates",
        "-SkipProfileSmoke",
        "-SkipPolicy",
        "-SkipBadge",
        "-SkipPerfLoad",
        "-SkipDemoRun",
        "-SummaryPath",
        summaryPath,
      ],
      {
        encoding: "utf8",
      },
    );

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test(
  "release-readiness passes with healthy operator task queue pressure",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary());
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when operator task queue pressure is critical",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ pressureLevel: "critical" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTaskQueuePressureLevel expected one of \[idle, healthy, elevated\]/i);
    assert.match(output, /actual\s+crit\s*ical/i);
  },
);

test(
  "release-readiness fails when required summary scenario is missing",
  { skip: skipIfNoPowerShell },
  () => {
    const summary = createPassingSummary();
    summary.scenarios = [{ name: "gateway.websocket.binding_mismatch", status: "passed" }];

    const result = runReleaseReadiness(summary);
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /Required scenario missing in summary:\s*gateway\.websocket\.draining_rejection/i);
  },
);

test(
  "release-readiness fails when operator task queue total is below one",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ queueTotal: 0 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /operatorTaskQueueTotal expected >= 1, actual 0/i);
  },
);

test(
  "release-readiness fails when gateway websocket roundtrip exceeds threshold",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayRoundTripMs: 2001 }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayWsRoundTripMs expected <= 1800, actual 2001/i);
  },
);

test(
  "release-readiness fails when service startup max attempts are below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ serviceStartMaxAttempts: "1" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.serviceStartMaxAttempts expected >= 2, actual 1/i);
  },
);
