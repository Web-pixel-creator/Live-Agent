param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string[]]$NotificationChannels = @(),

  [Parameter(Mandatory = $false)]
  [string]$DashboardTemplatePath = "",

  [Parameter(Mandatory = $false)]
  [string]$AlertTemplatesPath = ""
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

function Get-AccessToken {
  $Token = (& $script:GcloudCli auth print-access-token).Trim()
  if (-not $Token) {
    throw "Could not acquire access token. Run 'gcloud auth login' or configure workload identity."
  }
  return $Token
}

function Invoke-MonitoringApi {
  param(
    [ValidateSet("GET", "POST", "DELETE")]
    [string]$Method,
    [string]$Url,
    [string]$AccessToken,
    [object]$Body = $null
  )

  $Headers = @{
    Authorization = "Bearer $AccessToken"
  }

  try {
    if ($Method -eq "GET" -or $Method -eq "DELETE") {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }

    $Json = $Body | ConvertTo-Json -Depth 100
    $Headers["Content-Type"] = "application/json"
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body $Json
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
      throw
    }

    try {
      $stream = $response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $errorBody = $reader.ReadToEnd()
      throw ("Monitoring API request failed: " + $errorBody)
    } catch {
      throw
    }
  }
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

  try {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
      return $null
    }
    return $property.Value
  } catch {
    return $null
  }
}

function Ensure-LogMetric {
  param(
    [string]$Name,
    [string]$Description,
    [string]$Filter,
    [string]$ValueExtractor = "",
    [string]$LabelExtractors = ""
  )

  try {
    $Exists = & $script:GcloudCli logging metrics describe $Name --project $ProjectId --format "value(name)" 2>$null
  } catch {
    $Exists = ""
  }
  $BaseArgs = @(
    "--project", $ProjectId,
    "--description", $Description,
    "--log-filter", $Filter
  )

  if (-not $Exists) {
    $CreateArgs = @("logging", "metrics", "create", $Name) + $BaseArgs
    Invoke-Gcloud -CommandArgs $CreateArgs
    return
  }

  $UpdateArgs = @("logging", "metrics", "update", $Name) + $BaseArgs
  Invoke-Gcloud -CommandArgs $UpdateArgs
}

function Resolve-TemplatePaths {
  $ScriptDir = Split-Path -Parent $PSCommandPath
  $RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
  $MonitoringDir = Join-Path $RepoRoot "infra\monitoring"

  $Dashboard = if ($DashboardTemplatePath.Trim().Length -gt 0) {
    Resolve-Path $DashboardTemplatePath
  } else {
    Resolve-Path (Join-Path $MonitoringDir "dashboard.telemetry-kpis.json")
  }

  $AlertsDir = if ($AlertTemplatesPath.Trim().Length -gt 0) {
    Resolve-Path $AlertTemplatesPath
  } else {
    Resolve-Path $MonitoringDir
  }

  return @{
    Dashboard = $Dashboard
    AlertsDir = $AlertsDir
  }
}

function Convert-TemplateToObject {
  param(
    [string]$TemplatePath,
    [string]$ChannelsJson
  )

  $Raw = Get-Content $TemplatePath -Raw
  $Rendered = $Raw.Replace("__PROJECT_ID__", $ProjectId).Replace("__NOTIFICATION_CHANNELS__", $ChannelsJson)
  return $Rendered | ConvertFrom-Json
}

function Get-AllDashboards {
  param([string]$AccessToken)

  $Results = @()
  $PageToken = ""
  do {
    $Url = "https://monitoring.googleapis.com/v1/projects/$ProjectId/dashboards?pageSize=100"
    if ($PageToken) {
      $EncodedToken = [System.Uri]::EscapeDataString($PageToken)
      $Url = "$Url&pageToken=$EncodedToken"
    }
    $Response = Invoke-MonitoringApi -Method "GET" -Url $Url -AccessToken $AccessToken
    $Dashboards = Get-ObjectPropertyValue -Object $Response -Name "dashboards"
    if ($null -ne $Dashboards) {
      $Results += $Dashboards
    }
    $NextPageToken = Get-ObjectPropertyValue -Object $Response -Name "nextPageToken"
    $PageToken = if ($null -ne $NextPageToken) { [string]$NextPageToken } else { "" }
  } while ($PageToken)

  return $Results
}

function Get-AllAlertPolicies {
  param([string]$AccessToken)

  $Results = @()
  $PageToken = ""
  do {
    $Url = "https://monitoring.googleapis.com/v3/projects/$ProjectId/alertPolicies?pageSize=100"
    if ($PageToken) {
      $EncodedToken = [System.Uri]::EscapeDataString($PageToken)
      $Url = "$Url&pageToken=$EncodedToken"
    }
    $Response = Invoke-MonitoringApi -Method "GET" -Url $Url -AccessToken $AccessToken
    $AlertPolicies = Get-ObjectPropertyValue -Object $Response -Name "alertPolicies"
    if ($null -ne $AlertPolicies) {
      $Results += $AlertPolicies
    }
    $NextPageToken = Get-ObjectPropertyValue -Object $Response -Name "nextPageToken"
    $PageToken = if ($null -ne $NextPageToken) { [string]$NextPageToken } else { "" }
  } while ($PageToken)

  return $Results
}

function Replace-Dashboard {
  param(
    [object]$Dashboard,
    [object[]]$ExistingDashboards,
    [string]$AccessToken
  )

  $DisplayName = [string]$Dashboard.displayName
  $Existing = $ExistingDashboards | Where-Object {
    [string](Get-ObjectPropertyValue -Object $_ -Name "displayName") -eq $DisplayName
  } | Select-Object -First 1
  if ($Existing) {
    Write-Host "Replacing existing dashboard '$DisplayName' ($($Existing.name))"
    Invoke-MonitoringApi -Method "DELETE" -Url ("https://monitoring.googleapis.com/v1/" + $Existing.name) -AccessToken $AccessToken | Out-Null
  } else {
    Write-Host "Creating dashboard '$DisplayName'"
  }

  Invoke-MonitoringApi -Method "POST" -Url "https://monitoring.googleapis.com/v1/projects/$ProjectId/dashboards" -AccessToken $AccessToken -Body $Dashboard | Out-Null
}

function Replace-AlertPolicy {
  param(
    [object]$Policy,
    [object[]]$ExistingPolicies,
    [string]$AccessToken
  )

  $DisplayName = [string]$Policy.displayName
  $Existing = $ExistingPolicies | Where-Object {
    [string](Get-ObjectPropertyValue -Object $_ -Name "displayName") -eq $DisplayName
  } | Select-Object -First 1
  if ($Existing) {
    Write-Host "Replacing existing alert policy '$DisplayName' ($($Existing.name))"
    Invoke-MonitoringApi -Method "DELETE" -Url ("https://monitoring.googleapis.com/v3/" + $Existing.name) -AccessToken $AccessToken | Out-Null
  } else {
    Write-Host "Creating alert policy '$DisplayName'"
  }

  Invoke-MonitoringApi -Method "POST" -Url "https://monitoring.googleapis.com/v3/projects/$ProjectId/alertPolicies" -AccessToken $AccessToken -Body $Policy | Out-Null
}

Write-Host "==> Validating tooling"
Assert-Command -Name "gcloud"

Write-Host "==> Setting active project"
Invoke-Gcloud -CommandArgs @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling required services"
Invoke-Gcloud -CommandArgs @(
  "services", "enable",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "--project", $ProjectId
)

Write-Host "==> Ensuring log-based metrics"
Ensure-LogMetric `
  -Name "mla_analytics_metric_value" `
  -Description "Extracted numeric values from analytics_metric structured logs" `
  -Filter "jsonPayload.category=`"analytics_metric`" AND jsonPayload.value:*" `
  -ValueExtractor "EXTRACT(jsonPayload.value)" `
  -LabelExtractors "service=EXTRACT(jsonPayload.service),metric_type=EXTRACT(jsonPayload.metricType),operation=EXTRACT(jsonPayload.labels.operation),ok=EXTRACT(jsonPayload.labels.ok),model=EXTRACT(jsonPayload.labels.model),signal=EXTRACT(jsonPayload.labels.signal),scope=EXTRACT(jsonPayload.labels.scope)"

Ensure-LogMetric `
  -Name "mla_analytics_error_count" `
  -Description "Counter for analytics_metric records marked as failed" `
  -Filter "jsonPayload.category=`"analytics_metric`" AND jsonPayload.labels.ok=false" `
  -LabelExtractors "service=EXTRACT(jsonPayload.service),metric_type=EXTRACT(jsonPayload.metricType),operation=EXTRACT(jsonPayload.labels.operation)"

Ensure-LogMetric `
  -Name "mla_analytics_event_error_count" `
  -Description "Counter for analytics_event records with severity ERROR" `
  -Filter "jsonPayload.category=`"analytics_event`" AND jsonPayload.severity=`"ERROR`"" `
  -LabelExtractors "service=EXTRACT(jsonPayload.service),event_type=EXTRACT(jsonPayload.eventType)"

$ResolvedPaths = Resolve-TemplatePaths
$DashboardPath = [string]$ResolvedPaths.Dashboard
$AlertsDir = [string]$ResolvedPaths.AlertsDir
$AlertTemplates = Get-ChildItem $AlertsDir -Filter "alert-policy*.json" | Sort-Object Name
if (-not $AlertTemplates -or $AlertTemplates.Count -eq 0) {
  throw "No alert policy templates found in '$AlertsDir'."
}

$ChannelsJson = if ($NotificationChannels.Count -gt 0) {
  ($NotificationChannels | ConvertTo-Json -Compress)
} else {
  "[]"
}

Write-Host "==> Applying dashboard + alert policy templates"
$AccessToken = Get-AccessToken
$ExistingDashboards = Get-AllDashboards -AccessToken $AccessToken
$ExistingPolicies = Get-AllAlertPolicies -AccessToken $AccessToken

$Dashboard = Convert-TemplateToObject -TemplatePath $DashboardPath -ChannelsJson $ChannelsJson
Replace-Dashboard -Dashboard $Dashboard -ExistingDashboards $ExistingDashboards -AccessToken $AccessToken

foreach ($AlertTemplate in $AlertTemplates) {
  $Policy = Convert-TemplateToObject -TemplatePath $AlertTemplate.FullName -ChannelsJson $ChannelsJson
  Replace-AlertPolicy -Policy $Policy -ExistingPolicies $ExistingPolicies -AccessToken $AccessToken
}

Write-Host "==> Monitoring baseline ready"
Write-Host "Project: $ProjectId"
Write-Host "Dashboard template: $DashboardPath"
Write-Host "Alert templates: $($AlertTemplates.Count)"
if ($NotificationChannels.Count -gt 0) {
  Write-Host "Notification channels: $($NotificationChannels -join ", ")"
} else {
  Write-Host "Notification channels: none (policies created without channels)"
}
