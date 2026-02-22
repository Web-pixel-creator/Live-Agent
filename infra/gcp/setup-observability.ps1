param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

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
  [string[]]$NotificationChannels = @(),

  [Parameter(Mandatory = $false)]
  [string]$GatewaySaName = "mla-gateway-sa",

  [Parameter(Mandatory = $false)]
  [string]$ApiSaName = "mla-api-sa",

  [Parameter(Mandatory = $false)]
  [string]$OrchestratorSaName = "mla-orchestrator-sa",

  [switch]$SkipBootstrap,
  [switch]$SkipAnalyticsSinks,
  [switch]$SkipMonitoringBaseline,
  [switch]$SkipAnalyticsLogMetric
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host "==> $Name"
  & $Action
}

$ScriptDir = Split-Path -Parent $PSCommandPath
$BootstrapScript = Join-Path $ScriptDir "bootstrap.ps1"
$AnalyticsScript = Join-Path $ScriptDir "setup-analytics-sinks.ps1"
$MonitoringScript = Join-Path $ScriptDir "setup-monitoring-baseline.ps1"

if (-not (Test-Path $BootstrapScript)) {
  throw "Missing bootstrap script: $BootstrapScript"
}
if (-not (Test-Path $AnalyticsScript)) {
  throw "Missing analytics sink script: $AnalyticsScript"
}
if (-not (Test-Path $MonitoringScript)) {
  throw "Missing monitoring baseline script: $MonitoringScript"
}

if (-not $SkipBootstrap) {
  Invoke-Step -Name "Baseline bootstrap (APIs + IAM + secrets)" -Action {
    & $BootstrapScript `
      -ProjectId $ProjectId `
      -Region $Region `
      -GatewaySaName $GatewaySaName `
      -ApiSaName $ApiSaName `
      -OrchestratorSaName $OrchestratorSaName
  }
} else {
  Write-Host "==> Skipping bootstrap by request"
}

if (-not $SkipAnalyticsSinks) {
  Invoke-Step -Name "Analytics sinks (Cloud Logging -> BigQuery)" -Action {
    & $AnalyticsScript `
      -ProjectId $ProjectId `
      -Location $Location `
      -DatasetId $DatasetId `
      -SinkName $SinkName `
      -LogName $LogName `
      -LogMetricName $LogMetricName `
      -EnsureLogMetric (-not $SkipAnalyticsLogMetric)
  }
} else {
  Write-Host "==> Skipping analytics sink setup by request"
}

if (-not $SkipMonitoringBaseline) {
  Invoke-Step -Name "Monitoring baseline (metrics + dashboard + alerts)" -Action {
    & $MonitoringScript `
      -ProjectId $ProjectId `
      -NotificationChannels $NotificationChannels
  }
} else {
  Write-Host "==> Skipping monitoring baseline setup by request"
}

Write-Host ""
Write-Host "Observability setup completed."
Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Dataset: $DatasetId"
if ($NotificationChannels.Count -gt 0) {
  Write-Host "Notification channels: $($NotificationChannels -join ", ")"
} else {
  Write-Host "Notification channels: none"
}
