param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Database = "(default)",

  [Parameter(Mandatory = $false)]
  [string]$Location = "nam5",

  [Parameter(Mandatory = $false)]
  [string]$SummaryOutputPath = "artifacts/deploy/gcp-firestore-summary.json",

  [switch]$SkipIndexes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Invoke-Gcloud {
  param([string[]]$Args)
  Write-Host ("gcloud " + ($Args -join " "))
  & gcloud @Args
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

function Get-DatabaseState {
  $raw = & gcloud firestore databases describe --project $ProjectId --database $Database --format json 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$raw)) {
    return $null
  }
  return $raw | ConvertFrom-Json
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedSummaryOutputPath = if ([System.IO.Path]::IsPathRooted($SummaryOutputPath)) {
  $SummaryOutputPath
} else {
  Join-Path $repoRoot $SummaryOutputPath
}
$resolvedSummaryMarkdownPath = [System.IO.Path]::ChangeExtension($resolvedSummaryOutputPath, ".md")
$firestoreApplyScript = Join-Path $repoRoot "infra\firestore\apply.ps1"

Assert-Command -Name "gcloud"

Write-Host "==> Setting active project"
Invoke-Gcloud @("config", "set", "project", $ProjectId)

$databaseState = Get-DatabaseState
if ($null -eq $databaseState) {
  Write-Host "==> Creating Firestore database '$Database' in location '$Location'"
  Invoke-Gcloud @(
    "firestore", "databases", "create",
    "--project", $ProjectId,
    "--database", $Database,
    "--location", $Location,
    "--type", "firestore-native"
  )
  $databaseState = Get-DatabaseState
}

if (-not $SkipIndexes) {
  if (-not (Test-Path $firestoreApplyScript)) {
    throw "Missing Firestore apply helper: $firestoreApplyScript"
  }

  Write-Host "==> Applying Firestore indexes and TTL"
  & $firestoreApplyScript -ProjectId $ProjectId -Database $Database
}

$firestoreEnabled = $false
if ($null -ne $databaseState) {
  $firestoreEnabled = [string]$databaseState.type -match "FIRESTORE"
}

$summary = [ordered]@{
  platform = "gcp_firestore"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $ProjectId
  database = $Database
  firestoreEnabled = $firestoreEnabled
  locationId = if ($null -ne $databaseState) { [string]$databaseState.locationId } else { "unavailable" }
  type = if ($null -ne $databaseState) { [string]$databaseState.type } else { "unavailable" }
  concurrencyMode = if ($null -ne $databaseState) { [string]$databaseState.concurrencyMode } else { "unavailable" }
  appEngineIntegrationMode = if ($null -ne $databaseState) { [string]$databaseState.appEngineIntegrationMode } else { "unavailable" }
  deleteProtectionState = if ($null -ne $databaseState) { [string]$databaseState.deleteProtectionState } else { "unavailable" }
  pointInTimeRecoveryEnablement = if ($null -ne $databaseState) { [string]$databaseState.pointInTimeRecoveryEnablement } else { "unavailable" }
  indexesApplied = (-not $SkipIndexes)
}

Write-Utf8NoBomFile -Path $resolvedSummaryOutputPath -Content (($summary | ConvertTo-Json -Depth 10) + "`n")

$markdown = @(
  "# GCP Firestore Summary",
  "",
  "- Generated at: $($summary.generatedAt)",
  "- Project: $($summary.projectId)",
  "- Database: $($summary.database)",
  "- Firestore enabled: $($summary.firestoreEnabled)",
  "- Location: $($summary.locationId)",
  "- Type: $($summary.type)",
  "- Concurrency mode: $($summary.concurrencyMode)",
  "- Delete protection: $($summary.deleteProtectionState)",
  "- PITR: $($summary.pointInTimeRecoveryEnablement)",
  "- Indexes applied: $($summary.indexesApplied)"
) -join "`n"

Write-Utf8NoBomFile -Path $resolvedSummaryMarkdownPath -Content ($markdown + "`n")

Write-Host "Firestore summary JSON: $resolvedSummaryOutputPath"
Write-Host "Firestore summary Markdown: $resolvedSummaryMarkdownPath"
