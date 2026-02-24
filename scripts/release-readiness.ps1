[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipUnitTests,
  [switch]$SkipMonitoringTemplates,
  [switch]$SkipProfileSmoke,
  [switch]$SkipDemoE2E,
  [switch]$SkipDemoRun,
  [switch]$UseFastDemoE2E,
  [switch]$StrictFinalRun,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [switch]$SkipPerfLoad,
  [switch]$SkipPerfRun,
  [int]$DemoRunMaxAttempts = 2,
  [int]$DemoRunRetryBackoffMs = 2000,
  [int]$DemoScenarioRetryMaxAttempts = 2,
  [int]$DemoScenarioRetryBackoffMs = 900,
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
  [string]$PerfPolicyPath = "artifacts/perf-load/policy-check.json",
  [string]$SourceRunManifestPath = "artifacts/release-artifact-revalidation/source-run.json"
)

$ErrorActionPreference = "Stop"

$ReleaseThresholds = @{
  MaxGatewayWsRoundTripMs = 1800
  MaxGatewayInterruptLatencyMs = 300
  MinServiceStartMaxAttempts = 2
  MinServiceStartRetryBackoffMs = 300
  MinScenarioRetryMaxAttempts = 2
  MinScenarioRetryBackoffMs = 500
  MaxScenarioRetriesUsedCount = 2
  MinAnalyticsServicesValidated = 4
  MinAnalyticsRequestedEnabledServices = 4
  MinAnalyticsEnabledServices = 4
  MaxPerfLiveP95Ms = 1800
  MaxPerfUiP95Ms = 25000
  MaxPerfGatewayReplayP95Ms = 9000
  MaxPerfGatewayReplayErrorRatePct = 20
  MaxPerfAggregateErrorRatePct = 10
  RequiredPerfUiAdapterMode = "remote_http"
  MinPerfPolicyChecks = 15
}

$MaxAllowedScenarioRetriesUsedCount = if ($StrictFinalRun) { 0 } else { $ReleaseThresholds.MaxScenarioRetriesUsedCount }
$IsArtifactOnlyMode = $SkipDemoE2E -and $SkipPolicy -and $SkipBadge

function To-NumberOrNaN([object]$Value) {
  if ($null -eq $Value) {
    return [double]::NaN
  }
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [double]::NaN
  }
  $parsed = 0.0
  $numberStyle = [System.Globalization.NumberStyles]::Float -bor [System.Globalization.NumberStyles]::AllowThousands
  if ([double]::TryParse($raw, $numberStyle, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
    return $parsed
  }
  if ([double]::TryParse($raw, $numberStyle, [System.Globalization.CultureInfo]::CurrentCulture, [ref]$parsed)) {
    return $parsed
  }
  return [double]::NaN
}

function To-BoolOrNull([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }
  if ($Value -is [bool]) {
    return $Value
  }
  $raw = [string]$Value
  if ($raw -match "^(?i:true)$") {
    return $true
  }
  if ($raw -match "^(?i:false)$") {
    return $false
  }
  return $null
}

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

function Run-StepWithRetry(
  [string]$Name,
  [string]$Command,
  [int]$MaxAttempts,
  [int]$BackoffMs
) {
  $attempts = if ($MaxAttempts -lt 1) { 1 } else { $MaxAttempts }
  for ($attempt = 1; $attempt -le $attempts; $attempt += 1) {
    Write-Host ("[release-check] " + $Name + " (attempt " + $attempt + "/" + $attempts + ")")
    & cmd.exe /c $Command
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($attempt -lt $attempts) {
      if ($BackoffMs -gt 0) {
        Write-Host ("[release-check] " + $Name + " failed; retrying after " + $BackoffMs + "ms")
        Start-Sleep -Milliseconds $BackoffMs
      } else {
        Write-Host ("[release-check] " + $Name + " failed; retrying immediately")
      }
    }
  }

  Fail "Step failed after retries: $Name"
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

if ((-not $SkipDemoE2E) -and (-not $SkipDemoRun)) {
  $runFastDemo = $UseFastDemoE2E -or (-not $SkipBuild)
  $scenarioRetryArgs = "-ScenarioRetryMaxAttempts $DemoScenarioRetryMaxAttempts -ScenarioRetryBackoffMs $DemoScenarioRetryBackoffMs"
  $demoCommand = if ($runFastDemo) {
    "npm run demo:e2e:fast -- -StartupTimeoutSec $DemoStartupTimeoutSec -RequestTimeoutSec $DemoRequestTimeoutSec $scenarioRetryArgs"
  } else {
    "npm run demo:e2e -- -StartupTimeoutSec $DemoStartupTimeoutSec -RequestTimeoutSec $DemoRequestTimeoutSec $scenarioRetryArgs"
  }
  Run-StepWithRetry "Run demo e2e" $demoCommand $DemoRunMaxAttempts $DemoRunRetryBackoffMs
}

if (-not $SkipPolicy) {
  $policyCommand = "npm run demo:e2e:policy -- --maxScenarioRetriesUsedCount $MaxAllowedScenarioRetriesUsedCount"
  Run-Step "Run policy gate" $policyCommand
}

if (-not $SkipBadge) {
  Run-Step "Generate badge artifact" "npm run demo:e2e:badge"
}

if (-not $SkipPerfLoad) {
  if (-not $SkipPerfRun) {
    $perfCommand = "npm run perf:load:fast -- -LiveIterations $PerfLiveIterations -LiveConcurrency $PerfLiveConcurrency -UiIterations $PerfUiIterations -UiConcurrency $PerfUiConcurrency"
    Run-Step "Run perf load profile + policy gate" $perfCommand
  } else {
    Write-Host "[release-check] SkipPerfRun enabled; using existing perf artifacts"
  }
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
if ($IsArtifactOnlyMode) {
  $requiredFiles += $SourceRunManifestPath
}

$missing = @($requiredFiles | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) {
  Fail ("Missing required artifacts: " + ($missing -join ", "))
}

if ($IsArtifactOnlyMode -and (Test-Path $SourceRunManifestPath)) {
  $sourceRunManifest = $null
  try {
    $sourceRunManifest = Get-Content $SourceRunManifestPath -Raw | ConvertFrom-Json
  }
  catch {
    Fail ("Invalid source run manifest JSON: " + $SourceRunManifestPath)
  }

  $manifestSchemaVersion = [string]$sourceRunManifest.schemaVersion
  if ([string]::IsNullOrWhiteSpace($manifestSchemaVersion)) {
    Fail ("source run manifest schemaVersion is missing: " + $SourceRunManifestPath)
  }
  if ($manifestSchemaVersion -ne "1.0") {
    Fail ("source run manifest schemaVersion expected 1.0, actual " + $manifestSchemaVersion)
  }

  $manifestSourceRunId = [string]$sourceRunManifest.sourceRun.runId
  if ([string]::IsNullOrWhiteSpace($manifestSourceRunId)) {
    Fail ("source run manifest missing sourceRun.runId: " + $SourceRunManifestPath)
  }

  $manifestSourceBranch = [string]$sourceRunManifest.sourceRun.branch
  if ([string]::IsNullOrWhiteSpace($manifestSourceBranch)) {
    Fail ("source run manifest missing sourceRun.branch: " + $SourceRunManifestPath)
  }

  $manifestSourceConclusion = [string]$sourceRunManifest.sourceRun.conclusion
  if ($manifestSourceConclusion -ne "success") {
    Fail ("source run manifest sourceRun.conclusion expected success, actual " + $manifestSourceConclusion)
  }

  $manifestAllowAnySourceBranch = To-BoolOrNull $sourceRunManifest.sourceSelection.allowAnySourceBranch
  if ($null -eq $manifestAllowAnySourceBranch) {
    $manifestAllowAnySourceBranch = $false
  }

  $manifestAllowedBranches = @(
    @($sourceRunManifest.sourceSelection.allowedBranches) |
      ForEach-Object { [string]$_ } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
  if (-not $manifestAllowAnySourceBranch) {
    if ($manifestAllowedBranches.Count -eq 0) {
      Fail ("source run manifest sourceSelection.allowedBranches is required when allowAnySourceBranch=false")
    }
    if (-not ($manifestAllowedBranches -contains $manifestSourceBranch)) {
      Fail ("source run manifest sourceRun.branch not in allowlist: " + $manifestSourceBranch)
    }
  }

  $manifestMaxSourceRunAgeHours = To-NumberOrNaN $sourceRunManifest.sourceSelection.maxSourceRunAgeHours
  if ((-not [double]::IsNaN($manifestMaxSourceRunAgeHours)) -and ($manifestMaxSourceRunAgeHours -gt 0)) {
    $manifestSourceRunAgeHours = To-NumberOrNaN $sourceRunManifest.sourceRun.ageHours
    if ([double]::IsNaN($manifestSourceRunAgeHours)) {
      Fail ("source run manifest sourceRun.ageHours is required when maxSourceRunAgeHours > 0")
    }
    if ($manifestSourceRunAgeHours -gt $manifestMaxSourceRunAgeHours) {
      Fail (
        "source run manifest sourceRun.ageHours expected <= " +
        $manifestMaxSourceRunAgeHours +
        ", actual " +
        $manifestSourceRunAgeHours
      )
    }
  }

  $manifestRetryAttempts = To-NumberOrNaN $sourceRunManifest.retry.githubApiMaxAttempts
  if ([double]::IsNaN($manifestRetryAttempts) -or $manifestRetryAttempts -lt 1) {
    Fail ("source run manifest retry.githubApiMaxAttempts expected >= 1, actual " + $sourceRunManifest.retry.githubApiMaxAttempts)
  }
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
    assistantActivityLifecycleValidated = $true
    liveContextCompactionValidated = $true
    sessionVersioningValidated = $true
    operatorTaskQueueSummaryValidated = $true
    operatorAuditTrailValidated = $true
    operatorTraceCoverageValidated = $true
    operatorLiveBridgeHealthBlockValidated = $true
    operatorLiveBridgeProbeTelemetryValidated = $true
    operatorLiveBridgeHealthConsistencyValidated = $true
    storytellerVideoAsyncValidated = $true
    storytellerMediaQueueVisible = $true
    storytellerMediaQueueQuotaValidated = $true
    storytellerCacheEnabled = $true
    storytellerCacheHitValidated = $true
    storytellerCacheInvalidationValidated = $true
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

  $storytellerMediaMode = [string]$summary.kpis.storytellerMediaMode
  $allowedStorytellerMediaModes = @("simulated")
  if (-not ($allowedStorytellerMediaModes -contains $storytellerMediaMode)) {
    Fail ("Critical KPI check failed: storytellerMediaMode expected one of [" + ($allowedStorytellerMediaModes -join ", ") + "], actual " + $storytellerMediaMode)
  }

  $storytellerMediaQueueWorkers = To-NumberOrNaN $summary.kpis.storytellerMediaQueueWorkers
  if ([double]::IsNaN($storytellerMediaQueueWorkers) -or $storytellerMediaQueueWorkers -lt 1) {
    Fail ("Critical KPI check failed: storytellerMediaQueueWorkers expected >= 1, actual " + $summary.kpis.storytellerMediaQueueWorkers)
  }

  $storytellerCacheHits = To-NumberOrNaN $summary.kpis.storytellerCacheHits
  if ([double]::IsNaN($storytellerCacheHits) -or $storytellerCacheHits -lt 1) {
    Fail ("Critical KPI check failed: storytellerCacheHits expected >= 1, actual " + $summary.kpis.storytellerCacheHits)
  }

  $operatorLiveBridgeHealthState = [string]$summary.kpis.operatorLiveBridgeHealthState
  $allowedOperatorLiveBridgeHealthStates = @("healthy", "degraded", "unknown")
  if (-not ($allowedOperatorLiveBridgeHealthStates -contains $operatorLiveBridgeHealthState)) {
    Fail ("Critical KPI check failed: operatorLiveBridgeHealthState expected one of [" + ($allowedOperatorLiveBridgeHealthStates -join ", ") + "], actual " + $operatorLiveBridgeHealthState)
  }

  $gatewayRoundTrip = To-NumberOrNaN $summary.kpis.gatewayWsRoundTripMs
  if ([double]::IsNaN($gatewayRoundTrip)) {
    Fail "Critical KPI check failed: gatewayWsRoundTripMs is missing or invalid"
  }
  if ($gatewayRoundTrip -gt $ReleaseThresholds.MaxGatewayWsRoundTripMs) {
    Fail ("Critical KPI check failed: gatewayWsRoundTripMs expected <= " + $ReleaseThresholds.MaxGatewayWsRoundTripMs + ", actual " + $gatewayRoundTrip)
  }

  $gatewayInterruptLatencyMs = To-NumberOrNaN $summary.kpis.gatewayInterruptLatencyMs
  $gatewayInterruptEventType = [string]$summary.kpis.gatewayInterruptEventType
  $gatewayInterruptUnavailable = $gatewayInterruptEventType -eq "live.bridge.unavailable"
  if ([double]::IsNaN($gatewayInterruptLatencyMs)) {
    if (-not $gatewayInterruptUnavailable) {
      Fail ("Critical KPI check failed: gatewayInterruptLatencyMs is missing and gatewayInterruptEventType is not live.bridge.unavailable (actual " + $gatewayInterruptEventType + ")")
    }
  } elseif ($gatewayInterruptLatencyMs -gt $ReleaseThresholds.MaxGatewayInterruptLatencyMs) {
    Fail ("Critical KPI check failed: gatewayInterruptLatencyMs expected <= " + $ReleaseThresholds.MaxGatewayInterruptLatencyMs + ", actual " + $gatewayInterruptLatencyMs)
  }

  $serviceStartMaxAttempts = To-NumberOrNaN $summary.options.serviceStartMaxAttempts
  if ([double]::IsNaN($serviceStartMaxAttempts) -or $serviceStartMaxAttempts -lt $ReleaseThresholds.MinServiceStartMaxAttempts) {
    Fail ("Critical KPI check failed: options.serviceStartMaxAttempts expected >= " + $ReleaseThresholds.MinServiceStartMaxAttempts + ", actual " + $summary.options.serviceStartMaxAttempts)
  }

  $serviceStartRetryBackoffMs = To-NumberOrNaN $summary.options.serviceStartRetryBackoffMs
  if ([double]::IsNaN($serviceStartRetryBackoffMs) -or $serviceStartRetryBackoffMs -lt $ReleaseThresholds.MinServiceStartRetryBackoffMs) {
    Fail ("Critical KPI check failed: options.serviceStartRetryBackoffMs expected >= " + $ReleaseThresholds.MinServiceStartRetryBackoffMs + ", actual " + $summary.options.serviceStartRetryBackoffMs)
  }

  $scenarioRetryMaxAttempts = To-NumberOrNaN $summary.options.scenarioRetryMaxAttempts
  if ([double]::IsNaN($scenarioRetryMaxAttempts) -or $scenarioRetryMaxAttempts -lt $ReleaseThresholds.MinScenarioRetryMaxAttempts) {
    Fail ("Critical KPI check failed: options.scenarioRetryMaxAttempts expected >= " + $ReleaseThresholds.MinScenarioRetryMaxAttempts + ", actual " + $summary.options.scenarioRetryMaxAttempts)
  }

  $scenarioRetryBackoffMs = To-NumberOrNaN $summary.options.scenarioRetryBackoffMs
  if ([double]::IsNaN($scenarioRetryBackoffMs) -or $scenarioRetryBackoffMs -lt $ReleaseThresholds.MinScenarioRetryBackoffMs) {
    Fail ("Critical KPI check failed: options.scenarioRetryBackoffMs expected >= " + $ReleaseThresholds.MinScenarioRetryBackoffMs + ", actual " + $summary.options.scenarioRetryBackoffMs)
  }

  $scenarioRetriesUsedCount = To-NumberOrNaN $summary.kpis.scenarioRetriesUsedCount
  if (
    [double]::IsNaN($scenarioRetriesUsedCount) -or
    $scenarioRetriesUsedCount -lt 0 -or
    $scenarioRetriesUsedCount -gt $MaxAllowedScenarioRetriesUsedCount
  ) {
    Fail (
      "Critical KPI check failed: kpi.scenarioRetriesUsedCount expected 0.." +
      $MaxAllowedScenarioRetriesUsedCount +
      ", actual " +
      $summary.kpis.scenarioRetriesUsedCount
    )
  }

  $gatewayWsRoundTripScenarioAttempts = To-NumberOrNaN $summary.kpis.gatewayWsRoundTripScenarioAttempts
  if (
    [double]::IsNaN($gatewayWsRoundTripScenarioAttempts) -or
    $gatewayWsRoundTripScenarioAttempts -lt 1 -or
    $gatewayWsRoundTripScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.gatewayWsRoundTripScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.gatewayWsRoundTripScenarioAttempts
    )
  }

  $gatewayInterruptSignalScenarioAttempts = To-NumberOrNaN $summary.kpis.gatewayInterruptSignalScenarioAttempts
  if (
    [double]::IsNaN($gatewayInterruptSignalScenarioAttempts) -or
    $gatewayInterruptSignalScenarioAttempts -lt 1 -or
    $gatewayInterruptSignalScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.gatewayInterruptSignalScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.gatewayInterruptSignalScenarioAttempts
    )
  }

  $uiVisualTestingScenarioAttempts = To-NumberOrNaN $summary.kpis.uiVisualTestingScenarioAttempts
  if (
    [double]::IsNaN($uiVisualTestingScenarioAttempts) -or
    $uiVisualTestingScenarioAttempts -lt 1 -or
    $uiVisualTestingScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.uiVisualTestingScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.uiVisualTestingScenarioAttempts
    )
  }

  $operatorConsoleActionsScenarioAttempts = To-NumberOrNaN $summary.kpis.operatorConsoleActionsScenarioAttempts
  if (
    [double]::IsNaN($operatorConsoleActionsScenarioAttempts) -or
    $operatorConsoleActionsScenarioAttempts -lt 1 -or
    $operatorConsoleActionsScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.operatorConsoleActionsScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.operatorConsoleActionsScenarioAttempts
    )
  }

  $runtimeLifecycleScenarioAttempts = To-NumberOrNaN $summary.kpis.runtimeLifecycleScenarioAttempts
  if (
    [double]::IsNaN($runtimeLifecycleScenarioAttempts) -or
    $runtimeLifecycleScenarioAttempts -lt 1 -or
    $runtimeLifecycleScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.runtimeLifecycleScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.runtimeLifecycleScenarioAttempts
    )
  }

  $runtimeMetricsScenarioAttempts = To-NumberOrNaN $summary.kpis.runtimeMetricsScenarioAttempts
  if (
    [double]::IsNaN($runtimeMetricsScenarioAttempts) -or
    $runtimeMetricsScenarioAttempts -lt 1 -or
    $runtimeMetricsScenarioAttempts -gt $scenarioRetryMaxAttempts
  ) {
    Fail (
      "Critical KPI check failed: kpi.runtimeMetricsScenarioAttempts expected 1.." +
      $summary.options.scenarioRetryMaxAttempts +
      ", actual " +
      $summary.kpis.runtimeMetricsScenarioAttempts
    )
  }

  $scenarioRetryableFailuresTotal = To-NumberOrNaN $summary.kpis.scenarioRetryableFailuresTotal
  if ([double]::IsNaN($scenarioRetryableFailuresTotal) -or $scenarioRetryableFailuresTotal -lt 0) {
    Fail ("Critical KPI check failed: kpi.scenarioRetryableFailuresTotal expected >= 0, actual " + $summary.kpis.scenarioRetryableFailuresTotal)
  }

  $analyticsSplitTargetsValidated = To-BoolOrNull $summary.kpis.analyticsSplitTargetsValidated
  if ($analyticsSplitTargetsValidated -ne $true) {
    Fail ("Critical KPI check failed: analyticsSplitTargetsValidated expected True, actual " + $summary.kpis.analyticsSplitTargetsValidated)
  }

  $analyticsBigQueryConfigValidated = To-BoolOrNull $summary.kpis.analyticsBigQueryConfigValidated
  if ($analyticsBigQueryConfigValidated -ne $true) {
    Fail ("Critical KPI check failed: analyticsBigQueryConfigValidated expected True, actual " + $summary.kpis.analyticsBigQueryConfigValidated)
  }

  $analyticsServicesValidated = To-NumberOrNaN $summary.kpis.analyticsServicesValidated
  if ([double]::IsNaN($analyticsServicesValidated) -or $analyticsServicesValidated -lt $ReleaseThresholds.MinAnalyticsServicesValidated) {
    Fail (
      "Critical KPI check failed: kpi.analyticsServicesValidated expected >= " +
      $ReleaseThresholds.MinAnalyticsServicesValidated +
      ", actual " +
      $summary.kpis.analyticsServicesValidated
    )
  }

  $analyticsRequestedEnabledServices = To-NumberOrNaN $summary.kpis.analyticsRequestedEnabledServices
  if (
    [double]::IsNaN($analyticsRequestedEnabledServices) -or
    $analyticsRequestedEnabledServices -lt $ReleaseThresholds.MinAnalyticsRequestedEnabledServices
  ) {
    Fail (
      "Critical KPI check failed: kpi.analyticsRequestedEnabledServices expected >= " +
      $ReleaseThresholds.MinAnalyticsRequestedEnabledServices +
      ", actual " +
      $summary.kpis.analyticsRequestedEnabledServices
    )
  }

  $analyticsEnabledServices = To-NumberOrNaN $summary.kpis.analyticsEnabledServices
  if ([double]::IsNaN($analyticsEnabledServices) -or $analyticsEnabledServices -lt $ReleaseThresholds.MinAnalyticsEnabledServices) {
    Fail (
      "Critical KPI check failed: kpi.analyticsEnabledServices expected >= " +
      $ReleaseThresholds.MinAnalyticsEnabledServices +
      ", actual " +
      $summary.kpis.analyticsEnabledServices
    )
  }

  $assistiveRouterDiagnosticsValidated = To-BoolOrNull $summary.kpis.assistiveRouterDiagnosticsValidated
  if ($assistiveRouterDiagnosticsValidated -ne $true) {
    Fail ("Critical KPI check failed: assistiveRouterDiagnosticsValidated expected True, actual " + $summary.kpis.assistiveRouterDiagnosticsValidated)
  }

  $assistiveRouterMode = [string]$summary.kpis.assistiveRouterMode
  if (@("deterministic", "assistive_override", "assistive_match", "assistive_fallback") -notcontains $assistiveRouterMode) {
    Fail ("Critical KPI check failed: assistiveRouterMode expected deterministic|assistive_override|assistive_match|assistive_fallback, actual " + $assistiveRouterMode)
  }

  $transportModeValidated = To-BoolOrNull $summary.kpis.transportModeValidated
  if ($transportModeValidated -ne $true) {
    Fail ("Critical KPI check failed: transportModeValidated expected True, actual " + $summary.kpis.transportModeValidated)
  }

  $gatewayTransportRequestedMode = [string]$summary.kpis.gatewayTransportRequestedMode
  if (@("websocket", "webrtc") -notcontains $gatewayTransportRequestedMode) {
    Fail ("Critical KPI check failed: gatewayTransportRequestedMode expected websocket|webrtc, actual " + $gatewayTransportRequestedMode)
  }

  $gatewayTransportActiveMode = [string]$summary.kpis.gatewayTransportActiveMode
  if ($gatewayTransportActiveMode -ne "websocket") {
    Fail ("Critical KPI check failed: gatewayTransportActiveMode expected websocket, actual " + $gatewayTransportActiveMode)
  }

  $gatewayTransportFallbackActive = To-BoolOrNull $summary.kpis.gatewayTransportFallbackActive
  $expectedGatewayTransportFallbackActive = if ($gatewayTransportRequestedMode -eq "webrtc") { $true } else { $false }
  if ($gatewayTransportFallbackActive -ne $expectedGatewayTransportFallbackActive) {
    Fail ("Critical KPI check failed: gatewayTransportFallbackActive expected " + $expectedGatewayTransportFallbackActive + ", actual " + $summary.kpis.gatewayTransportFallbackActive)
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

  $perfWorkloads = @($perfSummary.workloads)
  $livePerfWorkload = @($perfWorkloads | Where-Object { [string]$_.name -eq "live_voice_translation" } | Select-Object -First 1)
  if ($livePerfWorkload.Count -eq 0) {
    Fail "perf summary missing workload: live_voice_translation"
  }

  $uiPerfWorkload = @($perfWorkloads | Where-Object { [string]$_.name -eq "ui_navigation_execution" } | Select-Object -First 1)
  if ($uiPerfWorkload.Count -eq 0) {
    Fail "perf summary missing workload: ui_navigation_execution"
  }

  $gatewayReplayPerfWorkload = @($perfWorkloads | Where-Object { [string]$_.name -eq "gateway_ws_request_replay" } | Select-Object -First 1)
  if ($gatewayReplayPerfWorkload.Count -eq 0) {
    Fail "perf summary missing workload: gateway_ws_request_replay"
  }

  $perfLiveP95 = To-NumberOrNaN $livePerfWorkload[0].latencyMs.p95
  if ([double]::IsNaN($perfLiveP95) -or $perfLiveP95 -gt $ReleaseThresholds.MaxPerfLiveP95Ms) {
    Fail ("perf summary check failed: live_voice_translation p95 expected <= " + $ReleaseThresholds.MaxPerfLiveP95Ms + ", actual " + $livePerfWorkload[0].latencyMs.p95)
  }

  $perfUiP95 = To-NumberOrNaN $uiPerfWorkload[0].latencyMs.p95
  if ([double]::IsNaN($perfUiP95) -or $perfUiP95 -gt $ReleaseThresholds.MaxPerfUiP95Ms) {
    Fail ("perf summary check failed: ui_navigation_execution p95 expected <= " + $ReleaseThresholds.MaxPerfUiP95Ms + ", actual " + $uiPerfWorkload[0].latencyMs.p95)
  }

  $perfGatewayReplayP95 = To-NumberOrNaN $gatewayReplayPerfWorkload[0].latencyMs.p95
  if ([double]::IsNaN($perfGatewayReplayP95) -or $perfGatewayReplayP95 -gt $ReleaseThresholds.MaxPerfGatewayReplayP95Ms) {
    Fail ("perf summary check failed: gateway_ws_request_replay p95 expected <= " + $ReleaseThresholds.MaxPerfGatewayReplayP95Ms + ", actual " + $gatewayReplayPerfWorkload[0].latencyMs.p95)
  }

  $perfGatewayReplayErrorRatePct = To-NumberOrNaN $gatewayReplayPerfWorkload[0].errorRatePct
  if ([double]::IsNaN($perfGatewayReplayErrorRatePct) -or $perfGatewayReplayErrorRatePct -gt $ReleaseThresholds.MaxPerfGatewayReplayErrorRatePct) {
    Fail ("perf summary check failed: gateway_ws_request_replay errorRatePct expected <= " + $ReleaseThresholds.MaxPerfGatewayReplayErrorRatePct + ", actual " + $gatewayReplayPerfWorkload[0].errorRatePct)
  }

  $perfAggregateErrorRatePct = To-NumberOrNaN $perfSummary.aggregate.errorRatePct
  if ([double]::IsNaN($perfAggregateErrorRatePct) -or $perfAggregateErrorRatePct -gt $ReleaseThresholds.MaxPerfAggregateErrorRatePct) {
    Fail ("perf summary check failed: aggregate.errorRatePct expected <= " + $ReleaseThresholds.MaxPerfAggregateErrorRatePct + ", actual " + $perfSummary.aggregate.errorRatePct)
  }
}

if ((-not $SkipPerfLoad) -and (Test-Path $PerfPolicyPath)) {
  $perfPolicy = Get-Content $PerfPolicyPath -Raw | ConvertFrom-Json
  if (-not $perfPolicy.ok) {
    Fail "perf policy-check result is not ok"
  }

  $perfPolicyThresholds = $perfPolicy.thresholds
  if ($null -eq $perfPolicyThresholds) {
    Fail "perf policy-check missing thresholds section"
  }

  $perfPolicyMaxLiveP95Ms = To-NumberOrNaN $perfPolicyThresholds.maxLiveP95Ms
  if ([double]::IsNaN($perfPolicyMaxLiveP95Ms) -or $perfPolicyMaxLiveP95Ms -gt $ReleaseThresholds.MaxPerfLiveP95Ms) {
    Fail ("perf policy threshold mismatch: maxLiveP95Ms expected <= " + $ReleaseThresholds.MaxPerfLiveP95Ms + ", actual " + $perfPolicyThresholds.maxLiveP95Ms)
  }

  $perfPolicyMaxUiP95Ms = To-NumberOrNaN $perfPolicyThresholds.maxUiP95Ms
  if ([double]::IsNaN($perfPolicyMaxUiP95Ms) -or $perfPolicyMaxUiP95Ms -gt $ReleaseThresholds.MaxPerfUiP95Ms) {
    Fail ("perf policy threshold mismatch: maxUiP95Ms expected <= " + $ReleaseThresholds.MaxPerfUiP95Ms + ", actual " + $perfPolicyThresholds.maxUiP95Ms)
  }

  $perfPolicyMaxGatewayReplayP95Ms = To-NumberOrNaN $perfPolicyThresholds.maxGatewayReplayP95Ms
  if ([double]::IsNaN($perfPolicyMaxGatewayReplayP95Ms) -or $perfPolicyMaxGatewayReplayP95Ms -gt $ReleaseThresholds.MaxPerfGatewayReplayP95Ms) {
    Fail ("perf policy threshold mismatch: maxGatewayReplayP95Ms expected <= " + $ReleaseThresholds.MaxPerfGatewayReplayP95Ms + ", actual " + $perfPolicyThresholds.maxGatewayReplayP95Ms)
  }

  $perfPolicyMaxGatewayReplayErrorRatePct = To-NumberOrNaN $perfPolicyThresholds.maxGatewayReplayErrorRatePct
  if ([double]::IsNaN($perfPolicyMaxGatewayReplayErrorRatePct) -or $perfPolicyMaxGatewayReplayErrorRatePct -gt $ReleaseThresholds.MaxPerfGatewayReplayErrorRatePct) {
    Fail ("perf policy threshold mismatch: maxGatewayReplayErrorRatePct expected <= " + $ReleaseThresholds.MaxPerfGatewayReplayErrorRatePct + ", actual " + $perfPolicyThresholds.maxGatewayReplayErrorRatePct)
  }

  $perfPolicyMaxAggregateErrorRatePct = To-NumberOrNaN $perfPolicyThresholds.maxAggregateErrorRatePct
  if ([double]::IsNaN($perfPolicyMaxAggregateErrorRatePct) -or $perfPolicyMaxAggregateErrorRatePct -gt $ReleaseThresholds.MaxPerfAggregateErrorRatePct) {
    Fail ("perf policy threshold mismatch: maxAggregateErrorRatePct expected <= " + $ReleaseThresholds.MaxPerfAggregateErrorRatePct + ", actual " + $perfPolicyThresholds.maxAggregateErrorRatePct)
  }

  $perfPolicyRequiredUiAdapterMode = [string]$perfPolicyThresholds.requiredUiAdapterMode
  if ($perfPolicyRequiredUiAdapterMode -ne $ReleaseThresholds.RequiredPerfUiAdapterMode) {
    Fail ("perf policy threshold mismatch: requiredUiAdapterMode expected " + $ReleaseThresholds.RequiredPerfUiAdapterMode + ", actual " + $perfPolicyRequiredUiAdapterMode)
  }

  $perfPolicyChecksCount = To-NumberOrNaN $perfPolicy.checks
  if ([double]::IsNaN($perfPolicyChecksCount) -or $perfPolicyChecksCount -lt $ReleaseThresholds.MinPerfPolicyChecks) {
    Fail ("perf policy-check count expected >= " + $ReleaseThresholds.MinPerfPolicyChecks + ", actual " + $perfPolicy.checks)
  }

  $requiredPerfPolicyChecks = @(
    "summary.success",
    "workload.live.exists",
    "workload.ui.exists",
    "workload.gateway_replay.exists",
    "workload.live.p95",
    "workload.ui.p95",
    "workload.gateway_replay.p95",
    "workload.gateway_replay.errorRatePct",
    "aggregate.errorRatePct",
    "workload.live.success",
    "workload.ui.success",
    "workload.gateway_replay.success",
    "workload.gateway_replay.contract.responseIdReusedAll",
    "workload.gateway_replay.contract.taskStartedExactlyOneAll",
    ("workload.ui.adapterMode." + $ReleaseThresholds.RequiredPerfUiAdapterMode)
  )

  foreach ($requiredPerfPolicyCheck in $requiredPerfPolicyChecks) {
    $checkRecord = @($perfPolicy.checkItems | Where-Object { [string]$_.name -eq $requiredPerfPolicyCheck } | Select-Object -First 1)
    if ($checkRecord.Count -eq 0) {
      Fail ("perf policy-check missing required check: " + $requiredPerfPolicyCheck)
    }
    $isPassed = To-BoolOrNull $checkRecord[0].passed
    if ($isPassed -ne $true) {
      Fail ("perf policy-check failed for required check: " + $requiredPerfPolicyCheck)
    }
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
  $scenarioRetryAttempts = $summary.options.scenarioRetryMaxAttempts
  $scenarioRetryBackoff = $summary.options.scenarioRetryBackoffMs
  $scenarioRetriesUsedCount = $summary.kpis.scenarioRetriesUsedCount
  $scenarioRetryableFailuresTotal = $summary.kpis.scenarioRetryableFailuresTotal
  $gatewayRoundTripAttempts = $summary.kpis.gatewayWsRoundTripScenarioAttempts
  $gatewayInterruptAttempts = $summary.kpis.gatewayInterruptSignalScenarioAttempts
  $uiVisualAttempts = $summary.kpis.uiVisualTestingScenarioAttempts
  $operatorActionsAttempts = $summary.kpis.operatorConsoleActionsScenarioAttempts
  $runtimeLifecycleAttempts = $summary.kpis.runtimeLifecycleScenarioAttempts
  $runtimeMetricsAttempts = $summary.kpis.runtimeMetricsScenarioAttempts
  if (
    $null -ne $scenarioRetryAttempts -or
    $null -ne $scenarioRetryBackoff -or
    $null -ne $scenarioRetriesUsedCount -or
    $null -ne $gatewayRoundTripAttempts -or
    $null -ne $gatewayInterruptAttempts -or
    $null -ne $uiVisualAttempts -or
    $null -ne $operatorActionsAttempts -or
    $null -ne $runtimeLifecycleAttempts -or
    $null -ne $runtimeMetricsAttempts
  ) {
    Write-Host (
      "demo.scenario.retry: max_attempts=" + $scenarioRetryAttempts +
      ", backoff_ms=" + $scenarioRetryBackoff +
      ", retries_used=" + $scenarioRetriesUsedCount +
      ", retryable_failures=" + $scenarioRetryableFailuresTotal +
      ", gateway.websocket.roundtrip_attempts=" + $gatewayRoundTripAttempts +
      ", gateway.websocket.interrupt_signal_attempts=" + $gatewayInterruptAttempts +
      ", ui.visual_testing_attempts=" + $uiVisualAttempts +
      ", operator.console.actions_attempts=" + $operatorActionsAttempts +
      ", runtime.lifecycle.endpoints_attempts=" + $runtimeLifecycleAttempts +
      ", runtime.metrics.endpoints_attempts=" + $runtimeMetricsAttempts
    )
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
  $assistantActivityValidated = $summary.kpis.assistantActivityLifecycleValidated
  if ($null -ne $assistantActivityValidated) {
    Write-Host ("assistant.activity.lifecycle.validated: " + $assistantActivityValidated)
  }
  $contextCompactionValidated = $summary.kpis.liveContextCompactionValidated
  if ($null -ne $contextCompactionValidated) {
    Write-Host ("live.context.compaction.validated: " + $contextCompactionValidated)
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
if ($IsArtifactOnlyMode -and (Test-Path $SourceRunManifestPath)) {
  $sourceRunManifest = Get-Content $SourceRunManifestPath -Raw | ConvertFrom-Json
  $manifestSchemaVersion = [string]$sourceRunManifest.schemaVersion
  $manifestSourceRunId = [string]$sourceRunManifest.sourceRun.runId
  $manifestSourceBranch = [string]$sourceRunManifest.sourceRun.branch
  $manifestPerfMode = [string]$sourceRunManifest.gate.effectivePerfMode
  Write-Host (
    "artifact.source_run_manifest: schema=" + $manifestSchemaVersion +
    ", run_id=" + $manifestSourceRunId +
    ", branch=" + $manifestSourceBranch +
    ", perf_mode=" + $manifestPerfMode
  )
}
