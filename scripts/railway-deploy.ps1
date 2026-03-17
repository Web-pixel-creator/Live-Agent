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
  [switch]$SkipPublicBadgeCheck,
  [switch]$SkipRootDescriptorCheck,
  [string]$PublicBadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$PublicBadgeDetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [string]$RailwayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [string]$DemoFrontendPublicUrl = $env:DEMO_FRONTEND_PUBLIC_URL,
  [int]$PublicBadgeCheckTimeoutSec = 20,
  [int]$RootDescriptorCheckTimeoutSec = 20,
  [int]$RootDescriptorCheckMaxAttempts = 3,
  [int]$RootDescriptorCheckRetryBackoffSec = 2,
  [switch]$NoWait,
  [switch]$SkipFailureLogs,
  [int]$FailureLogLines = 120,
  [int]$StatusPollMaxAttempts = 60,
  [int]$StatusPollIntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Write-RailwayDeploySummary([object]$Summary) {
  $summaryPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\artifacts\deploy\railway-deploy-summary.json"))
  $summaryJson = $Summary | ConvertTo-Json -Depth 10
  Write-Utf8NoBomFile -Path $summaryPath -Content $summaryJson
  return $summaryPath
}

function Write-GitHubOutputValue([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) {
    return
  }

  $line = $Name + "=" + $Value
  $line | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
}

function Write-GitHubStepSummaryLine([string]$Line) {
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    return
  }

  $Line | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
}

function Read-JsonArtifactIfPresent([string]$RelativePath, [string]$Label) {
  $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ("..\" + $RelativePath)))
  if (-not (Test-Path $resolvedPath)) {
    return $null
  }

  try {
    return Get-Content -Path $resolvedPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Warning ("[railway-deploy] Failed to parse " + $Label + ": " + $_.Exception.Message)
    return $null
  }
}

function Convert-ToNullableString([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) {
    return $null
  }

  return $text
}

function Convert-ToNullableInt([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) {
    return $parsed
  }

  return $null
}

function Convert-ToNullableDouble([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $parsed = [double]0
  if ([double]::TryParse([string]$Value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
    return $parsed
  }

  return $null
}

function Get-CompactRuntimeGuardrailsPrimaryPath([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $title = Convert-ToNullableString -Value $Value.title
  $kind = Convert-ToNullableString -Value $Value.kind
  $summaryText = Convert-ToNullableString -Value $Value.summaryText
  if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($kind) -and [string]::IsNullOrWhiteSpace($summaryText)) {
    return $null
  }

  return [ordered]@{
    title = $title
    kind = $kind
    profileId = Convert-ToNullableString -Value $Value.profileId
    phase = Convert-ToNullableString -Value $Value.phase
    buttonLabel = Convert-ToNullableString -Value $Value.buttonLabel
    summaryText = $summaryText
    lifecycleStatus = Convert-ToNullableString -Value $Value.lifecycleStatus
  }
}

function Get-CompactProviderUsagePrimaryEntry([object]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $route = Convert-ToNullableString -Value $Value.route
  $capability = Convert-ToNullableString -Value $Value.capability
  $selectedProvider = Convert-ToNullableString -Value $Value.selectedProvider
  $selectedModel = Convert-ToNullableString -Value $Value.selectedModel
  $selectionReason = Convert-ToNullableString -Value $Value.selectionReason
  if (
    [string]::IsNullOrWhiteSpace($route) -and
    [string]::IsNullOrWhiteSpace($capability) -and
    [string]::IsNullOrWhiteSpace($selectedProvider) -and
    [string]::IsNullOrWhiteSpace($selectedModel) -and
    [string]::IsNullOrWhiteSpace($selectionReason)
  ) {
    return $null
  }

  return [ordered]@{
    route = $route
    capability = $capability
    selectedProvider = $selectedProvider
    selectedModel = $selectedModel
    selectionReason = $selectionReason
  }
}

function Get-ReleaseEvidenceSnapshot([bool]$ValidatedInThisRun) {
  $report = Read-JsonArtifactIfPresent -RelativePath "artifacts/release-evidence/report.json" -Label "release evidence report"
  $manifest = Read-JsonArtifactIfPresent -RelativePath "artifacts/release-evidence/manifest.json" -Label "release evidence manifest"
  $badgeDetails = Read-JsonArtifactIfPresent -RelativePath "artifacts/demo-e2e/badge-details.json" -Label "demo badge-details"

  $runtimeGuardrailsSource = if ($null -ne $report -and $null -ne $report.runtimeGuardrailsSignalPaths) {
    $report.runtimeGuardrailsSignalPaths
  }
  else {
    $badgeDetails.evidence.runtimeGuardrailsSignalPaths
  }
  $providerUsageSource = if ($null -ne $report -and $null -ne $report.providerUsage) {
    $report.providerUsage
  }
  else {
    $badgeDetails.providerUsage
  }
  $deviceNodeUpdatesSource = if ($null -ne $report -and $null -ne $report.deviceNodeUpdates) {
    $report.deviceNodeUpdates
  }
  else {
    $badgeDetails.evidence.deviceNodes
  }

  $criticalEvidenceStatuses = $null
  if ($null -ne $manifest -and $null -ne $manifest.criticalEvidenceStatuses) {
    $criticalEvidenceStatuses = $manifest.criticalEvidenceStatuses
  }
  elseif ($null -ne $report -and $null -ne $report.statuses) {
    $criticalEvidenceStatuses = $report.statuses
  }

  return [ordered]@{
    available = (($null -ne $report) -or ($null -ne $manifest) -or ($null -ne $badgeDetails))
    validatedInThisRun = $ValidatedInThisRun
    reportGeneratedAt = Convert-ToNullableString -Value $report.generatedAt
    manifestGeneratedAt = Convert-ToNullableString -Value $manifest.generatedAt
    badgeDetailsGeneratedAt = Convert-ToNullableString -Value $badgeDetails.generatedAt
    manifestInventory = if ($null -ne $manifest -and $null -ne $manifest.inventory) {
      [ordered]@{
        total = Convert-ToNullableInt -Value $manifest.inventory.total
        present = Convert-ToNullableInt -Value $manifest.inventory.present
        missingRequired = Convert-ToNullableInt -Value $manifest.inventory.missingRequired
      }
    }
    else {
      $null
    }
    criticalEvidenceStatuses = $criticalEvidenceStatuses
    deviceNodeUpdates = if ($null -ne $deviceNodeUpdatesSource) {
      [ordered]@{
        updatesValidated = ($deviceNodeUpdatesSource.updatesValidated -eq $true)
        updatesHasUpsert = ($deviceNodeUpdatesSource.updatesHasUpsert -eq $true)
        updatesHasHeartbeat = ($deviceNodeUpdatesSource.updatesHasHeartbeat -eq $true)
        updatesApiValidated = ($deviceNodeUpdatesSource.updatesApiValidated -eq $true)
        updatesTotal = Convert-ToNullableInt -Value $deviceNodeUpdatesSource.updatesTotal
      }
    }
    else {
      $null
    }
    runtimeGuardrails = if ($null -ne $runtimeGuardrailsSource) {
      [ordered]@{
        status = Convert-ToNullableString -Value $(if ($null -ne $report -and $null -ne $report.statuses) { $report.statuses.runtimeGuardrailsSignalPathsStatus } else { $runtimeGuardrailsSource.status })
        summaryStatus = Convert-ToNullableString -Value $runtimeGuardrailsSource.summaryStatus
        totalPaths = Convert-ToNullableInt -Value $runtimeGuardrailsSource.totalPaths
        primaryPath = Get-CompactRuntimeGuardrailsPrimaryPath -Value $runtimeGuardrailsSource.primaryPath
      }
    }
    else {
      $null
    }
    providerUsage = if ($null -ne $providerUsageSource) {
      [ordered]@{
        status = Convert-ToNullableString -Value $providerUsageSource.status
        validated = ($providerUsageSource.validated -eq $true)
        activeSecondaryProviders = Convert-ToNullableInt -Value $providerUsageSource.activeSecondaryProviders
        entriesCount = Convert-ToNullableInt -Value $(if ($null -ne $providerUsageSource.entriesCount) { $providerUsageSource.entriesCount } elseif ($null -ne $providerUsageSource.entries) { @($providerUsageSource.entries).Count } else { $null })
        primaryEntry = Get-CompactProviderUsagePrimaryEntry -Value $(if ($null -ne $providerUsageSource.primaryEntry) { $providerUsageSource.primaryEntry } elseif ($null -ne $providerUsageSource.entries) { @($providerUsageSource.entries)[0] } else { $null })
      }
    }
    else {
      $null
    }
    badgeDetails = if ($null -ne $badgeDetails) {
      [ordered]@{
        checks = Convert-ToNullableInt -Value $badgeDetails.checks
        violations = Convert-ToNullableInt -Value $badgeDetails.violations
        roundTripMs = Convert-ToNullableInt -Value $badgeDetails.roundTripMs
        costTotalUsd = Convert-ToNullableDouble -Value $badgeDetails.costEstimate.totalUsd
        tokensTotal = Convert-ToNullableInt -Value $badgeDetails.tokensUsed.total
      }
    }
    else {
      $null
    }
  }
}

function Publish-RailwayDeployOutputs([string]$SummaryRelativePath, [object]$Summary) {
  $statusValue = Convert-ToNullableString -Value $Summary.status
  $deploymentIdValue = Convert-ToNullableString -Value $Summary.deploymentId
  $effectivePublicUrlValue = Convert-ToNullableString -Value $Summary.effectivePublicUrl
  $verification = $Summary.verification
  $verificationSkipped = if ($null -ne $verification -and $verification.skipped -eq $true) { "true" } else { "false" }
  $verificationStrictValue = if ($null -ne $verification -and $verification.strict -eq $true) { "true" } else { "false" }
  $verificationScriptValue = if ($null -ne $verification -and $verification.skipped -eq $true) { "skipped" } elseif ($null -ne $verification -and -not [string]::IsNullOrWhiteSpace([string]$verification.script)) { [string]$verification.script } else { "verify:release" }
  $releaseEvidenceValidatedValue = if ($null -ne $verification -and $verification.releaseEvidenceArtifactsValidated -eq $true) { "true" } else { "false" }
  $releaseEvidenceSnapshot = $Summary.releaseEvidenceSnapshot
  $snapshotAvailableValue = if ($null -ne $releaseEvidenceSnapshot -and $releaseEvidenceSnapshot.available -eq $true) { "true" } else { "false" }
  $missingRequiredValue = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.manifestInventory -and $null -ne $releaseEvidenceSnapshot.manifestInventory.missingRequired) { [string]$releaseEvidenceSnapshot.manifestInventory.missingRequired } else { "" }
  $badgeChecksValue = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.badgeDetails -and $null -ne $releaseEvidenceSnapshot.badgeDetails.checks) { [string]$releaseEvidenceSnapshot.badgeDetails.checks } else { "" }
  $runtimeGuardrailsSummaryValue = if ($null -ne $releaseEvidenceSnapshot -and $null -ne $releaseEvidenceSnapshot.runtimeGuardrails) { [string](Convert-ToNullableString -Value $releaseEvidenceSnapshot.runtimeGuardrails.summaryStatus) } else { "" }
  $artifacts = $Summary.artifacts
  $releaseEvidenceReportPathValue = if ($null -ne $artifacts -and -not [string]::IsNullOrWhiteSpace([string]$artifacts.releaseEvidenceReportJson)) { [string]$artifacts.releaseEvidenceReportJson } else { "artifacts/release-evidence/report.json" }
  $releaseEvidenceManifestPathValue = if ($null -ne $artifacts -and -not [string]::IsNullOrWhiteSpace([string]$artifacts.releaseEvidenceManifestJson)) { [string]$artifacts.releaseEvidenceManifestJson } else { "artifacts/release-evidence/manifest.json" }
  $badgeDetailsPathValue = if ($null -ne $artifacts -and -not [string]::IsNullOrWhiteSpace([string]$artifacts.badgeDetailsJson)) { [string]$artifacts.badgeDetailsJson } else { "artifacts/demo-e2e/badge-details.json" }

  Write-GitHubOutputValue -Name "railway_deploy_summary_path" -Value $SummaryRelativePath
  Write-GitHubOutputValue -Name "railway_deploy_verification_script" -Value $verificationScriptValue
  Write-GitHubOutputValue -Name "railway_deploy_verification_skipped" -Value $verificationSkipped
  Write-GitHubOutputValue -Name "railway_deploy_verification_strict" -Value $verificationStrictValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_validated" -Value $releaseEvidenceValidatedValue
  Write-GitHubOutputValue -Name "railway_deploy_status" -Value $(if ([string]::IsNullOrWhiteSpace($statusValue)) { "" } else { $statusValue })
  Write-GitHubOutputValue -Name "railway_deploy_deployment_id" -Value $(if ([string]::IsNullOrWhiteSpace($deploymentIdValue)) { "" } else { $deploymentIdValue })
  Write-GitHubOutputValue -Name "railway_deploy_effective_public_url" -Value $(if ([string]::IsNullOrWhiteSpace($effectivePublicUrlValue)) { "" } else { $effectivePublicUrlValue })
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_snapshot_available" -Value $snapshotAvailableValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_missing_required" -Value $missingRequiredValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_badge_checks" -Value $badgeChecksValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_runtime_guardrails_summary_status" -Value $runtimeGuardrailsSummaryValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_report_path" -Value $releaseEvidenceReportPathValue
  Write-GitHubOutputValue -Name "railway_deploy_release_evidence_manifest_path" -Value $releaseEvidenceManifestPathValue
  Write-GitHubOutputValue -Name "railway_deploy_badge_details_path" -Value $badgeDetailsPathValue

  Write-GitHubStepSummaryLine ("Railway deploy summary artifact: " + $SummaryRelativePath)
  Write-GitHubStepSummaryLine ("Railway deploy verification script: " + $verificationScriptValue)
  Write-GitHubStepSummaryLine ("Railway deploy verification skipped: " + $verificationSkipped)
  Write-GitHubStepSummaryLine ("Railway deploy verification strict: " + $verificationStrictValue)
  Write-GitHubStepSummaryLine ("Railway deploy release-evidence validated: " + $releaseEvidenceValidatedValue)
  if (-not [string]::IsNullOrWhiteSpace($statusValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy status: " + $statusValue)
  }
  if (-not [string]::IsNullOrWhiteSpace($deploymentIdValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy deployment ID: " + $deploymentIdValue)
  }
  if (-not [string]::IsNullOrWhiteSpace($effectivePublicUrlValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy effective public URL: " + $effectivePublicUrlValue)
  }
  Write-GitHubStepSummaryLine ("Railway deploy release-evidence snapshot available: " + $snapshotAvailableValue)
  if (-not [string]::IsNullOrWhiteSpace($missingRequiredValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy release-evidence missing required artifacts: " + $missingRequiredValue)
  }
  if (-not [string]::IsNullOrWhiteSpace($badgeChecksValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy release-evidence badge checks: " + $badgeChecksValue)
  }
  if (-not [string]::IsNullOrWhiteSpace($runtimeGuardrailsSummaryValue)) {
    Write-GitHubStepSummaryLine ("Railway deploy release-evidence runtime guardrails: " + $runtimeGuardrailsSummaryValue)
  }
  if ($releaseEvidenceValidatedValue -eq "true" -or $snapshotAvailableValue -eq "true") {
    Write-GitHubStepSummaryLine ("Railway deploy release-evidence report artifact: " + $releaseEvidenceReportPathValue)
    Write-GitHubStepSummaryLine ("Railway deploy release-evidence manifest artifact: " + $releaseEvidenceManifestPathValue)
    Write-GitHubStepSummaryLine ("Railway deploy badge-details artifact: " + $badgeDetailsPathValue)
  }
}

if ($RootDescriptorCheckMaxAttempts -lt 1) {
  Fail "RootDescriptorCheckMaxAttempts must be >= 1."
}

if ($RootDescriptorCheckRetryBackoffSec -lt 0) {
  Fail "RootDescriptorCheckRetryBackoffSec must be >= 0."
}

function Run-Cli([string[]]$CliArgs) {
  & railway @CliArgs
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($CliArgs -join " "))
  }
}

function Run-CliCapture([string[]]$CliArgs) {
  $output = & railway @CliArgs 2>&1
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($CliArgs -join " "))
  }
  return ,$output
}

function Ensure-RailwayAuthContext([string]$LogPrefix) {
  $hasProjectToken = -not [string]::IsNullOrWhiteSpace($env:RAILWAY_TOKEN)

  if ([string]::IsNullOrWhiteSpace($env:RAILWAY_API_TOKEN) -and $hasProjectToken) {
    $env:RAILWAY_API_TOKEN = $env:RAILWAY_TOKEN
    Write-Host ("[" + $LogPrefix + "] RAILWAY_API_TOKEN is empty; using RAILWAY_TOKEN fallback for CLI auth.")
  }

  $authProbe = ""
  $authProbeExitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $authProbe = (& railway whoami 2>&1 | Out-String).Trim()
    $authProbeExitCode = $LASTEXITCODE
  }
  catch {
    $authProbe = [string]$_.Exception.Message
    $authProbeExitCode = 1
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($authProbeExitCode -eq 0) {
    return
  }

  if (-not [string]::IsNullOrWhiteSpace($authProbe)) {
    Write-Host $authProbe
  }

  if ($hasProjectToken) {
    if ($env:RAILWAY_API_TOKEN -ne $env:RAILWAY_TOKEN) {
      $env:RAILWAY_API_TOKEN = $env:RAILWAY_TOKEN
      Write-Warning ("[" + $LogPrefix + "] railway whoami failed; forcing RAILWAY_TOKEN project-token mode (RAILWAY_TOKEN -> RAILWAY_API_TOKEN).")
    }
    else {
      Write-Warning ("[" + $LogPrefix + "] railway whoami failed; continuing with RAILWAY_TOKEN project-token mode.")
    }
    return
  }

  Fail ("[" + $LogPrefix + "] Railway authentication failed. Set RAILWAY_API_TOKEN (account token), or set RAILWAY_TOKEN (project token), or run 'railway login'.")
}

function Resolve-NpmCli() {
  if ($env:OS -eq "Windows_NT") {
    return "npm.cmd"
  }
  return "npm"
}

function Resolve-ServiceNameFromStatus([object]$StatusPayload, [string]$Service, [string]$TargetEnvironment) {
  if ($null -eq $StatusPayload) {
    return $null
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "environments") {
    $envEdges = $StatusPayload.environments.edges
    if ($null -ne $envEdges) {
      foreach ($envEdge in $envEdges) {
        $envNode = $envEdge.node
        if ($null -eq $envNode) {
          continue
        }
        if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment) -and $envNode.name -ne $TargetEnvironment) {
          continue
        }

        $instanceEdges = $envNode.serviceInstances.edges
        if ($null -eq $instanceEdges) {
          continue
        }

        foreach ($instanceEdge in $instanceEdges) {
          $instance = $instanceEdge.node
          if ($null -eq $instance) {
            continue
          }
          $serviceId = [string]$instance.serviceId
          $serviceName = [string]$instance.serviceName
          if (
            (-not [string]::IsNullOrWhiteSpace($Service)) -and
            $serviceId -ne $Service -and
            $serviceName -ne $Service
          ) {
            continue
          }
          if (-not [string]::IsNullOrWhiteSpace($serviceName)) {
            return $serviceName
          }
        }
      }
    }
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "services") {
    $serviceEdges = $StatusPayload.services.edges
    if ($null -ne $serviceEdges) {
      foreach ($edge in $serviceEdges) {
        $serviceNode = $edge.node
        if ($null -eq $serviceNode) {
          continue
        }
        $serviceId = [string]$serviceNode.id
        $serviceName = [string]$serviceNode.name
        if (
          (-not [string]::IsNullOrWhiteSpace($Service)) -and
          $serviceId -ne $Service -and
          $serviceName -ne $Service
        ) {
          continue
        }
        if (-not [string]::IsNullOrWhiteSpace($serviceName)) {
          return $serviceName
        }
      }
    }
  }

  return $null
}

function Resolve-RailwayServiceManifestTemplatePath([string]$RepoRoot, [string]$ServiceName) {
  if ([string]::IsNullOrWhiteSpace($ServiceName)) {
    return $null
  }

  $candidate = switch ($ServiceName) {
    "Live-Agent-Orchestrator" { Join-Path $RepoRoot "infra\railway\manifests\orchestrator.railway.json" }
    default { $null }
  }

  if ([string]::IsNullOrWhiteSpace($candidate) -or -not (Test-Path $candidate)) {
    return $null
  }

  return [System.IO.Path]::GetFullPath($candidate)
}

function New-RailwayDeployWorkspace([string]$RepoRoot, [string]$ManifestTemplatePath) {
  $workspacePath = Join-Path $env:TEMP ("mla-railway-deploy-" + [guid]::NewGuid().ToString())
  $gitArgs = @("-C", $RepoRoot, "worktree", "add", "--detach", $workspacePath, "HEAD")
  $gitOutput = @()
  $gitExitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $gitOutput = (& git @gitArgs 2>&1)
    $gitExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($gitOutput) {
    $gitOutput | ForEach-Object { Write-Host $_ }
  }
  if ($gitExitCode -ne 0) {
    Fail "Unable to create clean Railway deploy worktree."
  }

  if (-not [string]::IsNullOrWhiteSpace($ManifestTemplatePath)) {
    $targetManifestPath = Join-Path $workspacePath "railway.json"
    Copy-Item -LiteralPath $ManifestTemplatePath -Destination $targetManifestPath -Force
    Write-Host ("[railway-deploy] Applied service-specific Railway manifest template: " + $ManifestTemplatePath)
  }
  else {
    Write-Host "[railway-deploy] Using repository root Railway manifest in clean deploy worktree."
  }

  return $workspacePath
}

function Remove-RailwayDeployWorkspace([string]$RepoRoot, [string]$WorkspacePath) {
  if ([string]::IsNullOrWhiteSpace($WorkspacePath) -or -not (Test-Path $WorkspacePath)) {
    return
  }

  $gitArgs = @("-C", $RepoRoot, "worktree", "remove", "--force", $WorkspacePath)
  $gitOutput = @()
  $gitExitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $gitOutput = (& git @gitArgs 2>&1)
    $gitExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($gitOutput) {
    $gitOutput | ForEach-Object { Write-Host $_ }
  }
  if ($gitExitCode -ne 0) {
    Write-Warning ("[railway-deploy] Failed to remove temporary deploy worktree: " + $WorkspacePath)
  }
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

function Resolve-ServiceIdFromStatus([object]$StatusPayload, [string]$TargetEnvironment) {
  if ($null -eq $StatusPayload) {
    return $null
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "service") {
    $serviceNode = $StatusPayload.service
    if ($null -ne $serviceNode -and -not [string]::IsNullOrWhiteSpace([string]$serviceNode.id)) {
      return [string]$serviceNode.id
    }
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "services") {
    $serviceEdges = $StatusPayload.services.edges
    if ($null -ne $serviceEdges) {
      foreach ($edge in $serviceEdges) {
        $serviceNode = $edge.node
        if ($null -ne $serviceNode -and -not [string]::IsNullOrWhiteSpace([string]$serviceNode.id)) {
          return [string]$serviceNode.id
        }
      }
    }
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "environments") {
    $envEdges = $StatusPayload.environments.edges
    if ($null -ne $envEdges) {
      foreach ($envEdge in $envEdges) {
        $envNode = $envEdge.node
        if ($null -eq $envNode) {
          continue
        }
        if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment) -and $envNode.name -ne $TargetEnvironment) {
          continue
        }

        $instances = $envNode.serviceInstances.edges
        if ($null -eq $instances) {
          continue
        }

        foreach ($instanceEdge in $instances) {
          $instance = $instanceEdge.node
          if ($null -ne $instance -and -not [string]::IsNullOrWhiteSpace([string]$instance.serviceId)) {
            return [string]$instance.serviceId
          }
        }
      }
    }
  }

  return $null
}

function Resolve-PublicBadgeEndpoint(
  [string]$ExplicitEndpoint,
  [string]$PublicUrl
) {
  if (-not [string]::IsNullOrWhiteSpace($ExplicitEndpoint)) {
    return [string]$ExplicitEndpoint.Trim()
  }

  if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) {
    return ([string]$PublicUrl.TrimEnd("/") + "/demo-e2e/badge.json")
  }

  return $null
}

function Resolve-PublicBadgeDetailsEndpoint(
  [string]$ExplicitEndpoint,
  [string]$ResolvedBadgeEndpoint
) {
  if (-not [string]::IsNullOrWhiteSpace($ExplicitEndpoint)) {
    return [string]$ExplicitEndpoint.Trim()
  }

  if ([string]::IsNullOrWhiteSpace($ResolvedBadgeEndpoint)) {
    return $null
  }

  $normalizedBadgeEndpoint = [string]$ResolvedBadgeEndpoint.Trim()
  if ($normalizedBadgeEndpoint.EndsWith("/badge.json")) {
    return ($normalizedBadgeEndpoint.Substring(0, $normalizedBadgeEndpoint.Length - "badge.json".Length) + "badge-details.json")
  }

  return ($normalizedBadgeEndpoint.TrimEnd("/") + "/badge-details.json")
}

function Invoke-PublicBadgeCheck(
  [string]$Endpoint,
  [string]$DetailsEndpoint,
  [string]$PublicUrl,
  [int]$TimeoutSec
) {
  $badgeScriptPath = Join-Path $PSScriptRoot "public-badge-check.ps1"
  if (-not (Test-Path $badgeScriptPath)) {
    Fail "Missing helper script: $badgeScriptPath"
  }

  $resolvedBadgeEndpoint = Resolve-PublicBadgeEndpoint -ExplicitEndpoint $Endpoint -PublicUrl $PublicUrl
  $resolvedBadgeDetailsEndpoint = Resolve-PublicBadgeDetailsEndpoint -ExplicitEndpoint $DetailsEndpoint -ResolvedBadgeEndpoint $resolvedBadgeEndpoint

  $badgeArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $badgeScriptPath, "-TimeoutSec", [string]$TimeoutSec)
  if (-not [string]::IsNullOrWhiteSpace($resolvedBadgeEndpoint)) {
    $badgeArgs += @("-BadgeEndpoint", $resolvedBadgeEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedBadgeDetailsEndpoint)) {
    $badgeArgs += @("-DetailsEndpoint", $resolvedBadgeDetailsEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) {
    $badgeArgs += @("-RailwayPublicUrl", $PublicUrl)
  }

  if (-not [string]::IsNullOrWhiteSpace($resolvedBadgeEndpoint)) {
    Write-Host ("[railway-deploy] Effective public badge URL: " + $resolvedBadgeEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($resolvedBadgeDetailsEndpoint)) {
    Write-Host ("[railway-deploy] Effective public badge details URL: " + $resolvedBadgeDetailsEndpoint)
  }
  Write-Host "[railway-deploy] Running post-deploy public badge endpoint check..."
  & powershell @badgeArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Post-deploy public badge endpoint check failed."
  }

  return [ordered]@{
    badgeEndpoint = $resolvedBadgeEndpoint
    badgeDetailsEndpoint = $resolvedBadgeDetailsEndpoint
  }
}

function Invoke-GatewayRootDescriptorCheck(
  [string]$Endpoint,
  [string]$ExpectedUiUrl,
  [int]$TimeoutSec,
  [int]$MaxAttempts,
  [int]$RetryBackoffSec
) {
  if ([string]::IsNullOrWhiteSpace($Endpoint)) {
    Write-Host "[railway-deploy] Effective public URL is empty; skipping gateway root descriptor check."
    return
  }

  $attemptCount = if ($MaxAttempts -ge 1) { [math]::Floor($MaxAttempts) } else { 1 }
  $retryBackoff = if ($RetryBackoffSec -ge 0) { [math]::Floor($RetryBackoffSec) } else { 0 }
  $target = [string]$Endpoint.TrimEnd("/")
  Write-Host ("[railway-deploy] Running gateway root descriptor check: " + $target + "/ (attempts=" + [string]$attemptCount + ")")

  for ($attempt = 1; $attempt -le $attemptCount; $attempt++) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri ($target + "/") -TimeoutSec $TimeoutSec -ErrorAction Stop

      if ($null -eq $response -or $response.ok -ne $true) {
        throw "expected payload.ok=true."
      }

      $serviceName = [string]$response.service
      if ([string]::IsNullOrWhiteSpace($serviceName)) {
        throw "response.service is missing."
      }
      if ($serviceName -ne "realtime-gateway") {
        throw ("expected service 'realtime-gateway', actual '" + $serviceName + "'.")
      }

      $message = [string]$response.message
      if ($message -ne "realtime-gateway is online") {
        throw ("unexpected message '" + $message + "'.")
      }

      $routes = $response.routes
      if ($null -eq $routes) {
        throw "response.routes is missing."
      }

      $expectedRoutes = [ordered]@{
        websocket = "/realtime"
        health = "/healthz"
        status = "/status"
        metrics = "/metrics"
        badge = "/demo-e2e/badge.json"
        badgeDetails = "/demo-e2e/badge-details.json"
      }

      foreach ($routeKey in $expectedRoutes.Keys) {
        $actualRoute = [string]$routes.$routeKey
        if ([string]::IsNullOrWhiteSpace($actualRoute)) {
          throw ("routes." + $routeKey + " is missing.")
        }
        if ($actualRoute -ne [string]$expectedRoutes[$routeKey]) {
          throw (
            "routes." +
            $routeKey +
            " expected '" +
            [string]$expectedRoutes[$routeKey] +
            "', actual '" +
            $actualRoute +
            "'."
          )
        }
      }

      $reportedPublicUrl = [string]$response.publicUrl
      if ([string]::IsNullOrWhiteSpace($reportedPublicUrl)) {
        throw "response.publicUrl is missing."
      }

      $normalizedReportedPublicUrl = $reportedPublicUrl.TrimEnd("/")
      if ($normalizedReportedPublicUrl -ne $target) {
        Write-Warning (
          "[railway-deploy] Gateway root descriptor publicUrl mismatch: expected '" +
          $target +
          "', actual '" +
          $normalizedReportedPublicUrl +
          "'."
        )
      }

      if (-not [string]::IsNullOrWhiteSpace($ExpectedUiUrl)) {
        $reportedUiUrl = [string]$response.uiUrl
        if ([string]::IsNullOrWhiteSpace($reportedUiUrl)) {
          throw "response.uiUrl is missing while expected UI URL was provided."
        }
        $normalizedExpectedUiUrl = [string]$ExpectedUiUrl.TrimEnd("/")
        $normalizedReportedUiUrl = $reportedUiUrl.TrimEnd("/")
        if ($normalizedReportedUiUrl -ne $normalizedExpectedUiUrl) {
          throw (
            "response.uiUrl mismatch (expected '" +
            $normalizedExpectedUiUrl +
            "', actual '" +
            $normalizedReportedUiUrl +
            "')."
          )
        }
      }

      if ($attempt -gt 1) {
        Write-Host ("[railway-deploy] Gateway root descriptor check recovered on attempt " + [string]$attempt + ".")
      }
      return
    }
    catch {
      $reason = $_.Exception.Message
      if ($attempt -ge $attemptCount) {
        Fail (
          "Gateway root descriptor check failed for " +
          $target +
          "/ after " +
          [string]$attemptCount +
          " attempt(s): " +
          $reason
        )
      }

      Write-Warning (
        "[railway-deploy] Gateway root descriptor check attempt " +
        [string]$attempt +
        "/" +
        [string]$attemptCount +
        " failed: " +
        $reason
      )
      if ($retryBackoff -gt 0) {
        Write-Host ("[railway-deploy] Retrying gateway root descriptor check in " + [string]$retryBackoff + "s...")
        Start-Sleep -Seconds $retryBackoff
      }
    }
  }
}

function Show-DeploymentFailureDiagnostics(
  [string]$DeploymentId,
  [string]$Service,
  [string]$Env,
  [int]$Lines
) {
  if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
    return
  }

  if ($SkipFailureLogs) {
    Write-Host "[railway-deploy] Failure diagnostics log capture skipped by flag."
    return
  }

  $lineCount = if ($Lines -gt 0) { $Lines } else { 120 }
  $baseArgs = @("logs", $DeploymentId, "--lines", [string]$lineCount)
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $baseArgs += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $baseArgs += @("-e", $Env)
  }

  Write-Host "[railway-deploy] Collecting failure diagnostics (build logs)..."
  $buildArgs = $baseArgs + @("-b")
  & railway @buildArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[railway-deploy] Unable to fetch build logs for failed deployment."
  }

  Write-Host "[railway-deploy] Collecting failure diagnostics (deployment logs)..."
  $deploymentArgs = $baseArgs + @("-d")
  & railway @deploymentArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[railway-deploy] Unable to fetch deployment logs for failed deployment."
  }
}

function Resolve-DeploymentStartCommand([object]$Deployment) {
  if ($null -eq $Deployment) {
    return $null
  }

  if ($Deployment.PSObject.Properties.Name -contains "meta") {
    $meta = $Deployment.meta
    if ($null -ne $meta -and $meta.PSObject.Properties.Name -contains "serviceManifest") {
      $manifest = $meta.serviceManifest
      if (
        $null -ne $manifest -and
        $manifest.PSObject.Properties.Name -contains "deploy" -and
        $null -ne $manifest.deploy -and
        $manifest.deploy.PSObject.Properties.Name -contains "startCommand"
      ) {
        $startCommand = [string]$manifest.deploy.startCommand
        if (-not [string]::IsNullOrWhiteSpace($startCommand)) {
          return $startCommand
        }
      }
    }
  }

  return $null
}

function Resolve-ServicePublicUrlFromStatus([object]$StatusPayload, [string]$Service, [string]$TargetEnvironment) {
  if ($null -eq $StatusPayload -or -not ($StatusPayload.PSObject.Properties.Name -contains "environments")) {
    return $null
  }

  $envEdges = $StatusPayload.environments.edges
  if ($null -eq $envEdges) {
    return $null
  }

  foreach ($envEdge in $envEdges) {
    $envNode = $envEdge.node
    if ($null -eq $envNode) {
      continue
    }
    if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment) -and $envNode.name -ne $TargetEnvironment) {
      continue
    }

    $instanceEdges = $envNode.serviceInstances.edges
    if ($null -eq $instanceEdges) {
      continue
    }

    foreach ($instanceEdge in $instanceEdges) {
      $instance = $instanceEdge.node
      if ($null -eq $instance) {
        continue
      }
      if (-not [string]::IsNullOrWhiteSpace($Service) -and [string]$instance.serviceId -ne $Service) {
        continue
      }

      $domains = $instance.domains
      if ($null -eq $domains) {
        continue
      }

      $domainCandidates = @()
      if ($domains.PSObject.Properties.Name -contains "customDomains" -and $null -ne $domains.customDomains) {
        foreach ($item in $domains.customDomains) {
          $domainValue = [string]$item.domain
          if (-not [string]::IsNullOrWhiteSpace($domainValue)) {
            $domainCandidates += $domainValue
          }
        }
      }
      if ($domains.PSObject.Properties.Name -contains "serviceDomains" -and $null -ne $domains.serviceDomains) {
        foreach ($item in $domains.serviceDomains) {
          $domainValue = [string]$item.domain
          if (-not [string]::IsNullOrWhiteSpace($domainValue)) {
            $domainCandidates += $domainValue
          }
        }
      }

      foreach ($domain in $domainCandidates) {
        if ([string]::IsNullOrWhiteSpace($domain)) {
          continue
        }
        if ($domain -match "^https?://") {
          return $domain.TrimEnd("/")
        }
        return ("https://" + $domain.Trim())
      }
    }
  }

  return $null
}

& railway --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Railway CLI is not installed or unavailable in PATH."
}

Ensure-RailwayAuthContext -LogPrefix "railway-deploy"

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

$verificationScript = $null
$releaseEvidenceSnapshot = $null
$railwayVerificationSummary = [ordered]@{
  skipped = [bool]$SkipReleaseVerification
  script = $null
  strict = [bool]$StrictReleaseVerification
  releaseEvidenceArtifactsValidated = $false
}

if (-not $SkipReleaseVerification) {
  $verificationScript = if ($StrictReleaseVerification) { "verify:release:strict" } else { "verify:release" }
  $npmCli = Resolve-NpmCli
  Write-Host "[railway-deploy] Running pre-deploy quality gate: npm run $verificationScript"
  & $npmCli run $verificationScript
  if ($LASTEXITCODE -ne 0) {
    Fail "Pre-deploy quality gate failed: npm run $verificationScript"
  }
}

$railwayVerificationSummary.script = $verificationScript
$railwayVerificationSummary.releaseEvidenceArtifactsValidated = (-not $SkipReleaseVerification)
$releaseEvidenceSnapshot = Get-ReleaseEvidenceSnapshot -ValidatedInThisRun (-not $SkipReleaseVerification)

if (-not $SkipLink) {
  $hasProjectId = -not [string]::IsNullOrWhiteSpace($ProjectId)
  $hasServiceId = -not [string]::IsNullOrWhiteSpace($ServiceId)

  if ($hasProjectId -and $hasServiceId) {
    $linkArgs = @("link", "-p", $ProjectId, "-s", $ServiceId, "-e", $Environment)
    if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
      $linkArgs += @("-w", $Workspace)
    }
    Write-Host "[railway-deploy] Linking workspace to Railway service..."
    $linkOutput = @()
    $linkExitCode = 1
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $linkOutput = (& railway @linkArgs 2>&1)
      $linkExitCode = $LASTEXITCODE
    }
    catch {
      $linkOutput = @([string]$_.Exception.Message)
      $linkExitCode = 1
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($linkExitCode -ne 0) {
      if ($linkOutput) {
        $linkOutput | ForEach-Object { Write-Host $_ }
      }

      if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_TOKEN)) {
        Write-Warning "[railway-deploy] railway link failed; continuing with direct project/service flags in project-token mode."
      }
      else {
        Fail ("railway command failed: railway " + ($linkArgs -join " "))
      }
    }
  }
  elseif (-not $hasProjectId -and -not $hasServiceId) {
    Write-Host "[railway-deploy] -ProjectId/-ServiceId are not set; using existing linked Railway context."
  }
  else {
    Fail "Provide both -ProjectId and -ServiceId together, or omit both to use existing Railway link, or use -SkipLink."
  }
}

$status = $null
$resolvedService = if (-not [string]::IsNullOrWhiteSpace($ServiceId)) { $ServiceId } else { $null }
$needsStatusForServiceResolution = [string]::IsNullOrWhiteSpace($resolvedService)
$needsStatusForPublicUrlResolution = [string]::IsNullOrWhiteSpace($RailwayPublicUrl)
$shouldLoadStatus = $needsStatusForServiceResolution -or $needsStatusForPublicUrlResolution

if ($shouldLoadStatus) {
  $statusOutput = @()
  $statusExitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $statusOutput = (& railway status --json 2>&1)
    $statusExitCode = $LASTEXITCODE
  }
  catch {
    $statusOutput = @([string]$_.Exception.Message)
    $statusExitCode = 1
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($statusExitCode -ne 0) {
    if ($statusOutput) {
      $statusOutput | ForEach-Object { Write-Host $_ }
    }

    if ($needsStatusForServiceResolution) {
      Fail "Unable to resolve linked Railway project/service status."
    }

    Write-Warning "[railway-deploy] Unable to resolve Railway status payload; continuing with explicit -ServiceId/-RailwayPublicUrl inputs."
  }
  else {
    $statusJson = [string]::Join("`n", $statusOutput)
    $status = $statusJson | ConvertFrom-Json
  }
}

if ([string]::IsNullOrWhiteSpace($resolvedService) -and $null -ne $status) {
  $resolvedService = Resolve-ServiceIdFromStatus -StatusPayload $status -TargetEnvironment $Environment
}
if ([string]::IsNullOrWhiteSpace($resolvedService)) {
  Fail "No Railway service resolved. Link a service first or provide -ServiceId."
}

if ([string]::IsNullOrWhiteSpace($ProjectId) -and $null -ne $status -and -not [string]::IsNullOrWhiteSpace([string]$status.id)) {
  $ProjectId = [string]$status.id
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$resolvedServiceName = Resolve-ServiceNameFromStatus -StatusPayload $status -Service $resolvedService -TargetEnvironment $Environment
$serviceManifestTemplatePath = Resolve-RailwayServiceManifestTemplatePath -RepoRoot $repoRoot -ServiceName $resolvedServiceName
$deployWorkspacePath = New-RailwayDeployWorkspace -RepoRoot $repoRoot -ManifestTemplatePath $serviceManifestTemplatePath

try {
  Push-Location $deployWorkspacePath

  if (-not [string]::IsNullOrWhiteSpace($resolvedServiceName)) {
    Write-Host ("[railway-deploy] Target Railway service: " + $resolvedServiceName)
  }

  if (-not [string]::IsNullOrWhiteSpace($ProjectId) -and -not [string]::IsNullOrWhiteSpace($resolvedService)) {
    $workspaceLinkArgs = @("link", "-p", $ProjectId, "-s", $resolvedService, "-e", $Environment)
    if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
      $workspaceLinkArgs += @("-w", $Workspace)
    }
    Write-Host "[railway-deploy] Linking clean deploy worktree to Railway service..."
    $workspaceLinkOutput = @()
    $workspaceLinkExitCode = 1
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $workspaceLinkOutput = (& railway @workspaceLinkArgs 2>&1)
      $workspaceLinkExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($workspaceLinkOutput) {
      $workspaceLinkOutput | ForEach-Object { Write-Host $_ }
    }
    if ($workspaceLinkExitCode -ne 0) {
      Fail "Unable to link clean Railway deploy worktree."
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($DemoFrontendPublicUrl)) {
    Write-Host "[railway-deploy] Setting DEMO_FRONTEND_PUBLIC_URL on gateway service..."
    Run-Cli -CliArgs @("variable", "set", "-s", $resolvedService, "-e", $Environment, "--skip-deploys", ("DEMO_FRONTEND_PUBLIC_URL=" + $DemoFrontendPublicUrl))
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
  $deployOutput = Run-CliCapture -CliArgs $deployArgs
  $deployText = [string]::Join("`n", $deployOutput)

  $deploymentId = $null
  $idMatch = [regex]::Match($deployText, "id=([0-9a-fA-F-]{36})")
  if ($idMatch.Success) {
    $deploymentId = $idMatch.Groups[1].Value
  }

  if (-not $idMatch.Success -and $deployText -match "Usage:\s*railway\s+\[COMMAND\]") {
    Fail "Railway CLI returned global help output instead of deployment logs. Check deploy arguments/service link."
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
    $noWaitEffectivePublicUrl = if (-not [string]::IsNullOrWhiteSpace($RailwayPublicUrl)) {
      [string]$RailwayPublicUrl.TrimEnd("/")
    }
    else {
      $null
    }
    $noWaitBadgeEndpoint = Resolve-PublicBadgeEndpoint -ExplicitEndpoint $PublicBadgeEndpoint -PublicUrl $noWaitEffectivePublicUrl
    $noWaitBadgeDetailsEndpoint = Resolve-PublicBadgeDetailsEndpoint -ExplicitEndpoint $PublicBadgeDetailsEndpoint -ResolvedBadgeEndpoint $noWaitBadgeEndpoint
    if (-not $SkipRootDescriptorCheck) {
      Write-Host "[railway-deploy] Skipping gateway root descriptor check in no-wait mode."
    }
    if (-not $SkipPublicBadgeCheck) {
      Write-Host "[railway-deploy] Skipping public badge endpoint check in no-wait mode."
    }
    $noWaitSummary = [ordered]@{
      schemaVersion = 1
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      status = "triggered_no_wait"
      deploymentId = $deploymentId
      projectId = $ProjectId
      service = $resolvedService
      environment = $Environment
      effectivePublicUrl = $noWaitEffectivePublicUrl
      verification = $railwayVerificationSummary
      checks = [ordered]@{
        rootDescriptor = [ordered]@{
          attempted = $false
          skipped = $true
          skipReason = "no_wait"
          expectedUiUrl = if ([string]::IsNullOrWhiteSpace($DemoFrontendPublicUrl)) { $null } else { $DemoFrontendPublicUrl }
        }
        publicBadge = [ordered]@{
          attempted = $false
          skipped = $true
          skipReason = "no_wait"
          badgeEndpoint = $noWaitBadgeEndpoint
          badgeDetailsEndpoint = $noWaitBadgeDetailsEndpoint
        }
      }
      artifacts = [ordered]@{
        self = "artifacts/deploy/railway-deploy-summary.json"
        releaseEvidenceReportJson = "artifacts/release-evidence/report.json"
        releaseEvidenceManifestJson = "artifacts/release-evidence/manifest.json"
        badgeDetailsJson = "artifacts/demo-e2e/badge-details.json"
      }
      releaseEvidenceSnapshot = $releaseEvidenceSnapshot
    }
    $noWaitSummaryPath = Write-RailwayDeploySummary -Summary $noWaitSummary
    Write-Host ("[railway-deploy] Summary artifact: " + $noWaitSummaryPath)
    Publish-RailwayDeployOutputs -SummaryRelativePath "artifacts/deploy/railway-deploy-summary.json" -Summary $noWaitSummary
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
        $effectiveStartCommand = Resolve-DeploymentStartCommand -Deployment $deployment
        if (-not [string]::IsNullOrWhiteSpace($effectiveStartCommand)) {
          Write-Host ("[railway-deploy] Effective start command: " + $effectiveStartCommand)
        }

        $configSource = [string]$deployment.meta.configFile
        if (-not [string]::IsNullOrWhiteSpace($configSource)) {
          Write-Host ("[railway-deploy] Config-as-code source: " + $configSource)
        }

        $effectivePublicUrl = if (-not [string]::IsNullOrWhiteSpace($RailwayPublicUrl)) {
          [string]$RailwayPublicUrl.TrimEnd("/")
        }
        else {
          Resolve-ServicePublicUrlFromStatus -StatusPayload $status -Service $resolvedService -TargetEnvironment $Environment
        }
        if (-not [string]::IsNullOrWhiteSpace($effectivePublicUrl)) {
          Write-Host ("[railway-deploy] Effective public URL: " + $effectivePublicUrl)
        }

        $badgeCheckResult = $null
        if (-not $SkipRootDescriptorCheck) {
          Invoke-GatewayRootDescriptorCheck -Endpoint $effectivePublicUrl -ExpectedUiUrl $DemoFrontendPublicUrl -TimeoutSec $RootDescriptorCheckTimeoutSec -MaxAttempts $RootDescriptorCheckMaxAttempts -RetryBackoffSec $RootDescriptorCheckRetryBackoffSec
        }
        if (-not $SkipPublicBadgeCheck) {
          $badgeCheckResult = Invoke-PublicBadgeCheck -Endpoint $PublicBadgeEndpoint -DetailsEndpoint $PublicBadgeDetailsEndpoint -PublicUrl $effectivePublicUrl -TimeoutSec $PublicBadgeCheckTimeoutSec
          if ($null -ne $badgeCheckResult) {
            Write-Host ("[railway-deploy] Public badge verification completed: " + [string]$badgeCheckResult.badgeEndpoint)
            Write-Host ("[railway-deploy] Public badge details verification completed: " + [string]$badgeCheckResult.badgeDetailsEndpoint)
          }
        }
        $summaryBadgeEndpoint = if ($null -ne $badgeCheckResult) {
          [string]$badgeCheckResult.badgeEndpoint
        }
        else {
          Resolve-PublicBadgeEndpoint -ExplicitEndpoint $PublicBadgeEndpoint -PublicUrl $effectivePublicUrl
        }
        $summaryBadgeDetailsEndpoint = if ($null -ne $badgeCheckResult) {
          [string]$badgeCheckResult.badgeDetailsEndpoint
        }
        else {
          Resolve-PublicBadgeDetailsEndpoint -ExplicitEndpoint $PublicBadgeDetailsEndpoint -ResolvedBadgeEndpoint $summaryBadgeEndpoint
        }
        $deploySummary = [ordered]@{
          schemaVersion = 1
          generatedAt = (Get-Date).ToUniversalTime().ToString("o")
          status = "success"
          deploymentId = $deploymentId
          projectId = $ProjectId
          service = $resolvedService
          environment = $Environment
          effectiveStartCommand = $effectiveStartCommand
          configSource = if ([string]::IsNullOrWhiteSpace($configSource)) { $null } else { $configSource }
          effectivePublicUrl = if ([string]::IsNullOrWhiteSpace($effectivePublicUrl)) { $null } else { $effectivePublicUrl }
          verification = $railwayVerificationSummary
          checks = [ordered]@{
            rootDescriptor = [ordered]@{
              attempted = (-not $SkipRootDescriptorCheck)
              skipped = [bool]$SkipRootDescriptorCheck
              expectedUiUrl = if ([string]::IsNullOrWhiteSpace($DemoFrontendPublicUrl)) { $null } else { $DemoFrontendPublicUrl }
            }
            publicBadge = [ordered]@{
              attempted = (-not $SkipPublicBadgeCheck)
              skipped = [bool]$SkipPublicBadgeCheck
              badgeEndpoint = $summaryBadgeEndpoint
              badgeDetailsEndpoint = $summaryBadgeDetailsEndpoint
            }
          }
          artifacts = [ordered]@{
            self = "artifacts/deploy/railway-deploy-summary.json"
            releaseEvidenceReportJson = "artifacts/release-evidence/report.json"
            releaseEvidenceManifestJson = "artifacts/release-evidence/manifest.json"
            badgeDetailsJson = "artifacts/demo-e2e/badge-details.json"
          }
          releaseEvidenceSnapshot = $releaseEvidenceSnapshot
        }
        $deploySummaryPath = Write-RailwayDeploySummary -Summary $deploySummary
        Write-Host ("[railway-deploy] Summary artifact: " + $deploySummaryPath)
        Publish-RailwayDeployOutputs -SummaryRelativePath "artifacts/deploy/railway-deploy-summary.json" -Summary $deploySummary
        Write-Host ""
        Write-Host "Railway deployment completed successfully."
        Write-Host "Deployment ID: $deploymentId"
        exit 0
      }
      if ($pending -notcontains $state) {
        Show-DeploymentFailureDiagnostics -DeploymentId $deploymentId -Service $resolvedService -Env $Environment -Lines $FailureLogLines
        Fail "Railway deployment finished with non-success status: $state (deploymentId=$deploymentId)"
      }
    }

    if ($attempt -lt $StatusPollMaxAttempts) {
      Start-Sleep -Seconds $StatusPollIntervalSec
    }
  }

  Show-DeploymentFailureDiagnostics -DeploymentId $deploymentId -Service $resolvedService -Env $Environment -Lines $FailureLogLines
  Fail "Timed out waiting for Railway deployment completion (deploymentId=$deploymentId)."
}
finally {
  Pop-Location
  Remove-RailwayDeployWorkspace -RepoRoot $repoRoot -WorkspacePath $deployWorkspacePath
}
