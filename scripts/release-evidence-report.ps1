[CmdletBinding()]
param(
  [string]$BadgeDetailsPath = "artifacts/demo-e2e/badge-details.json",
  [string]$OutputJsonPath = "artifacts/release-evidence/report.json",
  [string]$OutputMarkdownPath = "artifacts/release-evidence/report.md",
  [string]$OutputManifestJsonPath = "artifacts/release-evidence/manifest.json",
  [string]$OutputManifestMarkdownPath = "artifacts/release-evidence/manifest.md"
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  $maxAttempts = 8
  $baseRetryDelayMs = 80

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      [System.IO.File]::WriteAllText($Path, $Content, $encoding)
      return
    }
    catch [System.IO.IOException] {
      if ($attempt -ge $maxAttempts) {
        throw
      }

      Start-Sleep -Milliseconds ($baseRetryDelayMs * $attempt)
    }
  }
}

function Get-StatusValueOrDefault {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$DefaultValue
  )

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }

  return $raw
}

function Convert-ToNonNegativeIntOrDefault {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [int]$DefaultValue
  )

  if ($null -eq $Value) {
    return $DefaultValue
  }

  $parsed = 0
  if (-not [int]::TryParse([string]$Value, [ref]$parsed)) {
    return $DefaultValue
  }

  if ($parsed -lt 0) {
    return 0
  }

  return $parsed
}

function New-RuntimeGuardrailsPrimaryPath {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $title = Get-StatusValueOrDefault -Value $Value.title -DefaultValue ""
  $kind = Get-StatusValueOrDefault -Value $Value.kind -DefaultValue ""
  $summaryText = Get-StatusValueOrDefault -Value $Value.summaryText -DefaultValue ""
  if ([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($kind) -or [string]::IsNullOrWhiteSpace($summaryText)) {
    return $null
  }

  $lifecycleStatus = "unknown"
  if ($null -ne $Value.lifecycle) {
    $lifecycleStatus = Get-StatusValueOrDefault -Value $Value.lifecycle.statusCode -DefaultValue "unknown"
  }

  return [ordered]@{
    title           = $title
    kind            = $kind
    profileId       = $(if ([string]::IsNullOrWhiteSpace([string]$Value.profileId)) { $null } else { [string]$Value.profileId })
    phase           = $(if ([string]::IsNullOrWhiteSpace([string]$Value.phase)) { $null } else { [string]$Value.phase })
    buttonLabel     = $(if ([string]::IsNullOrWhiteSpace([string]$Value.buttonLabel)) { $null } else { [string]$Value.buttonLabel })
    summaryText     = $summaryText
    lifecycleStatus = $lifecycleStatus
  }
}

function New-ProviderUsagePrimaryEntry {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $route = Get-StatusValueOrDefault -Value $Value.route -DefaultValue ""
  $capability = Get-StatusValueOrDefault -Value $Value.capability -DefaultValue ""
  $selectedProvider = Get-StatusValueOrDefault -Value $Value.selectedProvider -DefaultValue ""
  $selectedModel = Get-StatusValueOrDefault -Value $Value.selectedModel -DefaultValue ""
  $selectionReason = Get-StatusValueOrDefault -Value $Value.selectionReason -DefaultValue ""
  if (
    [string]::IsNullOrWhiteSpace($route) -or
    [string]::IsNullOrWhiteSpace($capability) -or
    [string]::IsNullOrWhiteSpace($selectedProvider) -or
    [string]::IsNullOrWhiteSpace($selectedModel) -or
    [string]::IsNullOrWhiteSpace($selectionReason)
  ) {
    return $null
  }

  return [ordered]@{
    route           = $route
    capability      = $capability
    selectedProvider = $selectedProvider
    selectedModel   = $selectedModel
    selectionReason = $selectionReason
  }
}

function New-ArtifactEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Id,
    [Parameter(Mandatory = $true)]
    [string]$Category,
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [bool]$Required,
    [Parameter(Mandatory = $true)]
    [bool]$Present
  )

  return [ordered]@{
    id       = $Id
    category = $Category
    label    = $Label
    path     = $Path
    required = $Required
    present  = $Present
  }
}

function Read-JsonIfExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return @{
      present    = $false
      parsed     = $false
      value      = $null
      parseError = $null
    }
  }

  try {
    return @{
      present    = $true
      parsed     = $true
      value      = (Get-Content $Path -Raw | ConvertFrom-Json)
      parseError = $null
    }
  }
  catch {
    return @{
      present    = $true
      parsed     = $false
      value      = $null
      parseError = [string]$_.Exception.Message
    }
  }
}

$resolvedBadgeDetailsPath = [System.IO.Path]::GetFullPath($BadgeDetailsPath)
$resolvedOutputJsonPath = [System.IO.Path]::GetFullPath($OutputJsonPath)
$resolvedOutputMarkdownPath = [System.IO.Path]::GetFullPath($OutputMarkdownPath)
$resolvedOutputManifestJsonPath = [System.IO.Path]::GetFullPath($OutputManifestJsonPath)
$resolvedOutputManifestMarkdownPath = [System.IO.Path]::GetFullPath($OutputManifestMarkdownPath)

$resolvedDemoSummaryPath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/summary.json")
$resolvedDemoPolicyPath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/policy-check.json")
$resolvedDemoBadgePath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/badge.json")
$resolvedPerfSummaryPath = [System.IO.Path]::GetFullPath("artifacts/perf-load/summary.json")
$resolvedPerfPolicyPath = [System.IO.Path]::GetFullPath("artifacts/perf-load/policy-check.json")
$resolvedSourceRunManifestPath = [System.IO.Path]::GetFullPath("artifacts/release-artifact-revalidation/source-run.json")
$resolvedGcpCloudRunSummaryPath = [System.IO.Path]::GetFullPath("artifacts/deploy/gcp-cloud-run-summary.json")
$resolvedGcpFirestoreSummaryPath = [System.IO.Path]::GetFullPath("artifacts/deploy/gcp-firestore-summary.json")
$resolvedGcpRuntimeProofPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/gcp-runtime-proof.json")
$resolvedSubmissionRefreshStatusPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/submission-refresh-status.json")
$resolvedSubmissionRefreshStatusMarkdownPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/submission-refresh-status.md")
$resolvedVideoShotListPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/video-shot-list.md")
$resolvedVideoScriptPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/video-script-4min.md")
$resolvedScreenChecklistPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/screen-checklist.md")
$resolvedBonusArticleDraftPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/bonus-article-draft.md")
$gcpRuntimeProofRead = Read-JsonIfExists -Path $resolvedGcpRuntimeProofPath
$gcpRuntimeProof = if ($gcpRuntimeProofRead.present -and $gcpRuntimeProofRead.parsed) { $gcpRuntimeProofRead.value } else { $null }
$submissionRefreshStatusRead = Read-JsonIfExists -Path $resolvedSubmissionRefreshStatusPath
$submissionRefreshStatus = if ($submissionRefreshStatusRead.present -and $submissionRefreshStatusRead.parsed) { $submissionRefreshStatusRead.value } else { $null }
$gcpRuntimeProofStatus = if ($null -ne $gcpRuntimeProof) {
  Get-StatusValueOrDefault -Value $gcpRuntimeProof.status -DefaultValue "placeholder_pending_post_deploy"
} else {
  "placeholder_pending_post_deploy"
}
$gcpRuntimeProofBlockingReason = if ($null -ne $gcpRuntimeProof) {
  Get-StatusValueOrDefault -Value $gcpRuntimeProof.blockingReason -DefaultValue "none"
} else {
  "Cloud Run deploy and live GCP evidence collection were not executed in this workspace session because gcloud and bq are not installed."
}
$submissionSafeSummaryGate = if ($null -ne $gcpRuntimeProof -and $null -ne $gcpRuntimeProof.submissionSafeSummaryGate) {
  [ordered]@{
    liveApiEnabled          = ($gcpRuntimeProof.submissionSafeSummaryGate.liveApiEnabled -eq $true)
    translationProvider     = Get-StatusValueOrDefault -Value $gcpRuntimeProof.submissionSafeSummaryGate.translationProvider -DefaultValue "not_fallback"
    storytellerMediaMode    = Get-StatusValueOrDefault -Value $gcpRuntimeProof.submissionSafeSummaryGate.storytellerMediaMode -DefaultValue "not_simulated"
    uiExecutorForceSimulation = ($gcpRuntimeProof.submissionSafeSummaryGate.uiExecutorForceSimulation -eq $true)
  }
} else {
  [ordered]@{
    liveApiEnabled            = $true
    translationProvider       = "not_fallback"
    storytellerMediaMode      = "not_simulated"
    uiExecutorForceSimulation = $false
  }
}

$report = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = [datetime]::UtcNow.ToString("o")
  source        = [ordered]@{
    badgeDetailsPath    = $resolvedBadgeDetailsPath
    badgeDetailsPresent = $false
    badgeDetailsParsed  = $false
    parseError          = $null
  }
  statuses      = [ordered]@{
    turnTruncationStatus      = "unavailable"
    turnDeleteStatus          = "unavailable"
    operatorDamageControlStatus = "unavailable"
    governancePolicyStatus    = "unavailable"
    skillsRegistryStatus      = "unavailable"
    pluginMarketplaceStatus   = "unavailable"
    deviceNodesStatus         = "unavailable"
    agentUsageStatus          = "unavailable"
    runtimeGuardrailsSignalPathsStatus = "unavailable"
    providerUsageStatus       = "unavailable"
    deviceNodeUpdatesStatus   = "unavailable"
  }
  deviceNodeUpdates = [ordered]@{
    updatesValidated   = $false
    updatesHasUpsert   = $false
    updatesHasHeartbeat = $false
    updatesApiValidated = $false
    updatesTotal       = 0
  }
  runtimeGuardrailsSignalPaths = [ordered]@{
    summaryStatus = "unavailable"
    totalPaths    = 0
    primaryPath   = $null
  }
  providerUsage = [ordered]@{
    status                  = "unavailable"
    validated               = $false
    activeSecondaryProviders = 0
    entriesCount            = 0
    primaryEntry            = $null
    entries                 = @()
  }
  gcpSubmissionFollowUp = [ordered]@{
    cloudRunProofPath           = $resolvedGcpCloudRunSummaryPath
    firestoreProofPath          = $resolvedGcpFirestoreSummaryPath
    runtimeProofPath            = $resolvedGcpRuntimeProofPath
    submissionRefreshStatusPath = $resolvedSubmissionRefreshStatusPath
    submissionRefreshMarkdownPath = $resolvedSubmissionRefreshStatusMarkdownPath
    status                      = $gcpRuntimeProofStatus
    blockingReason              = $gcpRuntimeProofBlockingReason
    runtimeProofPresent         = $gcpRuntimeProofRead.present
    runtimeProofParsed          = $gcpRuntimeProofRead.parsed
    runtimeProofParseError      = $gcpRuntimeProofRead.parseError
    submissionRefreshStatus     = if ($null -ne $submissionRefreshStatus) { Get-StatusValueOrDefault -Value $submissionRefreshStatus.status -DefaultValue "unavailable" } else { "missing" }
    submissionRefreshBlockingReason = if ($null -ne $submissionRefreshStatus) { Get-StatusValueOrDefault -Value $submissionRefreshStatus.blockingReason -DefaultValue "none" } else { "submission refresh wrapper has not been run yet." }
    submissionRefreshPresent    = $submissionRefreshStatusRead.present
    submissionRefreshParsed     = $submissionRefreshStatusRead.parsed
    submissionRefreshParseError = $submissionRefreshStatusRead.parseError
    submissionSafeSummaryGate   = $submissionSafeSummaryGate
  }
  submissionAssets = [ordered]@{
    videoShotListPath   = $resolvedVideoShotListPath
    videoScriptPath     = $resolvedVideoScriptPath
    screenChecklistPath = $resolvedScreenChecklistPath
    bonusArticleDraftPath = $resolvedBonusArticleDraftPath
  }
}

if (Test-Path $resolvedBadgeDetailsPath) {
  $report.source.badgeDetailsPresent = $true
  try {
    $badgeDetails = Get-Content $resolvedBadgeDetailsPath -Raw | ConvertFrom-Json
    $report.source.badgeDetailsParsed = $true

    if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence) {
      if ($null -ne $badgeDetails.evidence.operatorTurnTruncation) {
        $report.statuses.turnTruncationStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorTurnTruncation.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.operatorTurnDelete) {
        $report.statuses.turnDeleteStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorTurnDelete.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.operatorDamageControl) {
        $report.statuses.operatorDamageControlStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorDamageControl.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.governancePolicy) {
        $report.statuses.governancePolicyStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.governancePolicy.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.skillsRegistry) {
        $report.statuses.skillsRegistryStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.skillsRegistry.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.pluginMarketplace) {
        $report.statuses.pluginMarketplaceStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.pluginMarketplace.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.deviceNodes) {
        $report.statuses.deviceNodesStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.deviceNodes.status -DefaultValue "unavailable"
        $report.deviceNodeUpdates.updatesValidated = ($badgeDetails.evidence.deviceNodes.updatesValidated -eq $true)
        $report.deviceNodeUpdates.updatesHasUpsert = ($badgeDetails.evidence.deviceNodes.updatesHasUpsert -eq $true)
        $report.deviceNodeUpdates.updatesHasHeartbeat = ($badgeDetails.evidence.deviceNodes.updatesHasHeartbeat -eq $true)
        $report.deviceNodeUpdates.updatesApiValidated = ($badgeDetails.evidence.deviceNodes.updatesApiValidated -eq $true)

        $updatesTotalRaw = $badgeDetails.evidence.deviceNodes.updatesTotal
        $updatesTotal = 0
        if ($null -ne $updatesTotalRaw) {
          $updatesTotalParsed = 0
          if ([int]::TryParse([string]$updatesTotalRaw, [ref]$updatesTotalParsed)) {
            $updatesTotal = $updatesTotalParsed
          }
        }
        $report.deviceNodeUpdates.updatesTotal = $updatesTotal

        if (
          $report.deviceNodeUpdates.updatesValidated -and
          $report.deviceNodeUpdates.updatesHasUpsert -and
          $report.deviceNodeUpdates.updatesHasHeartbeat -and
          $report.deviceNodeUpdates.updatesApiValidated -and
          $report.deviceNodeUpdates.updatesTotal -ge 2
        ) {
          $report.statuses.deviceNodeUpdatesStatus = "pass"
        }
        elseif (
          $report.deviceNodeUpdates.updatesTotal -gt 0 -or
          $report.deviceNodeUpdates.updatesHasUpsert -or
          $report.deviceNodeUpdates.updatesHasHeartbeat -or
          $report.deviceNodeUpdates.updatesValidated -or
          $report.deviceNodeUpdates.updatesApiValidated
        ) {
          $report.statuses.deviceNodeUpdatesStatus = "fail"
        }
      }
      if ($null -ne $badgeDetails.evidence.agentUsage) {
        $report.statuses.agentUsageStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.agentUsage.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.runtimeGuardrailsSignalPaths) {
        $report.statuses.runtimeGuardrailsSignalPathsStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.status -DefaultValue "unavailable"
        $report.runtimeGuardrailsSignalPaths.summaryStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.summaryStatus -DefaultValue "unavailable"
        $report.runtimeGuardrailsSignalPaths.totalPaths = Convert-ToNonNegativeIntOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.totalPaths -DefaultValue 0
        $report.runtimeGuardrailsSignalPaths.primaryPath = New-RuntimeGuardrailsPrimaryPath -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.primaryPath
      }
    }
    if ($null -ne $badgeDetails.providerUsage) {
      $report.providerUsage.status = Get-StatusValueOrDefault -Value $badgeDetails.providerUsage.status -DefaultValue "unavailable"
      $report.statuses.providerUsageStatus = $report.providerUsage.status
      $report.providerUsage.validated = ($badgeDetails.providerUsage.validated -eq $true)
      $report.providerUsage.activeSecondaryProviders = Convert-ToNonNegativeIntOrDefault -Value $badgeDetails.providerUsage.activeSecondaryProviders -DefaultValue 0
      $report.providerUsage.entries = @($badgeDetails.providerUsage.entries)
      $report.providerUsage.entriesCount = @($report.providerUsage.entries).Count
      if ($report.providerUsage.entriesCount -gt 0) {
        $report.providerUsage.primaryEntry = New-ProviderUsagePrimaryEntry -Value $report.providerUsage.entries[0]
      }
    }
  }
  catch {
    $report.source.parseError = [string]$_.Exception.Message
  }
}

$json = $report | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputJsonPath -Content $json

$providerEntriesMarkdown = if (@($report.providerUsage.entries).Count -gt 0) {
  (@($report.providerUsage.entries | ForEach-Object {
    "- entry: $([string]$_.route)/$([string]$_.capability) -> $([string]$_.selectedProvider)/$([string]$_.selectedModel) (default $([string]$_.defaultProvider)/$([string]$_.defaultModel))"
  })) -join "`n"
} else {
  "- entries: (none)"
}

$markdown = @(
  "# Release Evidence Report",
  "",
  "- Generated at: $($report.generatedAt)",
  "- Badge details path: $($report.source.badgeDetailsPath)",
  "- Badge details present: $($report.source.badgeDetailsPresent)",
  "- Badge details parsed: $($report.source.badgeDetailsParsed)",
  $(if (-not [string]::IsNullOrWhiteSpace([string]$report.source.parseError)) { "- Parse error: $($report.source.parseError)" } else { "- Parse error: none" }),
  "",
  "| Evidence Lane | Status |",
  "|---|---|",
  "| operatorTurnTruncation | $($report.statuses.turnTruncationStatus) |",
  "| operatorTurnDelete | $($report.statuses.turnDeleteStatus) |",
  "| operatorDamageControl | $($report.statuses.operatorDamageControlStatus) |",
  "| governancePolicy | $($report.statuses.governancePolicyStatus) |",
  "| skillsRegistry | $($report.statuses.skillsRegistryStatus) |",
  "| pluginMarketplace | $($report.statuses.pluginMarketplaceStatus) |",
  "| deviceNodes | $($report.statuses.deviceNodesStatus) |",
  "| agentUsage | $($report.statuses.agentUsageStatus) |",
  "| runtimeGuardrailsSignalPaths | $($report.statuses.runtimeGuardrailsSignalPathsStatus) |",
  "| providerUsage | $($report.statuses.providerUsageStatus) |",
  "| deviceNodeUpdates | $($report.statuses.deviceNodeUpdatesStatus) |",
  "",
  "## Device Node Updates Details",
  "",
  "- updatesValidated: $($report.deviceNodeUpdates.updatesValidated)",
  "- updatesHasUpsert: $($report.deviceNodeUpdates.updatesHasUpsert)",
  "- updatesHasHeartbeat: $($report.deviceNodeUpdates.updatesHasHeartbeat)",
  "- updatesApiValidated: $($report.deviceNodeUpdates.updatesApiValidated)",
  "- updatesTotal: $($report.deviceNodeUpdates.updatesTotal)",
  "",
  "## Runtime Guardrails Signal Paths Snapshot",
  "",
  "- summaryStatus: $($report.runtimeGuardrailsSignalPaths.summaryStatus)",
  "- totalPaths: $($report.runtimeGuardrailsSignalPaths.totalPaths)",
  $(if ($null -ne $report.runtimeGuardrailsSignalPaths.primaryPath) {
      "- primaryPath: $($report.runtimeGuardrailsSignalPaths.primaryPath.title) [$($report.runtimeGuardrailsSignalPaths.primaryPath.kind)]"
    } else {
      "- primaryPath: (none)"
    }),
  "",
  "## Secondary Provider Usage",
  "",
  "- status: $($report.providerUsage.status)",
  "- validated: $($report.providerUsage.validated)",
  "- activeSecondaryProviders: $($report.providerUsage.activeSecondaryProviders)",
  "- entriesCount: $($report.providerUsage.entriesCount)",
  $(if ($null -ne $report.providerUsage.primaryEntry) {
      "- primaryEntry: $($report.providerUsage.primaryEntry.route)/$($report.providerUsage.primaryEntry.capability) -> $($report.providerUsage.primaryEntry.selectedProvider)/$($report.providerUsage.primaryEntry.selectedModel) [$($report.providerUsage.primaryEntry.selectionReason)]"
    } else {
      "- primaryEntry: (none)"
    }),
  $providerEntriesMarkdown,
  "",
  "## GCP Submission Follow-Up",
  "",
  "- Cloud Run proof target: artifacts/deploy/gcp-cloud-run-summary.json",
  "- Firestore proof target: artifacts/deploy/gcp-firestore-summary.json",
  "- Runtime proof target: artifacts/release-evidence/gcp-runtime-proof.json",
  "- Submission refresh status target: artifacts/release-evidence/submission-refresh-status.json",
  "- Current state: $($report.gcpSubmissionFollowUp.status)",
  "- Blocking reason: $($report.gcpSubmissionFollowUp.blockingReason)",
  "- Submission refresh state: $($report.gcpSubmissionFollowUp.submissionRefreshStatus)",
  "- Submission refresh blocker: $($report.gcpSubmissionFollowUp.submissionRefreshBlockingReason)",
  "- Submission-safe summary gate: liveApiEnabled=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.liveApiEnabled), translationProvider=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.translationProvider), storytellerMediaMode=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.storytellerMediaMode), uiExecutorForceSimulation=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.uiExecutorForceSimulation).",
  "",
  "## Submission Assets",
  "",
  "- Shot list: artifacts/release-evidence/video-shot-list.md",
  "- 4-minute script: artifacts/release-evidence/video-script-4min.md",
  "- Screen checklist: artifacts/release-evidence/screen-checklist.md",
  "- Bonus article draft: artifacts/release-evidence/bonus-article-draft.md"
) -join "`n"

Write-Utf8NoBomFile -Path $resolvedOutputMarkdownPath -Content $markdown

$artifactEntries = @(
  (New-ArtifactEntry -Id "demo.summary" -Category "demo" -Label "Demo summary JSON" -Path $resolvedDemoSummaryPath -Required $true -Present (Test-Path $resolvedDemoSummaryPath)),
  (New-ArtifactEntry -Id "demo.policy" -Category "demo" -Label "Demo policy-check JSON" -Path $resolvedDemoPolicyPath -Required $true -Present (Test-Path $resolvedDemoPolicyPath)),
  (New-ArtifactEntry -Id "demo.badge" -Category "demo" -Label "Demo badge JSON" -Path $resolvedDemoBadgePath -Required $true -Present (Test-Path $resolvedDemoBadgePath)),
  (New-ArtifactEntry -Id "demo.badgeDetails" -Category "demo" -Label "Demo badge-details JSON" -Path $resolvedBadgeDetailsPath -Required $true -Present (Test-Path $resolvedBadgeDetailsPath)),
  (New-ArtifactEntry -Id "perf.summary" -Category "perf" -Label "Perf summary JSON" -Path $resolvedPerfSummaryPath -Required $false -Present (Test-Path $resolvedPerfSummaryPath)),
  (New-ArtifactEntry -Id "perf.policy" -Category "perf" -Label "Perf policy-check JSON" -Path $resolvedPerfPolicyPath -Required $false -Present (Test-Path $resolvedPerfPolicyPath)),
  (New-ArtifactEntry -Id "release.reportJson" -Category "release_evidence" -Label "Release evidence report JSON" -Path $resolvedOutputJsonPath -Required $true -Present (Test-Path $resolvedOutputJsonPath)),
  (New-ArtifactEntry -Id "release.reportMarkdown" -Category "release_evidence" -Label "Release evidence report Markdown" -Path $resolvedOutputMarkdownPath -Required $true -Present (Test-Path $resolvedOutputMarkdownPath)),
  (New-ArtifactEntry -Id "release.manifestJson" -Category "release_evidence" -Label "Release evidence manifest JSON" -Path $resolvedOutputManifestJsonPath -Required $true -Present $true),
  (New-ArtifactEntry -Id "release.manifestMarkdown" -Category "release_evidence" -Label "Release evidence manifest Markdown" -Path $resolvedOutputManifestMarkdownPath -Required $true -Present $true),
  (New-ArtifactEntry -Id "release.submissionRefreshStatusJson" -Category "release_evidence" -Label "Submission refresh status JSON" -Path $resolvedSubmissionRefreshStatusPath -Required $false -Present (Test-Path $resolvedSubmissionRefreshStatusPath)),
  (New-ArtifactEntry -Id "release.submissionRefreshStatusMarkdown" -Category "release_evidence" -Label "Submission refresh status Markdown" -Path $resolvedSubmissionRefreshStatusMarkdownPath -Required $false -Present (Test-Path $resolvedSubmissionRefreshStatusMarkdownPath)),
  (New-ArtifactEntry -Id "artifactRevalidation.sourceRunManifest" -Category "provenance" -Label "Source-run provenance manifest" -Path $resolvedSourceRunManifestPath -Required $false -Present (Test-Path $resolvedSourceRunManifestPath))
)

$missingRequiredArtifacts = @($artifactEntries | Where-Object { $_.required -eq $true -and $_.present -ne $true })
$manifest = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = [datetime]::UtcNow.ToString("o")
  source        = [ordered]@{
    badgeDetailsPath   = $resolvedBadgeDetailsPath
    reportJsonPath     = $resolvedOutputJsonPath
    reportMarkdownPath = $resolvedOutputMarkdownPath
  }
  inventory     = [ordered]@{
    total           = $artifactEntries.Count
    present         = @($artifactEntries | Where-Object { $_.present -eq $true }).Count
    missingRequired = $missingRequiredArtifacts.Count
  }
  criticalEvidenceStatuses = $report.statuses
  artifacts     = $artifactEntries
  submissionAssets = @(
    [ordered]@{
      id     = "gcpRuntimeProof"
      status = $report.gcpSubmissionFollowUp.status
      path   = $resolvedGcpRuntimeProofPath
    },
    [ordered]@{
      id     = "submissionRefreshStatus"
      status = $report.gcpSubmissionFollowUp.submissionRefreshStatus
      path   = $resolvedSubmissionRefreshStatusPath
    },
    [ordered]@{
      id     = "videoShotList"
      status = $(if (Test-Path $resolvedVideoShotListPath) { "ready" } else { "missing" })
      path   = $resolvedVideoShotListPath
    },
    [ordered]@{
      id     = "videoScript4Min"
      status = $(if (Test-Path $resolvedVideoScriptPath) { "ready" } else { "missing" })
      path   = $resolvedVideoScriptPath
    },
    [ordered]@{
      id     = "screenChecklist"
      status = $(if (Test-Path $resolvedScreenChecklistPath) { "ready" } else { "missing" })
      path   = $resolvedScreenChecklistPath
    },
    [ordered]@{
      id     = "bonusArticleDraft"
      status = $(if (Test-Path $resolvedBonusArticleDraftPath) { "ready" } else { "missing" })
      path   = $resolvedBonusArticleDraftPath
    }
  )
  submissionRefreshGate = $report.gcpSubmissionFollowUp.submissionSafeSummaryGate
}

$manifestJson = $manifest | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputManifestJsonPath -Content $manifestJson

$manifestMarkdown = @(
  "# Release Evidence Manifest",
  "",
  "- Generated at: $($manifest.generatedAt)",
  "- Total artifacts: $($manifest.inventory.total)",
  "- Present artifacts: $($manifest.inventory.present)",
  "- Missing required artifacts: $($manifest.inventory.missingRequired)",
  "",
  "## Critical Evidence Statuses",
  "",
  "| Evidence Lane | Status |",
  "|---|---|",
  "| operatorTurnTruncation | $($report.statuses.turnTruncationStatus) |",
  "| operatorTurnDelete | $($report.statuses.turnDeleteStatus) |",
  "| operatorDamageControl | $($report.statuses.operatorDamageControlStatus) |",
  "| governancePolicy | $($report.statuses.governancePolicyStatus) |",
  "| skillsRegistry | $($report.statuses.skillsRegistryStatus) |",
  "| pluginMarketplace | $($report.statuses.pluginMarketplaceStatus) |",
  "| deviceNodes | $($report.statuses.deviceNodesStatus) |",
  "| agentUsage | $($report.statuses.agentUsageStatus) |",
  "| runtimeGuardrailsSignalPaths | $($report.statuses.runtimeGuardrailsSignalPathsStatus) |",
  "| providerUsage | $($report.statuses.providerUsageStatus) |",
  "| deviceNodeUpdates | $($report.statuses.deviceNodeUpdatesStatus) |",
  "",
  "## Artifact Inventory",
  "",
  "| Artifact | Category | Required | Present | Path |",
  "|---|---|---|---|---|"
)

foreach ($entry in $artifactEntries) {
  $manifestMarkdown += "| $($entry.id) | $($entry.category) | $($entry.required) | $($entry.present) | $($entry.path) |"
}

$manifestMarkdown += ""
$manifestMarkdown += "## Submission Assets"
$manifestMarkdown += ""
$manifestMarkdown += "| Asset | Status | Path |"
$manifestMarkdown += "|---|---|---|"
foreach ($asset in $manifest.submissionAssets) {
  $manifestMarkdown += "| $($asset.id) | $($asset.status) | $($asset.path) |"
}
$manifestMarkdown += ""
$manifestMarkdown += "## Submission Refresh Gate"
$manifestMarkdown += ""
$manifestMarkdown += "| Signal | Required Value |"
$manifestMarkdown += "|---|---|"
$manifestMarkdown += "| liveApiEnabled | $($manifest.submissionRefreshGate.liveApiEnabled) |"
$manifestMarkdown += "| translationProvider | $($manifest.submissionRefreshGate.translationProvider) |"
$manifestMarkdown += "| storytellerMediaMode | $($manifest.submissionRefreshGate.storytellerMediaMode) |"
$manifestMarkdown += "| uiExecutorForceSimulation | $($manifest.submissionRefreshGate.uiExecutorForceSimulation) |"

Write-Utf8NoBomFile -Path $resolvedOutputManifestMarkdownPath -Content ($manifestMarkdown -join "`n")

Write-Host ("[release-evidence-report] JSON: " + $resolvedOutputJsonPath)
Write-Host ("[release-evidence-report] Markdown: " + $resolvedOutputMarkdownPath)
Write-Host ("[release-evidence-report] Manifest JSON: " + $resolvedOutputManifestJsonPath)
Write-Host ("[release-evidence-report] Manifest Markdown: " + $resolvedOutputManifestMarkdownPath)
