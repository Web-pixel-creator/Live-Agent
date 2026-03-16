import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

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

test("perf-load script enforces remote_http runtime defaults for release verification", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "perf-load.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /function Set-EnvValue/);
  assert.match(source, /Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_MODE" -Value "remote_http"/);
  assert.match(source, /Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_URL" -Value "http:\/\/localhost:8090"/);
  assert.match(source, /Set-EnvValue -Name "UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE" -Value "failed"/);
  assert.match(source, /Set-EnvValue -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "true"/);
});

test("perf-load script probes remote_http readiness before the perf workload", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "perf-load.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /function Get-ObjectPropertyValue/);
  assert.match(source, /function Confirm-UiNavigatorRemoteHttpReadiness/);
  assert.match(source, /Invoke-RestMethod -Method POST -Uri \$OrchestratorUrl -ContentType "application\/json"/);
  assert.match(source, /UI navigator remote_http readiness check failed/);
  assert.match(
    source,
    /if \(\$RequiredUiAdapterMode -eq "remote_http"\)\s*\{[\s\S]*Confirm-UiNavigatorRemoteHttpReadiness -OrchestratorUrl "http:\/\/127\.0\.0\.1:8082\/orchestrate" -ExpectedAdapterMode \$RequiredUiAdapterMode/,
  );
});

test(
  "perf-load script parses in PowerShell",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const scriptPath = resolve(process.cwd(), "scripts", "perf-load.ps1");
    const parseCommand = [
      "$errors = $null;",
      `[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '${scriptPath.replace(/'/g, "''")}'), [ref]$null, [ref]$errors);`,
      "if ($errors) { $errors | ForEach-Object { $_.ToString() }; exit 1 }",
    ].join(" ");
    const result = spawnSync(
      powershellBin,
      ["-NoProfile", "-Command", parseCommand],
      {
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);
