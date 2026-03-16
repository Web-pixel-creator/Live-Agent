param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$ImageTag = "latest",

  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = "infra/cloud-run/services.yaml",

  [Parameter(Mandatory = $false)]
  [string]$SummaryOutputPath = "artifacts/deploy/gcp-cloud-run-summary.json",

  [switch]$DryRun
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

function Convert-ScalarValue {
  param([string]$Raw)

  $trimmed = $Raw.Trim()
  if (
    ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) -or
    ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'"))
  ) {
    return $trimmed.Substring(1, $trimmed.Length - 2)
  }
  return $trimmed
}

function Parse-ServicesConfig {
  param([string]$Path)

  $defaults = [ordered]@{}
  $services = @()
  $currentSection = ""
  $currentService = $null
  $currentMap = ""

  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) {
      continue
    }

    $indent = $line.Length - $line.TrimStart().Length
    if ($indent -eq 0) {
      if ($trimmed -eq "defaults:") {
        $currentSection = "defaults"
        $currentService = $null
        $currentMap = ""
        continue
      }
      if ($trimmed -eq "services:") {
        $currentSection = "services"
        $currentService = $null
        $currentMap = ""
        continue
      }
    }

    if ($currentSection -eq "defaults" -and $indent -eq 2) {
      $parts = $trimmed.Split(":", 2)
      $defaults[$parts[0].Trim()] = Convert-ScalarValue $parts[1]
      continue
    }

    if ($currentSection -ne "services") {
      continue
    }

    if ($indent -eq 2 -and $trimmed.StartsWith("- ")) {
      $currentService = [ordered]@{
        env = [ordered]@{}
        secretEnv = [ordered]@{}
      }
      $services += $currentService
      $currentMap = ""

      $remainder = $trimmed.Substring(2)
      if (-not [string]::IsNullOrWhiteSpace($remainder)) {
        $parts = $remainder.Split(":", 2)
        $currentService[$parts[0].Trim()] = Convert-ScalarValue $parts[1]
      }
      continue
    }

    if ($null -eq $currentService) {
      continue
    }

    if ($indent -eq 4) {
      $parts = $trimmed.Split(":", 2)
      $key = $parts[0].Trim()
      $value = if ($parts.Length -gt 1) { $parts[1] } else { "" }
      if ([string]::IsNullOrWhiteSpace($value)) {
        $currentMap = $key
        if (-not $currentService.Contains($key)) {
          $currentService[$key] = [ordered]@{}
        }
      } else {
        $currentMap = ""
        $currentService[$key] = Convert-ScalarValue $value
      }
      continue
    }

    if ($indent -eq 6 -and ($currentMap -eq "env" -or $currentMap -eq "secretEnv")) {
      $parts = $trimmed.Split(":", 2)
      $currentService[$currentMap][$parts[0].Trim()] = Convert-ScalarValue $parts[1]
    }
  }

  return @{
    defaults = $defaults
    services = $services
  }
}

function Resolve-TemplateString {
  param(
    [string]$Value,
    [hashtable]$Context
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Value
  }

  return [regex]::Replace(
    $Value,
    "\{([A-Za-z0-9_]+)\}",
    {
      param($match)
      $name = $match.Groups[1].Value
      if ($Context.ContainsKey($name)) {
        return [string]$Context[$name]
      }
      return $match.Value
    }
  )
}

function Resolve-ServiceDefinition {
  param(
    [hashtable]$Defaults,
    [hashtable]$Service,
    [hashtable]$Context
  )

  $resolved = [ordered]@{}
  foreach ($name in @(
    "name",
    "image",
    "port",
    "serviceAccount",
    "platform",
    "ingress",
    "allowUnauthenticated",
    "timeoutSeconds",
    "maxInstances",
    "minInstances",
    "cpu",
    "memory",
    "concurrency"
  )) {
    $value = if ($Service.Contains($name)) { $Service[$name] } elseif ($Defaults.Contains($name)) { $Defaults[$name] } else { $null }
    if ($null -ne $value) {
      $resolved[$name] = Resolve-TemplateString -Value ([string]$value) -Context $Context
    }
  }

  $resolved.env = [ordered]@{}
  foreach ($entry in $Service.env.GetEnumerator()) {
    $resolved.env[$entry.Key] = Resolve-TemplateString -Value ([string]$entry.Value) -Context $Context
  }

  $resolved.secretEnv = [ordered]@{}
  foreach ($entry in $Service.secretEnv.GetEnumerator()) {
    $resolved.secretEnv[$entry.Key] = Resolve-TemplateString -Value ([string]$entry.Value) -Context $Context
  }

  return $resolved
}

function ConvertTo-EnvArg {
  param([hashtable]$Map)

  if ($null -eq $Map -or $Map.Count -eq 0) {
    return $null
  }

  return (($Map.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }) -join ",")
}

function Ensure-SecretExists {
  param([string]$SecretName)

  $raw = & gcloud secrets describe $SecretName --project $ProjectId --format "value(name)" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$raw)) {
    throw "Required secret '$SecretName' does not exist in project '$ProjectId'."
  }
}

function Get-ServiceDescribeJson {
  param([string]$ServiceName)

  $raw = & gcloud run services describe $ServiceName --project $ProjectId --region $Region --format json
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$raw)) {
    throw "Could not describe Cloud Run service '$ServiceName'."
  }
  return $raw | ConvertFrom-Json
}

function Get-EnvValue {
  param(
    [object]$ServiceJson,
    [string]$Name
  )

  $envItems = @($ServiceJson.spec.template.spec.containers[0].env)
  $match = $envItems | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $match) {
    return $null
  }
  return $match.value
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedConfigPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) { $ConfigPath } else { Join-Path $repoRoot $ConfigPath }
$resolvedSummaryOutputPath = if ([System.IO.Path]::IsPathRooted($SummaryOutputPath)) { $SummaryOutputPath } else { Join-Path $repoRoot $SummaryOutputPath }
$resolvedSummaryMarkdownPath = [System.IO.Path]::ChangeExtension($resolvedSummaryOutputPath, ".md")
$gcloudAvailable = $null -ne (Get-Command "gcloud" -ErrorAction SilentlyContinue)

if (-not (Test-Path $resolvedConfigPath)) {
  throw "Cloud Run services config not found: $resolvedConfigPath"
}

if (-not $DryRun) {
  Assert-Command -Name "gcloud"
}

$parsedConfig = Parse-ServicesConfig -Path $resolvedConfigPath
$defaults = $parsedConfig.defaults
$serviceDefinitions = $parsedConfig.services
if ($serviceDefinitions.Count -eq 0) {
  throw "No services were parsed from $resolvedConfigPath"
}

$context = @{
  projectId = $ProjectId
  region = $Region
  imageTag = $ImageTag
  gatewayUrl = ""
  apiUrl = ""
  orchestratorUrl = ""
}

if ($DryRun) {
  Write-Host "==> Dry run mode: skipping gcloud project selection and secret validation"
} else {
  Write-Host "==> Setting active project"
  Invoke-Gcloud @("config", "set", "project", $ProjectId)
}

$deployedServices = @()
foreach ($serviceDefinition in $serviceDefinitions) {
  $service = Resolve-ServiceDefinition -Defaults $defaults -Service $serviceDefinition -Context $context
  $serviceName = [string]$service.name

  if (-not $DryRun) {
    foreach ($secretEnv in $service.secretEnv.GetEnumerator()) {
      $secretRefParts = [string]$secretEnv.Value -split ":", 2
      Ensure-SecretExists -SecretName $secretRefParts[0]
    }
  }

  $deployArgs = @(
    "run", "deploy", $serviceName,
    "--project", $ProjectId,
    "--region", $Region,
    "--platform", ([string]$service.platform),
    "--image", ([string]$service.image),
    "--service-account", ([string]$service.serviceAccount),
    "--port", ([string]$service.port),
    "--ingress", ([string]$service.ingress),
    "--timeout", ([string]$service.timeoutSeconds),
    "--min-instances", ([string]$service.minInstances),
    "--max-instances", ([string]$service.maxInstances),
    "--cpu", ([string]$service.cpu),
    "--memory", ([string]$service.memory),
    "--concurrency", ([string]$service.concurrency),
    "--quiet"
  )

  if ([string]$service.allowUnauthenticated -eq "true") {
    $deployArgs += "--allow-unauthenticated"
  } else {
    $deployArgs += "--no-allow-unauthenticated"
  }

  $envArg = ConvertTo-EnvArg -Map $service.env
  if (-not [string]::IsNullOrWhiteSpace($envArg)) {
    $deployArgs += @("--set-env-vars", $envArg)
  }

  $secretArg = ConvertTo-EnvArg -Map $service.secretEnv
  if (-not [string]::IsNullOrWhiteSpace($secretArg)) {
    $deployArgs += @("--set-secrets", $secretArg)
  }

  if ($DryRun) {
    Write-Host "==> Dry run for service '$serviceName'"
    Write-Host ("gcloud " + ($deployArgs -join " "))
    $describeJson = [ordered]@{
      status = [ordered]@{
        url = "dry-run-unavailable"
        latestReadyRevisionName = "dry-run-unavailable"
        latestCreatedRevisionName = "dry-run-unavailable"
      }
      spec = [ordered]@{
        template = [ordered]@{
          spec = [ordered]@{
            containers = @(
              [ordered]@{
                env = @($service.env.GetEnumerator() | ForEach-Object { [ordered]@{ name = $_.Key; value = $_.Value } })
              }
            )
          }
        }
      }
    }
  } else {
    Write-Host "==> Deploying Cloud Run service '$serviceName'"
    Invoke-Gcloud $deployArgs
    $describeJson = Get-ServiceDescribeJson -ServiceName $serviceName
  }

  $serviceSummary = [ordered]@{
    name = $serviceName
    image = [string]$service.image
    port = [string]$service.port
    serviceAccount = [string]$service.serviceAccount
    url = [string]$describeJson.status.url
    latestReadyRevision = [string]$describeJson.status.latestReadyRevisionName
    latestCreatedRevision = [string]$describeJson.status.latestCreatedRevisionName
    ingress = [string]$service.ingress
    allowUnauthenticated = ([string]$service.allowUnauthenticated -eq "true")
    firestoreEnabled = (Get-EnvValue -ServiceJson $describeJson -Name "FIRESTORE_ENABLED") -eq "true"
    analyticsEventsTarget = Get-EnvValue -ServiceJson $describeJson -Name "ANALYTICS_EXPORT_EVENTS_TARGET"
    analyticsDataset = Get-EnvValue -ServiceJson $describeJson -Name "ANALYTICS_BIGQUERY_DATASET"
  }
  $deployedServices += $serviceSummary

  switch ($serviceName) {
    "orchestrator" {
      $context.orchestratorUrl = if ($DryRun) { "https://orchestrator.dry-run.invalid" } else { [string]$describeJson.status.url }
    }
    "realtime-gateway" {
      $context.gatewayUrl = if ($DryRun) { "https://realtime-gateway.dry-run.invalid" } else { [string]$describeJson.status.url }
    }
    "api-backend" {
      $context.apiUrl = if ($DryRun) { "https://api-backend.dry-run.invalid" } else { [string]$describeJson.status.url }
    }
  }
}

$summary = [ordered]@{
  platform = "gcp_cloud_run"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $ProjectId
  region = $Region
  imageTag = $ImageTag
  configPath = $resolvedConfigPath
  commandAvailability = [ordered]@{
    gcloud = $gcloudAvailable
  }
  dryRun = [bool]$DryRun
  status = if ($DryRun) { "dry_run" } else { "success" }
  serviceCount = $deployedServices.Count
  gatewayUrl = if ([string]::IsNullOrWhiteSpace($context.gatewayUrl)) { "unavailable" } else { $context.gatewayUrl }
  apiUrl = if ([string]::IsNullOrWhiteSpace($context.apiUrl)) { "unavailable" } else { $context.apiUrl }
  orchestratorUrl = if ([string]::IsNullOrWhiteSpace($context.orchestratorUrl)) { "unavailable" } else { $context.orchestratorUrl }
  checks = [ordered]@{
    servicesReady = (-not $DryRun)
    publicUrlsResolved = $deployedServices.Count -gt 0 -and @($deployedServices | Where-Object { $_.url -notin @($null, "", "unavailable", "dry-run-unavailable") }).Count -eq $deployedServices.Count
    firestoreEnabled = @($deployedServices | Where-Object { $_.firestoreEnabled -eq $true }).Count -ge 2
  }
  services = $deployedServices
}

Write-Utf8NoBomFile -Path $resolvedSummaryOutputPath -Content (($summary | ConvertTo-Json -Depth 10) + "`n")

$markdown = @(
  "# GCP Cloud Run Summary",
  "",
  "- Generated at: $($summary.generatedAt)",
  "- Project: $($summary.projectId)",
  "- Region: $($summary.region)",
  "- Image tag: $($summary.imageTag)",
  "- Status: $($summary.status)",
  "- gcloud available: $($summary.commandAvailability.gcloud)",
  "- Service count: $($summary.serviceCount)",
  "- Gateway URL: $($summary.gatewayUrl)",
  "- API URL: $($summary.apiUrl)",
  "- Orchestrator URL: $($summary.orchestratorUrl)",
  "- Firestore enabled in runtime config: $($summary.checks.firestoreEnabled)",
  "",
  "## Services",
  "",
  "| Service | URL | Revision | Firestore | Analytics dataset |",
  "|---|---|---|---|---|"
)
foreach ($serviceSummary in $deployedServices) {
  $markdown += "| $($serviceSummary.name) | $($serviceSummary.url) | $($serviceSummary.latestReadyRevision) | $($serviceSummary.firestoreEnabled) | $($serviceSummary.analyticsDataset) |"
}

if ($DryRun) {
  $markdown += ""
  $markdown += "## Notes"
  $markdown += ""
  $markdown += "- Dry run does not call Cloud Run or Secret Manager and is not submission proof."
}

Write-Utf8NoBomFile -Path $resolvedSummaryMarkdownPath -Content (($markdown -join "`n") + "`n")

Write-Host "Cloud Run summary JSON: $resolvedSummaryOutputPath"
Write-Host "Cloud Run summary Markdown: $resolvedSummaryMarkdownPath"
