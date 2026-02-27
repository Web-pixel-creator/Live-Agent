[CmdletBinding()]
param(
  [ValidateSet("release_strict", "railway_deploy_all")]
  [string]$Workflow = "railway_deploy_all",
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [string]$Ref = $(if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_REF_NAME)) { $env:GITHUB_REF_NAME } elseif (-not [string]::IsNullOrWhiteSpace($env:GITHUB_BRANCH)) { $env:GITHUB_BRANCH } else { "main" }),
  [string]$Token = $(if (-not [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { $env:GH_TOKEN } elseif (-not [string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) { $env:GITHUB_TOKEN } else { "" }),
  [string]$RailwayEnvironment = "production",
  [string]$GatewayPublicUrl = "https://live-agent-production.up.railway.app",
  [switch]$DeployToRailway,
  [switch]$SkipReleaseVerification,
  [switch]$SkipGatewayDeploy,
  [switch]$SkipFrontendDeploy,
  [switch]$GatewayNoWait,
  [switch]$FrontendNoWait,
  [switch]$FrontendSkipHealthCheck,
  [switch]$DryRun,
  [switch]$NoWaitForRun,
  [int]$WaitTimeoutSec = 900,
  [int]$PollIntervalSec = 10
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

if ($WaitTimeoutSec -lt 1) {
  Fail "WaitTimeoutSec must be >= 1."
}

if ($PollIntervalSec -lt 1) {
  Fail "PollIntervalSec must be >= 1."
}

$targetScript = switch ($Workflow) {
  "release_strict" { "release-strict-dispatch.ps1" }
  "railway_deploy_all" { "railway-deploy-all-dispatch.ps1" }
  default { $null }
}

if ([string]::IsNullOrWhiteSpace($targetScript)) {
  Fail ("Unsupported workflow selector: " + $Workflow)
}

$targetScriptPath = Join-Path $PSScriptRoot $targetScript
if (-not (Test-Path $targetScriptPath)) {
  Fail ("Dispatch target script not found: " + $targetScriptPath)
}

$dispatchArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $targetScriptPath
)

if (-not [string]::IsNullOrWhiteSpace($Owner)) {
  $dispatchArgs += @("-Owner", $Owner)
}
if (-not [string]::IsNullOrWhiteSpace($Repo)) {
  $dispatchArgs += @("-Repo", $Repo)
}
if (-not [string]::IsNullOrWhiteSpace($Ref)) {
  $dispatchArgs += @("-Ref", $Ref)
}
if (-not [string]::IsNullOrWhiteSpace($Token)) {
  $dispatchArgs += @("-Token", $Token)
}
if (-not [string]::IsNullOrWhiteSpace($GatewayPublicUrl)) {
  $dispatchArgs += @("-GatewayPublicUrl", $GatewayPublicUrl)
}
if ($NoWaitForRun) {
  $dispatchArgs += "-NoWaitForRun"
}
if ($WaitTimeoutSec -gt 0) {
  $dispatchArgs += @("-WaitTimeoutSec", [string]$WaitTimeoutSec)
}
if ($PollIntervalSec -gt 0) {
  $dispatchArgs += @("-PollIntervalSec", [string]$PollIntervalSec)
}

if ($Workflow -eq "release_strict") {
  if ($DeployToRailway) {
    $dispatchArgs += "-DeployToRailway"
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayEnvironment)) {
    $dispatchArgs += @("-RailwayEnvironment", $RailwayEnvironment)
  }
}
else {
  if ($SkipReleaseVerification) {
    $dispatchArgs += "-SkipReleaseVerification"
  }
  if (-not [string]::IsNullOrWhiteSpace($RailwayEnvironment)) {
    $dispatchArgs += @("-Environment", $RailwayEnvironment)
  }
}

if ($SkipGatewayDeploy) {
  $dispatchArgs += "-SkipGatewayDeploy"
}
if ($SkipFrontendDeploy) {
  $dispatchArgs += "-SkipFrontendDeploy"
}
if ($GatewayNoWait) {
  $dispatchArgs += "-GatewayNoWait"
}
if ($FrontendNoWait) {
  $dispatchArgs += "-FrontendNoWait"
}
if ($FrontendSkipHealthCheck) {
  $dispatchArgs += "-FrontendSkipHealthCheck"
}

Write-Host ("[workflow-dispatch] Dispatch target: " + $Workflow + " (" + $targetScript + ")")

if ($DryRun) {
  $quotedArgs = @($dispatchArgs | ForEach-Object { '"' + [string]$_ + '"' })
  $previewCommand = "powershell " + ($quotedArgs -join " ")
  Write-Host "[workflow-dispatch] DryRun enabled. Command preview:"
  Write-Host $previewCommand
  exit 0
}

& powershell @dispatchArgs
if ($LASTEXITCODE -ne 0) {
  Fail ("Workflow dispatch failed for target '" + $Workflow + "'.")
}

Write-Host "[workflow-dispatch] Dispatch flow completed successfully."
