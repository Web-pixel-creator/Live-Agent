[CmdletBinding()]
param(
  [switch]$StrictFinalRun,
  [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$releaseScript = Join-Path $PSScriptRoot "release-readiness.ps1"
if (-not (Test-Path $releaseScript)) {
  Fail "release-readiness.ps1 was not found next to this script."
}

$powerShellCandidates = @("powershell", "pwsh")
$resolvedPowerShell = $null
foreach ($candidate in $powerShellCandidates) {
  $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
    $resolvedPowerShell = $command.Source
    break
  }
}
if ([string]::IsNullOrWhiteSpace($resolvedPowerShell)) {
  Fail "No PowerShell binary was found (tried: powershell, pwsh)."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mla-artifact-only-smoke-" + [guid]::NewGuid().ToString("N"))
$artifactsDir = Join-Path $tempRoot "artifacts"
$perfDir = Join-Path $artifactsDir "perf-load"
$manifestDir = Join-Path $artifactsDir "release-artifact-revalidation"
New-Item -Path $perfDir -ItemType Directory -Force | Out-Null
New-Item -Path $manifestDir -ItemType Directory -Force | Out-Null

$perfSummaryPath = Join-Path $perfDir "summary.json"
$perfPolicyPath = Join-Path $perfDir "policy-check.json"
$sourceRunManifestPath = Join-Path $manifestDir "source-run.json"

$perfSummary = [ordered]@{
  success   = $true
  workloads = @(
    [ordered]@{
      name       = "live_voice_translation"
      latencyMs  = [ordered]@{ p95 = 1100 }
      errorRatePct = 0
    },
    [ordered]@{
      name       = "ui_navigation_execution"
      latencyMs  = [ordered]@{ p95 = 8500 }
      errorRatePct = 0
    },
    [ordered]@{
      name       = "gateway_ws_request_replay"
      latencyMs  = [ordered]@{ p95 = 3200 }
      errorRatePct = 0
    }
  )
  aggregate = [ordered]@{
    errorRatePct = 0
  }
}
$perfSummaryJson = $perfSummary | ConvertTo-Json -Depth 8
Write-Utf8NoBomFile -Path $perfSummaryPath -Content $perfSummaryJson

$perfCheckNames = @(
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
  "workload.ui.adapterMode.remote_http"
)
$perfPolicy = [ordered]@{
  ok        = $true
  checks    = $perfCheckNames.Count
  thresholds = [ordered]@{
    maxLiveP95Ms                = 1800
    maxUiP95Ms                  = 25000
    maxGatewayReplayP95Ms       = 9000
    maxGatewayReplayErrorRatePct = 20
    maxAggregateErrorRatePct    = 10
    requiredUiAdapterMode       = "remote_http"
  }
  checkItems = @(
    $perfCheckNames | ForEach-Object {
      [ordered]@{
        name        = [string]$_
        passed      = $true
        value       = 1
        expectation = "ok"
      }
    }
  )
  violations = @()
}
$perfPolicyJson = $perfPolicy | ConvertTo-Json -Depth 8
Write-Utf8NoBomFile -Path $perfPolicyPath -Content $perfPolicyJson

$sourceRunManifest = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = [datetime]::UtcNow.ToString("o")
  repository    = [ordered]@{
    owner = "Web-pixel-creator"
    repo  = "Live-Agent"
  }
  sourceRun     = [ordered]@{
    runId        = "smoke-local-1"
    workflow     = "artifact-only-smoke"
    branch       = "main"
    headSha      = "smokesha000001"
    headShaShort = "smokesha000001"
    conclusion   = "success"
    updatedAtUtc = [datetime]::UtcNow.ToString("o")
    ageHours     = 0.01
  }
  artifact      = [ordered]@{
    name = "artifact-only-smoke"
    id   = 1
  }
  sourceSelection = [ordered]@{
    allowAnySourceBranch = $false
    allowedBranches      = @("main", "master")
    maxSourceRunAgeHours = 168
  }
  gate = [ordered]@{
    skipArtifactOnlyGate = $false
    strictFinalRun       = [bool]$StrictFinalRun
    requestedPerfMode    = "with_perf"
    effectivePerfMode    = "with_perf"
    perfArtifactsDetected = "true"
    evidenceSnapshot     = [ordered]@{
      demoSummaryPresent = $false
      badgeDetailsPresent = $false
      operatorTurnTruncationSummaryValidated = $true
      operatorTurnDeleteSummaryValidated = $true
      operatorDamageControlSummaryValidated = $true
      operatorDamageControlTotal = 1
      operatorDamageControlLatestVerdict = "ask"
      operatorDamageControlLatestSource = "default"
      operatorDamageControlLatestSeenAt = [datetime]::UtcNow.ToString("o")
      badgeEvidenceOperatorTurnTruncationStatus = "pass"
      badgeEvidenceOperatorTurnDeleteStatus = "pass"
      badgeEvidenceOperatorDamageControlStatus = "pass"
      badgeEvidenceGovernancePolicyStatus = "pass"
      badgeEvidenceSkillsRegistryStatus = "pass"
      badgeEvidenceDeviceNodesStatus = "pass"
      badgeEvidenceAgentUsageStatus = "pass"
      badgeEvidenceDeviceNodeUpdatesStatus = "pass"
    }
  }
  retry = [ordered]@{
    githubApiMaxAttempts    = 3
    githubApiRetryBackoffMs = 1200
    retryableStatusCodes    = @(408, 429, 500, 502, 503, 504)
  }
}
$sourceRunManifestJson = $sourceRunManifest | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $sourceRunManifestPath -Content $sourceRunManifestJson

$args = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $releaseScript,
  "-SkipBuild",
  "-SkipUnitTests",
  "-SkipMonitoringTemplates",
  "-SkipProfileSmoke",
  "-SkipDemoE2E",
  "-SkipPolicy",
  "-SkipBadge",
  "-SkipPerfRun",
  "-PerfSummaryPath",
  $perfSummaryPath,
  "-PerfPolicyPath",
  $perfPolicyPath,
  "-SourceRunManifestPath",
  $sourceRunManifestPath
)
if ($StrictFinalRun) {
  $args += "-StrictFinalRun"
}

Write-Host "[artifact-only-smoke] Running release artifact-only gate with generated local artifacts..."
& $resolvedPowerShell @args
if ($LASTEXITCODE -ne 0) {
  Fail ("release artifact-only smoke failed with exit code " + $LASTEXITCODE)
}

Write-Host ("[artifact-only-smoke] Passed. temp_root=" + $tempRoot)

if (-not $KeepTemp) {
  if (Test-Path $tempRoot) {
    Remove-Item -Path $tempRoot -Recurse -Force
  }
}
else {
  Write-Host ("[artifact-only-smoke] Keeping temp folder: " + $tempRoot)
}
