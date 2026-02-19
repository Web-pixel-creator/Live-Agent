[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipDemoE2E,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [string]$SummaryPath = "artifacts/demo-e2e/summary.json",
  [string]$PolicyPath = "artifacts/demo-e2e/policy-check.json",
  [string]$BadgePath = "artifacts/demo-e2e/badge.json"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Run-Step([string]$Name, [string]$Command) {
  Write-Host "[release-check] $Name"
  & cmd.exe /c $Command
  if ($LASTEXITCODE -ne 0) {
    Fail "Step failed: $Name"
  }
}

if (-not $SkipBuild) {
  Run-Step "Build workspaces" "npm run build"
}

if (-not $SkipDemoE2E) {
  Run-Step "Run demo e2e" "npm run demo:e2e"
}

if (-not $SkipPolicy) {
  Run-Step "Run policy gate" "npm run demo:e2e:policy"
}

if (-not $SkipBadge) {
  Run-Step "Generate badge artifact" "npm run demo:e2e:badge"
}

$requiredFiles = @()
if (-not $SkipDemoE2E) {
  $requiredFiles += $SummaryPath
}
if (-not $SkipPolicy) {
  $requiredFiles += $PolicyPath
}
if (-not $SkipBadge) {
  $requiredFiles += $BadgePath
}

$missing = @($requiredFiles | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  Fail ("Missing required artifacts: " + ($missing -join ", "))
}

if (Test-Path $SummaryPath) {
  $summary = Get-Content $SummaryPath -Raw | ConvertFrom-Json
  if (-not $summary.success) {
    Fail "summary.success is false"
  }

  $failedScenarios = @($summary.scenarios | Where-Object { $_.status -ne "passed" })
  if ($failedScenarios.Count -gt 0) {
    $names = $failedScenarios | ForEach-Object { $_.name }
    Fail ("One or more scenarios failed: " + ($names -join ", "))
  }
}

if (Test-Path $PolicyPath) {
  $policy = Get-Content $PolicyPath -Raw | ConvertFrom-Json
  if (-not $policy.ok) {
    Fail "policy-check result is not ok"
  }
}

if (Test-Path $BadgePath) {
  $badge = Get-Content $BadgePath -Raw | ConvertFrom-Json
  $badgeProps = @($badge.PSObject.Properties.Name)
  $missingBadgeFields = @("schemaVersion", "label", "message", "color" | Where-Object { $badgeProps -notcontains $_ })
  if ($missingBadgeFields.Count -gt 0) {
    Fail ("badge.json missing fields: " + ($missingBadgeFields -join ", "))
  }
}

Write-Host ""
Write-Host "Release readiness check passed."
if (Test-Path $SummaryPath) {
  $summary = Get-Content $SummaryPath -Raw | ConvertFrom-Json
  Write-Host ("summary.success: " + $summary.success)
  Write-Host ("scenarios: " + $summary.scenarios.Count)
}
if (Test-Path $PolicyPath) {
  $policy = Get-Content $PolicyPath -Raw | ConvertFrom-Json
  Write-Host ("policy.ok: " + $policy.ok + " (" + $policy.checks + " checks)")
}
if (Test-Path $BadgePath) {
  $badge = Get-Content $BadgePath -Raw | ConvertFrom-Json
  Write-Host ("badge: " + $badge.label + " -> " + $badge.message + " (" + $badge.color + ")")
}
