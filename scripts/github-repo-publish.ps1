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
}

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

Write-Host ""
Write-Host "Repository publish flow finished successfully."
