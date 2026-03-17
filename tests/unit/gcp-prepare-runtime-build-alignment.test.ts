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

test("prepare judge runtime wires secret sync and Cloud Build image publish", () => {
  const scriptPath = resolve(process.cwd(), "infra", "gcp", "prepare-judge-runtime.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /sync-runtime-secrets\.ps1/);
  assert.match(source, /build-cloud-run-images\.ps1/);
  assert.match(source, /SkipSecretSync/);
  assert.match(source, /SkipCloudRunBuild/);
  assert.match(source, /Sync runtime secrets into Secret Manager/);
  assert.match(source, /Build Cloud Run images in Artifact Registry/);
});

test("GCP docs mention source image build and dotenv-backed secret sync", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const quickstart = readFileSync(resolve(process.cwd(), "docs", "judge-quickstart.md"), "utf8");
  const gcpReadme = readFileSync(resolve(process.cwd(), "infra", "gcp", "README.md"), "utf8");

  for (const content of [readme, quickstart, gcpReadme]) {
    assert.match(content, /build-cloud-run-images\.ps1|Cloud Build/);
    assert.match(content, /sync-runtime-secrets\.ps1|Secret Manager/);
    assert.match(content, /\.env/);
  }
});

test(
  "prepare judge runtime parses in PowerShell",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const scriptPath = resolve(process.cwd(), "infra", "gcp", "prepare-judge-runtime.ps1");
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
