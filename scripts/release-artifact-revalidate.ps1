[CmdletBinding()]
param(
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [string]$Token = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { "" }),
  [long]$SourceRunId = 0,
  [string]$ArtifactName = "",
  [string[]]$WorkflowIds = @("demo-e2e.yml", "release-strict-final.yml"),
  [string[]]$AllowedBranches = @("main", "master"),
  [int]$PerWorkflowRuns = 20,
  [string]$ArtifactsDir = "artifacts",
  [string]$TempDir = ".tmp/release-artifact-revalidation",
  [switch]$SkipArtifactOnlyGate,
  [switch]$StrictFinalRun,
  [ValidateSet("auto", "with_perf", "without_perf")]
  [string]$PerfGateMode = "auto",
  [switch]$SkipPerfLoadGate,
  [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Resolve-AbsolutePath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Invoke-GitHubJson([string]$Uri, [hashtable]$Headers) {
  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers -TimeoutSec 60
}

function Invoke-ReleaseReadinessGate(
  [bool]$IncludePerfChecks,
  [bool]$StrictMode
) {
  $releaseScript = Join-Path $PSScriptRoot "release-readiness.ps1"
  if (-not (Test-Path $releaseScript)) {
    Fail "release-readiness.ps1 was not found next to this script."
  }

  $releaseArgs = @(
    "-SkipBuild",
    "-SkipUnitTests",
    "-SkipMonitoringTemplates",
    "-SkipProfileSmoke",
    "-SkipDemoE2E",
    "-SkipPolicy",
    "-SkipBadge",
    "-SkipPerfRun"
  )

  if (-not $IncludePerfChecks) {
    $releaseArgs += "-SkipPerfLoad"
  }
  if ($StrictMode) {
    $releaseArgs += "-StrictFinalRun"
  }

  $perfModeLabel = if ($IncludePerfChecks) { "with perf checks" } else { "without perf checks" }
  $strictModeLabel = if ($StrictMode) { "strict" } else { "standard" }
  Write-Host ("[artifact-revalidate] Running local gate: release-readiness.ps1 (" + $strictModeLabel + ", " + $perfModeLabel + ")")

  & $releaseScript @releaseArgs
  if ($LASTEXITCODE -ne 0) {
    $modeLabel = if ($StrictMode) { "strict artifact-only" } else { "artifact-only" }
    Fail ("Release revalidation failed in " + $modeLabel + " mode.")
  }
}

if ([string]::IsNullOrWhiteSpace($Owner)) {
  Fail "Missing owner. Set -Owner or env GITHUB_OWNER."
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  Fail "Missing repo. Set -Repo or env GITHUB_REPO."
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  $ghCli = Get-Command "gh" -ErrorAction SilentlyContinue
  if ($null -ne $ghCli) {
    try {
      $ghToken = (& gh auth token 2>$null | Select-Object -First 1)
      if (-not [string]::IsNullOrWhiteSpace($ghToken)) {
        $Token = $ghToken.Trim()
        Write-Host "[artifact-revalidate] Using token resolved from 'gh auth token'."
      }
    }
    catch {
      # Best-effort fallback only: keep explicit validation below.
    }
  }
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Fail "Missing token. Set -Token or env GITHUB_TOKEN/GH_TOKEN, or authenticate GitHub CLI via 'gh auth login'."
}

if ($WorkflowIds.Count -eq 0) {
  Fail "WorkflowIds cannot be empty."
}

if ($AllowedBranches.Count -eq 0) {
  Fail "AllowedBranches cannot be empty."
}

$headers = @{
  Accept                 = "application/vnd.github+json"
  Authorization          = "Bearer $Token"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$resolvedRunId = $SourceRunId
if ($resolvedRunId -le 0) {
  $candidateRuns = @()
  foreach ($workflowId in $WorkflowIds) {
    $listRunsUri = "https://api.github.com/repos/$Owner/$Repo/actions/workflows/$workflowId/runs?status=completed&per_page=$PerWorkflowRuns"
    $runsResponse = Invoke-GitHubJson -Uri $listRunsUri -Headers $headers
    $workflowRuns = @($runsResponse.workflow_runs)
    foreach ($run in $workflowRuns) {
      if ([string]$run.conclusion -ne "success") {
        continue
      }
      if ($AllowedBranches -notcontains [string]$run.head_branch) {
        continue
      }
      $candidateRuns += [pscustomobject]@{
        runId      = [long]$run.id
        updatedAt  = [datetime]$run.updated_at
        workflowId = $workflowId
      }
    }
  }

  if ($candidateRuns.Count -eq 0) {
    Fail "No successful workflow runs found in the allowed branches."
  }

  $latestRun = $candidateRuns | Sort-Object -Property updatedAt -Descending | Select-Object -First 1
  $resolvedRunId = [long]$latestRun.runId
  Write-Host "[artifact-revalidate] Auto-selected run id: $resolvedRunId (workflow: $($latestRun.workflowId))"
}
else {
  Write-Host "[artifact-revalidate] Using provided run id: $resolvedRunId"
}

$artifactsListUri = "https://api.github.com/repos/$Owner/$Repo/actions/runs/$resolvedRunId/artifacts?per_page=100"
$artifactsResponse = Invoke-GitHubJson -Uri $artifactsListUri -Headers $headers
$availableArtifacts = @($artifactsResponse.artifacts | Where-Object { -not $_.expired })

if ($availableArtifacts.Count -eq 0) {
  Fail "No non-expired artifacts found for run id $resolvedRunId."
}

$resolvedArtifact = $null
if (-not [string]::IsNullOrWhiteSpace($ArtifactName)) {
  $resolvedArtifact = $availableArtifacts | Where-Object { [string]$_.name -eq $ArtifactName } | Select-Object -First 1
  if ($null -eq $resolvedArtifact) {
    $availableNames = @($availableArtifacts | ForEach-Object { $_.name })
    Fail ("Artifact '$ArtifactName' not found for run id $resolvedRunId. Available: " + ($availableNames -join ", "))
  }
}
else {
  $preferredOrder = @(
    "release-strict-final-artifacts",
    "demo-e2e-artifacts",
    "pr-quality-artifacts"
  )
  foreach ($preferredName in $preferredOrder) {
    $matched = $availableArtifacts | Where-Object { [string]$_.name -eq $preferredName } | Select-Object -First 1
    if ($null -ne $matched) {
      $resolvedArtifact = $matched
      break
    }
  }

  if ($null -eq $resolvedArtifact) {
    $availableNames = @($availableArtifacts | ForEach-Object { $_.name })
    Fail ("No supported artifact bundle found for run id $resolvedRunId. Available: " + ($availableNames -join ", "))
  }
}

$resolvedTempDir = Resolve-AbsolutePath -PathValue $TempDir
$resolvedArtifactsDir = Resolve-AbsolutePath -PathValue $ArtifactsDir
$zipPath = Join-Path $resolvedTempDir "artifact.zip"
$extractDir = Join-Path $resolvedTempDir "bundle"

if (Test-Path $resolvedTempDir) {
  Remove-Item -Path $resolvedTempDir -Recurse -Force
}
New-Item -Path $resolvedTempDir -ItemType Directory -Force | Out-Null

$artifactDownloadUri = "https://api.github.com/repos/$Owner/$Repo/actions/artifacts/$($resolvedArtifact.id)/zip"
Write-Host "[artifact-revalidate] Downloading artifact '$($resolvedArtifact.name)' from run $resolvedRunId..."
Invoke-WebRequest -Uri $artifactDownloadUri -Headers $headers -OutFile $zipPath -TimeoutSec 120 | Out-Null

Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
$bundleArtifactsDir = Join-Path $extractDir "artifacts"
if (-not (Test-Path $bundleArtifactsDir)) {
  Fail "Downloaded bundle does not contain expected 'artifacts/' directory."
}

New-Item -Path $resolvedArtifactsDir -ItemType Directory -Force | Out-Null
$artifactChildren = Get-ChildItem -Path $bundleArtifactsDir -Force
foreach ($artifactChild in $artifactChildren) {
  $targetPath = Join-Path $resolvedArtifactsDir $artifactChild.Name
  if (Test-Path $targetPath) {
    Remove-Item -Path $targetPath -Recurse -Force
  }
  Copy-Item -Path $artifactChild.FullName -Destination $targetPath -Recurse -Force
}

$gateRequestedPerfMode = "not_run"
$gateEffectivePerfMode = "not_run"
$gateHasPerfArtifacts = "unknown"

if (-not $SkipArtifactOnlyGate) {
  $perfSummaryPath = Join-Path $resolvedArtifactsDir "perf-load/summary.json"
  $perfPolicyPath = Join-Path $resolvedArtifactsDir "perf-load/policy-check.json"
  $hasPerfArtifacts = (Test-Path $perfSummaryPath) -and (Test-Path $perfPolicyPath)
  $gateHasPerfArtifacts = if ($hasPerfArtifacts) { "true" } else { "false" }
  $requestedPerfMode = [string]$PerfGateMode
  if ([string]::IsNullOrWhiteSpace($requestedPerfMode)) {
    $requestedPerfMode = "auto"
  }
  $requestedPerfMode = $requestedPerfMode.ToLowerInvariant()

  if ($SkipPerfLoadGate) {
    if ($requestedPerfMode -eq "with_perf") {
      Fail "SkipPerfLoadGate cannot be combined with PerfGateMode=with_perf."
    }
    Write-Host "[artifact-revalidate] SkipPerfLoadGate is deprecated; forcing PerfGateMode=without_perf."
    $requestedPerfMode = "without_perf"
  }

  $includePerfChecks = $false
  switch ($requestedPerfMode) {
    "with_perf" {
      if (-not $hasPerfArtifacts) {
        Fail "PerfGateMode=with_perf requires artifacts/perf-load/summary.json and artifacts/perf-load/policy-check.json in the restored bundle."
      }
      $includePerfChecks = $true
    }
    "without_perf" {
      $includePerfChecks = $false
    }
    default {
      $includePerfChecks = $hasPerfArtifacts
    }
  }

  $gateRequestedPerfMode = $requestedPerfMode
  $gateEffectivePerfMode = if ($includePerfChecks) { "with_perf" } else { "without_perf" }
  Write-Host ("[artifact-revalidate] Perf gate mode: requested=" + $gateRequestedPerfMode + ", effective=" + $gateEffectivePerfMode + ", hasPerfArtifacts=" + $gateHasPerfArtifacts + ".")

  Invoke-ReleaseReadinessGate -IncludePerfChecks $includePerfChecks -StrictMode $StrictFinalRun
}
else {
  Write-Host "[artifact-revalidate] SkipArtifactOnlyGate enabled; artifacts were restored without running release gate."
}

Write-Host ""
Write-Host "Artifact revalidation flow completed."
Write-Host ("- run id: " + $resolvedRunId)
Write-Host ("- artifact: " + $resolvedArtifact.name)
Write-Host ("- restored artifacts path: " + $resolvedArtifactsDir)
Write-Host ("- strict final run: " + $StrictFinalRun)
Write-Host ("- requested perf gate mode: " + $gateRequestedPerfMode)
Write-Host ("- effective perf gate mode: " + $gateEffectivePerfMode)
Write-Host ("- perf artifacts detected: " + $gateHasPerfArtifacts)

if (-not $KeepTemp) {
  if (Test-Path $resolvedTempDir) {
    Remove-Item -Path $resolvedTempDir -Recurse -Force
  }
}
else {
  Write-Host ("- temp path kept: " + $resolvedTempDir)
}
