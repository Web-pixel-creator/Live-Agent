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
      $candidateRuns += [pscustomobject]@{
        runId        = [long]$run.id
        updatedAtUtc = Convert-ToUtcDateTime -Value ($run.updated_at ?? $run.created_at) -ContextLabel "workflow run updated_at"
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
  $resolvedRunUpdatedAtUtc = Convert-ToUtcDateTime -Value ($runDetails.updated_at ?? $runDetails.created_at) -ContextLabel "provided workflow run updated_at"
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

$manifestDir = Join-Path $resolvedArtifactsDir "release-artifact-revalidation"
New-Item -Path $manifestDir -ItemType Directory -Force | Out-Null
$sourceRunManifestPath = Join-Path $manifestDir "source-run.json"
$retryableStatusCodes = @(408, 429, 500, 502, 503, 504)
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

Write-Host ""
Write-Host "Artifact revalidation flow completed."
Write-Host ("- run id: " + $resolvedRunId)
Write-Host ("- run workflow: " + $resolvedRunWorkflowId)
Write-Host ("- run branch: " + $resolvedRunBranch)
Write-Host ("- run head sha: " + $resolvedRunHeadShaShort)
Write-Host ("- run updated at (UTC): " + $resolvedRunUpdatedAtUtc.ToString("o"))
Write-Host ("- run age hours: " + $runAgeHoursRounded)
Write-Host ("- artifact: " + $resolvedArtifact.name)
Write-Host ("- restored artifacts path: " + $resolvedArtifactsDir)
Write-Host ("- strict final run: " + $StrictFinalRun)
Write-Host ("- allow any source branch: " + $AllowAnySourceBranch)
Write-Host ("- max source run age hours: " + $MaxSourceRunAgeHours)
Write-Host ("- requested perf gate mode: " + $gateRequestedPerfMode)
Write-Host ("- effective perf gate mode: " + $gateEffectivePerfMode)
Write-Host ("- perf artifacts detected: " + $gateHasPerfArtifacts)
Write-Host ("- source run manifest: " + $sourceRunManifestPath)

if (-not $KeepTemp) {
  if (Test-Path $resolvedTempDir) {
    Remove-Item -Path $resolvedTempDir -Recurse -Force
  }
}
else {
  Write-Host ("- temp path kept: " + $resolvedTempDir)
}
