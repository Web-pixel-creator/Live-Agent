[CmdletBinding()]
param(
  [string]$OutputPath = "artifacts/deploy/deploy-readiness-preflight.json",
  [switch]$Strict,
  [switch]$SkipRailwayAuthProbe,
  [switch]$SkipGitHubAuthProbe,
  [string]$RailwayProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$RailwayGatewayServiceId = $env:RAILWAY_SERVICE_ID,
  [string]$RailwayFrontendServiceId = $env:RAILWAY_FRONTEND_SERVICE_ID,
  [string]$RailwayEnvironment = $env:RAILWAY_ENVIRONMENT,
  [string]$GitHubOwner = $env:GITHUB_OWNER,
  [string]$GitHubRepo = $env:GITHUB_REPO
)

$ErrorActionPreference = "Stop"

function Test-HasValue([string]$Value) {
  return -not [string]::IsNullOrWhiteSpace($Value)
}

function Test-CommandOnPath([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-TextCommand([string]$Command, [string[]]$Arguments) {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = (& $Command @Arguments 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($null -eq $exitCode) {
    $exitCode = 1
  }

  return [ordered]@{
    exitCode = $exitCode
    output = $output
  }
}

function Redact-SensitiveOutput([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  $redacted = $Value
  $redacted = $redacted -replace "gh[oprsu]_[A-Za-z0-9_]+", "gh_***REDACTED***"
  $redacted = $redacted -replace "github_pat_[A-Za-z0-9_]+", "github_pat_***REDACTED***"
  $redacted = $redacted -replace "RAILWAY_[A-Za-z0-9_]*TOKEN=[^\s]+", "RAILWAY_TOKEN=***REDACTED***"
  return $redacted
}

function New-Check([string]$Id, [string]$Status, [string]$Message, [bool]$Required) {
  return [ordered]@{
    id = $Id
    status = $Status
    required = $Required
    message = $Message
  }
}

function Add-Check([System.Collections.ArrayList]$Checks, [string]$Id, [string]$Status, [string]$Message, [bool]$Required) {
  [void]$Checks.Add((New-Check -Id $Id -Status $Status -Message $Message -Required $Required))
}

$checks = [System.Collections.ArrayList]::new()

$railwayCliAvailable = Test-CommandOnPath -Name "railway"
$ghCliAvailable = Test-CommandOnPath -Name "gh"

Add-Check -Checks $checks -Id "railway_cli" -Status $(if ($railwayCliAvailable) { "pass" } else { "fail" }) -Message $(if ($railwayCliAvailable) { "railway CLI is available." } else { "railway CLI is not available on PATH." }) -Required $true
Add-Check -Checks $checks -Id "github_cli" -Status $(if ($ghCliAvailable) { "pass" } else { "warn" }) -Message $(if ($ghCliAvailable) { "gh CLI is available." } else { "gh CLI is not available on PATH; workflow dispatch can still use GITHUB_TOKEN/GH_TOKEN." }) -Required $false

$hasRailwayApiToken = Test-HasValue -Value $env:RAILWAY_API_TOKEN
$hasRailwayLegacyToken = (Test-HasValue -Value $env:RAILWAY_TOKEN) -or (Test-HasValue -Value $env:RAILWAY_LEGACY_TOKEN)
$hasRailwayProjectToken = Test-HasValue -Value $env:RAILWAY_PROJECT_TOKEN
$hasAnyRailwayToken = $hasRailwayApiToken -or $hasRailwayLegacyToken -or $hasRailwayProjectToken

Add-Check -Checks $checks -Id "railway_auth_env" -Status $(if ($hasAnyRailwayToken) { "pass" } else { "warn" }) -Message $(if ($hasAnyRailwayToken) { "Railway token environment is present." } else { "No Railway token environment found; local deploy depends on an interactive railway login." }) -Required $false

$railwayAuthProbe = [ordered]@{
  skipped = [bool]$SkipRailwayAuthProbe
  exitCode = $null
  authenticated = $false
  output = ""
}

if ($SkipRailwayAuthProbe) {
  Add-Check -Checks $checks -Id "railway_auth_probe" -Status "warn" -Message "Railway auth probe skipped by flag." -Required $true
}
elseif (-not $railwayCliAvailable) {
  Add-Check -Checks $checks -Id "railway_auth_probe" -Status "fail" -Message "Railway auth probe cannot run because railway CLI is unavailable." -Required $true
}
else {
  $probe = Invoke-TextCommand -Command "railway" -Arguments @("whoami")
  $railwayAuthProbe.exitCode = $probe.exitCode
  $railwayAuthProbe.output = Redact-SensitiveOutput -Value $probe.output
  $railwayAuthProbe.authenticated = ($probe.exitCode -eq 0)
  Add-Check -Checks $checks -Id "railway_auth_probe" -Status $(if ($railwayAuthProbe.authenticated) { "pass" } else { "fail" }) -Message $(if ($railwayAuthProbe.authenticated) { "railway whoami succeeded." } else { "railway whoami failed; run railway login or provide RAILWAY_API_TOKEN/RAILWAY_TOKEN/RAILWAY_PROJECT_TOKEN." }) -Required $true
}

Add-Check -Checks $checks -Id "railway_project_id" -Status $(if (Test-HasValue -Value $RailwayProjectId) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $RailwayProjectId) { "Railway project id is configured." } else { "RAILWAY_PROJECT_ID is not configured; deploy helper may need explicit -ProjectId." }) -Required $false
Add-Check -Checks $checks -Id "railway_gateway_service" -Status $(if (Test-HasValue -Value $RailwayGatewayServiceId) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $RailwayGatewayServiceId) { "Gateway Railway service id is configured." } else { "RAILWAY_SERVICE_ID is not configured; deploy helper may need explicit -ServiceId or linked service context." }) -Required $false
Add-Check -Checks $checks -Id "railway_frontend_service" -Status $(if (Test-HasValue -Value $RailwayFrontendServiceId) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $RailwayFrontendServiceId) { "Frontend Railway service id is configured." } else { "RAILWAY_FRONTEND_SERVICE_ID is not configured; combined deploy can fall back to the frontend service name." }) -Required $false
Add-Check -Checks $checks -Id "railway_environment" -Status $(if (Test-HasValue -Value $RailwayEnvironment) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $RailwayEnvironment) { "Railway environment is configured." } else { "RAILWAY_ENVIRONMENT is not configured; helpers default to production." }) -Required $false

$hasGithubToken = (Test-HasValue -Value $env:GITHUB_TOKEN) -or (Test-HasValue -Value $env:GH_TOKEN)

Add-Check -Checks $checks -Id "github_auth_env" -Status $(if ($hasGithubToken) { "pass" } else { "warn" }) -Message $(if ($hasGithubToken) { "GitHub token environment is present." } else { "No GITHUB_TOKEN/GH_TOKEN found; workflow dispatch depends on gh auth." }) -Required $false

$githubAuthProbe = [ordered]@{
  skipped = [bool]$SkipGitHubAuthProbe
  exitCode = $null
  authenticated = $false
  output = ""
}

if ($SkipGitHubAuthProbe) {
  Add-Check -Checks $checks -Id "github_auth_probe" -Status "warn" -Message "GitHub auth probe skipped by flag." -Required $false
}
elseif ($hasGithubToken) {
  Add-Check -Checks $checks -Id "github_auth_probe" -Status "pass" -Message "GitHub token environment is present; gh auth probe not required." -Required $false
  $githubAuthProbe.authenticated = $true
}
elseif (-not $ghCliAvailable) {
  Add-Check -Checks $checks -Id "github_auth_probe" -Status "warn" -Message "gh auth probe cannot run because gh CLI is unavailable." -Required $false
}
else {
  $probe = Invoke-TextCommand -Command "gh" -Arguments @("auth", "status")
  $githubAuthProbe.exitCode = $probe.exitCode
  $githubAuthProbe.output = Redact-SensitiveOutput -Value $probe.output
  $githubAuthProbe.authenticated = ($probe.exitCode -eq 0)
  Add-Check -Checks $checks -Id "github_auth_probe" -Status $(if ($githubAuthProbe.authenticated) { "pass" } else { "warn" }) -Message $(if ($githubAuthProbe.authenticated) { "gh auth status succeeded." } else { "gh auth status failed; workflow dispatch needs gh auth login or GITHUB_TOKEN/GH_TOKEN." }) -Required $false
}

Add-Check -Checks $checks -Id "github_owner" -Status $(if (Test-HasValue -Value $GitHubOwner) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $GitHubOwner) { "GitHub owner is configured." } else { "GITHUB_OWNER is not configured; workflow dispatch needs -Owner or env value." }) -Required $false
Add-Check -Checks $checks -Id "github_repo" -Status $(if (Test-HasValue -Value $GitHubRepo) { "pass" } else { "warn" }) -Message $(if (Test-HasValue -Value $GitHubRepo) { "GitHub repo is configured." } else { "GITHUB_REPO is not configured; workflow dispatch needs -Repo or env value." }) -Required $false

$requiredFailures = @($checks | Where-Object { $_.required -and $_.status -eq "fail" })
$warnings = @($checks | Where-Object { $_.status -eq "warn" })

$status = if ($requiredFailures.Count -gt 0) { "blocked" } elseif ($warnings.Count -gt 0) { "ready_with_warnings" } else { "ready" }
$strictStatus = if ($Strict -and ($requiredFailures.Count -gt 0 -or $warnings.Count -gt 0)) { "blocked" } else { $status }

$summary = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = $status
  strict = [bool]$Strict
  strictStatus = $strictStatus
  checks = @($checks)
  auth = [ordered]@{
    railway = [ordered]@{
      cliAvailable = $railwayCliAvailable
      hasApiToken = $hasRailwayApiToken
      hasLegacyToken = $hasRailwayLegacyToken
      hasProjectToken = $hasRailwayProjectToken
      probe = $railwayAuthProbe
    }
    github = [ordered]@{
      cliAvailable = $ghCliAvailable
      hasToken = $hasGithubToken
      probe = $githubAuthProbe
    }
  }
  target = [ordered]@{
    railwayProjectIdConfigured = (Test-HasValue -Value $RailwayProjectId)
    railwayGatewayServiceIdConfigured = (Test-HasValue -Value $RailwayGatewayServiceId)
    railwayFrontendServiceIdConfigured = (Test-HasValue -Value $RailwayFrontendServiceId)
    railwayEnvironment = $(if (Test-HasValue -Value $RailwayEnvironment) { $RailwayEnvironment } else { "production-default" })
    githubOwnerConfigured = (Test-HasValue -Value $GitHubOwner)
    githubRepoConfigured = (Test-HasValue -Value $GitHubRepo)
  }
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host ("[deploy-readiness-preflight] Status: " + $status)
Write-Host ("[deploy-readiness-preflight] Strict status: " + $strictStatus)
Write-Host ("[deploy-readiness-preflight] Output: " + $OutputPath)

if ($Strict -and $strictStatus -eq "blocked") {
  Write-Host "[deploy-readiness-preflight] Deploy readiness preflight failed in strict mode."
  exit 1
}
