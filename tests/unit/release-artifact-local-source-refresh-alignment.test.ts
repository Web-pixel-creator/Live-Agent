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

test("local source-run refresh helper is exposed via npm alias", () => {
  const packagePath = resolve(process.cwd(), "package.json");
  const pkgRaw = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };

  const alias = pkg.scripts?.["verify:release:artifact:refresh-local-source"] ?? "";
  assert.match(alias, /release-artifact-local-source-refresh\.ps1/);
});

test("local source-run refresh helper keeps expected evidence and branch-guard inputs", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-local-source-refresh.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /demo-e2e\/summary\.json/);
  assert.match(source, /demo-e2e\/badge-details\.json/);
  assert.match(source, /release-evidence\/report\.json/);
  assert.match(source, /deploy\/railway-deploy-summary\.json/);
  assert.match(source, /deploy\/repo-publish-summary\.json/);
  assert.match(source, /release-evidence-report\.ps1/);
  assert.match(source, /release-artifact-revalidation\/source-run\.json/);
  assert.match(source, /local-artifact-refresh/);
  assert.match(source, /Resolve-RepositoryIdentity/);
  assert.match(source, /Resolve-BranchSelection/);
  assert.match(source, /git -C/);
  assert.match(source, /allowAnySourceBranch/);
  assert.match(source, /allowedBranches/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths/);
  assert.match(source, /badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath/);
  assert.match(source, /badgeEvidenceProviderUsageStatus/);
  assert.match(source, /badgeEvidenceProviderUsageValidated/);
  assert.match(source, /badgeEvidenceProviderUsageActiveSecondaryProviders/);
  assert.match(source, /badgeEvidenceProviderUsageEntriesCount/);
  assert.match(source, /badgeEvidenceProviderUsagePrimaryEntry/);
  assert.match(source, /badgeEvidenceDeviceNodeUpdatesStatus/);
  assert.match(source, /Source run manifest written/);
});

test("local source-run refresh helper docs stay aligned", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const localDevelopment = readFileSync(resolve(process.cwd(), "docs", "local-development.md"), "utf8");
  const challengeRunbook = readFileSync(resolve(process.cwd(), "docs", "challenge-demo-runbook.md"), "utf8");

  for (const content of [readme, localDevelopment, challengeRunbook]) {
    assert.match(content, /verify:release:artifact:refresh-local-source/);
    assert.match(content, /source-run\.json/);
  }
});

test(
  "local source-run refresh helper parses in PowerShell",
  { skip: skipIfNoPowerShell },
  () => {
    if (!powershellBin) {
      throw new Error("PowerShell binary is not available");
    }

    const scriptPath = resolve(process.cwd(), "scripts", "release-artifact-local-source-refresh.ps1");
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
