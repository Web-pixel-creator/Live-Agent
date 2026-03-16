[CmdletBinding()]
param(
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [string]$RemoteName = "origin",
  [string]$Branch = "main",
  [string]$CommitMessage = "chore: challenge-ready baseline",
  [string]$RemoteUrl = "",
  [switch]$UseHttps,
  [switch]$ForceRemoteUpdate,
  [switch]$SkipGitInit,
  [switch]$SkipCommit,
  [switch]$SkipPush,
  [switch]$SkipPages,
  [switch]$SkipBadgeCheck,
  [switch]$SkipReleaseVerification,
  [switch]$StrictReleaseVerification,
  [switch]$DeployRailway,
  [string]$RailwayProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$RailwayServiceId = $env:RAILWAY_SERVICE_ID,
  [string]$RailwayEnvironment = $env:RAILWAY_ENVIRONMENT,
  [string]$RailwayWorkspace = $env:RAILWAY_WORKSPACE,
  [switch]$RailwaySkipLink,
  [switch]$RailwaySkipPublicBadgeCheck,
  [switch]$RailwaySkipRootDescriptorCheck,
  [string]$RailwayPublicBadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$RailwayPublicBadgeDetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [string]$RailwayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [string]$RailwayDemoFrontendPublicUrl = $env:DEMO_FRONTEND_PUBLIC_URL,
  [int]$RailwayPublicBadgeCheckTimeoutSec = 20,
  [int]$RailwayRootDescriptorCheckMaxAttempts = 3,
  [int]$RailwayRootDescriptorCheckRetryBackoffSec = 2,
  [switch]$RailwayNoWait,
  [switch]$DeployRailwayFrontend,
  [string]$RailwayFrontendProjectId = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_PROJECT_ID)) { $env:RAILWAY_FRONTEND_PROJECT_ID } else { $env:RAILWAY_PROJECT_ID }),
  [string]$RailwayFrontendService = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE_ID)) { $env:RAILWAY_FRONTEND_SERVICE_ID } elseif (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE)) { $env:RAILWAY_FRONTEND_SERVICE } else { "Live-Agent-Frontend" }),
  [string]$RailwayFrontendEnvironment = $env:RAILWAY_ENVIRONMENT,
  [string]$RailwayFrontendPath = "apps/demo-frontend",
  [string]$RailwayFrontendWsUrl = $env:FRONTEND_WS_URL,
  [string]$RailwayFrontendApiBaseUrl = $env:FRONTEND_API_BASE_URL,
  [switch]$RailwayFrontendNoWait,
  [switch]$RailwayFrontendSkipHealthCheck,
  [int]$RailwayFrontendHealthCheckTimeoutSec = 20,
  [int]$BadgeCheckAttempts = 20,
  [int]$BadgeCheckIntervalSec = 20
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Write-RepoPublishSummary([object]$Summary) {
  $summaryPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\artifacts\deploy\repo-publish-summary.json"))
  $summaryJson = $Summary | ConvertTo-Json -Depth 10
  Write-Utf8NoBomFile -Path $summaryPath -Content $summaryJson
  return $summaryPath
}

function Write-GitHubOutputValue([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) {
    return
  }

  $line = $Name + "=" + $Value
  $line | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
}

function Write-GitHubStepSummaryLine([string]$Line) {
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    return
  }

  $Line | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
}

function Read-JsonArtifactIfPresent([string]$RelativePath, [string]$Label) {
  $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ("..\" + $RelativePath)))
  if (-not (Test-Path $resolvedPath)) {
    return $null
  }

  try {
    return Get-Content -Path $resolvedPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Warning ("[repo-publish] Failed to parse " + $Label + ": " + $_.Exception.Message)
    return $null
  }
}

function Convert-ToNullableString([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) {
    return $null
  }

  return $text
}

function Convert-ToNullableInt([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) {
    return $parsed
  }

  return $null
}

function Convert-ToNullableDouble([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $parsed = [double]0
  if ([double]::TryParse([string]$Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
    return $parsed
  }

  return $null
}

function Get-CompactRuntimeGuardrailsPrimaryPath([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $title = Convert-ToNullableString -Value $Value.title
  $kind = Convert-ToNullableString -Value $Value.kind
  $summaryText = Convert-ToNullableString -Value $Value.summaryText
  if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($kind) -and [string]::IsNullOrWhiteSpace($summaryText)) {
    return $null
  }

  return [ordered]@{
    title = $title
    kind = $kind
    profileId = Convert-ToNullableString -Value $Value.profileId
    phase = Convert-ToNullableString -Value $Value.phase
    buttonLabel = Convert-ToNullableString -Value $Value.buttonLabel
    summaryText = $summaryText
    lifecycleStatus = Convert-ToNullableString -Value $Value.lifecycleStatus
  }
}

function Get-CompactProviderUsagePrimaryEntry([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $route = Convert-ToNullableString -Value $Value.route
  $capability = Convert-ToNullableString -Value $Value.capability
  $selectedProvider = Convert-ToNullableString -Value $Value.selectedProvider
  $selectedModel = Convert-ToNullableString -Value $Value.selectedModel
  $selectionReason = Convert-ToNullableString -Value $Value.selectionReason
  if (
    [string]::IsNullOrWhiteSpace($route) -and
    [string]::IsNullOrWhiteSpace($capability) -and
    [string]::IsNullOrWhiteSpace($selectedProvider) -and
    [string]::IsNullOrWhiteSpace($selectedModel) -and
    [string]::IsNullOrWhiteSpace($selectionReason)
  ) {
    return $null
  }

  return [ordered]@{
    route = $route
    capability = $capability
    selectedProvider = $selectedProvider
    selectedModel = $selectedModel
    selectionReason = $selectionReason
  }
}

function Get-ReleaseEvidenceSnapshot([bool]$ValidatedInThisRun) {
  $report = Read-JsonArtifactIfPresent -RelativePath "artifacts/release-evidence/report.json" -Label "release evidence report"
  $manifest = Read-JsonArtifactIfPresent -RelativePath "artifacts/release-evidence/manifest.json" -Label "release evidence manifest"
  $badgeDetails = Read-JsonArtifactIfPresent -RelativePath "artifacts/demo-e2e/badge-details.json" -Label "demo badge-details"

  $runtimeGuardrailsSource = if ($null -ne $report -and $null -ne $report.runtimeGuardrailsSignalPaths) {
    $report.runtimeGuardrailsSignalPaths
  }
  else {
    $badgeDetails.evidence.runtimeGuardrailsSignalPaths
  }
  $providerUsageSource = if ($null -ne $report -and $null -ne $report.providerUsage) {
    $report.providerUsage
  }
  else {
    $badgeDetails.providerUsage
  }
  $deviceNodeUpdatesSource = if ($null -ne $report -and $null -ne $report.deviceNodeUpdates) {
    $report.deviceNodeUpdates
  }
  else {
    $badgeDetails.evidence.deviceNodes
  }

  $criticalEvidenceStatuses = $null
  if ($null -ne $manifest -and $null -ne $manifest.criticalEvidenceStatuses) {
    $criticalEvidenceStatuses = $manifest.criticalEvidenceStatuses
  }
  elseif ($null -ne $report -and $null -ne $report.statuses) {
    $criticalEvidenceStatuses = $report.statuses
  }

  return [ordered]@{
    available = (($null -ne $report) -or ($null -ne $manifest) -or ($null -ne $badgeDetails))
    validatedInThisRun = $ValidatedInThisRun
    reportGeneratedAt = Convert-ToNullableString -Value $report.generatedAt
    manifestGeneratedAt = Convert-ToNullableString -Value $manifest.generatedAt
    badgeDetailsGeneratedAt = Convert-ToNullableString -Value $badgeDetails.generatedAt
    manifestInventory = if ($null -ne $manifest -and $null -ne $manifest.inventory) {
      [ordered]@{
        total = Convert-ToNullableInt -Value $manifest.inventory.total
        present = Convert-ToNullableInt -Value $manifest.inventory.present
        missingRequired = Convert-ToNullableInt -Value $manifest.inventory.missingRequired
      }
    }
    else {
      $null
    }
    criticalEvidenceStatuses = $criticalEvidenceStatuses
    deviceNodeUpdates = if ($null -ne $deviceNodeUpdatesSource) {
      [ordered]@{
        updatesValidated = ($deviceNodeUpdatesSource.updatesValidated -eq $true)
        updatesHasUpsert = ($deviceNodeUpdatesSource.updatesHasUpsert -eq $true)
        updatesHasHeartbeat = ($deviceNodeUpdatesSource.updatesHasHeartbeat -eq $true)
        updatesApiValidated = ($deviceNodeUpdatesSource.updatesApiValidated -eq $true)
        updatesTotal = Convert-ToNullableInt -Value $deviceNodeUpdatesSource.updatesTotal
      }
    }
    else {
      $null
    }
    runtimeGuardrails = if ($null -ne $runtimeGuardrailsSource) {
      [ordered]@{
        status = Convert-ToNullableString -Value $(if ($null -ne $report -and $null -ne $report.statuses) { $report.statuses.runtimeGuardrailsSignalPathsStatus } else { $runtimeGuardrailsSource.status })
        summaryStatus = Convert-ToNullableString -Value $runtimeGuardrailsSource.summaryStatus
        totalPaths = Convert-ToNullableInt -Value $runtimeGuardrailsSource.totalPaths
        primaryPath = Get-CompactRuntimeGuardrailsPrimaryPath -Value $runtimeGuardrailsSource.primaryPath
      }
    }
    else {
      $null
    }
    providerUsage = if ($null -ne $providerUsageSource) {
      [ordered]@{
        status = Convert-ToNullableString -Value $providerUsageSource.status
        validated = ($providerUsageSource.validated -eq $true)
        activeSecondaryProviders = Convert-ToNullableInt -Value $providerUsageSource.activeSecondaryProviders
        entriesCount = Convert-ToNullableInt -Value $(if ($null -ne $providerUsageSource.entriesCount) { $providerUsageSource.entriesCount } elseif ($null -ne $providerUsageSource.entries) { @($providerUsageSource.entries).Count } else { $null })
        primaryEntry = Get-CompactProviderUsagePrimaryEntry -Value $(if ($null -ne $providerUsageSource.primaryEntry) { $providerUsageSource.primaryEntry } elseif ($null -ne $providerUsageSource.entries) { @($providerUsageSource.entries)[0] } else { $null })
      }
    }
    else {
      $null
    }
    badgeDetails = if ($null -ne $badgeDetails) {
      [ordered]@{
        checks = Convert-ToNullableInt -Value $badgeDetails.checks
        violations = Convert-ToNullableInt -Value $badgeDetails.violations
        roundTripMs = Convert-ToNullableInt -Value $badgeDetails.roundTripMs
        costTotalUsd = Convert-ToNullableDouble -Value $badgeDetails.costEstimate.totalUsd
        tokensTotal = Convert-ToNullableInt -Value $badgeDetails.tokensUsed.total
      }
    }
    else {
      $null
    }
  }
}

function Run-Git([string[]]$CliArgs) {
  & git @CliArgs
  if ($LASTEXITCODE -ne 0) {
    Fail ("git command failed: git " + ($CliArgs -join " "))
  }
}

function Resolve-NpmCli() {
  if ($env:OS -eq "Windows_NT") {
    return "npm.cmd"
  }
  return "npm"
}

function In-GitRepo {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & git rev-parse --is-inside-work-tree 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Normalize-GitHubRemote([string]$Url) {
  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $null
  }

  $trimmed = $Url.Trim()
  $patterns = @(
    '^git@github\.com:(?<path>[^/]+/[^/]+?)(?:\.git)?/?$',
    '^ssh://git@github\.com/(?<path>[^/]+/[^/]+?)(?:\.git)?/?$',
    '^https?://github\.com/(?<path>[^/]+/[^/]+?)(?:\.git)?/?$',
    '^git://github\.com/(?<path>[^/]+/[^/]+?)(?:\.git)?/?$'
  )

  foreach ($pattern in $patterns) {
    $match = [regex]::Match($trimmed, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      return $match.Groups["path"].Value.ToLowerInvariant()
    }
  }

  return $null
}

function Convert-ToWebSocketBaseUrl([string]$HttpBaseUrl) {
  if ([string]::IsNullOrWhiteSpace($HttpBaseUrl)) {
    return $null
  }

  $trimmed = $HttpBaseUrl.Trim().TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return $null
  }

  if ($trimmed -match "^https://") {
    return ("wss://" + $trimmed.Substring(8))
  }
  if ($trimmed -match "^http://") {
    return ("ws://" + $trimmed.Substring(7))
  }
  if ($trimmed -match "^wss?://") {
    return $trimmed
  }

  return ("wss://" + $trimmed)
}

function Get-RequiredReleaseEvidenceArtifacts() {
  return @(
    "artifacts/release-evidence/report.json",
    "artifacts/release-evidence/report.md",
    "artifacts/release-evidence/manifest.json",
    "artifacts/release-evidence/manifest.md",
    "artifacts/demo-e2e/badge-details.json"
  )
}

function Assert-ReleaseEvidenceArtifactsPresent() {
  $requiredArtifacts = Get-RequiredReleaseEvidenceArtifacts

  $missingArtifacts = @()
  foreach ($artifact in $requiredArtifacts) {
    if (-not (Test-Path $artifact)) {
      $missingArtifacts += $artifact
    }
  }

  if ($missingArtifacts.Count -gt 0) {
    Fail ("Pre-publish release evidence artifacts are missing: " + ($missingArtifacts -join ", "))
  }

  Write-Host "[repo-publish] Release evidence artifacts:"
  foreach ($artifact in $requiredArtifacts) {
    Write-Host (" - " + [System.IO.Path]::GetFullPath($artifact))
  }

  return ,$requiredArtifacts
}

& git --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "git is not installed or unavailable in PATH."
}

if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
  if ([string]::IsNullOrWhiteSpace($Owner) -or [string]::IsNullOrWhiteSpace($Repo)) {
    Fail "Provide -RemoteUrl or set both -Owner and -Repo."
  }
  if ($UseHttps) {
    $RemoteUrl = "https://github.com/$Owner/$Repo.git"
  }
  else {
    $RemoteUrl = "git@github.com:$Owner/$Repo.git"
  }
}

Write-Host "[repo-publish] Remote URL: $RemoteUrl"

$verificationScript = $null
$releaseEvidenceArtifacts = @()
$releaseEvidenceSnapshot = $null

if ($DeployRailway -and $RailwayRootDescriptorCheckMaxAttempts -lt 1) {
  Fail "RailwayRootDescriptorCheckMaxAttempts must be >= 1 when -DeployRailway is enabled."
}

if ($DeployRailway -and $RailwayRootDescriptorCheckRetryBackoffSec -lt 0) {
  Fail "RailwayRootDescriptorCheckRetryBackoffSec must be >= 0 when -DeployRailway is enabled."
}

if (-not (In-GitRepo)) {
  if ($SkipGitInit) {
    Fail "No git repository detected and -SkipGitInit is set."
  }
  Write-Host "[repo-publish] No git repository detected. Initializing..."
  Run-Git @("init")
}

Run-Git @("checkout", "-B", $Branch)

$existingRemote = (& git remote get-url $RemoteName 2>$null)
if ($LASTEXITCODE -ne 0) {
  Write-Host "[repo-publish] Adding remote '$RemoteName'..."
  Run-Git @("remote", "add", $RemoteName, $RemoteUrl)
}
elseif ($existingRemote -ne $RemoteUrl) {
  $existingRemoteCanonical = Normalize-GitHubRemote -Url $existingRemote
  $targetRemoteCanonical = Normalize-GitHubRemote -Url $RemoteUrl

  if (
    -not [string]::IsNullOrWhiteSpace($existingRemoteCanonical) -and
    -not [string]::IsNullOrWhiteSpace($targetRemoteCanonical) -and
    $existingRemoteCanonical -eq $targetRemoteCanonical
  ) {
    Write-Host "[repo-publish] Remote '$RemoteName' already points to the same GitHub repository ($existingRemoteCanonical). Using existing equivalent URL."
  }
  elseif ($ForceRemoteUpdate) {
    Write-Host "[repo-publish] Updating remote '$RemoteName' URL..."
    Run-Git @("remote", "set-url", $RemoteName, $RemoteUrl)
  }
  else {
    Fail "Remote '$RemoteName' already points to '$existingRemote'. Use -ForceRemoteUpdate to replace."
  }
}

if (-not $SkipReleaseVerification) {
  $verificationScript = if ($StrictReleaseVerification) { "verify:release:strict" } else { "verify:release" }
  $npmCli = Resolve-NpmCli
  Write-Host "[repo-publish] Running pre-publish quality gate: npm run $verificationScript"
  & $npmCli run $verificationScript
  if ($LASTEXITCODE -ne 0) {
    Fail "Pre-publish quality gate failed: npm run $verificationScript"
  }
  $releaseEvidenceArtifacts = @(Assert-ReleaseEvidenceArtifactsPresent)
}

$releaseEvidenceSnapshot = Get-ReleaseEvidenceSnapshot -ValidatedInThisRun (-not $SkipReleaseVerification)

if (-not $SkipCommit) {
  $gitName = (& git config user.name)
  $gitEmail = (& git config user.email)
  if ([string]::IsNullOrWhiteSpace($gitName) -or [string]::IsNullOrWhiteSpace($gitEmail)) {
    Fail "Missing git identity. Set 'git config user.name' and 'git config user.email' before commit."
  }

  Write-Host "[repo-publish] Staging files..."
  Run-Git @("add", "-A")

  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[repo-publish] No staged changes to commit."
  }
  elseif ($LASTEXITCODE -eq 1) {
    Write-Host "[repo-publish] Creating commit..."
    Run-Git @("commit", "-m", $CommitMessage)
  }
  else {
    Fail "Unable to determine staged changes state."
  }
}

if (-not $SkipPush) {
  Write-Host "[repo-publish] Pushing branch '$Branch' to '$RemoteName'..."
  Run-Git @("push", "-u", $RemoteName, $Branch)
}

if (-not $SkipPages) {
  if ([string]::IsNullOrWhiteSpace($Owner) -or [string]::IsNullOrWhiteSpace($Repo)) {
    Fail "Pages setup requires -Owner and -Repo."
  }
  Write-Host "[repo-publish] Enabling GitHub Pages source..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot/github-pages-enable.ps1" -Owner $Owner -Repo $Repo
  if ($LASTEXITCODE -ne 0) {
    Fail "Failed to enable GitHub Pages source."
  }
}

if (-not $SkipBadgeCheck) {
  if ([string]::IsNullOrWhiteSpace($Owner) -or [string]::IsNullOrWhiteSpace($Repo)) {
    Fail "Badge check requires -Owner and -Repo."
  }
  $badgeOk = $false
  for ($attempt = 1; $attempt -le $BadgeCheckAttempts; $attempt++) {
    Write-Host "[repo-publish] Badge check attempt $attempt/$BadgeCheckAttempts..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot/github-pages-badge-check.ps1" -Owner $Owner -Repo $Repo
    if ($LASTEXITCODE -eq 0) {
      $badgeOk = $true
      break
    }

    if ($attempt -lt $BadgeCheckAttempts) {
      Start-Sleep -Seconds $BadgeCheckIntervalSec
    }
  }

  if (-not $badgeOk) {
    Fail "Badge endpoint did not become available in time."
  }
}

if ($DeployRailway) {
  Write-Host "[repo-publish] Triggering Railway deploy..."

  $railwayArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "$PSScriptRoot/railway-deploy.ps1",
    "-SkipReleaseVerification"
  )

  if (-not [string]::IsNullOrWhiteSpace($RailwayProjectId)) {
    $railwayArgs += @("-ProjectId", $RailwayProjectId)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayServiceId)) {
    $railwayArgs += @("-ServiceId", $RailwayServiceId)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayEnvironment)) {
    $railwayArgs += @("-Environment", $RailwayEnvironment)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayWorkspace)) {
    $railwayArgs += @("-Workspace", $RailwayWorkspace)
  }
  if ($RailwaySkipLink) {
    $railwayArgs += "-SkipLink"
  }
  if ($RailwaySkipPublicBadgeCheck) {
    $railwayArgs += "-SkipPublicBadgeCheck"
  }
  if ($RailwaySkipRootDescriptorCheck) {
    $railwayArgs += "-SkipRootDescriptorCheck"
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayPublicBadgeEndpoint)) {
    $railwayArgs += @("-PublicBadgeEndpoint", $RailwayPublicBadgeEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayPublicBadgeDetailsEndpoint)) {
    $railwayArgs += @("-PublicBadgeDetailsEndpoint", $RailwayPublicBadgeDetailsEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayPublicUrl)) {
    $railwayArgs += @("-RailwayPublicUrl", $RailwayPublicUrl)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayDemoFrontendPublicUrl)) {
    $railwayArgs += @("-DemoFrontendPublicUrl", $RailwayDemoFrontendPublicUrl)
  }
  if ($RailwayRootDescriptorCheckMaxAttempts -gt 0) {
    $railwayArgs += @("-RootDescriptorCheckMaxAttempts", [string]$RailwayRootDescriptorCheckMaxAttempts)
  }
  if ($RailwayRootDescriptorCheckRetryBackoffSec -ge 0) {
    $railwayArgs += @("-RootDescriptorCheckRetryBackoffSec", [string]$RailwayRootDescriptorCheckRetryBackoffSec)
  }
  if ($RailwayPublicBadgeCheckTimeoutSec -gt 0) {
    $railwayArgs += @("-PublicBadgeCheckTimeoutSec", [string]$RailwayPublicBadgeCheckTimeoutSec)
  }
  if ($RailwayNoWait) {
    $railwayArgs += "-NoWait"
  }

  & powershell @railwayArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Railway deploy failed."
  }
}

if ($DeployRailwayFrontend) {
  Write-Host "[repo-publish] Triggering Railway frontend deploy..."

  $resolvedFrontendApiBaseUrl = $RailwayFrontendApiBaseUrl
  if ([string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl) -and -not [string]::IsNullOrWhiteSpace($RailwayPublicUrl)) {
    $resolvedFrontendApiBaseUrl = $RailwayPublicUrl.TrimEnd("/")
  }

  $resolvedFrontendWsUrl = $RailwayFrontendWsUrl
  if ([string]::IsNullOrWhiteSpace($resolvedFrontendWsUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl)) {
    $resolvedWsBase = Convert-ToWebSocketBaseUrl -HttpBaseUrl $resolvedFrontendApiBaseUrl
    if (-not [string]::IsNullOrWhiteSpace($resolvedWsBase)) {
      $resolvedFrontendWsUrl = $resolvedWsBase.TrimEnd("/") + "/realtime"
    }
  }

  $railwayFrontendArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "$PSScriptRoot/railway-deploy-frontend.ps1"
  )

  if (-not [string]::IsNullOrWhiteSpace($RailwayFrontendProjectId)) {
    $railwayFrontendArgs += @("-ProjectId", $RailwayFrontendProjectId)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayFrontendService)) {
    $railwayFrontendArgs += @("-Service", $RailwayFrontendService)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayFrontendEnvironment)) {
    $railwayFrontendArgs += @("-Environment", $RailwayFrontendEnvironment)
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayFrontendPath)) {
    $railwayFrontendArgs += @("-FrontendPath", $RailwayFrontendPath)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedFrontendWsUrl)) {
    $railwayFrontendArgs += @("-FrontendWsUrl", $resolvedFrontendWsUrl)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl)) {
    $railwayFrontendArgs += @("-FrontendApiBaseUrl", $resolvedFrontendApiBaseUrl)
  }
  if ($RailwayFrontendNoWait) {
    $railwayFrontendArgs += "-NoWait"
  }
  if ($RailwayFrontendSkipHealthCheck) {
    $railwayFrontendArgs += "-SkipHealthCheck"
  }
  if ($RailwayFrontendHealthCheckTimeoutSec -gt 0) {
    $railwayFrontendArgs += @("-HealthCheckTimeoutSec", [string]$RailwayFrontendHealthCheckTimeoutSec)
  }

  & powershell @railwayFrontendArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Railway frontend deploy failed."
  }
}

$repoPublishSummary = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  branch = $Branch
  remoteName = $RemoteName
  remoteUrl = $RemoteUrl
  owner = $Owner
  repo = $Repo
  verification = [ordered]@{
    skipped = [bool]$SkipReleaseVerification
    script = $verificationScript
    strict = [bool]$StrictReleaseVerification
    releaseEvidenceArtifactsValidated = (-not $SkipReleaseVerification)
    releaseEvidenceArtifacts = if ($releaseEvidenceArtifacts.Count -gt 0) { $releaseEvidenceArtifacts } else { Get-RequiredReleaseEvidenceArtifacts }
    releaseEvidenceArtifactsCount = @(if ($releaseEvidenceArtifacts.Count -gt 0) { $releaseEvidenceArtifacts } else { Get-RequiredReleaseEvidenceArtifacts }).Count
  }
  steps = [ordered]@{
    commitEnabled = (-not $SkipCommit)
    pushEnabled = (-not $SkipPush)
    pagesEnabled = (-not $SkipPages)
    badgeCheckEnabled = (-not $SkipBadgeCheck)
    railwayDeployEnabled = [bool]$DeployRailway
    railwayFrontendDeployEnabled = [bool]$DeployRailwayFrontend
  }
  runtime = [ordered]@{
    railwayPublicUrl = if ([string]::IsNullOrWhiteSpace($RailwayPublicUrl)) { $null } else { $RailwayPublicUrl }
    railwayDemoFrontendPublicUrl = if ([string]::IsNullOrWhiteSpace($RailwayDemoFrontendPublicUrl)) { $null } else { $RailwayDemoFrontendPublicUrl }
    railwayNoWait = [bool]$RailwayNoWait
    railwayFrontendNoWait = [bool]$RailwayFrontendNoWait
  }
  releaseEvidenceSnapshot = $releaseEvidenceSnapshot
  artifacts = [ordered]@{
    self = "artifacts/deploy/repo-publish-summary.json"
    railwayDeploySummary = if ($DeployRailway) { "artifacts/deploy/railway-deploy-summary.json" } else { $null }
    releaseEvidenceReportJson = "artifacts/release-evidence/report.json"
    releaseEvidenceManifestJson = "artifacts/release-evidence/manifest.json"
    badgeDetailsJson = "artifacts/demo-e2e/badge-details.json"
  }
}
$repoPublishSummaryPath = Write-RepoPublishSummary -Summary $repoPublishSummary
Write-Host ("[repo-publish] Summary artifact: " + $repoPublishSummaryPath)

$repoPublishSummaryRelativePath = "artifacts/deploy/repo-publish-summary.json"
$railwayDeploySummaryRelativePath = if ($DeployRailway) { "artifacts/deploy/railway-deploy-summary.json" } else { "" }
$repoPublishVerificationLabel = if ($SkipReleaseVerification) { "skipped" } elseif (-not [string]::IsNullOrWhiteSpace($verificationScript)) { $verificationScript } else { "verify:release" }
$repoPublishVerificationSkipped = if ($SkipReleaseVerification) { "true" } else { "false" }
$repoPublishVerificationStrict = if ($StrictReleaseVerification) { "true" } else { "false" }
$repoPublishReleaseEvidenceValidated = if ($SkipReleaseVerification) { "false" } else { "true" }
$repoPublishRailwayDeployEnabled = if ($DeployRailway) { "true" } else { "false" }
$repoPublishRailwayFrontendDeployEnabled = if ($DeployRailwayFrontend) { "true" } else { "false" }
$repoPublishReleaseEvidenceArtifactsCount = [string]@(if ($releaseEvidenceArtifacts.Count -gt 0) { $releaseEvidenceArtifacts } else { Get-RequiredReleaseEvidenceArtifacts }).Count
$repoPublishReleaseEvidenceSnapshotAvailable = if ($null -ne $releaseEvidenceSnapshot -and $releaseEvidenceSnapshot.available -eq $true) { "true" } else { "false" }
$repoPublishReleaseEvidenceMissingRequired = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.manifestInventory -and $null -ne $releaseEvidenceSnapshot.manifestInventory.missingRequired) { [string]$releaseEvidenceSnapshot.manifestInventory.missingRequired } else { "" }
$repoPublishReleaseEvidenceBadgeChecks = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.badgeDetails -and $null -ne $releaseEvidenceSnapshot.badgeDetails.checks) { [string]$releaseEvidenceSnapshot.badgeDetails.checks } else { "" }
$repoPublishReleaseEvidenceRuntimeGuardrailsSummaryStatus = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.runtimeGuardrails) { [string](Convert-ToNullableString -Value $releaseEvidenceSnapshot.runtimeGuardrails.summaryStatus) } else { "" }
$repoPublishReleaseEvidenceReportPath = [string]$repoPublishSummary.artifacts.releaseEvidenceReportJson
$repoPublishReleaseEvidenceManifestPath = [string]$repoPublishSummary.artifacts.releaseEvidenceManifestJson
$repoPublishBadgeDetailsPath = [string]$repoPublishSummary.artifacts.badgeDetailsJson

Write-GitHubOutputValue -Name "repo_publish_summary_path" -Value $repoPublishSummaryRelativePath
Write-GitHubOutputValue -Name "repo_publish_verification_script" -Value $repoPublishVerificationLabel
Write-GitHubOutputValue -Name "repo_publish_verification_skipped" -Value $repoPublishVerificationSkipped
Write-GitHubOutputValue -Name "repo_publish_verification_strict" -Value $repoPublishVerificationStrict
Write-GitHubOutputValue -Name "repo_publish_release_evidence_validated" -Value $repoPublishReleaseEvidenceValidated
Write-GitHubOutputValue -Name "repo_publish_release_evidence_artifacts_count" -Value $repoPublishReleaseEvidenceArtifactsCount
Write-GitHubOutputValue -Name "repo_publish_railway_deploy_enabled" -Value $repoPublishRailwayDeployEnabled
Write-GitHubOutputValue -Name "repo_publish_railway_frontend_deploy_enabled" -Value $repoPublishRailwayFrontendDeployEnabled
Write-GitHubOutputValue -Name "repo_publish_railway_summary_path" -Value $railwayDeploySummaryRelativePath
Write-GitHubOutputValue -Name "repo_publish_release_evidence_snapshot_available" -Value $repoPublishReleaseEvidenceSnapshotAvailable
Write-GitHubOutputValue -Name "repo_publish_release_evidence_missing_required" -Value $repoPublishReleaseEvidenceMissingRequired
Write-GitHubOutputValue -Name "repo_publish_release_evidence_badge_checks" -Value $repoPublishReleaseEvidenceBadgeChecks
Write-GitHubOutputValue -Name "repo_publish_release_evidence_runtime_guardrails_summary_status" -Value $repoPublishReleaseEvidenceRuntimeGuardrailsSummaryStatus
Write-GitHubOutputValue -Name "repo_publish_release_evidence_report_path" -Value $repoPublishReleaseEvidenceReportPath
Write-GitHubOutputValue -Name "repo_publish_release_evidence_manifest_path" -Value $repoPublishReleaseEvidenceManifestPath
Write-GitHubOutputValue -Name "repo_publish_badge_details_path" -Value $repoPublishBadgeDetailsPath

Write-GitHubStepSummaryLine ("Repo publish summary artifact: " + $repoPublishSummaryRelativePath)
Write-GitHubStepSummaryLine ("Repo publish verification script: " + $repoPublishVerificationLabel)
Write-GitHubStepSummaryLine ("Repo publish verification skipped: " + $repoPublishVerificationSkipped)
Write-GitHubStepSummaryLine ("Repo publish verification strict: " + $repoPublishVerificationStrict)
Write-GitHubStepSummaryLine ("Repo publish release-evidence validated: " + $repoPublishReleaseEvidenceValidated)
Write-GitHubStepSummaryLine ("Repo publish release-evidence artifacts count: " + $repoPublishReleaseEvidenceArtifactsCount)
Write-GitHubStepSummaryLine ("Repo publish Railway deploy enabled: " + $repoPublishRailwayDeployEnabled)
Write-GitHubStepSummaryLine ("Repo publish Railway frontend deploy enabled: " + $repoPublishRailwayFrontendDeployEnabled)
Write-GitHubStepSummaryLine ("Repo publish release-evidence snapshot available: " + $repoPublishReleaseEvidenceSnapshotAvailable)
if (-not [string]::IsNullOrWhiteSpace($repoPublishReleaseEvidenceMissingRequired)) {
  Write-GitHubStepSummaryLine ("Repo publish release-evidence missing required artifacts: " + $repoPublishReleaseEvidenceMissingRequired)
}
if (-not [string]::IsNullOrWhiteSpace($repoPublishReleaseEvidenceBadgeChecks)) {
  Write-GitHubStepSummaryLine ("Repo publish release-evidence badge checks: " + $repoPublishReleaseEvidenceBadgeChecks)
}
if (-not [string]::IsNullOrWhiteSpace($repoPublishReleaseEvidenceRuntimeGuardrailsSummaryStatus)) {
  Write-GitHubStepSummaryLine ("Repo publish release-evidence runtime guardrails: " + $repoPublishReleaseEvidenceRuntimeGuardrailsSummaryStatus)
}
if ($repoPublishReleaseEvidenceValidated -eq "true" -or $repoPublishReleaseEvidenceSnapshotAvailable -eq "true") {
  Write-GitHubStepSummaryLine ("Repo publish release-evidence report artifact: " + $repoPublishReleaseEvidenceReportPath)
  Write-GitHubStepSummaryLine ("Repo publish release-evidence manifest artifact: " + $repoPublishReleaseEvidenceManifestPath)
  Write-GitHubStepSummaryLine ("Repo publish badge-details artifact: " + $repoPublishBadgeDetailsPath)
}
if (-not [string]::IsNullOrWhiteSpace($railwayDeploySummaryRelativePath)) {
  Write-GitHubStepSummaryLine ("Repo publish Railway deploy summary artifact: " + $railwayDeploySummaryRelativePath)
}

Write-Host ""
Write-Host "Repository publish flow finished successfully."
