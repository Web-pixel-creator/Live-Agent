[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipUnitTests,
  [switch]$SkipMonitoringTemplates,
  [switch]$SkipProfileSmoke,
  [switch]$SkipDemoE2E,
  [switch]$UseFastDemoE2E,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [switch]$SkipPerfLoad,
  [int]$DemoStartupTimeoutSec = 90,
  [int]$DemoRequestTimeoutSec = 45,
  [int]$PerfLiveIterations = 6,
  [int]$PerfLiveConcurrency = 2,
  [int]$PerfUiIterations = 6,
  [int]$PerfUiConcurrency = 2,
  [string]$SummaryPath = "artifacts/demo-e2e/summary.json",
  [string]$PolicyPath = "artifacts/demo-e2e/policy-check.json",
  [string]$BadgePath = "artifacts/demo-e2e/badge.json",
  [string]$PerfSummaryPath = "artifacts/perf-load/summary.json",
  [string]$PerfPolicyPath = "artifacts/perf-load/policy-check.json"
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

if (-not $SkipUnitTests) {
  Run-Step "Run unit tests" "npm run test:unit"
}

if (-not $SkipMonitoringTemplates) {
  Run-Step "Validate monitoring templates" "npm run infra:monitoring:validate"
}

if (-not $SkipProfileSmoke) {
  Run-Step "Run runtime profile smoke checks" "npm run profile:smoke"
}

if (-not $SkipDemoE2E) {
  $runFastDemo = $UseFastDemoE2E -or (-not $SkipBuild)
  $demoCommand = if ($runFastDemo) {
    "npm run demo:e2e:fast -- -StartupTimeoutSec $DemoStartupTimeoutSec -RequestTimeoutSec $DemoRequestTimeoutSec"
  } else {
    "npm run demo:e2e -- -StartupTimeoutSec $DemoStartupTimeoutSec -RequestTimeoutSec $DemoRequestTimeoutSec"
  }
  Run-Step "Run demo e2e" $demoCommand
}

if (-not $SkipPolicy) {
  Run-Step "Run policy gate" "npm run demo:e2e:policy"
}

if (-not $SkipBadge) {
  Run-Step "Generate badge artifact" "npm run demo:e2e:badge"
}

if (-not $SkipPerfLoad) {
  $perfCommand = "npm run perf:load:fast -- -LiveIterations $PerfLiveIterations -LiveConcurrency $PerfLiveConcurrency -UiIterations $PerfUiIterations -UiConcurrency $PerfUiConcurrency"
  Run-Step "Run perf load profile + policy gate" $perfCommand
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
if (-not $SkipPerfLoad) {
  $requiredFiles += $PerfSummaryPath
  $requiredFiles += $PerfPolicyPath
}

$missing = @($requiredFiles | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  Fail ("Missing required artifacts: " + ($missing -join ", "))
}

if ((-not $SkipDemoE2E) -and (Test-Path $SummaryPath)) {
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

if ((-not $SkipPolicy) -and (Test-Path $PolicyPath)) {
  $policy = Get-Content $PolicyPath -Raw | ConvertFrom-Json
  if (-not $policy.ok) {
    Fail "policy-check result is not ok"
  }
}

if ((-not $SkipBadge) -and (Test-Path $BadgePath)) {
  $badge = Get-Content $BadgePath -Raw | ConvertFrom-Json
  $badgeProps = @($badge.PSObject.Properties.Name)
  $missingBadgeFields = @("schemaVersion", "label", "message", "color" | Where-Object { $badgeProps -notcontains $_ })
  if ($missingBadgeFields.Count -gt 0) {
    Fail ("badge.json missing fields: " + ($missingBadgeFields -join ", "))
  }
}

if ((-not $SkipPerfLoad) -and (Test-Path $PerfSummaryPath)) {
  $perfSummary = Get-Content $PerfSummaryPath -Raw | ConvertFrom-Json
  if (-not $perfSummary.success) {
    Fail "perf summary.success is false"
  }
}

if ((-not $SkipPerfLoad) -and (Test-Path $PerfPolicyPath)) {
  $perfPolicy = Get-Content $PerfPolicyPath -Raw | ConvertFrom-Json
  if (-not $perfPolicy.ok) {
    Fail "perf policy-check result is not ok"
  }
}

Write-Host ""
Write-Host "Release readiness check passed."
if ((-not $SkipDemoE2E) -and (Test-Path $SummaryPath)) {
  $summary = Get-Content $SummaryPath -Raw | ConvertFrom-Json
  Write-Host ("summary.success: " + $summary.success)
  Write-Host ("scenarios: " + $summary.scenarios.Count)
  $uiAttempts = $summary.kpis.uiApprovalResumeRequestAttempts
  $uiRetried = $summary.kpis.uiApprovalResumeRequestRetried
  if ($null -ne $uiAttempts -or $null -ne $uiRetried) {
    Write-Host ("ui.approval.resume.request: attempts=" + $uiAttempts + ", retried=" + $uiRetried)
  }
}
if ((-not $SkipPolicy) -and (Test-Path $PolicyPath)) {
  $policy = Get-Content $PolicyPath -Raw | ConvertFrom-Json
  Write-Host ("policy.ok: " + $policy.ok + " (" + $policy.checks + " checks)")
}
if ((-not $SkipBadge) -and (Test-Path $BadgePath)) {
  $badge = Get-Content $BadgePath -Raw | ConvertFrom-Json
  Write-Host ("badge: " + $badge.label + " -> " + $badge.message + " (" + $badge.color + ")")
}
if ((-not $SkipPerfLoad) -and (Test-Path $PerfSummaryPath)) {
  $perfSummary = Get-Content $PerfSummaryPath -Raw | ConvertFrom-Json
  Write-Host ("perf.success: " + $perfSummary.success)
}
if ((-not $SkipPerfLoad) -and (Test-Path $PerfPolicyPath)) {
  $perfPolicy = Get-Content $PerfPolicyPath -Raw | ConvertFrom-Json
  $violationsCount = @($perfPolicy.violations).Count
  Write-Host ("perf.policy.ok: " + $perfPolicy.ok + " (" + $perfPolicy.checks + " checks, violations: " + $violationsCount + ")")
}
