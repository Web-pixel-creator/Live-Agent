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

  $requiredSummaryScenarios = @(
    "gateway.websocket.binding_mismatch",
    "gateway.websocket.draining_rejection",
    "api.sessions.versioning"
  )
  foreach ($requiredScenario in $requiredSummaryScenarios) {
    $scenarioRecord = @($summary.scenarios | Where-Object { $_.name -eq $requiredScenario } | Select-Object -First 1)
    if ($scenarioRecord.Count -eq 0) {
      Fail ("Required scenario missing in summary: " + $requiredScenario)
    }
    if ($scenarioRecord[0].status -ne "passed") {
      Fail ("Required scenario did not pass: " + $requiredScenario + " (status=" + $scenarioRecord[0].status + ")")
    }
  }

  $criticalKpiChecks = @{
    gatewayWsBindingMismatchValidated = $true
    gatewayWsDrainingValidated = $true
    sessionVersioningValidated = $true
    operatorTaskQueueSummaryValidated = $true
  }
  foreach ($kpiName in $criticalKpiChecks.Keys) {
    $expectedValue = $criticalKpiChecks[$kpiName]
    $actualValue = $summary.kpis.$kpiName
    if ($actualValue -ne $expectedValue) {
      Fail ("Critical KPI check failed: " + $kpiName + " expected " + $expectedValue + ", actual " + $actualValue)
    }
  }

  $taskQueuePressureLevel = [string]$summary.kpis.operatorTaskQueuePressureLevel
  $allowedTaskQueuePressureLevels = @("idle", "healthy", "elevated")
  if (-not ($allowedTaskQueuePressureLevels -contains $taskQueuePressureLevel)) {
    Fail ("Critical KPI check failed: operatorTaskQueuePressureLevel expected one of [" + ($allowedTaskQueuePressureLevels -join ", ") + "], actual " + $taskQueuePressureLevel)
  }

  $taskQueueTotal = [int]$summary.kpis.operatorTaskQueueTotal
  if ($taskQueueTotal -lt 1) {
    Fail ("Critical KPI check failed: operatorTaskQueueTotal expected >= 1, actual " + $taskQueueTotal)
  }

  $taskQueueStaleCount = [int]$summary.kpis.operatorTaskQueueStaleCount
  if ($taskQueueStaleCount -lt 0) {
    Fail ("Critical KPI check failed: operatorTaskQueueStaleCount expected >= 0, actual " + $taskQueueStaleCount)
  }

  $taskQueuePendingApproval = [int]$summary.kpis.operatorTaskQueuePendingApproval
  if ($taskQueuePendingApproval -lt 0) {
    Fail ("Critical KPI check failed: operatorTaskQueuePendingApproval expected >= 0, actual " + $taskQueuePendingApproval)
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
  $gatewayRoundTrip = $summary.kpis.gatewayWsRoundTripMs
  if ($null -ne $gatewayRoundTrip) {
    Write-Host ("gateway.ws.roundtrip.ms: " + $gatewayRoundTrip)
  }
  $drainCode = $summary.kpis.gatewayWsDrainingCode
  $drainValidated = $summary.kpis.gatewayWsDrainingValidated
  if ($null -ne $drainCode -or $null -ne $drainValidated) {
    Write-Host ("gateway.ws.draining: code=" + $drainCode + ", validated=" + $drainValidated)
  }
  $bindingValidated = $summary.kpis.gatewayWsBindingMismatchValidated
  if ($null -ne $bindingValidated) {
    Write-Host ("gateway.ws.binding.validated: " + $bindingValidated)
  }
  $sessionVersioningValidated = $summary.kpis.sessionVersioningValidated
  if ($null -ne $sessionVersioningValidated) {
    Write-Host ("api.sessions.versioning.validated: " + $sessionVersioningValidated)
  }
  $taskQueueValidated = $summary.kpis.operatorTaskQueueSummaryValidated
  $taskQueueLevel = $summary.kpis.operatorTaskQueuePressureLevel
  $taskQueueTotal = $summary.kpis.operatorTaskQueueTotal
  $taskQueuePending = $summary.kpis.operatorTaskQueuePendingApproval
  $taskQueueStale = $summary.kpis.operatorTaskQueueStaleCount
  if (
    $null -ne $taskQueueValidated -or
    $null -ne $taskQueueLevel -or
    $null -ne $taskQueueTotal -or
    $null -ne $taskQueuePending -or
    $null -ne $taskQueueStale
  ) {
    Write-Host ("operator.task_queue: validated=" + $taskQueueValidated + ", level=" + $taskQueueLevel + ", total=" + $taskQueueTotal + ", pending=" + $taskQueuePending + ", stale=" + $taskQueueStale)
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
