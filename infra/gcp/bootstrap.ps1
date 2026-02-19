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

function Invoke-Gcloud {
  param([string[]]$Args)
  Write-Host ("gcloud " + ($Args -join " "))
  & gcloud @Args
}

function Ensure-ServiceAccount {
  param(
    [string]$Name,
    [string]$DisplayName
  )
  $Email = "$Name@$ProjectId.iam.gserviceaccount.com"
  $Exists = & gcloud iam service-accounts list --project $ProjectId --filter "email:$Email" --format "value(email)"
  if (-not $Exists) {
    Invoke-Gcloud @("iam", "service-accounts", "create", $Name, "--project", $ProjectId, "--display-name", $DisplayName)
  }
  return $Email
}

function Ensure-ProjectBinding {
  param(
    [string]$Member,
    [string]$Role
  )
  Invoke-Gcloud @(
    "projects", "add-iam-policy-binding", $ProjectId,
    "--member", $Member,
    "--role", $Role,
    "--quiet"
  )
}

function Ensure-Secret {
  param([string]$Name)
  $Exists = & gcloud secrets list --project $ProjectId --filter "name:$Name" --format "value(name)"
  if (-not $Exists) {
    Invoke-Gcloud @("secrets", "create", $Name, "--project", $ProjectId, "--replication-policy", "automatic")
  }
}

Write-Host "==> Setting active project"
Invoke-Gcloud @("config", "set", "project", $ProjectId)

Write-Host "==> Enabling required services"
Invoke-Gcloud @(
  "services", "enable",
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "firestore.googleapis.com",
  "secretmanager.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
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
