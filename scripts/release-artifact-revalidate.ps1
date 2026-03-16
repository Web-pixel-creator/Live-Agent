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
  [int]$GithubApiMaxAttempts = 3,
  [int]$GithubApiRetryBackoffMs = 1200,
  [int]$MaxSourceRunAgeHours = 168,
  [switch]$AllowAnySourceBranch,
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

function Get-ExceptionPropertyValue {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Exception,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -eq $Exception) {
    return $null
  }

  $property = $Exception.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Get-ObjectPropertyValue {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
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

function Resolve-AbsolutePath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Resolve-GhCli() {
  $ghCli = Get-Command "gh" -ErrorAction SilentlyContinue
  if ($null -ne $ghCli -and -not [string]::IsNullOrWhiteSpace($ghCli.Source)) {
    return [string]$ghCli.Source
  }

  $fallbackCandidates = @(
    (Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI\gh.exe")
  )

  foreach ($candidate in $fallbackCandidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
      return [string]$candidate
    }
  }

  return $null
}

function Convert-ToUtcDateTime([object]$Value, [string]$ContextLabel) {
  if ($Value -is [datetime]) {
    return ([datetime]$Value).ToUniversalTime()
  }

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Fail ("Missing datetime value for " + $ContextLabel + ".")
  }

  $parsed = [datetime]::MinValue
  $style = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
  $ok = [datetime]::TryParse($raw, [System.Globalization.CultureInfo]::InvariantCulture, $style, [ref]$parsed)
  if (-not $ok) {
    Fail ("Invalid datetime value '" + $raw + "' for " + $ContextLabel + ".")
  }
  return $parsed.ToUniversalTime()
}

function Get-HttpStatusCode([object]$ErrorRecord) {
  try {
    if ($null -eq $ErrorRecord -or $null -eq $ErrorRecord.Exception) {
      return 0
    }

    $response = Get-ExceptionPropertyValue -Exception $ErrorRecord.Exception -Name "Response"
    if ($null -eq $response) {
      return 0
    }

    $statusCode = $response.StatusCode
    if ($null -eq $statusCode) {
      return 0
    }

    if ($statusCode -is [int]) {
      return [int]$statusCode
    }

    if ($null -ne $statusCode.value__) {
      return [int]$statusCode.value__
    }

    return [int]$statusCode
  }
  catch {
    return 0
  }
}

function Is-RetryableStatusCode([int]$StatusCode) {
  if ($StatusCode -eq 0) {
    return $true
  }
  return @(408, 429, 500, 502, 503, 504) -contains $StatusCode
}

function Invoke-WithRetry(
  [string]$OperationName,
  [int]$MaxAttempts,
  [int]$BaseBackoffMs,
  [scriptblock]$Operation
) {
  if ($MaxAttempts -lt 1) {
    $MaxAttempts = 1
  }
  if ($BaseBackoffMs -lt 0) {
    $BaseBackoffMs = 0
  }

  $attempt = 0
  while ($attempt -lt $MaxAttempts) {
    $attempt++
    try {
      return & $Operation
    }
    catch {
      $statusCode = Get-HttpStatusCode -ErrorRecord $_
      $retryable = Is-RetryableStatusCode -StatusCode $statusCode
      if ($attempt -ge $MaxAttempts -or -not $retryable) {
        throw
      }

      $delayMs = $BaseBackoffMs * $attempt
      Write-Host ("[artifact-revalidate] " + $OperationName + " failed (attempt " + $attempt + "/" + $MaxAttempts + ", status=" + $statusCode + "). Retrying in " + $delayMs + "ms...")
      if ($delayMs -gt 0) {
        Start-Sleep -Milliseconds $delayMs
      }
    }
  }

  throw ("Retry loop exited unexpectedly for operation: " + $OperationName)
}

function Invoke-GitHubJson([string]$Uri, [hashtable]$Headers) {
  return Invoke-WithRetry `
    -OperationName ("GitHub API GET " + $Uri) `
    -MaxAttempts $GithubApiMaxAttempts `
    -BaseBackoffMs $GithubApiRetryBackoffMs `
    -Operation {
      Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers -TimeoutSec 60
    }
}

function Download-ArtifactZip([string]$Uri, [hashtable]$Headers, [string]$OutFilePath) {
  Invoke-WithRetry `
    -OperationName ("Artifact download " + $Uri) `
    -MaxAttempts $GithubApiMaxAttempts `
    -BaseBackoffMs $GithubApiRetryBackoffMs `
    -Operation {
      Invoke-WebRequest -Uri $Uri -Headers $Headers -OutFile $OutFilePath -TimeoutSec 120 | Out-Null
    } | Out-Null
}

function Invoke-ReleaseReadinessGate(
  [bool]$IncludePerfChecks,
  [bool]$StrictMode,
  [string]$SummaryPath,
  [string]$PolicyPath,
  [string]$BadgePath,
  [string]$BadgeDetailsPath,
  [string]$PerfSummaryPath,
  [string]$PerfPolicyPath,
  [string]$SourceRunManifestPath,
  [string]$ReleaseEvidenceReportPath,
  [string]$ReleaseEvidenceReportMarkdownPath,
  [string]$ReleaseEvidenceManifestPath,
  [string]$ReleaseEvidenceManifestMarkdownPath
) {
  $releaseScript = Join-Path $PSScriptRoot "release-readiness.ps1"
  if (-not (Test-Path $releaseScript)) {
    Fail "release-readiness.ps1 was not found next to this script."
  }

  $releaseArgs = @{
    SkipBuild              = $true
    SkipUnitTests          = $true
    SkipMonitoringTemplates = $true
    SkipProfileSmoke       = $true
    SkipDemoE2E            = $true
    SkipPolicy             = $true
    SkipBadge              = $true
    SkipPerfRun            = $true
    SummaryPath            = $SummaryPath
    PolicyPath             = $PolicyPath
    BadgePath              = $BadgePath
    BadgeDetailsPath       = $BadgeDetailsPath
    PerfSummaryPath        = $PerfSummaryPath
    PerfPolicyPath         = $PerfPolicyPath
    SourceRunManifestPath  = $SourceRunManifestPath
    ReleaseEvidenceReportPath = $ReleaseEvidenceReportPath
    ReleaseEvidenceReportMarkdownPath = $ReleaseEvidenceReportMarkdownPath
    ReleaseEvidenceManifestPath = $ReleaseEvidenceManifestPath
    ReleaseEvidenceManifestMarkdownPath = $ReleaseEvidenceManifestMarkdownPath
  }

  if (-not $IncludePerfChecks) {
    $releaseArgs.SkipPerfLoad = $true
  }
  if ($StrictMode) {
    $releaseArgs.StrictFinalRun = $true
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
  $ghCliPath = Resolve-GhCli
  if (-not [string]::IsNullOrWhiteSpace($ghCliPath)) {
    try {
      $ghToken = (& $ghCliPath auth token 2>$null | Select-Object -First 1)
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

if ($GithubApiMaxAttempts -lt 1) {
  Fail "GithubApiMaxAttempts must be >= 1."
}

if ($GithubApiRetryBackoffMs -lt 0) {
  Fail "GithubApiRetryBackoffMs must be >= 0."
}

if ($MaxSourceRunAgeHours -lt 0) {
  Fail "MaxSourceRunAgeHours must be >= 0."
}

$headers = @{
  Accept                 = "application/vnd.github+json"
  Authorization          = "Bearer $Token"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$resolvedRunId = $SourceRunId
$resolvedRunWorkflowId = ""
$resolvedRunBranch = ""
$resolvedRunHeadSha = ""
$resolvedRunConclusion = ""
$resolvedRunUpdatedAtUtc = [datetime]::MinValue
$resolvedRunAgeHours = [double]::NaN

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
      if (-not $AllowAnySourceBranch -and $AllowedBranches -notcontains [string]$run.head_branch) {
        continue
      }
      $runUpdatedAtValue = if ($null -ne $run.updated_at) { $run.updated_at } else { $run.created_at }
      $candidateRuns += [pscustomobject]@{
        runId        = [long]$run.id
        updatedAtUtc = Convert-ToUtcDateTime -Value $runUpdatedAtValue -ContextLabel "workflow run updated_at"
        workflowId   = $workflowId
        headBranch   = [string]$run.head_branch
        headSha      = [string]$run.head_sha
        conclusion   = [string]$run.conclusion
      }
    }
  }

  if ($candidateRuns.Count -eq 0) {
    Fail "No successful workflow runs found in the allowed branches."
  }

  $latestRun = $candidateRuns | Sort-Object -Property updatedAtUtc -Descending | Select-Object -First 1
  $resolvedRunId = [long]$latestRun.runId
  $resolvedRunWorkflowId = [string]$latestRun.workflowId
  $resolvedRunBranch = [string]$latestRun.headBranch
  $resolvedRunHeadSha = [string]$latestRun.headSha
  $resolvedRunConclusion = [string]$latestRun.conclusion
  $resolvedRunUpdatedAtUtc = [datetime]$latestRun.updatedAtUtc
  Write-Host "[artifact-revalidate] Auto-selected run id: $resolvedRunId (workflow: $resolvedRunWorkflowId)"
}
else {
  Write-Host "[artifact-revalidate] Using provided run id: $resolvedRunId"

  $runDetailsUri = "https://api.github.com/repos/$Owner/$Repo/actions/runs/$resolvedRunId"
  $runDetails = Invoke-GitHubJson -Uri $runDetailsUri -Headers $headers
  $detailsRunId = [long]$runDetails.id
  if ($detailsRunId -le 0) {
    Fail "Failed to resolve workflow run metadata for provided run id $resolvedRunId."
  }

  $resolvedRunId = $detailsRunId
  $resolvedRunWorkflowId = [string]$runDetails.path
  if ([string]::IsNullOrWhiteSpace($resolvedRunWorkflowId)) {
    $resolvedRunWorkflowId = [string]$runDetails.name
  }
  if ([string]::IsNullOrWhiteSpace($resolvedRunWorkflowId)) {
    $resolvedRunWorkflowId = "unknown"
  }
  $resolvedRunBranch = [string]$runDetails.head_branch
  $resolvedRunHeadSha = [string]$runDetails.head_sha
  $resolvedRunConclusion = [string]$runDetails.conclusion
  $runDetailsUpdatedAtValue = if ($null -ne $runDetails.updated_at) { $runDetails.updated_at } else { $runDetails.created_at }
  $resolvedRunUpdatedAtUtc = Convert-ToUtcDateTime -Value $runDetailsUpdatedAtValue -ContextLabel "provided workflow run updated_at"
}

if ([string]::IsNullOrWhiteSpace($resolvedRunBranch)) {
  Fail ("Workflow run " + $resolvedRunId + " is missing head_branch metadata.")
}

if (-not $AllowAnySourceBranch -and $AllowedBranches -notcontains $resolvedRunBranch) {
  Fail ("Workflow run " + $resolvedRunId + " is from unsupported branch '" + $resolvedRunBranch + "'. Allowed branches: " + ($AllowedBranches -join ", "))
}

if ($resolvedRunConclusion -ne "success") {
  Fail ("Workflow run " + $resolvedRunId + " conclusion is '" + $resolvedRunConclusion + "'. Expected 'success'.")
}

$resolvedRunAgeHours = ([datetime]::UtcNow - $resolvedRunUpdatedAtUtc).TotalHours
if ($resolvedRunAgeHours -lt 0) {
  $resolvedRunAgeHours = 0
}
if ($MaxSourceRunAgeHours -gt 0 -and $resolvedRunAgeHours -gt [double]$MaxSourceRunAgeHours) {
  $formattedAge = [math]::Round($resolvedRunAgeHours, 2)
  Fail ("Workflow run " + $resolvedRunId + " is older than allowed threshold (" + $formattedAge + "h > " + $MaxSourceRunAgeHours + "h).")
}

$runAgeHoursRounded = [math]::Round($resolvedRunAgeHours, 2)
$resolvedRunHeadShaShort = "unknown"
if (-not [string]::IsNullOrWhiteSpace($resolvedRunHeadSha)) {
  $resolvedRunHeadShaShort = $resolvedRunHeadSha.Substring(0, [math]::Min(12, $resolvedRunHeadSha.Length))
}
Write-Host ("[artifact-revalidate] Source run metadata: branch=" + $resolvedRunBranch + ", conclusion=" + $resolvedRunConclusion + ", updatedAt=" + $resolvedRunUpdatedAtUtc.ToString("o") + ", ageHours=" + $runAgeHoursRounded + ", headSha=" + $resolvedRunHeadShaShort + ".")

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
Download-ArtifactZip -Uri $artifactDownloadUri -Headers $headers -OutFilePath $zipPath

Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
$bundleArtifactsDir = Join-Path $extractDir "artifacts"
if (-not (Test-Path $bundleArtifactsDir)) {
  $bundleArtifactChildren = @(Get-ChildItem -Path $extractDir -Force -ErrorAction SilentlyContinue)
  $bundleArtifactNames = @($bundleArtifactChildren | ForEach-Object { [string]$_.Name })
  $looksLikeArtifactRoot = (
    $bundleArtifactNames -contains "demo-e2e" -or
    $bundleArtifactNames -contains "perf-load" -or
    $bundleArtifactNames -contains "release-evidence"
  )
  if ($looksLikeArtifactRoot) {
    $bundleArtifactsDir = $extractDir
  }
  else {
    Fail "Downloaded bundle does not contain expected 'artifacts/' directory or recognized artifact root lanes."
  }
}

$restoredArtifactsDir = $bundleArtifactsDir
New-Item -Path $resolvedArtifactsDir -ItemType Directory -Force | Out-Null

$gateRequestedPerfMode = "not_run"
$gateEffectivePerfMode = "not_run"
$gateHasPerfArtifacts = "unknown"

if (-not $SkipArtifactOnlyGate) {
  $perfSummaryPath = Join-Path $restoredArtifactsDir "perf-load/summary.json"
  $perfPolicyPath = Join-Path $restoredArtifactsDir "perf-load/policy-check.json"
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
}

$manifestDir = Join-Path $resolvedArtifactsDir "release-artifact-revalidation"
New-Item -Path $manifestDir -ItemType Directory -Force | Out-Null
$sourceRunManifestPath = Join-Path $manifestDir "source-run.json"
$releaseEvidenceManifestPath = Join-Path $manifestDir "release-evidence/manifest.json"
$releaseEvidenceManifestMarkdownPath = Join-Path $manifestDir "release-evidence/manifest.md"
$retryableStatusCodes = @(408, 429, 500, 502, 503, 504)
$releaseEvidenceReportPath = Join-Path $restoredArtifactsDir "release-evidence/report.json"
$releaseEvidenceReportMarkdownPath = Join-Path $restoredArtifactsDir "release-evidence/report.md"
$railwayDeploySummaryPath = Join-Path $restoredArtifactsDir "deploy/railway-deploy-summary.json"
$repoPublishSummaryPath = Join-Path $restoredArtifactsDir "deploy/repo-publish-summary.json"

$demoSummaryPath = Join-Path $restoredArtifactsDir "demo-e2e/summary.json"
$policyPath = Join-Path $restoredArtifactsDir "demo-e2e/policy-check.json"
$badgePath = Join-Path $restoredArtifactsDir "demo-e2e/badge.json"
$badgeDetailsPath = Join-Path $restoredArtifactsDir "demo-e2e/badge-details.json"
$perfSummaryPath = Join-Path $restoredArtifactsDir "perf-load/summary.json"
$perfPolicyPath = Join-Path $restoredArtifactsDir "perf-load/policy-check.json"
$demoSummaryPresent = Test-Path $demoSummaryPath
$badgeDetailsPresent = Test-Path $badgeDetailsPath
$releaseEvidenceReportPresent = $false
$railwayDeploySummaryPresent = Test-Path $railwayDeploySummaryPath
$repoPublishSummaryPresent = Test-Path $repoPublishSummaryPath
$demoSummary = $null
$badgeDetails = $null
$releaseEvidenceReport = $null
$railwayDeploySummary = $null
$repoPublishSummary = $null

if ($demoSummaryPresent) {
  try {
    $demoSummary = Get-Content $demoSummaryPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Host ("[artifact-revalidate] Failed to parse demo summary for evidence snapshot: " + $_.Exception.Message)
  }
}

if ($badgeDetailsPresent) {
  try {
    $badgeDetails = Get-Content $badgeDetailsPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Host ("[artifact-revalidate] Failed to parse badge details for evidence snapshot: " + $_.Exception.Message)
  }
}

if ($badgeDetailsPresent) {
  $releaseEvidenceScriptPath = Join-Path $PSScriptRoot "release-evidence-report.ps1"
  if (-not (Test-Path $releaseEvidenceScriptPath)) {
    Fail ("Missing helper script: " + $releaseEvidenceScriptPath)
  }

  Write-Host "[artifact-revalidate] Build release evidence report"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $releaseEvidenceScriptPath `
    -BadgeDetailsPath $badgeDetailsPath `
    -OutputJsonPath $releaseEvidenceReportPath `
    -OutputMarkdownPath $releaseEvidenceReportMarkdownPath `
    -OutputManifestJsonPath $releaseEvidenceManifestPath `
    -OutputManifestMarkdownPath $releaseEvidenceManifestMarkdownPath
  if ($LASTEXITCODE -ne 0) {
    Fail "Build release evidence report failed."
  }
}

$releaseEvidenceReportPresent = Test-Path $releaseEvidenceReportPath
if ($releaseEvidenceReportPresent) {
  try {
    $releaseEvidenceReport = Get-Content $releaseEvidenceReportPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Host ("[artifact-revalidate] Failed to parse release evidence report for evidence snapshot: " + $_.Exception.Message)
  }
}

if ($railwayDeploySummaryPresent) {
  try {
    $railwayDeploySummary = Get-Content $railwayDeploySummaryPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Host ("[artifact-revalidate] Failed to parse railway deploy summary for evidence snapshot: " + $_.Exception.Message)
  }
}

if ($repoPublishSummaryPresent) {
  try {
    $repoPublishSummary = Get-Content $repoPublishSummaryPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Host ("[artifact-revalidate] Failed to parse repo publish summary for evidence snapshot: " + $_.Exception.Message)
  }
}

$operatorTurnTruncationSummaryValidated = $null
$operatorTurnDeleteSummaryValidated = $null
$operatorDamageControlSummaryValidated = $null
$operatorDamageControlTotal = $null
$operatorDamageControlLatestVerdict = $null
$operatorDamageControlLatestSource = $null
$operatorDamageControlLatestSeenAt = $null

if ($null -ne $demoSummary -and $null -ne $demoSummary.kpis) {
  $operatorTurnTruncationSummaryValidated = $demoSummary.kpis.operatorTurnTruncationSummaryValidated
  $operatorTurnDeleteSummaryValidated = $demoSummary.kpis.operatorTurnDeleteSummaryValidated
  $operatorDamageControlSummaryValidated = $demoSummary.kpis.operatorDamageControlSummaryValidated
  $operatorDamageControlTotal = $demoSummary.kpis.operatorDamageControlTotal
  $operatorDamageControlLatestVerdict = $demoSummary.kpis.operatorDamageControlLatestVerdict
  $operatorDamageControlLatestSource = $demoSummary.kpis.operatorDamageControlLatestSource
  $operatorDamageControlLatestSeenAt = $demoSummary.kpis.operatorDamageControlLatestSeenAt
}

$badgeEvidenceOperatorDamageControlStatus = $null
$badgeEvidenceGovernancePolicyStatus = $null
$badgeEvidenceSkillsRegistryStatus = $null
$badgeEvidencePluginMarketplaceStatus = $null
$badgeEvidenceDeviceNodesStatus = $null
$badgeEvidenceAgentUsageStatus = $null
$badgeEvidenceRuntimeGuardrailsSignalPathsStatus = $null
$badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus = $null
$badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths = $null
$badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath = $null
$badgeEvidenceProviderUsageStatus = "unavailable"
$badgeEvidenceProviderUsageValidated = $false
$badgeEvidenceProviderUsageActiveSecondaryProviders = 0
$badgeEvidenceProviderUsageEntriesCount = 0
$badgeEvidenceProviderUsagePrimaryEntry = $null
$badgeEvidenceDeviceNodeUpdatesStatus = "unavailable"
$railwayDeploySummaryStatus = "unavailable"
$railwayDeploySummaryDeploymentId = $null
$railwayDeploySummaryEffectivePublicUrl = $null
$railwayDeploySummaryBadgeEndpoint = $null
$railwayDeploySummaryBadgeDetailsEndpoint = $null
$railwayDeploySummaryProjectId = $null
$railwayDeploySummaryService = $null
$railwayDeploySummaryEnvironment = $null
$railwayDeploySummaryEffectiveStartCommand = $null
$railwayDeploySummaryConfigSource = $null
$railwayDeploySummaryRootDescriptorAttempted = $null
$railwayDeploySummaryRootDescriptorSkipped = $null
$railwayDeploySummaryRootDescriptorExpectedUiUrl = $null
$railwayDeploySummaryPublicBadgeAttempted = $null
$railwayDeploySummaryPublicBadgeSkipped = $null
$repoPublishSummaryVerificationScript = $null
$repoPublishSummaryReleaseEvidenceValidated = $false
$repoPublishSummaryRailwayDeployEnabled = $false
$repoPublishSummaryRailwayFrontendDeployEnabled = $false
$repoPublishSummaryBranch = $null
$repoPublishSummaryRemoteName = $null
$repoPublishSummaryVerificationSkipped = $null
$repoPublishSummaryVerificationStrict = $null
$repoPublishSummaryReleaseEvidenceArtifactsCount = $null
$repoPublishSummaryCommitEnabled = $null
$repoPublishSummaryPushEnabled = $null
$repoPublishSummaryPagesEnabled = $null
$repoPublishSummaryBadgeCheckEnabled = $null
$repoPublishSummaryRuntimeRailwayPublicUrl = $null
$repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl = $null
$repoPublishSummaryRuntimeRailwayNoWait = $null
$repoPublishSummaryRuntimeRailwayFrontendNoWait = $null
$repoPublishSummaryArtifactSelf = $null
$repoPublishSummaryArtifactRailwayDeploySummary = $null
$repoPublishSummaryArtifactReleaseEvidenceReportJson = $null
$repoPublishSummaryArtifactReleaseEvidenceManifestJson = $null
$repoPublishSummaryArtifactBadgeDetailsJson = $null
$badgeEvidenceOperatorTurnTruncationStatus = $null
$badgeEvidenceOperatorTurnDeleteStatus = $null
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.operatorTurnTruncation) {
  $badgeEvidenceOperatorTurnTruncationStatus = $badgeDetails.evidence.operatorTurnTruncation.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.operatorTurnDelete) {
  $badgeEvidenceOperatorTurnDeleteStatus = $badgeDetails.evidence.operatorTurnDelete.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.operatorDamageControl) {
  $badgeEvidenceOperatorDamageControlStatus = $badgeDetails.evidence.operatorDamageControl.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.governancePolicy) {
  $badgeEvidenceGovernancePolicyStatus = $badgeDetails.evidence.governancePolicy.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.skillsRegistry) {
  $badgeEvidenceSkillsRegistryStatus = $badgeDetails.evidence.skillsRegistry.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.pluginMarketplace) {
  $badgeEvidencePluginMarketplaceStatus = $badgeDetails.evidence.pluginMarketplace.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.deviceNodes) {
  $badgeEvidenceDeviceNodesStatus = $badgeDetails.evidence.deviceNodes.status
  $updatesValidated = ($badgeDetails.evidence.deviceNodes.updatesValidated -eq $true)
  $updatesHasUpsert = ($badgeDetails.evidence.deviceNodes.updatesHasUpsert -eq $true)
  $updatesHasHeartbeat = ($badgeDetails.evidence.deviceNodes.updatesHasHeartbeat -eq $true)
  $updatesApiValidated = ($badgeDetails.evidence.deviceNodes.updatesApiValidated -eq $true)
  $updatesTotalRaw = $badgeDetails.evidence.deviceNodes.updatesTotal
  $updatesTotal = 0
  if ($null -ne $updatesTotalRaw) {
    $updatesTotalParsed = 0
    if ([int]::TryParse([string]$updatesTotalRaw, [ref]$updatesTotalParsed)) {
      $updatesTotal = $updatesTotalParsed
    }
  }
  if ($updatesValidated -and $updatesHasUpsert -and $updatesHasHeartbeat -and $updatesApiValidated -and $updatesTotal -ge 2) {
    $badgeEvidenceDeviceNodeUpdatesStatus = "pass"
  }
  elseif ($updatesTotal -gt 0 -or $updatesHasUpsert -or $updatesHasHeartbeat -or $updatesValidated -or $updatesApiValidated) {
    $badgeEvidenceDeviceNodeUpdatesStatus = "fail"
  }
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.agentUsage) {
  $badgeEvidenceAgentUsageStatus = $badgeDetails.evidence.agentUsage.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence -and $null -ne $badgeDetails.evidence.runtimeGuardrailsSignalPaths) {
  $badgeEvidenceRuntimeGuardrailsSignalPathsStatus = $badgeDetails.evidence.runtimeGuardrailsSignalPaths.status
}
if ($null -ne $badgeDetails -and $null -ne $badgeDetails.providerUsage) {
  if (-not [string]::IsNullOrWhiteSpace([string]$badgeDetails.providerUsage.status)) {
    $badgeEvidenceProviderUsageStatus = [string]$badgeDetails.providerUsage.status
  }
  $badgeEvidenceProviderUsageValidated = ($badgeDetails.providerUsage.validated -eq $true)
  if ($null -ne $badgeDetails.providerUsage.activeSecondaryProviders) {
    $providerUsageActiveSecondaryProviders = 0
    if ([int]::TryParse([string]$badgeDetails.providerUsage.activeSecondaryProviders, [ref]$providerUsageActiveSecondaryProviders) -and $providerUsageActiveSecondaryProviders -ge 0) {
      $badgeEvidenceProviderUsageActiveSecondaryProviders = $providerUsageActiveSecondaryProviders
    }
  }
  $providerUsageEntries = @($badgeDetails.providerUsage.entries)
  $badgeEvidenceProviderUsageEntriesCount = $providerUsageEntries.Count
  if ($providerUsageEntries.Count -gt 0) {
    $badgeEvidenceProviderUsagePrimaryEntry = $providerUsageEntries[0]
  }
}
if ($null -ne $releaseEvidenceReport -and $null -ne $releaseEvidenceReport.runtimeGuardrailsSignalPaths) {
  if (-not [string]::IsNullOrWhiteSpace([string]$releaseEvidenceReport.runtimeGuardrailsSignalPaths.summaryStatus)) {
    $badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus = [string]$releaseEvidenceReport.runtimeGuardrailsSignalPaths.summaryStatus
  }
  if ($null -ne $releaseEvidenceReport.runtimeGuardrailsSignalPaths.totalPaths) {
    $badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths = $releaseEvidenceReport.runtimeGuardrailsSignalPaths.totalPaths
  }
  if ($null -ne $releaseEvidenceReport.runtimeGuardrailsSignalPaths.primaryPath) {
    $badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath = $releaseEvidenceReport.runtimeGuardrailsSignalPaths.primaryPath
  }
}
if ($null -ne $releaseEvidenceReport -and $null -ne $releaseEvidenceReport.statuses) {
  if (-not [string]::IsNullOrWhiteSpace([string]$releaseEvidenceReport.statuses.providerUsageStatus)) {
    $badgeEvidenceProviderUsageStatus = [string]$releaseEvidenceReport.statuses.providerUsageStatus
  }
}
if ($null -ne $releaseEvidenceReport -and $null -ne $releaseEvidenceReport.providerUsage) {
  $badgeEvidenceProviderUsageValidated = ($releaseEvidenceReport.providerUsage.validated -eq $true)
  if ($null -ne $releaseEvidenceReport.providerUsage.activeSecondaryProviders) {
    $providerUsageActiveSecondaryProviders = 0
    if ([int]::TryParse([string]$releaseEvidenceReport.providerUsage.activeSecondaryProviders, [ref]$providerUsageActiveSecondaryProviders) -and $providerUsageActiveSecondaryProviders -ge 0) {
      $badgeEvidenceProviderUsageActiveSecondaryProviders = $providerUsageActiveSecondaryProviders
    }
  }
  if ($null -ne $releaseEvidenceReport.providerUsage.entriesCount) {
    $providerUsageEntriesCount = 0
    if ([int]::TryParse([string]$releaseEvidenceReport.providerUsage.entriesCount, [ref]$providerUsageEntriesCount) -and $providerUsageEntriesCount -ge 0) {
      $badgeEvidenceProviderUsageEntriesCount = $providerUsageEntriesCount
    }
  }
  elseif ($null -ne $releaseEvidenceReport.providerUsage.entries) {
    $badgeEvidenceProviderUsageEntriesCount = @($releaseEvidenceReport.providerUsage.entries).Count
  }
  if ($null -ne $releaseEvidenceReport.providerUsage.primaryEntry) {
    $badgeEvidenceProviderUsagePrimaryEntry = $releaseEvidenceReport.providerUsage.primaryEntry
  }
}
if ($null -ne $railwayDeploySummary) {
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.status)) {
    $railwayDeploySummaryStatus = [string]$railwayDeploySummary.status
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.deploymentId)) {
    $railwayDeploySummaryDeploymentId = [string]$railwayDeploySummary.deploymentId
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.effectivePublicUrl)) {
    $railwayDeploySummaryEffectivePublicUrl = [string]$railwayDeploySummary.effectivePublicUrl
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.projectId)) {
    $railwayDeploySummaryProjectId = [string]$railwayDeploySummary.projectId
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.service)) {
    $railwayDeploySummaryService = [string]$railwayDeploySummary.service
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.environment)) {
    $railwayDeploySummaryEnvironment = [string]$railwayDeploySummary.environment
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.effectiveStartCommand)) {
    $railwayDeploySummaryEffectiveStartCommand = [string]$railwayDeploySummary.effectiveStartCommand
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.configSource)) {
    $railwayDeploySummaryConfigSource = [string]$railwayDeploySummary.configSource
  }
  $railwayRootDescriptorSummary = Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "checks") -Name "rootDescriptor"
  if ($null -ne $railwayRootDescriptorSummary) {
    $railwayDeploySummaryRootDescriptorAttempted = Get-ObjectPropertyValue -Object $railwayRootDescriptorSummary -Name "attempted"
    $railwayDeploySummaryRootDescriptorSkipped = Get-ObjectPropertyValue -Object $railwayRootDescriptorSummary -Name "skipped"
    $railwayRootDescriptorExpectedUiUrl = [string](Get-ObjectPropertyValue -Object $railwayRootDescriptorSummary -Name "expectedUiUrl")
    if (-not [string]::IsNullOrWhiteSpace($railwayRootDescriptorExpectedUiUrl)) {
      $railwayDeploySummaryRootDescriptorExpectedUiUrl = $railwayRootDescriptorExpectedUiUrl
    }
  }
  if ($null -ne $railwayDeploySummary.checks -and $null -ne $railwayDeploySummary.checks.publicBadge) {
    $railwayDeploySummaryPublicBadgeAttempted = Get-ObjectPropertyValue -Object $railwayDeploySummary.checks.publicBadge -Name "attempted"
    $railwayDeploySummaryPublicBadgeSkipped = Get-ObjectPropertyValue -Object $railwayDeploySummary.checks.publicBadge -Name "skipped"
    if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.checks.publicBadge.badgeEndpoint)) {
      $railwayDeploySummaryBadgeEndpoint = [string]$railwayDeploySummary.checks.publicBadge.badgeEndpoint
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummary.checks.publicBadge.badgeDetailsEndpoint)) {
      $railwayDeploySummaryBadgeDetailsEndpoint = [string]$railwayDeploySummary.checks.publicBadge.badgeDetailsEndpoint
    }
  }
}
if ($null -ne $repoPublishSummary) {
  if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.branch)) {
    $repoPublishSummaryBranch = [string]$repoPublishSummary.branch
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.remoteName)) {
    $repoPublishSummaryRemoteName = [string]$repoPublishSummary.remoteName
  }
  if ($null -ne $repoPublishSummary.verification) {
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.verification.script)) {
      $repoPublishSummaryVerificationScript = [string]$repoPublishSummary.verification.script
    }
    $repoPublishSummaryReleaseEvidenceValidated = ($repoPublishSummary.verification.releaseEvidenceArtifactsValidated -eq $true)
    $repoPublishSummaryVerificationSkipped = Get-ObjectPropertyValue -Object $repoPublishSummary.verification -Name "skipped"
    $repoPublishSummaryVerificationStrict = Get-ObjectPropertyValue -Object $repoPublishSummary.verification -Name "strict"
    $releaseEvidenceArtifacts = Get-ObjectPropertyValue -Object $repoPublishSummary.verification -Name "releaseEvidenceArtifacts"
    if ($null -ne $releaseEvidenceArtifacts) {
      $repoPublishSummaryReleaseEvidenceArtifactsCount = @($releaseEvidenceArtifacts).Count
    }
  }
  if ($null -ne $repoPublishSummary.steps) {
    $repoPublishSummaryCommitEnabled = Get-ObjectPropertyValue -Object $repoPublishSummary.steps -Name "commitEnabled"
    $repoPublishSummaryPushEnabled = Get-ObjectPropertyValue -Object $repoPublishSummary.steps -Name "pushEnabled"
    $repoPublishSummaryPagesEnabled = Get-ObjectPropertyValue -Object $repoPublishSummary.steps -Name "pagesEnabled"
    $repoPublishSummaryBadgeCheckEnabled = Get-ObjectPropertyValue -Object $repoPublishSummary.steps -Name "badgeCheckEnabled"
    $repoPublishSummaryRailwayDeployEnabled = ($repoPublishSummary.steps.railwayDeployEnabled -eq $true)
    $repoPublishSummaryRailwayFrontendDeployEnabled = ($repoPublishSummary.steps.railwayFrontendDeployEnabled -eq $true)
  }
  if ($null -ne $repoPublishSummary.runtime) {
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.runtime.railwayPublicUrl)) {
      $repoPublishSummaryRuntimeRailwayPublicUrl = [string]$repoPublishSummary.runtime.railwayPublicUrl
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.runtime.railwayDemoFrontendPublicUrl)) {
      $repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl = [string]$repoPublishSummary.runtime.railwayDemoFrontendPublicUrl
    }
    $repoPublishSummaryRuntimeRailwayNoWait = Get-ObjectPropertyValue -Object $repoPublishSummary.runtime -Name "railwayNoWait"
    $repoPublishSummaryRuntimeRailwayFrontendNoWait = Get-ObjectPropertyValue -Object $repoPublishSummary.runtime -Name "railwayFrontendNoWait"
  }
  if ($null -ne $repoPublishSummary.artifacts) {
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.artifacts.self)) {
      $repoPublishSummaryArtifactSelf = [string]$repoPublishSummary.artifacts.self
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.artifacts.railwayDeploySummary)) {
      $repoPublishSummaryArtifactRailwayDeploySummary = [string]$repoPublishSummary.artifacts.railwayDeploySummary
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.artifacts.releaseEvidenceReportJson)) {
      $repoPublishSummaryArtifactReleaseEvidenceReportJson = [string]$repoPublishSummary.artifacts.releaseEvidenceReportJson
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.artifacts.releaseEvidenceManifestJson)) {
      $repoPublishSummaryArtifactReleaseEvidenceManifestJson = [string]$repoPublishSummary.artifacts.releaseEvidenceManifestJson
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummary.artifacts.badgeDetailsJson)) {
      $repoPublishSummaryArtifactBadgeDetailsJson = [string]$repoPublishSummary.artifacts.badgeDetailsJson
    }
  }
}

$gateEvidenceSnapshot = [ordered]@{
  demoSummaryPresent                          = [bool]$demoSummaryPresent
  badgeDetailsPresent                         = [bool]$badgeDetailsPresent
  releaseEvidenceReportPresent                = [bool]$releaseEvidenceReportPresent
  railwayDeploySummaryPresent                 = [bool]$railwayDeploySummaryPresent
  railwayDeploySummaryStatus                  = $railwayDeploySummaryStatus
  railwayDeploySummaryDeploymentId            = $railwayDeploySummaryDeploymentId
  railwayDeploySummaryEffectivePublicUrl      = $railwayDeploySummaryEffectivePublicUrl
  railwayDeploySummaryBadgeEndpoint           = $railwayDeploySummaryBadgeEndpoint
  railwayDeploySummaryBadgeDetailsEndpoint    = $railwayDeploySummaryBadgeDetailsEndpoint
  railwayDeploySummaryProjectId               = $railwayDeploySummaryProjectId
  railwayDeploySummaryService                 = $railwayDeploySummaryService
  railwayDeploySummaryEnvironment             = $railwayDeploySummaryEnvironment
  railwayDeploySummaryEffectiveStartCommand   = $railwayDeploySummaryEffectiveStartCommand
  railwayDeploySummaryConfigSource            = $railwayDeploySummaryConfigSource
  railwayDeploySummaryRootDescriptorAttempted = $railwayDeploySummaryRootDescriptorAttempted
  railwayDeploySummaryRootDescriptorSkipped   = $railwayDeploySummaryRootDescriptorSkipped
  railwayDeploySummaryRootDescriptorExpectedUiUrl = $railwayDeploySummaryRootDescriptorExpectedUiUrl
  railwayDeploySummaryPublicBadgeAttempted    = $railwayDeploySummaryPublicBadgeAttempted
  railwayDeploySummaryPublicBadgeSkipped      = $railwayDeploySummaryPublicBadgeSkipped
  repoPublishSummaryPresent                   = [bool]$repoPublishSummaryPresent
  repoPublishSummaryBranch                    = $repoPublishSummaryBranch
  repoPublishSummaryRemoteName                = $repoPublishSummaryRemoteName
  repoPublishSummaryVerificationScript        = $repoPublishSummaryVerificationScript
  repoPublishSummaryVerificationSkipped       = $repoPublishSummaryVerificationSkipped
  repoPublishSummaryVerificationStrict        = $repoPublishSummaryVerificationStrict
  repoPublishSummaryReleaseEvidenceValidated  = $repoPublishSummaryReleaseEvidenceValidated
  repoPublishSummaryReleaseEvidenceArtifactsCount = $repoPublishSummaryReleaseEvidenceArtifactsCount
  repoPublishSummaryCommitEnabled             = $repoPublishSummaryCommitEnabled
  repoPublishSummaryPushEnabled               = $repoPublishSummaryPushEnabled
  repoPublishSummaryPagesEnabled              = $repoPublishSummaryPagesEnabled
  repoPublishSummaryBadgeCheckEnabled         = $repoPublishSummaryBadgeCheckEnabled
  repoPublishSummaryRailwayDeployEnabled      = $repoPublishSummaryRailwayDeployEnabled
  repoPublishSummaryRailwayFrontendDeployEnabled = $repoPublishSummaryRailwayFrontendDeployEnabled
  repoPublishSummaryRuntimeRailwayPublicUrl   = $repoPublishSummaryRuntimeRailwayPublicUrl
  repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl = $repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl
  repoPublishSummaryRuntimeRailwayNoWait      = $repoPublishSummaryRuntimeRailwayNoWait
  repoPublishSummaryRuntimeRailwayFrontendNoWait = $repoPublishSummaryRuntimeRailwayFrontendNoWait
  repoPublishSummaryArtifactSelf              = $repoPublishSummaryArtifactSelf
  repoPublishSummaryArtifactRailwayDeploySummary = $repoPublishSummaryArtifactRailwayDeploySummary
  repoPublishSummaryArtifactReleaseEvidenceReportJson = $repoPublishSummaryArtifactReleaseEvidenceReportJson
  repoPublishSummaryArtifactReleaseEvidenceManifestJson = $repoPublishSummaryArtifactReleaseEvidenceManifestJson
  repoPublishSummaryArtifactBadgeDetailsJson  = $repoPublishSummaryArtifactBadgeDetailsJson
  operatorTurnTruncationSummaryValidated      = $operatorTurnTruncationSummaryValidated
  operatorTurnDeleteSummaryValidated          = $operatorTurnDeleteSummaryValidated
  operatorDamageControlSummaryValidated       = $operatorDamageControlSummaryValidated
  operatorDamageControlTotal                  = $operatorDamageControlTotal
  operatorDamageControlLatestVerdict          = $operatorDamageControlLatestVerdict
  operatorDamageControlLatestSource           = $operatorDamageControlLatestSource
  operatorDamageControlLatestSeenAt           = $operatorDamageControlLatestSeenAt
  badgeEvidenceOperatorTurnTruncationStatus   = $badgeEvidenceOperatorTurnTruncationStatus
  badgeEvidenceOperatorTurnDeleteStatus       = $badgeEvidenceOperatorTurnDeleteStatus
  badgeEvidenceOperatorDamageControlStatus    = $badgeEvidenceOperatorDamageControlStatus
  badgeEvidenceGovernancePolicyStatus         = $badgeEvidenceGovernancePolicyStatus
  badgeEvidenceSkillsRegistryStatus           = $badgeEvidenceSkillsRegistryStatus
  badgeEvidencePluginMarketplaceStatus        = $badgeEvidencePluginMarketplaceStatus
  badgeEvidenceDeviceNodesStatus              = $badgeEvidenceDeviceNodesStatus
  badgeEvidenceAgentUsageStatus               = $badgeEvidenceAgentUsageStatus
  badgeEvidenceRuntimeGuardrailsSignalPathsStatus = $badgeEvidenceRuntimeGuardrailsSignalPathsStatus
  badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus = $badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus
  badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths = $badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths
  badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath = $badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath
  badgeEvidenceProviderUsageStatus            = $badgeEvidenceProviderUsageStatus
  badgeEvidenceProviderUsageValidated         = $badgeEvidenceProviderUsageValidated
  badgeEvidenceProviderUsageActiveSecondaryProviders = $badgeEvidenceProviderUsageActiveSecondaryProviders
  badgeEvidenceProviderUsageEntriesCount      = $badgeEvidenceProviderUsageEntriesCount
  badgeEvidenceProviderUsagePrimaryEntry      = $badgeEvidenceProviderUsagePrimaryEntry
  badgeEvidenceDeviceNodeUpdatesStatus        = $badgeEvidenceDeviceNodeUpdatesStatus
}

$sourceRunManifest = [ordered]@{
  schemaVersion = "1.0"
  generatedAt = [datetime]::UtcNow.ToString("o")
  repository = [ordered]@{
    owner = $Owner
    repo  = $Repo
  }
  sourceRun = [ordered]@{
    runId        = [long]$resolvedRunId
    workflow     = $resolvedRunWorkflowId
    branch       = $resolvedRunBranch
    headSha      = $resolvedRunHeadSha
    headShaShort = $resolvedRunHeadShaShort
    conclusion   = $resolvedRunConclusion
    updatedAtUtc = $resolvedRunUpdatedAtUtc.ToString("o")
    ageHours     = $runAgeHoursRounded
  }
  artifact = [ordered]@{
    name = [string]$resolvedArtifact.name
    id   = [long]$resolvedArtifact.id
  }
  sourceSelection = [ordered]@{
    allowAnySourceBranch = [bool]$AllowAnySourceBranch
    allowedBranches      = $AllowedBranches
    maxSourceRunAgeHours = $MaxSourceRunAgeHours
  }
  gate = [ordered]@{
    skipArtifactOnlyGate = [bool]$SkipArtifactOnlyGate
    strictFinalRun       = [bool]$StrictFinalRun
    requestedPerfMode    = $gateRequestedPerfMode
    effectivePerfMode    = $gateEffectivePerfMode
    perfArtifactsDetected = $gateHasPerfArtifacts
    evidenceSnapshot     = $gateEvidenceSnapshot
  }
  retry = [ordered]@{
    githubApiMaxAttempts     = $GithubApiMaxAttempts
    githubApiRetryBackoffMs  = $GithubApiRetryBackoffMs
    retryableStatusCodes     = $retryableStatusCodes
  }
}
$sourceRunManifestJson = $sourceRunManifest | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $sourceRunManifestPath -Content $sourceRunManifestJson
Write-Host ("[artifact-revalidate] Source run manifest written: " + $sourceRunManifestPath)

if (-not $SkipArtifactOnlyGate) {
  $includePerfChecks = ($gateEffectivePerfMode -eq "with_perf")
  Invoke-ReleaseReadinessGate `
    -IncludePerfChecks $includePerfChecks `
    -StrictMode $StrictFinalRun `
    -SummaryPath $demoSummaryPath `
    -PolicyPath $policyPath `
    -BadgePath $badgePath `
    -BadgeDetailsPath $badgeDetailsPath `
    -PerfSummaryPath $perfSummaryPath `
    -PerfPolicyPath $perfPolicyPath `
    -SourceRunManifestPath $sourceRunManifestPath `
    -ReleaseEvidenceReportPath $releaseEvidenceReportPath `
    -ReleaseEvidenceReportMarkdownPath $releaseEvidenceReportMarkdownPath `
    -ReleaseEvidenceManifestPath $releaseEvidenceManifestPath `
    -ReleaseEvidenceManifestMarkdownPath $releaseEvidenceManifestMarkdownPath
}
else {
  Write-Host "[artifact-revalidate] SkipArtifactOnlyGate enabled; artifacts were restored without running release gate."
}

Write-Host ""
Write-Host "Artifact revalidation flow completed."
Write-Host ("- run id: " + $resolvedRunId)
Write-Host ("- run workflow: " + $resolvedRunWorkflowId)
Write-Host ("- run branch: " + $resolvedRunBranch)
Write-Host ("- run head sha: " + $resolvedRunHeadShaShort)
Write-Host ("- run updated at (UTC): " + $resolvedRunUpdatedAtUtc.ToString("o"))
Write-Host ("- run age hours: " + $runAgeHoursRounded)
Write-Host ("- artifact: " + $resolvedArtifact.name)
Write-Host ("- restored artifacts path: " + $restoredArtifactsDir)
Write-Host ("- revalidation output path: " + $manifestDir)
Write-Host ("- strict final run: " + $StrictFinalRun)
Write-Host ("- allow any source branch: " + $AllowAnySourceBranch)
Write-Host ("- max source run age hours: " + $MaxSourceRunAgeHours)
Write-Host ("- requested perf gate mode: " + $gateRequestedPerfMode)
Write-Host ("- effective perf gate mode: " + $gateEffectivePerfMode)
Write-Host ("- perf artifacts detected: " + $gateHasPerfArtifacts)
Write-Host ("- evidence snapshot (railway deploy summary present): " + $railwayDeploySummaryPresent)
Write-Host ("- evidence snapshot (railway deploy summary status): " + $railwayDeploySummaryStatus)
Write-Host ("- evidence snapshot (railway deploy summary deployment id): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryDeploymentId)) { $railwayDeploySummaryDeploymentId } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary public url): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryEffectivePublicUrl)) { $railwayDeploySummaryEffectivePublicUrl } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary badge endpoint): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryBadgeEndpoint)) { $railwayDeploySummaryBadgeEndpoint } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary badge details endpoint): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryBadgeDetailsEndpoint)) { $railwayDeploySummaryBadgeDetailsEndpoint } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary project id): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryProjectId)) { $railwayDeploySummaryProjectId } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary service): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryService)) { $railwayDeploySummaryService } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary environment): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryEnvironment)) { $railwayDeploySummaryEnvironment } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary effective start command): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryEffectiveStartCommand)) { $railwayDeploySummaryEffectiveStartCommand } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary config source): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryConfigSource)) { $railwayDeploySummaryConfigSource } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary root descriptor attempted): " + $(if ($null -ne $railwayDeploySummaryRootDescriptorAttempted) { [string]$railwayDeploySummaryRootDescriptorAttempted } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary root descriptor skipped): " + $(if ($null -ne $railwayDeploySummaryRootDescriptorSkipped) { [string]$railwayDeploySummaryRootDescriptorSkipped } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary expected UI URL): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$railwayDeploySummaryRootDescriptorExpectedUiUrl)) { $railwayDeploySummaryRootDescriptorExpectedUiUrl } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary public badge attempted): " + $(if ($null -ne $railwayDeploySummaryPublicBadgeAttempted) { [string]$railwayDeploySummaryPublicBadgeAttempted } else { "(none)" }))
Write-Host ("- evidence snapshot (railway deploy summary public badge skipped): " + $(if ($null -ne $railwayDeploySummaryPublicBadgeSkipped) { [string]$railwayDeploySummaryPublicBadgeSkipped } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish summary present): " + $repoPublishSummaryPresent)
Write-Host ("- evidence snapshot (repo publish branch): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryBranch)) { $repoPublishSummaryBranch } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish remote name): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryRemoteName)) { $repoPublishSummaryRemoteName } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish verification script): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryVerificationScript)) { $repoPublishSummaryVerificationScript } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish verification skipped): " + $(if ($null -ne $repoPublishSummaryVerificationSkipped) { [string]$repoPublishSummaryVerificationSkipped } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish verification strict): " + $(if ($null -ne $repoPublishSummaryVerificationStrict) { [string]$repoPublishSummaryVerificationStrict } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish release-evidence validated): " + $repoPublishSummaryReleaseEvidenceValidated)
Write-Host ("- evidence snapshot (repo publish release-evidence artifacts count): " + $(if ($null -ne $repoPublishSummaryReleaseEvidenceArtifactsCount) { [string]$repoPublishSummaryReleaseEvidenceArtifactsCount } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish commit enabled): " + $(if ($null -ne $repoPublishSummaryCommitEnabled) { [string]$repoPublishSummaryCommitEnabled } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish push enabled): " + $(if ($null -ne $repoPublishSummaryPushEnabled) { [string]$repoPublishSummaryPushEnabled } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish pages enabled): " + $(if ($null -ne $repoPublishSummaryPagesEnabled) { [string]$repoPublishSummaryPagesEnabled } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish badge-check enabled): " + $(if ($null -ne $repoPublishSummaryBadgeCheckEnabled) { [string]$repoPublishSummaryBadgeCheckEnabled } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish Railway deploy enabled): " + $repoPublishSummaryRailwayDeployEnabled)
Write-Host ("- evidence snapshot (repo publish Railway frontend deploy enabled): " + $repoPublishSummaryRailwayFrontendDeployEnabled)
Write-Host ("- evidence snapshot (repo publish runtime Railway public URL): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryRuntimeRailwayPublicUrl)) { $repoPublishSummaryRuntimeRailwayPublicUrl } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish runtime Railway frontend URL): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl)) { $repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish runtime Railway no-wait): " + $(if ($null -ne $repoPublishSummaryRuntimeRailwayNoWait) { [string]$repoPublishSummaryRuntimeRailwayNoWait } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish runtime Railway frontend no-wait): " + $(if ($null -ne $repoPublishSummaryRuntimeRailwayFrontendNoWait) { [string]$repoPublishSummaryRuntimeRailwayFrontendNoWait } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish artifact self): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryArtifactSelf)) { $repoPublishSummaryArtifactSelf } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish artifact Railway deploy summary): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryArtifactRailwayDeploySummary)) { $repoPublishSummaryArtifactRailwayDeploySummary } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish artifact release evidence report): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryArtifactReleaseEvidenceReportJson)) { $repoPublishSummaryArtifactReleaseEvidenceReportJson } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish artifact release evidence manifest): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryArtifactReleaseEvidenceManifestJson)) { $repoPublishSummaryArtifactReleaseEvidenceManifestJson } else { "(none)" }))
Write-Host ("- evidence snapshot (repo publish artifact badge details): " + $(if (-not [string]::IsNullOrWhiteSpace([string]$repoPublishSummaryArtifactBadgeDetailsJson)) { $repoPublishSummaryArtifactBadgeDetailsJson } else { "(none)" }))
Write-Host ("- evidence snapshot (turn truncation status): " + $badgeEvidenceOperatorTurnTruncationStatus)
Write-Host ("- evidence snapshot (turn delete status): " + $badgeEvidenceOperatorTurnDeleteStatus)
Write-Host ("- evidence snapshot (operator damage-control status): " + $badgeEvidenceOperatorDamageControlStatus)
Write-Host ("- evidence snapshot (governance policy status): " + $badgeEvidenceGovernancePolicyStatus)
Write-Host ("- evidence snapshot (skills registry status): " + $badgeEvidenceSkillsRegistryStatus)
Write-Host ("- evidence snapshot (plugin marketplace status): " + $badgeEvidencePluginMarketplaceStatus)
Write-Host ("- evidence snapshot (device nodes status): " + $badgeEvidenceDeviceNodesStatus)
Write-Host ("- evidence snapshot (agent usage status): " + $badgeEvidenceAgentUsageStatus)
Write-Host ("- evidence snapshot (runtime guardrails signal paths status): " + $badgeEvidenceRuntimeGuardrailsSignalPathsStatus)
Write-Host ("- evidence snapshot (runtime guardrails signal paths summary status): " + $badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus)
Write-Host ("- evidence snapshot (runtime guardrails signal paths total paths): " + $badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths)
Write-Host ("- evidence snapshot (runtime guardrails signal paths primary path title): " + $(if ($null -ne $badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath) { [string]$badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath.title } else { "(none)" }))
Write-Host ("- evidence snapshot (provider usage status): " + $badgeEvidenceProviderUsageStatus)
Write-Host ("- evidence snapshot (provider usage validated): " + $badgeEvidenceProviderUsageValidated)
Write-Host ("- evidence snapshot (provider usage active secondary providers): " + $badgeEvidenceProviderUsageActiveSecondaryProviders)
Write-Host ("- evidence snapshot (provider usage entries count): " + $badgeEvidenceProviderUsageEntriesCount)
Write-Host ("- evidence snapshot (provider usage primary entry): " + $(if ($null -ne $badgeEvidenceProviderUsagePrimaryEntry) { ([string]$badgeEvidenceProviderUsagePrimaryEntry.route + "/" + [string]$badgeEvidenceProviderUsagePrimaryEntry.capability + " -> " + [string]$badgeEvidenceProviderUsagePrimaryEntry.selectedProvider + "/" + [string]$badgeEvidenceProviderUsagePrimaryEntry.selectedModel) } else { "(none)" }))
Write-Host ("- evidence snapshot (device node updates status): " + $badgeEvidenceDeviceNodeUpdatesStatus)
if (Test-Path $releaseEvidenceReportPath) {
  Write-Host ("- release evidence report: " + $releaseEvidenceReportPath)
}
Write-Host ("- source run manifest: " + $sourceRunManifestPath)

if (-not $KeepTemp) {
  if (Test-Path $resolvedTempDir) {
    Remove-Item -Path $resolvedTempDir -Recurse -Force
  }
}
else {
  Write-Host ("- temp path kept: " + $resolvedTempDir)
}
