param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$FirestoreLocation = "nam5",

  [Parameter(Mandatory = $false)]
  [string]$DatasetId = "agent_analytics",

  [Parameter(Mandatory = $false)]
  [string]$ImageTag = "latest",

  [Parameter(Mandatory = $false)]
  [string[]]$NotificationChannels = @(),

  [Parameter(Mandatory = $false)]
  [string]$GoogleGenAiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiAuthHeader = "x-goog-api-key",

  [switch]$SkipBootstrap,
  [switch]$SkipFirestore,
  [switch]$SkipObservability,
  [switch]$SkipSecretSync,
  [switch]$SkipCloudRunBuild,
  [switch]$SkipCloudRunDeploy,
  [switch]$SkipObservabilityEvidence,
  [switch]$SkipRuntimeProof,
  [switch]$DryRun
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

$scriptDir = Split-Path -Parent $PSCommandPath
$bootstrapScript = Join-Path $scriptDir "bootstrap.ps1"
$firestoreScript = Join-Path $scriptDir "ensure-firestore.ps1"
$observabilityScript = Join-Path $scriptDir "setup-observability.ps1"
$syncSecretsScript = Join-Path $scriptDir "sync-runtime-secrets.ps1"
$buildCloudRunImagesScript = Join-Path $scriptDir "build-cloud-run-images.ps1"
$collectObservabilityScript = Join-Path $scriptDir "collect-observability-evidence.ps1"
$deployCloudRunScript = Join-Path $scriptDir "deploy-cloud-run.ps1"
$collectRuntimeProofScript = Join-Path $scriptDir "collect-runtime-proof.ps1"

if (-not $SkipBootstrap) {
  Invoke-Step -Name "Bootstrap APIs, IAM, and secrets" -Action {
    & $bootstrapScript -ProjectId $ProjectId -Region $Region
  }
}

if (-not $SkipFirestore) {
  Invoke-Step -Name "Ensure Firestore database and indexes" -Action {
    & $firestoreScript -ProjectId $ProjectId -Location $FirestoreLocation
  }
}

if (-not $SkipObservability) {
  Invoke-Step -Name "Apply observability baseline" -Action {
    & $observabilityScript -ProjectId $ProjectId -Region $Region -DatasetId $DatasetId -NotificationChannels $NotificationChannels
  }
}

if (-not $SkipSecretSync) {
  Invoke-Step -Name "Sync runtime secrets into Secret Manager" -Action {
    & $syncSecretsScript -ProjectId $ProjectId -GoogleGenAiApiKey $GoogleGenAiApiKey -LiveApiApiKey $LiveApiApiKey -LiveApiAuthHeader $LiveApiAuthHeader -DryRun:$DryRun
  }
}

if (-not $SkipCloudRunBuild) {
  Invoke-Step -Name "Build Cloud Run images in Artifact Registry" -Action {
    & $buildCloudRunImagesScript -ProjectId $ProjectId -Region $Region -ImageTag $ImageTag -DryRun:$DryRun
  }
}

if (-not $SkipCloudRunDeploy) {
  Invoke-Step -Name "Deploy Cloud Run judge path" -Action {
    & $deployCloudRunScript -ProjectId $ProjectId -Region $Region -ImageTag $ImageTag -DryRun:$DryRun
  }
}

if (-not $SkipObservabilityEvidence) {
  Invoke-Step -Name "Collect observability evidence" -Action {
    & $collectObservabilityScript -ProjectId $ProjectId -DatasetId $DatasetId
  }
}

if (-not $SkipRuntimeProof) {
  Invoke-Step -Name "Collect GCP runtime proof" -Action {
    & $collectRuntimeProofScript -ProjectId $ProjectId -Region $Region -DatasetId $DatasetId
  }
}

Write-Host ""
Write-Host "Judge runtime preparation completed."
Write-Host "Review artifacts/deploy/gcp-cloud-run-summary.json and artifacts/release-evidence/gcp-runtime-proof.json."
