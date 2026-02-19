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
  [int]$BadgeCheckAttempts = 20,
  [int]$BadgeCheckIntervalSec = 20
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Run-Git([string[]]$Args) {
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    Fail ("git command failed: git " + ($Args -join " "))
  }
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
  if ($ForceRemoteUpdate) {
    Write-Host "[repo-publish] Updating remote '$RemoteName' URL..."
    Run-Git @("remote", "set-url", $RemoteName, $RemoteUrl)
  }
  else {
    Fail "Remote '$RemoteName' already points to '$existingRemote'. Use -ForceRemoteUpdate to replace."
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

Write-Host ""
Write-Host "Repository publish flow finished successfully."
