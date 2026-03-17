param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$GatewaySaName = "mla-gateway-sa",

  [Parameter(Mandatory = $false)]
  [string]$ApiSaName = "mla-api-sa",

  [Parameter(Mandatory = $false)]
  [string]$OrchestratorSaName = "mla-orchestrator-sa"
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

function Ensure-ServiceAccount {
  param(
    [string]$Name,
    [string]$DisplayName
  )
  $Email = "$Name@$ProjectId.iam.gserviceaccount.com"
  $Exists = & $script:GcloudCli iam service-accounts list --project $ProjectId --filter "email:$Email" --format "value(email)"
  if (-not $Exists) {
    Invoke-Gcloud -CommandArgs @("iam", "service-accounts", "create", $Name, "--project", $ProjectId, "--display-name", $DisplayName)
  }
  return $Email
}

function Ensure-ProjectBinding {
  param(
    [string]$Member,
    [string]$Role
  )
  Invoke-Gcloud -CommandArgs @(
    "projects", "add-iam-policy-binding", $ProjectId,
    "--member", $Member,
    "--role", $Role,
    "--quiet"
  )
}

function Ensure-Secret {
  param([string]$Name)
  $Exists = & $script:GcloudCli secrets list --project $ProjectId --filter "name:$Name" --format "value(name)"
  if (-not $Exists) {
    Invoke-Gcloud -CommandArgs @("secrets", "create", $Name, "--project", $ProjectId, "--replication-policy", "automatic")
  }
}

Write-Host "==> Setting active project"
Invoke-Gcloud -CommandArgs @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling required services"
Invoke-Gcloud -CommandArgs @(
  "services", "enable",
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "firestore.googleapis.com",
  "secretmanager.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "bigquery.googleapis.com",
  "iamcredentials.googleapis.com",
  "--project", $ProjectId
)

Write-Host "==> Ensuring service accounts"
$GatewaySaEmail = Ensure-ServiceAccount -Name $GatewaySaName -DisplayName "MLA Realtime Gateway SA"
$ApiSaEmail = Ensure-ServiceAccount -Name $ApiSaName -DisplayName "MLA API Backend SA"
$OrchestratorSaEmail = Ensure-ServiceAccount -Name $OrchestratorSaName -DisplayName "MLA Orchestrator SA"

Write-Host "==> Applying IAM bindings"
Ensure-ProjectBinding -Member "serviceAccount:$GatewaySaEmail" -Role "roles/secretmanager.secretAccessor"
Ensure-ProjectBinding -Member "serviceAccount:$GatewaySaEmail" -Role "roles/logging.logWriter"
Ensure-ProjectBinding -Member "serviceAccount:$GatewaySaEmail" -Role "roles/monitoring.metricWriter"
Ensure-ProjectBinding -Member "serviceAccount:$GatewaySaEmail" -Role "roles/run.invoker"

Ensure-ProjectBinding -Member "serviceAccount:$ApiSaEmail" -Role "roles/datastore.user"
Ensure-ProjectBinding -Member "serviceAccount:$ApiSaEmail" -Role "roles/secretmanager.secretAccessor"
Ensure-ProjectBinding -Member "serviceAccount:$ApiSaEmail" -Role "roles/logging.logWriter"
Ensure-ProjectBinding -Member "serviceAccount:$ApiSaEmail" -Role "roles/monitoring.metricWriter"

Ensure-ProjectBinding -Member "serviceAccount:$OrchestratorSaEmail" -Role "roles/datastore.user"
Ensure-ProjectBinding -Member "serviceAccount:$OrchestratorSaEmail" -Role "roles/secretmanager.secretAccessor"
Ensure-ProjectBinding -Member "serviceAccount:$OrchestratorSaEmail" -Role "roles/logging.logWriter"
Ensure-ProjectBinding -Member "serviceAccount:$OrchestratorSaEmail" -Role "roles/monitoring.metricWriter"

Write-Host "==> Ensuring required secrets exist"
Ensure-Secret -Name "LIVE_API_API_KEY"
Ensure-Secret -Name "LIVE_API_AUTH_HEADER"
Ensure-Secret -Name "GOOGLE_GENAI_API_KEY"

Write-Host "==> Baseline ready"
Write-Host "Region: $Region"
Write-Host "Gateway SA: $GatewaySaEmail"
Write-Host "API SA: $ApiSaEmail"
Write-Host "Orchestrator SA: $OrchestratorSaEmail"
