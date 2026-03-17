param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$ImageTag = "latest",

  [Parameter(Mandatory = $false)]
  [string]$RepositoryName = "multimodal-live-agent",

  [Parameter(Mandatory = $false)]
  [string]$SummaryOutputPath = "artifacts/deploy/gcp-image-build-summary.json",

  [switch]$DryRun
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

function Invoke-Gcloud {
  param([string[]]$CommandArgs)
  Write-Host ("gcloud " + ($CommandArgs -join " "))
  & $script:GcloudCli @CommandArgs
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

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedSummaryOutputPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $SummaryOutputPath
$cloudbuildConfigPath = Join-Path $repoRoot "artifacts/deploy/gcp-cloudbuild-images.yaml"
$repositoryUri = "$Region-docker.pkg.dev/$ProjectId/$RepositoryName"

$services = @(
  [ordered]@{
    name = "orchestrator"
    dockerfile = "infra/cloud-run/Dockerfile.orchestrator"
    image = "$repositoryUri/orchestrator:$ImageTag"
  },
  [ordered]@{
    name = "realtime-gateway"
    dockerfile = "infra/cloud-run/Dockerfile.realtime-gateway"
    image = "$repositoryUri/realtime-gateway:$ImageTag"
  },
  [ordered]@{
    name = "api-backend"
    dockerfile = "infra/cloud-run/Dockerfile.api-backend"
    image = "$repositoryUri/api-backend:$ImageTag"
  }
)

Invoke-Gcloud -CommandArgs @("config", "set", "project", $ProjectId)

$repositoryList = & $script:GcloudCli artifacts repositories list --location $Region --project $ProjectId --format "value(name)"
$repositoryExists = @($repositoryList | Where-Object { [string]$_ -eq $RepositoryName }) -join ""
if (-not $repositoryExists) {
  if ($DryRun) {
    Write-Host "Dry run: would create Artifact Registry repository $RepositoryName in $Region"
  } else {
    Invoke-Gcloud -CommandArgs @(
      "artifacts", "repositories", "create", $RepositoryName,
      "--project", $ProjectId,
      "--location", $Region,
      "--repository-format", "docker",
      "--description", "Multimodal Live Agent judge runtime images"
    )
  }
}

$configLines = New-Object System.Collections.Generic.List[string]
$configLines.Add("steps:")
foreach ($service in $services) {
  $configLines.Add("- name: gcr.io/cloud-builders/docker")
  $configLines.Add("  args:")
  $configLines.Add("    - build")
  $configLines.Add("    - -f")
  $configLines.Add("    - " + [string]$service.dockerfile)
  $configLines.Add("    - -t")
  $configLines.Add("    - " + [string]$service.image)
  $configLines.Add("    - .")
}
$configLines.Add("images:")
foreach ($service in $services) {
  $configLines.Add("- " + [string]$service.image)
}
$configLines.Add("options:")
$configLines.Add("  logging: CLOUD_LOGGING_ONLY")

Write-Utf8NoBomFile -Path $cloudbuildConfigPath -Content (($configLines -join "`n") + "`n")

if ($DryRun) {
  Write-Host "Dry run: would submit Cloud Build with config $cloudbuildConfigPath"
} else {
  Invoke-Gcloud -CommandArgs @(
    "builds", "submit", $repoRoot,
    "--project", $ProjectId,
    "--region", $Region,
    "--config", $cloudbuildConfigPath
  )
}

$summary = [ordered]@{
  status = if ($DryRun) { "dry_run" } else { "success" }
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $ProjectId
  region = $Region
  repositoryName = $RepositoryName
  repositoryUri = $repositoryUri
  cloudBuildConfigPath = $cloudbuildConfigPath
  imageTag = $ImageTag
  dryRun = $DryRun.IsPresent
  services = @($services)
}

Write-Utf8NoBomFile -Path $resolvedSummaryOutputPath -Content (($summary | ConvertTo-Json -Depth 6) + "`n")

Write-Host "Image build summary written to $resolvedSummaryOutputPath"
