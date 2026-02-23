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
    transportModeValidated: boolean | string;
    gatewayTransportActiveMode: string;
    gatewayTransportFallbackActive: boolean | string;
  }> = {},
): Record<string, unknown> {
  const hasOverride = (key: string): boolean => Object.prototype.hasOwnProperty.call(overrides, key);
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
      operatorTaskQueuePressureLevel: hasOverride("pressureLevel") ? overrides.pressureLevel : "healthy",
      operatorTaskQueueTotal: hasOverride("queueTotal") ? overrides.queueTotal : 1,
      operatorTaskQueueStaleCount: hasOverride("queueStale") ? overrides.queueStale : 0,
      operatorTaskQueuePendingApproval: hasOverride("queuePending") ? overrides.queuePending : 0,
      gatewayWsRoundTripMs: hasOverride("gatewayRoundTripMs") ? overrides.gatewayRoundTripMs : 120,
      gatewayInterruptLatencyMs: hasOverride("gatewayInterruptLatencyMs") ? overrides.gatewayInterruptLatencyMs : 120,
      gatewayInterruptEventType: hasOverride("gatewayInterruptEventType")
        ? overrides.gatewayInterruptEventType
        : "live.interrupt.requested",
      transportModeValidated: hasOverride("transportModeValidated") ? overrides.transportModeValidated : true,
      gatewayTransportActiveMode: hasOverride("gatewayTransportActiveMode")
        ? overrides.gatewayTransportActiveMode
        : "websocket",
      gatewayTransportFallbackActive: hasOverride("gatewayTransportFallbackActive")
        ? overrides.gatewayTransportFallbackActive
        : false,
    },
    options: {
      serviceStartMaxAttempts: hasOverride("serviceStartMaxAttempts") ? overrides.serviceStartMaxAttempts : "2",
      serviceStartRetryBackoffMs: hasOverride("serviceStartRetryBackoffMs")
        ? overrides.serviceStartRetryBackoffMs
        : "1200",
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

test(
  "release-readiness allows missing interrupt latency when bridge is unavailable",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayInterruptLatencyMs: null,
        gatewayInterruptEventType: "live.bridge.unavailable",
      }),
    );
    assert.equal(result.exitCode, 0, `${result.stderr}\n${result.stdout}`);
  },
);

test(
  "release-readiness fails when interrupt latency is missing for non-unavailable event",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(
      createPassingSummary({
        gatewayInterruptLatencyMs: null,
        gatewayInterruptEventType: "live.interrupt.requested",
      }),
    );
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayInterruptLatencyMs is missing and gatewayInterruptEventType is not live\.bridge/i);
    assert.match(output, /actual live\.interrupt\.requested/i);
  },
);

test(
  "release-readiness fails when service startup retry backoff is below minimum",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ serviceStartRetryBackoffMs: "200" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /options\.serviceStartRetryBackoffMs expected >= 300, actual 200/i);
  },
);

test(
  "release-readiness fails when transport mode KPI is not validated",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ transportModeValidated: false }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /transportModeValidated expected True, actual False/i);
  },
);

test(
  "release-readiness fails when gateway active transport mode is not websocket",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayTransportActiveMode: "webrtc" }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayTransportActiveMode expected websocket, actual webrtc/i);
  },
);

test(
  "release-readiness fails when gateway transport fallback remains active",
  { skip: skipIfNoPowerShell },
  () => {
    const result = runReleaseReadiness(createPassingSummary({ gatewayTransportFallbackActive: true }));
    assert.equal(result.exitCode, 1);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /gatewayTransportFallbackActive expected False, actual True/i);
  },
);
