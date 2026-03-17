param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$DatasetId = "agent_analytics",

  [Parameter(Mandatory = $false)]
  [string]$Database = "(default)",

  [Parameter(Mandatory = $false)]
  [string]$CloudRunSummaryPath = "artifacts/deploy/gcp-cloud-run-summary.json",

  [Parameter(Mandatory = $false)]
  [string]$FirestoreSummaryPath = "artifacts/deploy/gcp-firestore-summary.json",

  [Parameter(Mandatory = $false)]
  [string]$ObservabilitySummaryPath = "artifacts/observability/observability-evidence-summary.json",

  [Parameter(Mandatory = $false)]
  [string]$DashboardScreenshotPath = "artifacts/judge-visual-evidence/screenshots/observability-dashboard.png",

  [Parameter(Mandatory = $false)]
  [string[]]$AlertScreenshotPaths = @(
    "artifacts/judge-visual-evidence/screenshots/observability-alert-gateway-latency.png",
    "artifacts/judge-visual-evidence/screenshots/observability-alert-service-error-rate.png",
    "artifacts/judge-visual-evidence/screenshots/observability-alert-orchestrator-persistence.png"
  ),

  [Parameter(Mandatory = $false)]
  [string]$OutputJsonPath = "artifacts/release-evidence/gcp-runtime-proof.json",

  [Parameter(Mandatory = $false)]
  [string]$OutputMarkdownPath = "artifacts/release-evidence/gcp-runtime-proof.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Write-Utf8NoBomFile {
  param(
    [string]$Path,
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Resolve-RepoPath {
  param(
    [string]$RepoRoot,
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }
  return Join-Path $RepoRoot $Path
}

function Read-JsonIfExists {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return @{
      present = $false
      parsed = $false
      value = $null
      parseError = $null
    }
  }

  try {
    return @{
      present = $true
      parsed = $true
      value = (Get-Content $Path -Raw | ConvertFrom-Json)
      parseError = $null
    }
  } catch {
    return @{
      present = $true
      parsed = $false
      value = $null
      parseError = $_.Exception.Message
    }
  }
}

function Invoke-BqJsonQuery {
  param([string]$Sql)

  $normalizedSql = (($Sql -split "(`r`n|`n|`r)") | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join " "
  $raw = & bq query --nouse_legacy_sql --format=json $normalizedSql
  if ($LASTEXITCODE -ne 0) {
    throw "bq query failed"
  }
  if ([string]::IsNullOrWhiteSpace([string]$raw)) {
    return @()
  }
  return $raw | ConvertFrom-Json
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedCloudRunSummaryPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $CloudRunSummaryPath
$resolvedFirestoreSummaryPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $FirestoreSummaryPath
$resolvedObservabilitySummaryPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $ObservabilitySummaryPath
$resolvedDashboardScreenshotPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $DashboardScreenshotPath
$resolvedAlertScreenshotPaths = @($AlertScreenshotPaths | ForEach-Object { Resolve-RepoPath -RepoRoot $repoRoot -Path $_ })
$resolvedOutputJsonPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $OutputJsonPath
$resolvedOutputMarkdownPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $OutputMarkdownPath
$gcloudAvailable = $null -ne (Get-Command "gcloud" -ErrorAction SilentlyContinue)
$bqAvailable = $null -ne (Get-Command "bq" -ErrorAction SilentlyContinue)

$cloudRunSummaryRead = Read-JsonIfExists -Path $resolvedCloudRunSummaryPath
$firestoreSummaryRead = Read-JsonIfExists -Path $resolvedFirestoreSummaryPath
$observabilitySummaryRead = Read-JsonIfExists -Path $resolvedObservabilitySummaryPath

$tableQuery = @"
SELECT
  table_name,
  creation_time
FROM ``${ProjectId}.${DatasetId}.INFORMATION_SCHEMA.TABLES``
ORDER BY creation_time DESC
"@
$tables = @()
$sampledRows = @()
$bigQueryError = $null
if ($bqAvailable) {
  try {
    $tables = @(Invoke-BqJsonQuery -Sql $tableQuery)
    if ($tables.Count -gt 0) {
      $sampleTable = [string]$tables[0].table_name
      $sampleQuery = @"
SELECT
  timestamp,
  severity,
  logName,
  jsonPayload.category AS category,
  jsonPayload.service AS service,
  jsonPayload.eventType AS event_type
FROM ``${ProjectId}.${DatasetId}.${sampleTable}``
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
ORDER BY timestamp DESC
LIMIT 25
"@
      $sampledRows = @(Invoke-BqJsonQuery -Sql $sampleQuery)
    }
  } catch {
    $bigQueryError = $_.Exception.Message
  }
} else {
  $bigQueryError = "Required command 'bq' was not found in PATH."
}

$dashboardScreenshotPresent = Test-Path $resolvedDashboardScreenshotPath
$presentAlertScreenshots = @($resolvedAlertScreenshotPaths | Where-Object { Test-Path $_ })

$cloudRunSummary = if ($cloudRunSummaryRead.present -and $cloudRunSummaryRead.parsed) { $cloudRunSummaryRead.value } else { $null }
$firestoreSummary = if ($firestoreSummaryRead.present -and $firestoreSummaryRead.parsed) { $firestoreSummaryRead.value } else { $null }
$observabilitySummary = if ($observabilitySummaryRead.present -and $observabilitySummaryRead.parsed) { $observabilitySummaryRead.value } else { $null }
$observabilityMonitoring = if ($null -ne $observabilitySummary) { $observabilitySummary.monitoring } else { $null }
$observabilityBigQuery = if ($null -ne $observabilitySummary) { $observabilitySummary.bigQuery } else { $null }
$cloudRunSummaryStatus = if ($null -ne $cloudRunSummary -and $null -ne $cloudRunSummary.status) { [string]$cloudRunSummary.status } else { "unavailable" }
$notes = @()
$nextSteps = @()

$proof = [ordered]@{
  platform = "gcp_cloud_run"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $ProjectId
  region = $Region
  commandAvailability = [ordered]@{
    gcloud = $gcloudAvailable
    bq = $bqAvailable
  }
  cloudRun = [ordered]@{
    summaryPath = $resolvedCloudRunSummaryPath
    summaryPresent = $cloudRunSummaryRead.present
    summaryParsed = $cloudRunSummaryRead.parsed
    status = $cloudRunSummaryStatus
    serviceCount = if ($null -ne $cloudRunSummary) { [int]$cloudRunSummary.serviceCount } else { 0 }
    publicUrlsCount = if ($null -ne $cloudRunSummary) { @($cloudRunSummary.services | Where-Object { $_.url -and $_.url -ne "unavailable" }).Count } else { 0 }
    gatewayUrl = if ($null -ne $cloudRunSummary) { [string]$cloudRunSummary.gatewayUrl } else { "unavailable" }
    apiUrl = if ($null -ne $cloudRunSummary) { [string]$cloudRunSummary.apiUrl } else { "unavailable" }
    orchestratorUrl = if ($null -ne $cloudRunSummary) { [string]$cloudRunSummary.orchestratorUrl } else { "unavailable" }
    services = if ($null -ne $cloudRunSummary) { @($cloudRunSummary.services) } else { @() }
  }
  firestore = [ordered]@{
    summaryPath = $resolvedFirestoreSummaryPath
    summaryPresent = $firestoreSummaryRead.present
    summaryParsed = $firestoreSummaryRead.parsed
    database = if ($null -ne $firestoreSummary) { [string]$firestoreSummary.database } else { $Database }
    firestoreEnabled = if ($null -ne $firestoreSummary) { $firestoreSummary.firestoreEnabled -eq $true } else { $false }
    locationId = if ($null -ne $firestoreSummary) { [string]$firestoreSummary.locationId } else { "unavailable" }
    type = if ($null -ne $firestoreSummary) { [string]$firestoreSummary.type } else { "unavailable" }
  }
  bigQuery = [ordered]@{
    datasetId = $DatasetId
    tablesFound = $tables.Count
    sampledTable = if ($tables.Count -gt 0) { [string]$tables[0].table_name } else { "unavailable" }
    sampledRows = $sampledRows.Count
    error = $bigQueryError
    tablesSource = if ($null -ne $observabilityBigQuery) { $observabilityBigQuery.files } else { @() }
  }
  observability = [ordered]@{
    summaryPath = $resolvedObservabilitySummaryPath
    summaryPresent = $observabilitySummaryRead.present
    summaryParsed = $observabilitySummaryRead.parsed
    dashboardsFound = if ($null -ne $observabilityMonitoring) { [int]$observabilityMonitoring.dashboardsFound } else { 0 }
    alertsFound = if ($null -ne $observabilityMonitoring) { [int]$observabilityMonitoring.alertsFound } else { 0 }
    dashboardScreenshotPath = $resolvedDashboardScreenshotPath
    dashboardScreenshotPresent = $dashboardScreenshotPresent
    alertScreenshotPaths = $resolvedAlertScreenshotPaths
    alertScreenshotCount = $presentAlertScreenshots.Count
  }
  judgeProof = [ordered]@{
    cloudRunUrlProof = ($null -ne $cloudRunSummary -and @($cloudRunSummary.services | Where-Object { $_.url -and $_.url -ne "unavailable" }).Count -ge 3)
    firestoreProof = ($null -ne $firestoreSummary -and $firestoreSummary.firestoreEnabled -eq $true)
    bigQueryRowsProof = ($sampledRows.Count -gt 0)
    observabilityScreenshotsProof = ($dashboardScreenshotPresent -and $presentAlertScreenshots.Count -ge 3)
  }
  submissionSafeSummaryGate = [ordered]@{
    liveApiEnabled = $true
    translationProvider = "not_fallback"
    storytellerMediaMode = "not_simulated"
    uiExecutorForceSimulation = $false
  }
  status = "pending_post_deploy"
  blockingReason = $null
  notes = @()
  nextSteps = @()
}

if (-not $cloudRunSummaryRead.present) {
  $notes += "Cloud Run summary is missing; run infra/gcp/deploy-cloud-run.ps1 first."
}
if ($cloudRunSummaryStatus -eq "dry_run") {
  $notes += "Cloud Run summary is a dry-run placeholder and does not prove a live deployment."
}
if (-not $firestoreSummaryRead.present) {
  $notes += "Firestore summary is missing; run infra/gcp/ensure-firestore.ps1 first."
}
if (-not $observabilitySummaryRead.present) {
  $notes += "Observability summary is missing; run infra/gcp/collect-observability-evidence.ps1 first."
}
if (-not $dashboardScreenshotPresent) {
  $notes += "Observability dashboard screenshot is missing."
}
if ($presentAlertScreenshots.Count -lt 3) {
  $notes += "One or more observability alert screenshots are missing."
}
if (-not [string]::IsNullOrWhiteSpace($bigQueryError)) {
  $notes += "BigQuery query failed: $bigQueryError"
}

if (-not $gcloudAvailable) {
  $notes += "gcloud is not installed in this workspace session; live deploy steps were not executed here."
}

if (-not $proof.judgeProof.cloudRunUrlProof) {
  $nextSteps += "Run pwsh ./infra/gcp/deploy-cloud-run.ps1 -ProjectId `"$ProjectId`" -Region `"$Region`" -ImageTag `"<release-tag>`"."
}
if (-not $proof.judgeProof.firestoreProof) {
  $nextSteps += "Run pwsh ./infra/gcp/ensure-firestore.ps1 -ProjectId `"$ProjectId`" -Location `"nam5`"."
}
if (-not $proof.judgeProof.bigQueryRowsProof) {
  $nextSteps += "Ensure analytics export is writing recent rows to BigQuery dataset `"$DatasetId`", then rerun this script."
}
if (-not $proof.judgeProof.observabilityScreenshotsProof) {
  $nextSteps += "Refresh dashboard and alert screenshots under artifacts/judge-visual-evidence/screenshots."
}

$allProofsSatisfied = $proof.judgeProof.cloudRunUrlProof -and $proof.judgeProof.firestoreProof -and $proof.judgeProof.bigQueryRowsProof -and $proof.judgeProof.observabilityScreenshotsProof
$proof.status = if ($allProofsSatisfied) {
  "success"
} elseif ($cloudRunSummaryRead.present -or $firestoreSummaryRead.present -or $observabilitySummaryRead.present -or $dashboardScreenshotPresent -or $presentAlertScreenshots.Count -gt 0) {
  "pending_follow_up"
} else {
  "pending_post_deploy"
}
$proof.blockingReason = if ($allProofsSatisfied) { $null } elseif ($notes.Count -gt 0) { $notes[0] } else { "Live GCP proof has not been collected yet." }
$proof.notes = $notes
$proof.nextSteps = $nextSteps

Write-Utf8NoBomFile -Path $resolvedOutputJsonPath -Content (($proof | ConvertTo-Json -Depth 12) + "`n")

$markdown = @(
  "# GCP Runtime Proof",
  "",
  "- Status: $($proof.status)",
  "- Generated at: $($proof.generatedAt)",
  "- Project: $($proof.projectId)",
  "- Region: $($proof.region)",
  "- gcloud available: $($proof.commandAvailability.gcloud)",
  "- bq available: $($proof.commandAvailability.bq)",
  $(if (-not [string]::IsNullOrWhiteSpace([string]$proof.blockingReason)) { "- Blocking reason: $($proof.blockingReason)" } else { "- Blocking reason: none" }),
  "",
  "## Cloud Run",
  "",
  "- Summary status: $($proof.cloudRun.status)",
  "- Service count: $($proof.cloudRun.serviceCount)",
  "- Public URLs: $($proof.cloudRun.publicUrlsCount)",
  "- Gateway URL: $($proof.cloudRun.gatewayUrl)",
  "- API URL: $($proof.cloudRun.apiUrl)",
  "- Orchestrator URL: $($proof.cloudRun.orchestratorUrl)",
  "",
  "## Firestore",
  "",
  "- Database: $($proof.firestore.database)",
  "- Enabled: $($proof.firestore.firestoreEnabled)",
  "- Location: $($proof.firestore.locationId)",
  "- Type: $($proof.firestore.type)",
  "",
  "## BigQuery",
  "",
  "- Dataset: $($proof.bigQuery.datasetId)",
  "- Tables found: $($proof.bigQuery.tablesFound)",
  "- Sampled table: $($proof.bigQuery.sampledTable)",
  "- Sampled rows: $($proof.bigQuery.sampledRows)",
  $(if (-not [string]::IsNullOrWhiteSpace([string]$proof.bigQuery.error)) { "- Error: $($proof.bigQuery.error)" } else { "- Error: none" }),
  "",
  "## Observability",
  "",
  "- Dashboards found: $($proof.observability.dashboardsFound)",
  "- Alert policies found: $($proof.observability.alertsFound)",
  "- Dashboard screenshot present: $($proof.observability.dashboardScreenshotPresent)",
  "- Alert screenshot count: $($proof.observability.alertScreenshotCount)",
  "",
  "## Judge Proof Checklist",
  "",
  "- Cloud Run URL proof: $($proof.judgeProof.cloudRunUrlProof)",
  "- Firestore proof: $($proof.judgeProof.firestoreProof)",
  "- BigQuery rows proof: $($proof.judgeProof.bigQueryRowsProof)",
  "- Observability screenshots proof: $($proof.judgeProof.observabilityScreenshotsProof)",
  "",
  "## Submission-Safe Summary Gate",
  "",
  "- liveApiEnabled: $($proof.submissionSafeSummaryGate.liveApiEnabled)",
  "- translationProvider: $($proof.submissionSafeSummaryGate.translationProvider)",
  "- storytellerMediaMode: $($proof.submissionSafeSummaryGate.storytellerMediaMode)",
  "- uiExecutorForceSimulation: $($proof.submissionSafeSummaryGate.uiExecutorForceSimulation)"
)

if ($proof.notes.Count -gt 0) {
  $markdown += ""
  $markdown += "## Notes"
  $markdown += ""
  foreach ($note in $proof.notes) {
    $markdown += "- $note"
  }
}

if ($proof.nextSteps.Count -gt 0) {
  $markdown += ""
  $markdown += "## Next Steps"
  $markdown += ""
  foreach ($step in $proof.nextSteps) {
    $markdown += "- $step"
  }
}

Write-Utf8NoBomFile -Path $resolvedOutputMarkdownPath -Content (($markdown -join "`n") + "`n")

Write-Host "GCP runtime proof JSON: $resolvedOutputJsonPath"
Write-Host "GCP runtime proof Markdown: $resolvedOutputMarkdownPath"
