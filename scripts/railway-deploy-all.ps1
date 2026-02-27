[CmdletBinding()]
param(
  [string]$ProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$GatewayServiceId = $env:RAILWAY_SERVICE_ID,
  [string]$Environment = $env:RAILWAY_ENVIRONMENT,
  [string]$GatewayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [string]$GatewayDemoFrontendPublicUrl = $env:DEMO_FRONTEND_PUBLIC_URL,
  [int]$GatewayRootDescriptorCheckMaxAttempts = 3,
  [int]$GatewayRootDescriptorCheckRetryBackoffSec = 2,
  [switch]$SkipGatewayDeploy,
  [switch]$SkipFrontendDeploy,
  [switch]$SkipReleaseVerification,
  [switch]$StrictReleaseVerification,
  [switch]$GatewaySkipLink,
  [switch]$GatewaySkipPublicBadgeCheck,
  [switch]$GatewaySkipRootDescriptorCheck,
  [string]$GatewayPublicBadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$GatewayPublicBadgeDetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [int]$GatewayPublicBadgeCheckTimeoutSec = 20,
  [switch]$GatewayNoWait,
  [string]$FrontendProjectId = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_PROJECT_ID)) { $env:RAILWAY_FRONTEND_PROJECT_ID } else { $env:RAILWAY_PROJECT_ID }),
  [string]$FrontendService = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE_ID)) { $env:RAILWAY_FRONTEND_SERVICE_ID } elseif (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE)) { $env:RAILWAY_FRONTEND_SERVICE } else { "Live-Agent-Frontend" }),
  [string]$FrontendPath = "apps/demo-frontend",
  [string]$FrontendWsUrl = $env:FRONTEND_WS_URL,
  [string]$FrontendApiBaseUrl = $env:FRONTEND_API_BASE_URL,
  [switch]$FrontendNoWait,
  [switch]$FrontendSkipHealthCheck,
  [int]$FrontendHealthCheckTimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
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

if ($SkipGatewayDeploy -and $SkipFrontendDeploy) {
  Fail "Both -SkipGatewayDeploy and -SkipFrontendDeploy are set; nothing to deploy."
}

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

if (-not $SkipGatewayDeploy) {
  Write-Host "[railway-deploy-all] Deploying gateway service..."
  $gatewayArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "$PSScriptRoot/railway-deploy.ps1"
  )

  if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
    $gatewayArgs += @("-ProjectId", $ProjectId)
  }
  if (-not [string]::IsNullOrWhiteSpace($GatewayServiceId)) {
    $gatewayArgs += @("-ServiceId", $GatewayServiceId)
  }
  if (-not [string]::IsNullOrWhiteSpace($Environment)) {
    $gatewayArgs += @("-Environment", $Environment)
  }
  if (-not [string]::IsNullOrWhiteSpace($GatewayPublicUrl)) {
    $gatewayArgs += @("-RailwayPublicUrl", $GatewayPublicUrl)
  }
  if (-not [string]::IsNullOrWhiteSpace($GatewayDemoFrontendPublicUrl)) {
    $gatewayArgs += @("-DemoFrontendPublicUrl", $GatewayDemoFrontendPublicUrl)
  }
  if ($GatewayRootDescriptorCheckMaxAttempts -gt 0) {
    $gatewayArgs += @("-RootDescriptorCheckMaxAttempts", [string]$GatewayRootDescriptorCheckMaxAttempts)
  }
  if ($GatewayRootDescriptorCheckRetryBackoffSec -ge 0) {
    $gatewayArgs += @("-RootDescriptorCheckRetryBackoffSec", [string]$GatewayRootDescriptorCheckRetryBackoffSec)
  }
  if ($SkipReleaseVerification) {
    $gatewayArgs += "-SkipReleaseVerification"
  }
  if ($StrictReleaseVerification) {
    $gatewayArgs += "-StrictReleaseVerification"
  }
  if ($GatewaySkipLink) {
    $gatewayArgs += "-SkipLink"
  }
  if ($GatewaySkipPublicBadgeCheck) {
    $gatewayArgs += "-SkipPublicBadgeCheck"
  }
  if ($GatewaySkipRootDescriptorCheck) {
    $gatewayArgs += "-SkipRootDescriptorCheck"
  }
  if (-not [string]::IsNullOrWhiteSpace($GatewayPublicBadgeEndpoint)) {
    $gatewayArgs += @("-PublicBadgeEndpoint", $GatewayPublicBadgeEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($GatewayPublicBadgeDetailsEndpoint)) {
    $gatewayArgs += @("-PublicBadgeDetailsEndpoint", $GatewayPublicBadgeDetailsEndpoint)
  }
  if ($GatewayPublicBadgeCheckTimeoutSec -gt 0) {
    $gatewayArgs += @("-PublicBadgeCheckTimeoutSec", [string]$GatewayPublicBadgeCheckTimeoutSec)
  }
  if ($GatewayNoWait) {
    $gatewayArgs += "-NoWait"
  }

  & powershell @gatewayArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Gateway deploy step failed."
  }
}

if (-not $SkipFrontendDeploy) {
  Write-Host "[railway-deploy-all] Deploying frontend service..."

  $resolvedFrontendApiBaseUrl = $FrontendApiBaseUrl
  if ([string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl) -and -not [string]::IsNullOrWhiteSpace($GatewayPublicUrl)) {
    $resolvedFrontendApiBaseUrl = $GatewayPublicUrl.TrimEnd("/")
  }

  $resolvedFrontendWsUrl = $FrontendWsUrl
  if ([string]::IsNullOrWhiteSpace($resolvedFrontendWsUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl)) {
    $resolvedWsBase = Convert-ToWebSocketBaseUrl -HttpBaseUrl $resolvedFrontendApiBaseUrl
    if (-not [string]::IsNullOrWhiteSpace($resolvedWsBase)) {
      $resolvedFrontendWsUrl = $resolvedWsBase.TrimEnd("/") + "/realtime"
    }
  }

  $frontendArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "$PSScriptRoot/railway-deploy-frontend.ps1"
  )

  if (-not [string]::IsNullOrWhiteSpace($FrontendProjectId)) {
    $frontendArgs += @("-ProjectId", $FrontendProjectId)
  }
  if (-not [string]::IsNullOrWhiteSpace($FrontendService)) {
    $frontendArgs += @("-Service", $FrontendService)
  }
  if (-not [string]::IsNullOrWhiteSpace($Environment)) {
    $frontendArgs += @("-Environment", $Environment)
  }
  if (-not [string]::IsNullOrWhiteSpace($FrontendPath)) {
    $frontendArgs += @("-FrontendPath", $FrontendPath)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedFrontendWsUrl)) {
    $frontendArgs += @("-FrontendWsUrl", $resolvedFrontendWsUrl)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedFrontendApiBaseUrl)) {
    $frontendArgs += @("-FrontendApiBaseUrl", $resolvedFrontendApiBaseUrl)
  }
  if ($FrontendNoWait) {
    $frontendArgs += "-NoWait"
  }
  if ($FrontendSkipHealthCheck) {
    $frontendArgs += "-SkipHealthCheck"
  }
  if ($FrontendHealthCheckTimeoutSec -gt 0) {
    $frontendArgs += @("-HealthCheckTimeoutSec", [string]$FrontendHealthCheckTimeoutSec)
  }

  & powershell @frontendArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Frontend deploy step failed."
  }
}

Write-Host ""
Write-Host "Railway combined deploy flow completed successfully."
