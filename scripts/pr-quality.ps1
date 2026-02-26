[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipUnitTests,
  [switch]$SkipMonitoringTemplates,
  [switch]$SkipProfileSmoke,
  [switch]$SkipDemoE2E,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [int]$DemoStartupTimeoutSec = 90,
  [int]$DemoRequestTimeoutSec = 45
)

$ErrorActionPreference = "Stop"

$releaseScript = Join-Path $PSScriptRoot "release-readiness.ps1"
if (-not (Test-Path $releaseScript)) {
  Write-Error "release-readiness script not found at $releaseScript"
  exit 1
}

$params = @{
  SkipPerfLoad = $true
  UseFastDemoE2E = $true
  SkipPublicBadgeSync = $true
  DemoStartupTimeoutSec = $DemoStartupTimeoutSec
  DemoRequestTimeoutSec = $DemoRequestTimeoutSec
}

if ($SkipBuild) {
  $params.SkipBuild = $true
}
if ($SkipUnitTests) {
  $params.SkipUnitTests = $true
}
if ($SkipMonitoringTemplates) {
  $params.SkipMonitoringTemplates = $true
}
if ($SkipProfileSmoke) {
  $params.SkipProfileSmoke = $true
}
if ($SkipDemoE2E) {
  $params.SkipDemoE2E = $true
}
if ($SkipPolicy) {
  $params.SkipPolicy = $true
}
if ($SkipBadge) {
  $params.SkipBadge = $true
}

& $releaseScript @params
exit $LASTEXITCODE
