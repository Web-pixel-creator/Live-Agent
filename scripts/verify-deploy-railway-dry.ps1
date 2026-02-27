[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

$testFiles = @(
  "tests/unit/public-badge-check-alignment.test.ts",
  "tests/unit/railway-deploy-alignment.test.ts",
  "tests/unit/railway-deploy-frontend-alignment.test.ts",
  "tests/unit/railway-deploy-all-alignment.test.ts",
  "tests/unit/railway-deploy-all-dispatch-alignment.test.ts",
  "tests/unit/railway-deploy-all-workflow-alignment.test.ts",
  "tests/unit/release-strict-dispatch-alignment.test.ts",
  "tests/unit/release-strict-workflow-alignment.test.ts",
  "tests/unit/workflow-dispatch-alignment.test.ts",
  "tests/unit/workflow-dispatch-defaults-alignment.test.ts",
  "tests/unit/workflow-dispatch-flag-parity-alignment.test.ts",
  "tests/unit/workflow-dispatch-dry-run-smoke.test.ts",
  "tests/unit/railway-deploy-public-badge-flow-smoke.test.ts",
  "tests/unit/railway-runtime-start-command-alignment.test.ts",
  "tests/unit/repo-publish-release-gate-alignment.test.ts",
  "tests/unit/repo-publish-railway-forwarding-smoke.test.ts"
)

foreach ($testFile in $testFiles) {
  if (-not (Test-Path $testFile)) {
    Fail "Missing contract test file: $testFile"
  }
}

Write-Host "[verify-deploy-railway-dry] Running deploy-contract checks..."
$nodeArgs = @("--import", "tsx", "--test") + $testFiles
& node @nodeArgs
if ($LASTEXITCODE -ne 0) {
  Fail "Deploy-contract checks failed."
}

Write-Host "[verify-deploy-railway-dry] Deploy-contract checks passed."
