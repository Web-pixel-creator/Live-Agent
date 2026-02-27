[CmdletBinding()]
param(
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [string]$Ref = $(if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_REF_NAME)) { $env:GITHUB_REF_NAME } elseif (-not [string]::IsNullOrWhiteSpace($env:GITHUB_BRANCH)) { $env:GITHUB_BRANCH } else { "main" }),
  [string]$Token = $(if (-not [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { $env:GH_TOKEN } elseif (-not [string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) { $env:GITHUB_TOKEN } else { "" }),
  [string]$Environment = "production",
  [string]$GatewayPublicUrl = "https://live-agent-production.up.railway.app",
  [string]$GatewayDemoFrontendPublicUrl = $env:DEMO_FRONTEND_PUBLIC_URL,
  [int]$GatewayRootDescriptorCheckMaxAttempts = 3,
  [int]$GatewayRootDescriptorCheckRetryBackoffSec = 2,
  [switch]$SkipReleaseVerification,
  [switch]$SkipGatewayDeploy,
  [switch]$SkipFrontendDeploy,
  [switch]$GatewaySkipRootDescriptorCheck,
  [switch]$GatewayNoWait,
  [switch]$FrontendNoWait,
  [switch]$FrontendSkipHealthCheck,
  [switch]$NoWaitForRun,
  [int]$WaitTimeoutSec = 900,
  [int]$PollIntervalSec = 10
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Resolve-BooleanString([bool]$Value) {
  if ($Value) {
    return "true"
  }
  return "false"
}

function Get-LatestRailwayDeployAllRun([string]$RepoSlug, [string]$Branch) {
  $args = @(
    "run",
    "list",
    "--workflow", "railway-deploy-all.yml",
    "--repo", $RepoSlug,
    "--limit", "20",
    "--json", "databaseId,event,headBranch,status,conclusion,createdAt,url"
  )

  $json = (& gh @args)
  if ($LASTEXITCODE -ne 0) {
    Fail "Failed to load GitHub Actions run list."
  }

  $parsed = @($json | ConvertFrom-Json)
  if ($parsed.Count -eq 0) {
    return $null
  }

  $filtered = @(
    $parsed | Where-Object {
      $_.event -eq "workflow_dispatch" -and (
        [string]::IsNullOrWhiteSpace($Branch) -or [string]$_.headBranch -eq $Branch
      )
    }
  )

  if ($filtered.Count -eq 0) {
    return $null
  }

  return $filtered | Sort-Object -Property @{ Expression = { [datetime]$_.createdAt }; Descending = $true } | Select-Object -First 1
}

function Get-RunStatus([string]$RepoSlug, [string]$RunId) {
  $args = @(
    "run",
    "view",
    $RunId,
    "--repo", $RepoSlug,
    "--json", "status,conclusion,url,workflowName,createdAt,updatedAt"
  )

  $json = (& gh @args)
  if ($LASTEXITCODE -ne 0) {
    Fail ("Failed to load workflow run status for run id " + $RunId + ".")
  }
  return $json | ConvertFrom-Json
}

if ([string]::IsNullOrWhiteSpace($Owner)) {
  Fail "Missing owner. Set -Owner or env GITHUB_OWNER."
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  Fail "Missing repo. Set -Repo or env GITHUB_REPO."
}

if ($WaitTimeoutSec -lt 1) {
  Fail "WaitTimeoutSec must be >= 1."
}

if ($PollIntervalSec -lt 1) {
  Fail "PollIntervalSec must be >= 1."
}

$ghCli = Get-Command "gh" -ErrorAction SilentlyContinue
if ($null -eq $ghCli) {
  Fail "GitHub CLI is not installed or unavailable in PATH."
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  try {
    $ghToken = (& gh auth token 2>$null | Select-Object -First 1)
    if (-not [string]::IsNullOrWhiteSpace($ghToken)) {
      $Token = $ghToken.Trim()
      Write-Host "[railway-deploy-all-dispatch] Using token resolved from 'gh auth token'."
    }
  }
  catch {
    # Best-effort fallback only.
  }
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Fail "Missing token. Set -Token or env GITHUB_TOKEN/GH_TOKEN, or authenticate GitHub CLI via 'gh auth login'."
}

$env:GH_TOKEN = $Token

$repoSlug = "$Owner/$Repo"

$skipReleaseVerificationValue = Resolve-BooleanString -Value $SkipReleaseVerification.IsPresent
$skipGatewayDeployValue = Resolve-BooleanString -Value $SkipGatewayDeploy.IsPresent
$skipFrontendDeployValue = Resolve-BooleanString -Value $SkipFrontendDeploy.IsPresent
$gatewaySkipRootDescriptorCheckValue = Resolve-BooleanString -Value $GatewaySkipRootDescriptorCheck.IsPresent
$gatewayNoWaitValue = Resolve-BooleanString -Value $GatewayNoWait.IsPresent
$frontendNoWaitValue = Resolve-BooleanString -Value $FrontendNoWait.IsPresent
$frontendSkipHealthCheckValue = Resolve-BooleanString -Value $FrontendSkipHealthCheck.IsPresent

$dispatchArgs = @(
  "workflow",
  "run",
  "railway-deploy-all.yml",
  "--repo", $repoSlug,
  "--ref", $Ref,
  "-f", ("environment=" + $Environment),
  "-f", ("gateway_public_url=" + $GatewayPublicUrl),
  "-f", ("skip_release_verification=" + $skipReleaseVerificationValue),
  "-f", ("skip_gateway_deploy=" + $skipGatewayDeployValue),
  "-f", ("skip_frontend_deploy=" + $skipFrontendDeployValue),
  "-f", ("gateway_skip_root_descriptor_check=" + $gatewaySkipRootDescriptorCheckValue),
  "-f", ("gateway_no_wait=" + $gatewayNoWaitValue),
  "-f", ("frontend_no_wait=" + $frontendNoWaitValue),
  "-f", ("frontend_skip_health_check=" + $frontendSkipHealthCheckValue)
)

if (-not [string]::IsNullOrWhiteSpace($GatewayDemoFrontendPublicUrl)) {
  $dispatchArgs += @("-f", ("gateway_demo_frontend_public_url=" + $GatewayDemoFrontendPublicUrl))
}
if ($GatewayRootDescriptorCheckMaxAttempts -gt 0) {
  $dispatchArgs += @("-f", ("gateway_root_descriptor_check_max_attempts=" + [string]$GatewayRootDescriptorCheckMaxAttempts))
}
if ($GatewayRootDescriptorCheckRetryBackoffSec -ge 0) {
  $dispatchArgs += @("-f", ("gateway_root_descriptor_check_retry_backoff_sec=" + [string]$GatewayRootDescriptorCheckRetryBackoffSec))
}

Write-Host "[railway-deploy-all-dispatch] Dispatching railway-deploy-all workflow..."
& gh @dispatchArgs
if ($LASTEXITCODE -ne 0) {
  Fail "Workflow dispatch failed."
}

Write-Host "[railway-deploy-all-dispatch] Workflow dispatch accepted."

$runResolveDeadline = [datetime]::UtcNow.AddSeconds([math]::Min(120, $WaitTimeoutSec))
$run = $null
while ([datetime]::UtcNow -lt $runResolveDeadline) {
  $run = Get-LatestRailwayDeployAllRun -RepoSlug $repoSlug -Branch $Ref
  if ($null -ne $run -and -not [string]::IsNullOrWhiteSpace([string]$run.databaseId)) {
    break
  }
  Start-Sleep -Seconds 3
}

if ($null -eq $run -or [string]::IsNullOrWhiteSpace([string]$run.databaseId)) {
  if ($NoWaitForRun) {
    Write-Host "[railway-deploy-all-dispatch] Dispatched, but run id is not yet visible."
    exit 0
  }
  Fail "Dispatched workflow, but could not resolve run id in time."
}

$runId = [string]$run.databaseId
$runUrl = [string]$run.url
if ([string]::IsNullOrWhiteSpace($runUrl)) {
  $runUrl = ("https://github.com/" + $repoSlug + "/actions/runs/" + $runId)
}

Write-Host ("[railway-deploy-all-dispatch] Run id: " + $runId)
Write-Host ("[railway-deploy-all-dispatch] Run url: " + $runUrl)

if ($NoWaitForRun) {
  Write-Host "[railway-deploy-all-dispatch] NoWaitForRun enabled. Exiting after dispatch."
  exit 0
}

$deadline = [datetime]::UtcNow.AddSeconds($WaitTimeoutSec)
while ([datetime]::UtcNow -lt $deadline) {
  $statusPayload = Get-RunStatus -RepoSlug $repoSlug -RunId $runId
  $status = [string]$statusPayload.status
  $conclusion = [string]$statusPayload.conclusion
  Write-Host ("[railway-deploy-all-dispatch] Run status: " + $status + " (conclusion=" + $conclusion + ")")

  if ($status -eq "completed") {
    if ($conclusion -eq "success") {
      Write-Host "[railway-deploy-all-dispatch] Workflow completed successfully."
      exit 0
    }
    Fail ("Workflow completed with non-success conclusion '" + $conclusion + "'. See: " + $runUrl)
  }

  Start-Sleep -Seconds $PollIntervalSec
}

Fail ("Timed out waiting for workflow completion. See: " + $runUrl)
