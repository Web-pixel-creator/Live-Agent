param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Location = "US",

  [Parameter(Mandatory = $false)]
  [string]$DatasetId = "agent_analytics",

  [Parameter(Mandatory = $false)]
  [string]$SinkName = "mla-analytics-to-bigquery",

  [Parameter(Mandatory = $false)]
  [string]$LogName = "multimodal_analytics",

  [Parameter(Mandatory = $false)]
  [string]$LogMetricName = "mla_analytics_metric_value",

  [Parameter(Mandatory = $false)]
  [bool]$EnsureLogMetric = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-GcloudCli {
  $candidates = @(
    "C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )
  $resolved = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $resolved) {
    $command = Get-Command "gcloud.cmd" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      $resolved = $command.Source
    }
  }
  if (-not $resolved) {
    throw "gcloud.cmd was not found in PATH."
  }
  return $resolved
}

$script:GcloudCli = Resolve-GcloudCli

function Assert-Command {
  param([string]$Name)
  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $Command) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Invoke-Gcloud {
  param([string[]]$CommandArgs)
  Write-Host ("gcloud " + ($CommandArgs -join " "))
  & $script:GcloudCli @CommandArgs
}

function Invoke-Bq {
  param([string[]]$CommandArgs)
  Write-Host ("bq " + ($CommandArgs -join " "))
  & bq @CommandArgs
}

function Ensure-BigQueryDataset {
  param(
    [string]$Project,
    [string]$Dataset,
    [string]$Region
  )

  $DatasetRef = "$Project`:$Dataset"
  & bq --project_id $Project show --format=none $DatasetRef *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Dataset '$DatasetRef' already exists."
    return
  }

  Invoke-Bq -CommandArgs @(
    "--project_id", $Project,
    "--location", $Region,
    "mk",
    "--dataset",
    "--description", "Analytics sink dataset for multimodal live agent telemetry",
    $DatasetRef
  )
}

function Ensure-LoggingSink {
  param(
    [string]$Project,
    [string]$Name,
    [string]$Dataset,
    [string]$AnalyticsLogName
  )

  $SinkFilter = "jsonPayload.category=`"analytics_event`" OR (jsonPayload.category=`"analytics_metric`" AND jsonPayload.logName=`"$AnalyticsLogName`")"
  $Destination = "bigquery.googleapis.com/projects/$Project/datasets/$Dataset"
  try {
    $Existing = & $script:GcloudCli logging sinks describe $Name --project $Project --format "value(name)" 2>$null
  } catch {
    $Existing = ""
  }

  if (-not $Existing) {
    Invoke-Gcloud -CommandArgs @(
      "logging", "sinks", "create", $Name, $Destination,
      "--project", $Project,
      "--description", "Exports structured analytics logs to BigQuery dataset",
      "--log-filter", $SinkFilter,
      "--use-partitioned-tables"
    )
  } else {
    Write-Host "Sink '$Name' already exists; ensuring destination/filter are up to date."
    Invoke-Gcloud -CommandArgs @(
      "logging", "sinks", "update", $Name, $Destination,
      "--project", $Project,
      "--log-filter", $SinkFilter
    )
  }

  $WriterIdentity = & $script:GcloudCli logging sinks describe $Name --project $Project --format "value(writerIdentity)"
  if (-not $WriterIdentity) {
    throw "Could not resolve sink writer identity for '$Name'."
  }

  Write-Host "Granting sink writer BigQuery editor role at project scope (baseline)."
  Invoke-Gcloud -CommandArgs @(
    "projects", "add-iam-policy-binding", $Project,
    "--member", $WriterIdentity,
    "--role", "roles/bigquery.dataEditor",
    "--quiet"
  )
}

function Ensure-LogMetric {
  param(
    [string]$Project,
    [string]$MetricName
  )

  $Filter = "jsonPayload.category=`"analytics_metric`" AND jsonPayload.value:*"
  try {
    $MetricExists = & $script:GcloudCli logging metrics describe $MetricName --project $Project --format "value(name)" 2>$null
  } catch {
    $MetricExists = ""
  }
  $CommonArgs = @(
    "--project", $Project,
    "--description", "Extracted metric values from structured analytics logs",
    "--log-filter", $Filter
  )

  if (-not $MetricExists) {
    $Args = @("logging", "metrics", "create", $MetricName) + $CommonArgs
    Invoke-Gcloud -CommandArgs $Args
    return
  }

  $UpdateArgs = @("logging", "metrics", "update", $MetricName) + $CommonArgs
  Invoke-Gcloud -CommandArgs $UpdateArgs
}

Write-Host "==> Validating tooling"
Assert-Command -Name "gcloud"
Assert-Command -Name "bq"

Write-Host "==> Setting active project"
Invoke-Gcloud -CommandArgs @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling required APIs"
Invoke-Gcloud -CommandArgs @(
  "services", "enable",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "bigquery.googleapis.com",
  "--project", $ProjectId
)

Write-Host "==> Ensuring BigQuery dataset"
Ensure-BigQueryDataset -Project $ProjectId -Dataset $DatasetId -Region $Location

Write-Host "==> Ensuring analytics export sink"
Ensure-LoggingSink -Project $ProjectId -Name $SinkName -Dataset $DatasetId -AnalyticsLogName $LogName

if ($EnsureLogMetric) {
  Write-Host "==> Ensuring log-based metric for analytics values"
  Ensure-LogMetric -Project $ProjectId -MetricName $LogMetricName
} else {
  Write-Host "==> Skipping log-based metric provisioning by request"
}

Write-Host "==> Analytics sink baseline ready"
Write-Host "Project: $ProjectId"
Write-Host "Dataset: $DatasetId"
Write-Host "Sink: $SinkName"
if ($EnsureLogMetric) {
  Write-Host "Log metric: $LogMetricName"
}
