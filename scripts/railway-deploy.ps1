[CmdletBinding()]
param(
  [string]$ProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$ServiceId = $env:RAILWAY_SERVICE_ID,
  [string]$Environment = $env:RAILWAY_ENVIRONMENT,
  [string]$Workspace = $env:RAILWAY_WORKSPACE,
  [string]$DeployMessage = "",
  [switch]$SkipLink,
  [switch]$SkipReleaseVerification,
  [switch]$StrictReleaseVerification,
  [switch]$NoWait,
  [int]$StatusPollMaxAttempts = 60,
  [int]$StatusPollIntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Run-Cli([string[]]$Args) {
  & railway @Args
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($Args -join " "))
  }
}

function Run-CliCapture([string[]]$Args) {
  $output = & railway @Args 2>&1
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($Args -join " "))
  }
  return ,$output
}

function Get-LatestDeployment([string]$Service, [string]$Env) {
  $args = @("deployment", "list", "--limit", "20", "--json")
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $args += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $args += @("-e", $Env)
  }

  $json = (& railway @args)
  if ($LASTEXITCODE -ne 0) {
    Fail "Unable to load Railway deployment list."
  }

  $items = $json | ConvertFrom-Json
  if ($null -eq $items -or $items.Count -eq 0) {
    return $null
  }
  return $items[0]
}

function Get-DeploymentById([string]$DeploymentId, [string]$Service, [string]$Env) {
  $args = @("deployment", "list", "--limit", "30", "--json")
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $args += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $args += @("-e", $Env)
  }

  $json = (& railway @args)
  if ($LASTEXITCODE -ne 0) {
    Fail "Unable to load Railway deployment list."
  }

  $items = $json | ConvertFrom-Json
  if ($null -eq $items) {
    return $null
  }

  return $items | Where-Object { $_.id -eq $DeploymentId } | Select-Object -First 1
}

& railway --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Railway CLI is not installed or unavailable in PATH."
}

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

if (-not $SkipReleaseVerification) {
  $verificationScript = if ($StrictReleaseVerification) { "verify:release:strict" } else { "verify:release" }
  Write-Host "[railway-deploy] Running pre-deploy quality gate: npm run $verificationScript"
  & npm run $verificationScript
  if ($LASTEXITCODE -ne 0) {
    Fail "Pre-deploy quality gate failed: npm run $verificationScript"
  }
}

if (-not $SkipLink) {
  if ([string]::IsNullOrWhiteSpace($ProjectId) -or [string]::IsNullOrWhiteSpace($ServiceId)) {
    Fail "Provide -ProjectId and -ServiceId (or set RAILWAY_PROJECT_ID and RAILWAY_SERVICE_ID), or use -SkipLink."
  }

  $linkArgs = @("link", "-p", $ProjectId, "-s", $ServiceId, "-e", $Environment)
  if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
    $linkArgs += @("-w", $Workspace)
  }
  Write-Host "[railway-deploy] Linking workspace to Railway service..."
  Run-Cli -Args $linkArgs
}

$statusJson = (& railway status --json)
if ($LASTEXITCODE -ne 0) {
  Fail "Unable to resolve linked Railway project/service status."
}
$status = $statusJson | ConvertFrom-Json

$resolvedService = if (-not [string]::IsNullOrWhiteSpace($ServiceId)) { $ServiceId } else { [string]$status.service.id }
if ([string]::IsNullOrWhiteSpace($resolvedService)) {
  Fail "No Railway service resolved. Link a service first or provide -ServiceId."
}

if ([string]::IsNullOrWhiteSpace($DeployMessage)) {
  $commit = (& git rev-parse --short HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
    $commit = "unknown"
  }
  $DeployMessage = "deploy: $commit"
}

$deployArgs = @("up", "-d", "-m", $DeployMessage, "-s", $resolvedService, "-e", $Environment)
if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
  $deployArgs += @("-p", $ProjectId)
}

Write-Host "[railway-deploy] Triggering deployment..."
$deployOutput = Run-CliCapture -Args $deployArgs
$deployText = [string]::Join("`n", $deployOutput)

$deploymentId = $null
$idMatch = [regex]::Match($deployText, "id=([0-9a-fA-F-]{36})")
if ($idMatch.Success) {
  $deploymentId = $idMatch.Groups[1].Value
}

if ([string]::IsNullOrWhiteSpace($deploymentId)) {
  $latest = Get-LatestDeployment -Service $resolvedService -Env $Environment
  if ($null -ne $latest) {
    $deploymentId = [string]$latest.id
  }
}

if ([string]::IsNullOrWhiteSpace($deploymentId)) {
  Fail "Deployment created but deployment ID could not be resolved."
}

Write-Host "[railway-deploy] Deployment ID: $deploymentId"

if ($NoWait) {
  Write-Host "[railway-deploy] No-wait mode enabled. Exiting after trigger."
  exit 0
}

$pending = @("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING")
for ($attempt = 1; $attempt -le $StatusPollMaxAttempts; $attempt++) {
  $deployment = Get-DeploymentById -DeploymentId $deploymentId -Service $resolvedService -Env $Environment
  if ($null -eq $deployment) {
    Write-Host "[railway-deploy] Waiting for deployment metadata ($attempt/$StatusPollMaxAttempts)..."
  }
  else {
    $state = [string]$deployment.status
    Write-Host "[railway-deploy] Status ($attempt/$StatusPollMaxAttempts): $state"
    if ($state -eq "SUCCESS") {
      Write-Host ""
      Write-Host "Railway deployment completed successfully."
      Write-Host "Deployment ID: $deploymentId"
      exit 0
    }
    if ($pending -notcontains $state) {
      Fail "Railway deployment finished with non-success status: $state (deploymentId=$deploymentId)"
    }
  }

  if ($attempt -lt $StatusPollMaxAttempts) {
    Start-Sleep -Seconds $StatusPollIntervalSec
  }
}

Fail "Timed out waiting for Railway deployment completion (deploymentId=$deploymentId)."
