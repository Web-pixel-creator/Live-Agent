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

function Assert-Command {
  param([string]$Name)
  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $Command) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Invoke-Gcloud {
  param([string[]]$Args)
  Write-Host ("gcloud " + ($Args -join " "))
  & gcloud @Args
}

function Invoke-Bq {
  param([string[]]$Args)
  Write-Host ("bq " + ($Args -join " "))
  & bq @Args
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

  Invoke-Bq @(
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
  $Existing = & gcloud logging sinks describe $Name --project $Project --format "value(name)" 2>$null

  if (-not $Existing) {
    Invoke-Gcloud @(
      "logging", "sinks", "create", $Name, $Destination,
      "--project", $Project,
      "--description", "Exports structured analytics logs to BigQuery dataset",
      "--log-filter", $SinkFilter,
      "--use-partitioned-tables"
    )
  } else {
    Write-Host "Sink '$Name' already exists; ensuring destination/filter are up to date."
    Invoke-Gcloud @(
      "logging", "sinks", "update", $Name, $Destination,
      "--project", $Project,
      "--log-filter", $SinkFilter
    )
  }

  $WriterIdentity = & gcloud logging sinks describe $Name --project $Project --format "value(writerIdentity)"
  if (-not $WriterIdentity) {
    throw "Could not resolve sink writer identity for '$Name'."
  }

  Write-Host "Granting sink writer BigQuery editor role at project scope (baseline)."
  Invoke-Gcloud @(
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
  $MetricExists = & gcloud logging metrics describe $MetricName --project $Project --format "value(name)" 2>$null
  $CommonArgs = @(
    "--project", $Project,
    "--description", "Extracted metric values from structured analytics logs",
    "--log-filter", $Filter,
    "--value-extractor", "EXTRACT(jsonPayload.value)",
    "--label-extractors", "service=EXTRACT(jsonPayload.service),metric_type=EXTRACT(jsonPayload.metricType),operation=EXTRACT(jsonPayload.labels.operation),ok=EXTRACT(jsonPayload.labels.ok),model=EXTRACT(jsonPayload.labels.model),signal=EXTRACT(jsonPayload.labels.signal),scope=EXTRACT(jsonPayload.labels.scope)"
  )

  if (-not $MetricExists) {
    $Args = @("logging", "metrics", "create", $MetricName) + $CommonArgs
    Invoke-Gcloud -Args $Args
    return
  }

  $UpdateArgs = @("logging", "metrics", "update", $MetricName) + $CommonArgs
  Invoke-Gcloud -Args $UpdateArgs
}

Write-Host "==> Validating tooling"
Assert-Command -Name "gcloud"
Assert-Command -Name "bq"

Write-Host "==> Setting active project"
Invoke-Gcloud @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling required APIs"
Invoke-Gcloud @(
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
