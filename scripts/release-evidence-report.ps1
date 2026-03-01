[CmdletBinding()]
param(
  [string]$BadgeDetailsPath = "artifacts/demo-e2e/badge-details.json",
  [string]$OutputJsonPath = "artifacts/release-evidence/report.json",
  [string]$OutputMarkdownPath = "artifacts/release-evidence/report.md"
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
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-StatusValueOrDefault {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }

  return $raw
}

$resolvedBadgeDetailsPath = [System.IO.Path]::GetFullPath($BadgeDetailsPath)
$resolvedOutputJsonPath = [System.IO.Path]::GetFullPath($OutputJsonPath)
$resolvedOutputMarkdownPath = [System.IO.Path]::GetFullPath($OutputMarkdownPath)

$report = [ordered]@{
  schemaVersion = "1.0"
  generatedAt = [datetime]::UtcNow.ToString("o")
  source = [ordered]@{
    badgeDetailsPath = $resolvedBadgeDetailsPath
    badgeDetailsPresent = $false
    badgeDetailsParsed = $false
    parseError = $null
  }
  statuses = [ordered]@{
    turnTruncationStatus = "unavailable"
    turnDeleteStatus = "unavailable"
    operatorDamageControlStatus = "unavailable"
    governancePolicyStatus = "unavailable"
    skillsRegistryStatus = "unavailable"
    deviceNodesStatus = "unavailable"
    agentUsageStatus = "unavailable"
    deviceNodeUpdatesStatus = "unavailable"
  }
  deviceNodeUpdates = [ordered]@{
    updatesValidated = $false
    updatesHasUpsert = $false
    updatesHasHeartbeat = $false
    updatesApiValidated = $false
    updatesTotal = 0
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
    }
  }
  catch {
    $report.source.parseError = [string]$_.Exception.Message
  }
}

$json = $report | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputJsonPath -Content $json

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
  "| deviceNodes | $($report.statuses.deviceNodesStatus) |",
  "| agentUsage | $($report.statuses.agentUsageStatus) |",
  "| deviceNodeUpdates | $($report.statuses.deviceNodeUpdatesStatus) |",
  "",
  "## Device Node Updates Details",
  "",
  "- updatesValidated: $($report.deviceNodeUpdates.updatesValidated)",
  "- updatesHasUpsert: $($report.deviceNodeUpdates.updatesHasUpsert)",
  "- updatesHasHeartbeat: $($report.deviceNodeUpdates.updatesHasHeartbeat)",
  "- updatesApiValidated: $($report.deviceNodeUpdates.updatesApiValidated)",
  "- updatesTotal: $($report.deviceNodeUpdates.updatesTotal)"
) -join "`n"

Write-Utf8NoBomFile -Path $resolvedOutputMarkdownPath -Content $markdown

Write-Host ("[release-evidence-report] JSON: " + $resolvedOutputJsonPath)
Write-Host ("[release-evidence-report] Markdown: " + $resolvedOutputMarkdownPath)
