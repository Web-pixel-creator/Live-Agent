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

test("submission refresh helper resolves dotenv and Google Live defaults", () => {
  const scriptPath = resolve(process.cwd(), "infra", "gcp", "refresh-submission-pack.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /Read-DotEnvValues/);
  assert.match(source, /Join-Path \$repoRoot "\.env"/);
  assert.match(source, /dotenv:/);
  assert.match(source, /derived-from:/);
  assert.match(source, /default:x-goog-api-key/);
  assert.match(source, /GOOGLE_GENAI_API_KEY available via env, \.env, or Secret Manager/);
  assert.match(source, /LIVE_API_API_KEY available via env, \.env, or Secret Manager/);
  assert.match(source, /LIVE_API_AUTH_HEADER available via env, \.env, or Secret Manager/);
  assert.match(source, /candidateLiveApiEnabled/);
  assert.match(source, /Get-ObjectPropertyValue -Object \$scenarioData -Name "liveApiEnabled"/);
});

test("submission refresh docs mention dotenv-backed key resolution", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const quickstart = readFileSync(resolve(process.cwd(), "docs", "judge-quickstart.md"), "utf8");
  const gcpReadme = readFileSync(resolve(process.cwd(), "infra", "gcp", "README.md"), "utf8");

  for (const content of [readme, quickstart, gcpReadme]) {
    assert.match(content, /\.env/);
    assert.match(content, /LIVE_API_API_KEY/);
    assert.match(content, /x-goog-api-key/);
  }
});

test(
  "submission refresh helper parses in PowerShell",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const scriptPath = resolve(process.cwd(), "infra", "gcp", "refresh-submission-pack.ps1");
    const parseCommand = [
      "$errors = $null;",
      "[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '" + scriptPath.replace(/'/g, "''") + "'), [ref]$null, [ref]$errors);",
      "if ($errors) { $errors | ForEach-Object { $_.ToString() }; exit 1 }",
    ].join(" ");
    const result = spawnSync(
      powershellBin,
      ["-NoProfile", "-Command", parseCommand],
      {
        encoding: "utf8",
      },
    );

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.status ?? 1, 0, output);
  },
);
