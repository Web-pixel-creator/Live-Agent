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

  Assert-RequiredFields -Required @("ok", "generatedAt", "checks", "violations", "roundTripMs", "evidence", "badge") -Payload $details -ScopeName "badge-details"

  if ($details.badge -eq $null) {
    Fail "badge-details JSON field 'badge' must be present."
  }

  if ($details.evidence -eq $null) {
    Fail "badge-details JSON field 'evidence' must be present."
  }

  Assert-RequiredFields -Required @("operatorTurnTruncation", "operatorTurnDelete", "damageControl", "operatorDamageControl") -Payload $details.evidence -ScopeName "badge-details.evidence"

  $truncationEvidence = $details.evidence.operatorTurnTruncation
  $deleteEvidence = $details.evidence.operatorTurnDelete
  $damageControlEvidence = $details.evidence.damageControl
  $operatorDamageControlEvidence = $details.evidence.operatorDamageControl
  if ($null -eq $truncationEvidence) {
    Fail "badge-details evidence is missing operatorTurnTruncation block."
  }
  if ($null -eq $deleteEvidence) {
    Fail "badge-details evidence is missing operatorTurnDelete block."
  }
  if ($null -eq $damageControlEvidence) {
    Fail "badge-details evidence is missing damageControl block."
  }
  if ($null -eq $operatorDamageControlEvidence) {
    Fail "badge-details evidence is missing operatorDamageControl block."
  }

  $turnEvidenceRequired = @("status", "validated", "expectedEventSeen", "total", "uniqueRuns", "uniqueSessions", "latestSeenAt", "latestSeenAtIsIso")
  Assert-RequiredFields -Required $turnEvidenceRequired -Payload $truncationEvidence -ScopeName "badge-details.evidence.operatorTurnTruncation"
  Assert-RequiredFields -Required $turnEvidenceRequired -Payload $deleteEvidence -ScopeName "badge-details.evidence.operatorTurnDelete"

  $allowedTurnEvidenceStatuses = @("pass", "fail")
  $truncationStatus = [string]$truncationEvidence.status
  $deleteStatus = [string]$deleteEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $truncationStatus)) {
    Fail "badge-details evidence operatorTurnTruncation.status must be one of [pass, fail]."
  }
  if (-not ($allowedTurnEvidenceStatuses -contains $deleteStatus)) {
    Fail "badge-details evidence operatorTurnDelete.status must be one of [pass, fail]."
  }

  $damageControlEvidenceRequired = @("status", "diagnosticsValidated", "enabled", "verdict", "source", "matchedRuleCount", "matchedRuleIds")
  Assert-RequiredFields -Required $damageControlEvidenceRequired -Payload $damageControlEvidence -ScopeName "badge-details.evidence.damageControl"
  $damageControlStatus = [string]$damageControlEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $damageControlStatus)) {
    Fail "badge-details evidence damageControl.status must be one of [pass, fail]."
  }

  $operatorDamageControlEvidenceRequired = @("status", "validated", "total", "uniqueRuns", "uniqueSessions", "matchedRuleCountTotal", "verdictCounts", "latest")
  Assert-RequiredFields -Required $operatorDamageControlEvidenceRequired -Payload $operatorDamageControlEvidence -ScopeName "badge-details.evidence.operatorDamageControl"
  $operatorDamageControlStatus = [string]$operatorDamageControlEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $operatorDamageControlStatus)) {
    Fail "badge-details evidence operatorDamageControl.status must be one of [pass, fail]."
  }
  if ($null -eq $operatorDamageControlEvidence.verdictCounts) {
    Fail "badge-details evidence operatorDamageControl.verdictCounts must be present."
  }
  if ($null -eq $operatorDamageControlEvidence.latest) {
    Fail "badge-details evidence operatorDamageControl.latest must be present."
  }
  Assert-RequiredFields -Required @("allow", "ask", "block", "total") -Payload $operatorDamageControlEvidence.verdictCounts -ScopeName "badge-details.evidence.operatorDamageControl.verdictCounts"
  Assert-RequiredFields -Required @("verdict", "source", "matchedRuleCount", "seenAt", "seenAtIsIso") -Payload $operatorDamageControlEvidence.latest -ScopeName "badge-details.evidence.operatorDamageControl.latest"

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
