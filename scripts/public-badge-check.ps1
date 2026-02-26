[CmdletBinding()]
param(
  [string]$BadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$DetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [string]$RailwayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [int]$TimeoutSec = 20,
  [int]$ExpectedSchemaVersion = 1,
  [switch]$SkipDetails
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Resolve-BadgeEndpoint {
  param(
    [string]$ExplicitEndpoint,
    [string]$RailwayUrl
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitEndpoint)) {
    return $ExplicitEndpoint
  }

  if (-not [string]::IsNullOrWhiteSpace($RailwayUrl)) {
    return "$($RailwayUrl.TrimEnd('/'))/demo-e2e/badge.json"
  }

  return "https://live-agent-production.up.railway.app/demo-e2e/badge.json"
}

function Resolve-DetailsEndpoint {
  param(
    [string]$ExplicitEndpoint,
    [string]$ResolvedBadgeEndpoint
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitEndpoint)) {
    return $ExplicitEndpoint
  }

  if ($ResolvedBadgeEndpoint.EndsWith("/badge.json")) {
    return $ResolvedBadgeEndpoint.Substring(0, $ResolvedBadgeEndpoint.Length - "badge.json".Length) + "badge-details.json"
  }

  return "$($ResolvedBadgeEndpoint.TrimEnd('/'))/badge-details.json"
}

function Assert-RequiredFields {
  param(
    [string[]]$Required,
    [object]$Payload,
    [string]$ScopeName
  )

  $propertyNames = @($Payload.PSObject.Properties.Name)
  $missing = @($Required | Where-Object { $propertyNames -notcontains $_ })
  if ($missing.Count -gt 0) {
    Fail "$ScopeName JSON is missing fields: $($missing -join ', ')"
  }
}

$badgeEndpoint = Resolve-BadgeEndpoint -ExplicitEndpoint $BadgeEndpoint -RailwayUrl $RailwayPublicUrl
$detailsEndpoint = Resolve-DetailsEndpoint -ExplicitEndpoint $DetailsEndpoint -ResolvedBadgeEndpoint $badgeEndpoint
$shield = "https://img.shields.io/endpoint?url=$([System.Uri]::EscapeDataString($badgeEndpoint))"

Write-Host "Checking public badge endpoint:"
Write-Host $badgeEndpoint

try {
  $badge = Invoke-RestMethod -Method Get -Uri $badgeEndpoint -TimeoutSec $TimeoutSec
}
catch {
  Fail "Public badge endpoint is not reachable: $badgeEndpoint"
}

Assert-RequiredFields -Required @("schemaVersion", "label", "message", "color", "cacheSeconds") -Payload $badge -ScopeName "badge"

if ($badge.schemaVersion -ne $ExpectedSchemaVersion) {
  Fail "Unexpected badge schemaVersion=$($badge.schemaVersion). Expected $ExpectedSchemaVersion."
}

if ([string]::IsNullOrWhiteSpace([string]$badge.message)) {
  Fail "Badge field 'message' must be non-empty."
}

if (-not $SkipDetails) {
  Write-Host "Checking public badge details endpoint:"
  Write-Host $detailsEndpoint

  try {
    $details = Invoke-RestMethod -Method Get -Uri $detailsEndpoint -TimeoutSec $TimeoutSec
  }
  catch {
    Fail "Public badge details endpoint is not reachable: $detailsEndpoint"
  }

  Assert-RequiredFields -Required @("ok", "generatedAt", "checks", "violations", "roundTripMs", "badge") -Payload $details -ScopeName "badge-details"

  if ($details.badge -eq $null) {
    Fail "badge-details JSON field 'badge' must be present."
  }

  Assert-RequiredFields -Required @("schemaVersion", "label", "message", "color", "cacheSeconds") -Payload $details.badge -ScopeName "badge-details.badge"

  if ($details.badge.schemaVersion -ne $ExpectedSchemaVersion) {
    Fail "Unexpected badge-details.badge schemaVersion=$($details.badge.schemaVersion). Expected $ExpectedSchemaVersion."
  }
}

Write-Host "Public badge endpoint is valid."
Write-Host "Badge: $($badge.label) -> $($badge.message) ($($badge.color))"
Write-Host ""
Write-Host "Shields URL:"
Write-Host $shield
