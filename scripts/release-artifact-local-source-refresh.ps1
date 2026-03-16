[CmdletBinding()]
param(
  [string]$ArtifactsDir = "artifacts",
  [string]$OutputPath = "artifacts/release-artifact-revalidation/source-run.json"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

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
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Resolve-AbsolutePath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Get-ObjectPropertyValue {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Read-JsonFileOrNull([string]$PathValue, [string]$Label) {
  if (-not (Test-Path $PathValue)) {
    return $null
  }

  try {
    return Get-Content $PathValue -Raw | ConvertFrom-Json
  }
  catch {
    Fail ("Failed to parse " + $Label + ": " + $_.Exception.Message)
  }
}

function Get-NonEmptyStringOrNull([object]$Value) {
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  return $raw
}

function Get-StatusOrFallback([object]$Primary, [object]$Secondary, [string]$Fallback = "unavailable") {
  $primaryText = Get-NonEmptyStringOrNull $Primary
  if ($null -ne $primaryText) {
    return $primaryText
  }

  $secondaryText = Get-NonEmptyStringOrNull $Secondary
  if ($null -ne $secondaryText) {
    return $secondaryText
  }

  return $Fallback
}

function Get-IntOrDefault([object]$Value, [int]$DefaultValue = 0) {
  if ($null -eq $Value) {
    return $DefaultValue
  }

  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) {
    return $parsed
  }

  return $DefaultValue
}

function Invoke-GitText {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  try {
    $raw = & git -C $WorkingDirectory @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }

    $text = [string]($raw -join "`n")
    if ([string]::IsNullOrWhiteSpace($text)) {
      return $null
    }

    return $text.Trim()
  }
  catch {
    return $null
  }
}

function Resolve-RepositoryIdentity {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $false)]
    [object]$ExistingManifest
  )

  $remoteUrl = Invoke-GitText -WorkingDirectory $RepoRoot -Arguments @("config", "--get", "remote.origin.url")
  if (-not [string]::IsNullOrWhiteSpace($remoteUrl)) {
    $match = [regex]::Match($remoteUrl, "[:/]([^/:]+)/([^/]+?)(?:\.git)?$")
    if ($match.Success) {
      return [ordered]@{
        owner = $match.Groups[1].Value
        repo  = $match.Groups[2].Value
      }
    }
  }

  $existingOwner = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $ExistingManifest -Name "repository") -Name "owner")
  $existingRepo = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $ExistingManifest -Name "repository") -Name "repo")
  if ($null -ne $existingOwner -and $null -ne $existingRepo) {
    return [ordered]@{
      owner = $existingOwner
      repo  = $existingRepo
    }
  }

  return [ordered]@{
    owner = "local"
    repo  = Split-Path -Leaf $RepoRoot
  }
}

function Resolve-BranchSelection {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $branch = Invoke-GitText -WorkingDirectory $RepoRoot -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
  if (-not [string]::IsNullOrWhiteSpace($branch) -and $branch -ne "HEAD") {
    return [ordered]@{
      branch               = $branch
      allowAnySourceBranch = $false
      allowedBranches      = @($branch)
    }
  }

  return [ordered]@{
    branch               = "local"
    allowAnySourceBranch = $true
    allowedBranches      = @("main", "master")
  }
}

function New-NullablePrimaryPath([object]$PrimaryPath) {
  if ($null -eq $PrimaryPath) {
    return $null
  }

  $title = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "title")
  $kind = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "kind")
  $summaryText = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "summaryText")
  if ($null -eq $title -or $null -eq $kind -or $null -eq $summaryText) {
    return $null
  }

  return [ordered]@{
    title           = $title
    kind            = $kind
    profileId       = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "profileId")
    phase           = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "phase")
    buttonLabel     = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryPath -Name "buttonLabel")
    summaryText     = $summaryText
    lifecycleStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $PrimaryPath -Name "lifecycleStatus") -Secondary $null -Fallback "unknown"
  }
}

function New-NullableProviderPrimaryEntry([object]$PrimaryEntry) {
  if ($null -eq $PrimaryEntry) {
    return $null
  }

  $route = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryEntry -Name "route")
  $capability = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryEntry -Name "capability")
  $selectedProvider = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryEntry -Name "selectedProvider")
  $selectedModel = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryEntry -Name "selectedModel")
  $selectionReason = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $PrimaryEntry -Name "selectionReason")
  if ($null -eq $route -or $null -eq $capability -or $null -eq $selectedProvider -or $null -eq $selectedModel -or $null -eq $selectionReason) {
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

function Get-DeviceNodeUpdatesStatus {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Report,
    [Parameter(Mandatory = $false)]
    [object]$BadgeDetails
  )

  $reportStatus = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $Report -Name "statuses") -Name "deviceNodeUpdatesStatus")
  if ($null -ne $reportStatus) {
    return $reportStatus
  }

  $deviceNodes = Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $BadgeDetails -Name "evidence") -Name "deviceNodes"
  if ($null -eq $deviceNodes) {
    return "unavailable"
  }

  $updatesValidated = ((Get-ObjectPropertyValue -Object $deviceNodes -Name "updatesValidated") -eq $true)
  $updatesHasUpsert = ((Get-ObjectPropertyValue -Object $deviceNodes -Name "updatesHasUpsert") -eq $true)
  $updatesHasHeartbeat = ((Get-ObjectPropertyValue -Object $deviceNodes -Name "updatesHasHeartbeat") -eq $true)
  $updatesApiValidated = ((Get-ObjectPropertyValue -Object $deviceNodes -Name "updatesApiValidated") -eq $true)
  $updatesTotal = Get-IntOrDefault (Get-ObjectPropertyValue -Object $deviceNodes -Name "updatesTotal") 0

  if ($updatesValidated -and $updatesHasUpsert -and $updatesHasHeartbeat -and $updatesApiValidated -and $updatesTotal -ge 2) {
    return "pass"
  }

  if ($updatesTotal -gt 0 -or $updatesHasUpsert -or $updatesHasHeartbeat -or $updatesValidated -or $updatesApiValidated) {
    return "fail"
  }

  return "unavailable"
}

$resolvedArtifactsDir = Resolve-AbsolutePath $ArtifactsDir
$resolvedOutputPath = Resolve-AbsolutePath $OutputPath
$repoRoot = Split-Path -Parent $resolvedArtifactsDir

$summaryPath = Join-Path $resolvedArtifactsDir "demo-e2e/summary.json"
$badgeDetailsPath = Join-Path $resolvedArtifactsDir "demo-e2e/badge-details.json"
$releaseEvidenceReportPath = Join-Path $resolvedArtifactsDir "release-evidence/report.json"
$releaseEvidenceReportMarkdownPath = Join-Path $resolvedArtifactsDir "release-evidence/report.md"
$releaseEvidenceManifestPath = Join-Path $resolvedArtifactsDir "release-evidence/manifest.json"
$releaseEvidenceManifestMarkdownPath = Join-Path $resolvedArtifactsDir "release-evidence/manifest.md"
$railwayDeploySummaryPath = Join-Path $resolvedArtifactsDir "deploy/railway-deploy-summary.json"
$repoPublishSummaryPath = Join-Path $resolvedArtifactsDir "deploy/repo-publish-summary.json"
$existingManifestPath = Join-Path $resolvedArtifactsDir "release-artifact-revalidation/source-run.json"
$perfSummaryPath = Join-Path $resolvedArtifactsDir "perf-load/summary.json"
$perfPolicyPath = Join-Path $resolvedArtifactsDir "perf-load/policy-check.json"

if (-not (Test-Path $summaryPath)) {
  Fail ("Missing required demo summary: " + $summaryPath)
}
if (-not (Test-Path $badgeDetailsPath)) {
  Fail ("Missing required badge details: " + $badgeDetailsPath)
}

$releaseEvidenceScriptPath = Join-Path $PSScriptRoot "release-evidence-report.ps1"
if (-not (Test-Path $releaseEvidenceScriptPath)) {
  Fail ("Missing helper script: " + $releaseEvidenceScriptPath)
}

Write-Host "[local-source-refresh] Build release evidence report"
& powershell -NoProfile -ExecutionPolicy Bypass -File $releaseEvidenceScriptPath `
  -BadgeDetailsPath $badgeDetailsPath `
  -OutputJsonPath $releaseEvidenceReportPath `
  -OutputMarkdownPath $releaseEvidenceReportMarkdownPath `
  -OutputManifestJsonPath $releaseEvidenceManifestPath `
  -OutputManifestMarkdownPath $releaseEvidenceManifestMarkdownPath
if ($LASTEXITCODE -ne 0) {
  Fail "Build release evidence report failed."
}

$summary = Read-JsonFileOrNull -PathValue $summaryPath -Label "demo summary"
$badgeDetails = Read-JsonFileOrNull -PathValue $badgeDetailsPath -Label "badge details"
$releaseEvidenceReport = Read-JsonFileOrNull -PathValue $releaseEvidenceReportPath -Label "release evidence report"
$railwayDeploySummary = Read-JsonFileOrNull -PathValue $railwayDeploySummaryPath -Label "railway deploy summary"
$repoPublishSummary = Read-JsonFileOrNull -PathValue $repoPublishSummaryPath -Label "repo publish summary"
$existingManifest = Read-JsonFileOrNull -PathValue $existingManifestPath -Label "existing source-run manifest"

$repositoryIdentity = Resolve-RepositoryIdentity -RepoRoot $repoRoot -ExistingManifest $existingManifest
$branchSelection = Resolve-BranchSelection -RepoRoot $repoRoot
$headSha = Invoke-GitText -WorkingDirectory $repoRoot -Arguments @("rev-parse", "HEAD")
$headShaShort = Invoke-GitText -WorkingDirectory $repoRoot -Arguments @("rev-parse", "--short=12", "HEAD")
$updatedAtUtc = [datetime]::UtcNow
$runId = "local-" + $updatedAtUtc.ToString("yyyyMMddHHmmss")
$hasPerfArtifacts = (Test-Path $perfSummaryPath) -and (Test-Path $perfPolicyPath)
$perfMode = if ($hasPerfArtifacts) { "with_perf" } else { "without_perf" }

$summaryKpis = Get-ObjectPropertyValue -Object $summary -Name "kpis"
$reportStatuses = Get-ObjectPropertyValue -Object $releaseEvidenceReport -Name "statuses"
$badgeEvidence = Get-ObjectPropertyValue -Object $badgeDetails -Name "evidence"
$runtimeGuardrails = Get-ObjectPropertyValue -Object $releaseEvidenceReport -Name "runtimeGuardrailsSignalPaths"
$providerUsage = Get-ObjectPropertyValue -Object $releaseEvidenceReport -Name "providerUsage"
$deviceNodes = Get-ObjectPropertyValue -Object $badgeEvidence -Name "deviceNodes"
$runtimeGuardrailsBadge = Get-ObjectPropertyValue -Object $badgeEvidence -Name "runtimeGuardrailsSignalPaths"
$providerUsageBadge = Get-ObjectPropertyValue -Object $badgeDetails -Name "providerUsage"
$providerUsageEntriesValue = Get-ObjectPropertyValue -Object $providerUsage -Name "entries"
$providerUsageEntries = if ($null -ne $providerUsageEntriesValue) { @($providerUsageEntriesValue) } else { @() }
$providerUsageBadgeEntriesValue = Get-ObjectPropertyValue -Object $providerUsageBadge -Name "entries"
$providerUsageBadgeEntriesCount = if ($null -ne $providerUsageBadgeEntriesValue) { @($providerUsageBadgeEntriesValue).Count } else { 0 }
$providerUsageValidated = if ($null -ne (Get-ObjectPropertyValue -Object $providerUsage -Name "validated")) {
  ((Get-ObjectPropertyValue -Object $providerUsage -Name "validated") -eq $true)
}
else {
  ((Get-ObjectPropertyValue -Object $providerUsageBadge -Name "validated") -eq $true)
}

$repoPublishVerification = Get-ObjectPropertyValue -Object $repoPublishSummary -Name "verification"
$repoPublishSteps = Get-ObjectPropertyValue -Object $repoPublishSummary -Name "steps"
$repoPublishRuntime = Get-ObjectPropertyValue -Object $repoPublishSummary -Name "runtime"
$repoPublishArtifacts = Get-ObjectPropertyValue -Object $repoPublishSummary -Name "artifacts"
$repoPublishReleaseEvidenceArtifacts = Get-ObjectPropertyValue -Object $repoPublishVerification -Name "releaseEvidenceArtifacts"
$repoPublishReleaseEvidenceArtifactsCount = if ($null -ne $repoPublishReleaseEvidenceArtifacts) { @($repoPublishReleaseEvidenceArtifacts).Count } else { $null }

$railwayChecks = Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "checks"
$railwayRootDescriptor = Get-ObjectPropertyValue -Object $railwayChecks -Name "rootDescriptor"
$railwayPublicBadge = Get-ObjectPropertyValue -Object $railwayChecks -Name "publicBadge"

$runtimeGuardrailsPrimaryPath = New-NullablePrimaryPath (Get-ObjectPropertyValue -Object $runtimeGuardrails -Name "primaryPath")
$providerUsagePrimaryEntry = New-NullableProviderPrimaryEntry (Get-ObjectPropertyValue -Object $providerUsage -Name "primaryEntry")
if ($null -eq $providerUsagePrimaryEntry) {
  if ($providerUsageEntries.Count -gt 0) {
    $providerUsagePrimaryEntry = New-NullableProviderPrimaryEntry $providerUsageEntries[0]
  }
}
if ($null -eq $providerUsagePrimaryEntry -and $providerUsageBadgeEntriesCount -gt 0) {
  $providerUsagePrimaryEntry = New-NullableProviderPrimaryEntry @($providerUsageBadgeEntriesValue)[0]
}

$sourceRunManifest = [ordered]@{
  schemaVersion = "1.0"
  generatedAt = $updatedAtUtc.ToString("o")
  repository = $repositoryIdentity
  sourceRun = [ordered]@{
    runId = $runId
    workflow = "local-artifact-refresh"
    branch = $branchSelection.branch
    headSha = $(if (-not [string]::IsNullOrWhiteSpace($headSha)) { $headSha } else { "local" })
    headShaShort = $(if (-not [string]::IsNullOrWhiteSpace($headShaShort)) { $headShaShort } else { "local" })
    conclusion = "success"
    updatedAtUtc = $updatedAtUtc.ToString("o")
    ageHours = 0.01
  }
  artifact = [ordered]@{
    name = "local-artifact-refresh"
    id = 0
  }
  sourceSelection = [ordered]@{
    allowAnySourceBranch = [bool]$branchSelection.allowAnySourceBranch
    allowedBranches = $branchSelection.allowedBranches
    maxSourceRunAgeHours = 168
  }
  gate = [ordered]@{
    skipArtifactOnlyGate = $false
    strictFinalRun = $false
    requestedPerfMode = $perfMode
    effectivePerfMode = $perfMode
    perfArtifactsDetected = $(if ($hasPerfArtifacts) { "true" } else { "false" })
    evidenceSnapshot = [ordered]@{
      demoSummaryPresent = (Test-Path $summaryPath)
      badgeDetailsPresent = (Test-Path $badgeDetailsPath)
      releaseEvidenceReportPresent = (Test-Path $releaseEvidenceReportPath)
      railwayDeploySummaryPresent = (Test-Path $railwayDeploySummaryPath)
      railwayDeploySummaryStatus = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "status")
      railwayDeploySummaryDeploymentId = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "deploymentId")
      railwayDeploySummaryEffectivePublicUrl = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "effectivePublicUrl")
      railwayDeploySummaryBadgeEndpoint = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayPublicBadge -Name "badgeEndpoint")
      railwayDeploySummaryBadgeDetailsEndpoint = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayPublicBadge -Name "badgeDetailsEndpoint")
      railwayDeploySummaryProjectId = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "projectId")
      railwayDeploySummaryService = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "service")
      railwayDeploySummaryEnvironment = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "environment")
      railwayDeploySummaryEffectiveStartCommand = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "effectiveStartCommand")
      railwayDeploySummaryConfigSource = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayDeploySummary -Name "configSource")
      railwayDeploySummaryRootDescriptorAttempted = Get-ObjectPropertyValue -Object $railwayRootDescriptor -Name "attempted"
      railwayDeploySummaryRootDescriptorSkipped = Get-ObjectPropertyValue -Object $railwayRootDescriptor -Name "skipped"
      railwayDeploySummaryRootDescriptorExpectedUiUrl = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $railwayRootDescriptor -Name "expectedUiUrl")
      railwayDeploySummaryPublicBadgeAttempted = Get-ObjectPropertyValue -Object $railwayPublicBadge -Name "attempted"
      railwayDeploySummaryPublicBadgeSkipped = Get-ObjectPropertyValue -Object $railwayPublicBadge -Name "skipped"
      repoPublishSummaryPresent = (Test-Path $repoPublishSummaryPath)
      repoPublishSummaryBranch = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishSummary -Name "branch")
      repoPublishSummaryRemoteName = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishSummary -Name "remoteName")
      repoPublishSummaryVerificationScript = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishVerification -Name "script")
      repoPublishSummaryVerificationSkipped = Get-ObjectPropertyValue -Object $repoPublishVerification -Name "skipped"
      repoPublishSummaryVerificationStrict = Get-ObjectPropertyValue -Object $repoPublishVerification -Name "strict"
      repoPublishSummaryReleaseEvidenceValidated = ((Get-ObjectPropertyValue -Object $repoPublishVerification -Name "releaseEvidenceArtifactsValidated") -eq $true)
      repoPublishSummaryReleaseEvidenceArtifactsCount = $repoPublishReleaseEvidenceArtifactsCount
      repoPublishSummaryCommitEnabled = Get-ObjectPropertyValue -Object $repoPublishSteps -Name "commitEnabled"
      repoPublishSummaryPushEnabled = Get-ObjectPropertyValue -Object $repoPublishSteps -Name "pushEnabled"
      repoPublishSummaryPagesEnabled = Get-ObjectPropertyValue -Object $repoPublishSteps -Name "pagesEnabled"
      repoPublishSummaryBadgeCheckEnabled = Get-ObjectPropertyValue -Object $repoPublishSteps -Name "badgeCheckEnabled"
      repoPublishSummaryRailwayDeployEnabled = ((Get-ObjectPropertyValue -Object $repoPublishSteps -Name "railwayDeployEnabled") -eq $true)
      repoPublishSummaryRailwayFrontendDeployEnabled = ((Get-ObjectPropertyValue -Object $repoPublishSteps -Name "railwayFrontendDeployEnabled") -eq $true)
      repoPublishSummaryRuntimeRailwayPublicUrl = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishRuntime -Name "railwayPublicUrl")
      repoPublishSummaryRuntimeRailwayDemoFrontendPublicUrl = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishRuntime -Name "railwayDemoFrontendPublicUrl")
      repoPublishSummaryRuntimeRailwayNoWait = Get-ObjectPropertyValue -Object $repoPublishRuntime -Name "railwayNoWait"
      repoPublishSummaryRuntimeRailwayFrontendNoWait = Get-ObjectPropertyValue -Object $repoPublishRuntime -Name "railwayFrontendNoWait"
      repoPublishSummaryArtifactSelf = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishArtifacts -Name "self")
      repoPublishSummaryArtifactRailwayDeploySummary = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishArtifacts -Name "railwayDeploySummary")
      repoPublishSummaryArtifactReleaseEvidenceReportJson = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishArtifacts -Name "releaseEvidenceReportJson")
      repoPublishSummaryArtifactReleaseEvidenceManifestJson = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishArtifacts -Name "releaseEvidenceManifestJson")
      repoPublishSummaryArtifactBadgeDetailsJson = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $repoPublishArtifacts -Name "badgeDetailsJson")
      operatorTurnTruncationSummaryValidated = ((Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorTurnTruncationSummaryValidated") -eq $true)
      operatorTurnDeleteSummaryValidated = ((Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorTurnDeleteSummaryValidated") -eq $true)
      operatorDamageControlSummaryValidated = ((Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorDamageControlSummaryValidated") -eq $true)
      operatorDamageControlTotal = Get-IntOrDefault (Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorDamageControlTotal") 0
      operatorDamageControlLatestVerdict = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorDamageControlLatestVerdict")
      operatorDamageControlLatestSource = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorDamageControlLatestSource")
      operatorDamageControlLatestSeenAt = Get-NonEmptyStringOrNull (Get-ObjectPropertyValue -Object $summaryKpis -Name "operatorDamageControlLatestSeenAt")
      badgeEvidenceOperatorTurnTruncationStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "turnTruncationStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "operatorTurnTruncation") -Name "status")
      badgeEvidenceOperatorTurnDeleteStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "turnDeleteStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "operatorTurnDelete") -Name "status")
      badgeEvidenceOperatorDamageControlStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "operatorDamageControlStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "operatorDamageControl") -Name "status")
      badgeEvidenceGovernancePolicyStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "governancePolicyStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "governancePolicy") -Name "status")
      badgeEvidenceSkillsRegistryStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "skillsRegistryStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "skillsRegistry") -Name "status")
      badgeEvidencePluginMarketplaceStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "pluginMarketplaceStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "pluginMarketplace") -Name "status")
      badgeEvidenceDeviceNodesStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "deviceNodesStatus") -Secondary (Get-ObjectPropertyValue -Object $deviceNodes -Name "status")
      badgeEvidenceAgentUsageStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "agentUsageStatus") -Secondary (Get-ObjectPropertyValue -Object (Get-ObjectPropertyValue -Object $badgeEvidence -Name "agentUsage") -Name "status")
      badgeEvidenceRuntimeGuardrailsSignalPathsStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $reportStatuses -Name "runtimeGuardrailsSignalPathsStatus") -Secondary (Get-ObjectPropertyValue -Object $runtimeGuardrailsBadge -Name "status")
      badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $runtimeGuardrails -Name "summaryStatus") -Secondary (Get-ObjectPropertyValue -Object $runtimeGuardrailsBadge -Name "summaryStatus")
      badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths = Get-IntOrDefault (Get-ObjectPropertyValue -Object $runtimeGuardrails -Name "totalPaths") (Get-IntOrDefault (Get-ObjectPropertyValue -Object $runtimeGuardrailsBadge -Name "totalPaths") 0)
      badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath = $runtimeGuardrailsPrimaryPath
      badgeEvidenceProviderUsageStatus = Get-StatusOrFallback -Primary (Get-ObjectPropertyValue -Object $providerUsage -Name "status") -Secondary (Get-ObjectPropertyValue -Object $providerUsageBadge -Name "status")
      badgeEvidenceProviderUsageValidated = $providerUsageValidated
      badgeEvidenceProviderUsageActiveSecondaryProviders = Get-IntOrDefault (Get-ObjectPropertyValue -Object $providerUsage -Name "activeSecondaryProviders") (Get-IntOrDefault (Get-ObjectPropertyValue -Object $providerUsageBadge -Name "activeSecondaryProviders") 0)
      badgeEvidenceProviderUsageEntriesCount = Get-IntOrDefault (Get-ObjectPropertyValue -Object $providerUsage -Name "entriesCount") $providerUsageBadgeEntriesCount
      badgeEvidenceProviderUsagePrimaryEntry = $providerUsagePrimaryEntry
      badgeEvidenceDeviceNodeUpdatesStatus = Get-DeviceNodeUpdatesStatus -Report $releaseEvidenceReport -BadgeDetails $badgeDetails
    }
  }
  retry = [ordered]@{
    githubApiMaxAttempts = 3
    githubApiRetryBackoffMs = 1200
    retryableStatusCodes = @(408, 429, 500, 502, 503, 504)
  }
}

$sourceRunManifestJson = $sourceRunManifest | ConvertTo-Json -Depth 12
Write-Utf8NoBomFile -Path $resolvedOutputPath -Content $sourceRunManifestJson

Write-Host ("[local-source-refresh] Source run manifest written: " + $resolvedOutputPath)
Write-Host ("[local-source-refresh] Branch guard: allowAnySourceBranch=" + [string]$branchSelection.allowAnySourceBranch + "; allowedBranches=" + ($branchSelection.allowedBranches -join ", "))
Write-Host ("[local-source-refresh] Perf mode: " + $perfMode)
Write-Host ("[local-source-refresh] Runtime guardrails status: " + [string]$sourceRunManifest.gate.evidenceSnapshot.badgeEvidenceRuntimeGuardrailsSignalPathsStatus)
Write-Host ("[local-source-refresh] Provider usage status: " + [string]$sourceRunManifest.gate.evidenceSnapshot.badgeEvidenceProviderUsageStatus)
