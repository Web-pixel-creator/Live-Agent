[CmdletBinding()]
param(
  [string]$BadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$DetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [string]$RailwayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [int]$TimeoutSec = 20,
  [int]$ExpectedSchemaVersion = 1,
  [switch]$SkipDetails,
  [switch]$AllowFailingEvidence
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

  Assert-RequiredFields -Required @("ok", "generatedAt", "checks", "violations", "roundTripMs", "costEstimate", "tokensUsed", "evidence", "badge") -Payload $details -ScopeName "badge-details"

  if ($details.badge -eq $null) {
    Fail "badge-details JSON field 'badge' must be present."
  }

  if ($details.costEstimate -eq $null) {
    Fail "badge-details JSON field 'costEstimate' must be present."
  }

  if ($details.tokensUsed -eq $null) {
    Fail "badge-details JSON field 'tokensUsed' must be present."
  }

  if ($details.evidence -eq $null) {
    Fail "badge-details JSON field 'evidence' must be present."
  }

  Assert-RequiredFields -Required @("currency", "geminiLiveUsd", "imagenUsd", "veoUsd", "ttsUsd", "totalUsd", "source") -Payload $details.costEstimate -ScopeName "badge-details.costEstimate"
  Assert-RequiredFields -Required @("input", "output", "total", "source") -Payload $details.tokensUsed -ScopeName "badge-details.tokensUsed"

  $costGeminiLiveUsd = 0.0
  $costImagenUsd = 0.0
  $costVeoUsd = 0.0
  $costTtsUsd = 0.0
  $costTotalUsd = 0.0
  if (-not [double]::TryParse([string]$details.costEstimate.geminiLiveUsd, [ref]$costGeminiLiveUsd)) {
    Fail "badge-details costEstimate.geminiLiveUsd must be numeric."
  }
  if (-not [double]::TryParse([string]$details.costEstimate.imagenUsd, [ref]$costImagenUsd)) {
    Fail "badge-details costEstimate.imagenUsd must be numeric."
  }
  if (-not [double]::TryParse([string]$details.costEstimate.veoUsd, [ref]$costVeoUsd)) {
    Fail "badge-details costEstimate.veoUsd must be numeric."
  }
  if (-not [double]::TryParse([string]$details.costEstimate.ttsUsd, [ref]$costTtsUsd)) {
    Fail "badge-details costEstimate.ttsUsd must be numeric."
  }
  if (-not [double]::TryParse([string]$details.costEstimate.totalUsd, [ref]$costTotalUsd)) {
    Fail "badge-details costEstimate.totalUsd must be numeric."
  }
  if (
    $costGeminiLiveUsd -lt 0 -or
    $costImagenUsd -lt 0 -or
    $costVeoUsd -lt 0 -or
    $costTtsUsd -lt 0 -or
    $costTotalUsd -lt 0
  ) {
    Fail "badge-details costEstimate values must be non-negative."
  }
  $costPartsTotal = $costGeminiLiveUsd + $costImagenUsd + $costVeoUsd + $costTtsUsd
  if ($costTotalUsd + 0.000001 -lt $costPartsTotal) {
    Fail "badge-details costEstimate.totalUsd must be >= sum of component costs."
  }

  $tokensInput = 0
  $tokensOutput = 0
  $tokensTotal = 0
  if (-not [int]::TryParse([string]$details.tokensUsed.input, [ref]$tokensInput)) {
    Fail "badge-details tokensUsed.input must be integer."
  }
  if (-not [int]::TryParse([string]$details.tokensUsed.output, [ref]$tokensOutput)) {
    Fail "badge-details tokensUsed.output must be integer."
  }
  if (-not [int]::TryParse([string]$details.tokensUsed.total, [ref]$tokensTotal)) {
    Fail "badge-details tokensUsed.total must be integer."
  }
  if ($tokensInput -lt 0 -or $tokensOutput -lt 0 -or $tokensTotal -lt 0) {
    Fail "badge-details tokensUsed values must be non-negative."
  }
  if ($tokensTotal -lt ($tokensInput + $tokensOutput)) {
    Fail "badge-details tokensUsed.total must be >= input + output."
  }

  Assert-RequiredFields -Required @("operatorTurnTruncation", "operatorTurnDelete", "damageControl", "operatorDamageControl", "governancePolicy", "skillsRegistry", "deviceNodes") -Payload $details.evidence -ScopeName "badge-details.evidence"

  $truncationEvidence = $details.evidence.operatorTurnTruncation
  $deleteEvidence = $details.evidence.operatorTurnDelete
  $damageControlEvidence = $details.evidence.damageControl
  $operatorDamageControlEvidence = $details.evidence.operatorDamageControl
  $governancePolicyEvidence = $details.evidence.governancePolicy
  $skillsRegistryEvidence = $details.evidence.skillsRegistry
  $deviceNodesEvidence = $details.evidence.deviceNodes
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
  if ($null -eq $governancePolicyEvidence) {
    Fail "badge-details evidence is missing governancePolicy block."
  }
  if ($null -eq $skillsRegistryEvidence) {
    Fail "badge-details evidence is missing skillsRegistry block."
  }
  if ($null -eq $deviceNodesEvidence) {
    Fail "badge-details evidence is missing deviceNodes block."
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

  $governancePolicyEvidenceRequired = @(
    "status",
    "validated",
    "operatorActionSeen",
    "overrideTenantSeen",
    "idempotencyReplayOutcome",
    "versionConflictCode",
    "idempotencyConflictCode",
    "tenantScopeForbiddenCode",
    "summaryTemplateId",
    "summarySource",
    "complianceTemplate",
    "overridesTotal"
  )
  Assert-RequiredFields -Required $governancePolicyEvidenceRequired -Payload $governancePolicyEvidence -ScopeName "badge-details.evidence.governancePolicy"
  $governancePolicyStatus = [string]$governancePolicyEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $governancePolicyStatus)) {
    Fail "badge-details evidence governancePolicy.status must be one of [pass, fail]."
  }

  $skillsRegistryEvidenceRequired = @(
    "status",
    "validated",
    "indexHasSkill",
    "registryHasSkill",
    "createOutcome",
    "replayOutcome",
    "versionConflictCode",
    "pluginInvalidPermissionCode",
    "indexTotal",
    "registryTotal"
  )
  Assert-RequiredFields -Required $skillsRegistryEvidenceRequired -Payload $skillsRegistryEvidence -ScopeName "badge-details.evidence.skillsRegistry"
  $skillsRegistryStatus = [string]$skillsRegistryEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $skillsRegistryStatus)) {
    Fail "badge-details evidence skillsRegistry.status must be one of [pass, fail]."
  }

  $deviceNodesEvidenceRequired = @(
    "status",
    "validated",
    "lookupValidated",
    "versionConflictValidated",
    "healthSummaryValidated",
    "updatesValidated",
    "updatesHasUpsert",
    "updatesHasHeartbeat",
    "updatesApiValidated",
    "lookupStatus",
    "lookupVersion",
    "updatedVersion",
    "versionConflictStatusCode",
    "versionConflictCode",
    "updatesTotal",
    "summaryTotal",
    "summaryDegraded",
    "summaryStale",
    "summaryMissingHeartbeat",
    "summaryRecentContainsLookup"
  )
  Assert-RequiredFields -Required $deviceNodesEvidenceRequired -Payload $deviceNodesEvidence -ScopeName "badge-details.evidence.deviceNodes"
  $deviceNodesStatus = [string]$deviceNodesEvidence.status
  if (-not ($allowedTurnEvidenceStatuses -contains $deviceNodesStatus)) {
    Fail "badge-details evidence deviceNodes.status must be one of [pass, fail]."
  }

  $deviceNodeUpdatesStatus = "unavailable"
  $updatesValidated = ($deviceNodesEvidence.updatesValidated -eq $true)
  $updatesHasUpsert = ($deviceNodesEvidence.updatesHasUpsert -eq $true)
  $updatesHasHeartbeat = ($deviceNodesEvidence.updatesHasHeartbeat -eq $true)
  $updatesApiValidated = ($deviceNodesEvidence.updatesApiValidated -eq $true)
  $updatesTotalRaw = $deviceNodesEvidence.updatesTotal
  $updatesTotal = 0
  if ($null -ne $updatesTotalRaw) {
    $updatesTotalParsed = 0
    if ([int]::TryParse([string]$updatesTotalRaw, [ref]$updatesTotalParsed)) {
      $updatesTotal = $updatesTotalParsed
    }
  }
  if ($updatesValidated -and $updatesHasUpsert -and $updatesHasHeartbeat -and $updatesApiValidated -and $updatesTotal -ge 2) {
    $deviceNodeUpdatesStatus = "pass"
  }
  elseif ($updatesTotal -gt 0 -or $updatesHasUpsert -or $updatesHasHeartbeat -or $updatesValidated -or $updatesApiValidated) {
    $deviceNodeUpdatesStatus = "fail"
  }

  Assert-RequiredFields -Required @("schemaVersion", "label", "message", "color", "cacheSeconds") -Payload $details.badge -ScopeName "badge-details.badge"

  if ($details.badge.schemaVersion -ne $ExpectedSchemaVersion) {
    Fail "Unexpected badge-details.badge schemaVersion=$($details.badge.schemaVersion). Expected $ExpectedSchemaVersion."
  }

  if (-not $AllowFailingEvidence) {
    $statusChecks = @(
      @{ Name = "operatorTurnTruncation"; Status = $truncationStatus },
      @{ Name = "operatorTurnDelete"; Status = $deleteStatus },
      @{ Name = "damageControl"; Status = $damageControlStatus },
      @{ Name = "operatorDamageControl"; Status = $operatorDamageControlStatus },
      @{ Name = "governancePolicy"; Status = $governancePolicyStatus },
      @{ Name = "skillsRegistry"; Status = $skillsRegistryStatus },
      @{ Name = "deviceNodes"; Status = $deviceNodesStatus }
    )
    foreach ($statusCheck in $statusChecks) {
      if ([string]$statusCheck.Status -ne "pass") {
        Fail ("badge-details evidence " + [string]$statusCheck.Name + ".status must be 'pass' for deployment gate.")
      }
    }

    if (-not [bool]$truncationEvidence.validated -or -not [bool]$truncationEvidence.expectedEventSeen) {
      Fail "badge-details evidence operatorTurnTruncation must be validated and expectedEventSeen=true."
    }
    if (-not [bool]$deleteEvidence.validated -or -not [bool]$deleteEvidence.expectedEventSeen) {
      Fail "badge-details evidence operatorTurnDelete must be validated and expectedEventSeen=true."
    }
    if (-not [bool]$damageControlEvidence.diagnosticsValidated) {
      Fail "badge-details evidence damageControl must be diagnosticsValidated=true."
    }
    if (-not [bool]$operatorDamageControlEvidence.validated) {
      Fail "badge-details evidence operatorDamageControl must be validated=true."
    }
    if (
      -not [bool]$governancePolicyEvidence.validated -or
      -not [bool]$governancePolicyEvidence.operatorActionSeen -or
      -not [bool]$governancePolicyEvidence.overrideTenantSeen
    ) {
      Fail "badge-details evidence governancePolicy must be validated with operatorActionSeen=true and overrideTenantSeen=true."
    }
    if (
      -not [bool]$skillsRegistryEvidence.validated -or
      -not [bool]$skillsRegistryEvidence.indexHasSkill -or
      -not [bool]$skillsRegistryEvidence.registryHasSkill
    ) {
      Fail "badge-details evidence skillsRegistry must be validated with indexHasSkill=true and registryHasSkill=true."
    }
    if (
      -not [bool]$deviceNodesEvidence.validated -or
      -not [bool]$deviceNodesEvidence.lookupValidated -or
      -not [bool]$deviceNodesEvidence.versionConflictValidated -or
      -not [bool]$deviceNodesEvidence.healthSummaryValidated -or
      -not [bool]$deviceNodesEvidence.updatesValidated -or
      -not [bool]$deviceNodesEvidence.updatesHasUpsert -or
      -not [bool]$deviceNodesEvidence.updatesHasHeartbeat -or
      -not [bool]$deviceNodesEvidence.updatesApiValidated -or
      [int]$deviceNodesEvidence.updatesTotal -lt 2 -or
      -not [bool]$deviceNodesEvidence.summaryRecentContainsLookup
    ) {
      Fail "badge-details evidence deviceNodes must be validated with lookup/versionConflict/healthSummary + updates lane (upsert+heartbeat) and summaryRecentContainsLookup=true."
    }
    if ($deviceNodeUpdatesStatus -ne "pass") {
      Fail ("badge-details evidence deviceNodes updates lane must be 'pass' for deployment gate. actual=" + $deviceNodeUpdatesStatus)
    }
  }

  Write-Host ("Device-node-updates status (badge evidence): " + $deviceNodeUpdatesStatus)
}

Write-Host "Public badge endpoint is valid."
Write-Host "Badge: $($badge.label) -> $($badge.message) ($($badge.color))"
Write-Host ""
Write-Host "Shields URL:"
Write-Host $shield
