import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const smokeScriptPath = resolve(process.cwd(), "scripts", "release-artifact-only-smoke.ps1");

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

test("artifact-only smoke script is wired to release-readiness with local artifacts", () => {
  const source = readFileSync(smokeScriptPath, "utf8");

  assert.match(source, /release-readiness\.ps1/);
  assert.match(source, /source-run\.json/);
  assert.match(source, /perf-load/);
  assert.match(source, /-SkipDemoE2E/);
  assert.match(source, /-SkipPolicy/);
  assert.match(source, /-SkipBadge/);
  assert.match(source, /-SkipPerfRun/);
  assert.match(source, /-SourceRunManifestPath/);
  assert.match(source, /-PerfSummaryPath/);
  assert.match(source, /-PerfPolicyPath/);
  assert.match(source, /-StrictFinalRun/);
  assert.match(source, /evidenceSnapshot/);
  assert.match(source, /operatorDamageControlSummaryValidated/);
  assert.match(source, /badgeEvidenceOperatorDamageControlStatus/);
});

test(
  "artifact-only smoke script passes end-to-end with generated local artifacts",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const result = spawnSync(
      powershellBin,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        smokeScriptPath,
      ],
      {
        encoding: "utf8",
      },
    );

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.status ?? 1, 0, output);
    assert.match(output, /\[artifact-only-smoke\] Passed/i);
    assert.match(output, /release readiness check passed/i);
    assert.match(output, /artifact\.source_run_manifest:/i);
  },
);
