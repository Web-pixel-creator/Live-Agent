[CmdletBinding()]
param(
  [string]$ProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$Service = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_API_SERVICE_ID)) { $env:RAILWAY_API_SERVICE_ID } elseif (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_API_SERVICE)) { $env:RAILWAY_API_SERVICE } else { "Live-Agent-API" }),
  [string]$Environment = $env:RAILWAY_ENVIRONMENT,
  [string]$ApiPath = "apps/api-backend",
  [string]$DeployMessage = "",
  [string]$ApiCorsAllowedOrigins = $env:API_CORS_ALLOWED_ORIGINS,
  [string]$ApiPublicUrl = $(if (-not [string]::IsNullOrWhiteSpace($env:API_PUBLIC_URL)) { $env:API_PUBLIC_URL } else { "https://live-agent-api-production.up.railway.app" }),
  [string]$LiveApiEnabled = $env:LIVE_API_ENABLED,
  [string]$LiveDirectModeEnabled = $env:LIVE_DIRECT_MODE_ENABLED,
  [string]$LiveEphemeralTokensEnabled = $env:LIVE_EPHEMERAL_TOKENS_ENABLED,
  [string]$LiveDirectModeDefault = $env:LIVE_DIRECT_MODE_DEFAULT,
  [string]$LiveApiProtocol = $env:LIVE_API_PROTOCOL,
  [string]$LiveModelId = $env:LIVE_MODEL_ID,
  [string]$GeminiApiKey = $env:GEMINI_API_KEY,
  [string]$RuntimeEvidenceSigningEnabled = $env:RUNTIME_EVIDENCE_SIGNING_ENABLED,
  [string]$RuntimeEvidenceSigningPrivateKeyPem = $env:RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_PEM,
  [string]$RuntimeEvidenceSigningPrivateKeyBase64 = $env:RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64,
  [string]$RuntimeEvidenceSigningKeyId = $env:RUNTIME_EVIDENCE_SIGNING_KEY_ID,
  [string]$RuntimeEvidenceSigningSignerId = $env:RUNTIME_EVIDENCE_SIGNING_SIGNER_ID,
  [switch]$NoWait,
  [switch]$SkipHealthCheck,
  [switch]$SkipCapabilitiesCheck,
  [int]$HealthCheckTimeoutSec = 20,
  [int]$StatusPollMaxAttempts = 60,
  [int]$StatusPollIntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Write-RailwayApiDeploySummary([object]$Summary) {
  $summaryPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\artifacts\deploy\railway-api-deploy-summary.json"))
  $summaryJson = $Summary | ConvertTo-Json -Depth 10
  Write-Utf8NoBomFile -Path $summaryPath -Content $summaryJson
  return $summaryPath
}

function Normalize-PublicUrl([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  $trimmed = $Value.Trim().TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return $null
  }

  if ($trimmed -match "^https?://") {
    return $trimmed
  }

  return ("https://" + $trimmed)
}

function Resolve-RailwayApiManifestTemplatePath([string]$RepoRoot) {
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    return $null
  }

  $candidate = Join-Path $RepoRoot "infra\railway\manifests\api-backend.railway.json"
  if (Test-Path $candidate) {
    return $candidate
  }

  return $null
}

function New-RailwayApiDeployWorkspace([string]$RepoRoot, [string]$ManifestTemplatePath) {
  $workspacePath = Join-Path $env:TEMP ("mla-railway-api-deploy-" + [guid]::NewGuid().ToString())
  $gitArgs = @("-C", $RepoRoot, "worktree", "add", "--detach", $workspacePath, "HEAD")
  $gitOutput = @()
  $gitExitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $gitOutput = (& git @gitArgs 2>&1)
    $gitExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($gitOutput) {
    $gitOutput | ForEach-Object { Write-Host $_ }
  }
  if ($gitExitCode -ne 0) {
    Fail "Unable to create temporary Railway API deploy worktree."
  }

  if (-not [string]::IsNullOrWhiteSpace($ManifestTemplatePath)) {
    Copy-Item -LiteralPath $ManifestTemplatePath -Destination (Join-Path $workspacePath "railway.json") -Force
  }

  return $workspacePath
}

function Remove-RailwayApiDeployWorkspace([string]$RepoRoot, [string]$WorkspacePath) {
  if ([string]::IsNullOrWhiteSpace($WorkspacePath) -or -not (Test-Path $WorkspacePath)) {
    return
  }

  $gitArgs = @("-C", $RepoRoot, "worktree", "remove", "--force", $WorkspacePath)
  $gitOutput = @()
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $gitOutput = (& git @gitArgs 2>&1)
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($gitOutput) {
    $gitOutput | ForEach-Object { Write-Host $_ }
  }

  if (Test-Path $WorkspacePath) {
    Remove-Item -LiteralPath $WorkspacePath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Write-RailwayApiDeployFailureSummary(
  [string]$FailureStatus,
  [string]$DeploymentId,
  [string]$ProjectId,
  [string]$Service,
  [string]$Environment,
  [string]$EffectivePublicUrl,
  [string]$RequestedPublicUrl = $null,
  [string[]]$ResolvedServicePublicUrls = @(),
  [string]$PublicUrlSource = $null,
  [object]$RequestedPublicUrlMatchesServiceDomain = $null,
  [bool]$SkipHealthCheck,
  [bool]$SkipCapabilitiesCheck
) {
  $normalizedRequestedPublicUrl = Normalize-PublicUrl $RequestedPublicUrl
  $normalizedResolvedServicePublicUrls = @(
    $ResolvedServicePublicUrls |
      ForEach-Object { Normalize-PublicUrl ([string]$_) } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  $normalizedEffectivePublicUrl = Normalize-PublicUrl $EffectivePublicUrl

  $summary = [ordered]@{
    schemaVersion = 1
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    status = $FailureStatus
    deploymentId = $DeploymentId
    projectId = $ProjectId
    service = $Service
    environment = $Environment
    requestedPublicUrl = $normalizedRequestedPublicUrl
    effectivePublicUrl = $normalizedEffectivePublicUrl
    resolvedServicePublicUrl = if ($normalizedResolvedServicePublicUrls.Count -gt 0) { $normalizedResolvedServicePublicUrls[0] } else { $null }
    resolvedServicePublicUrls = $normalizedResolvedServicePublicUrls
    publicUrlSource = if ([string]::IsNullOrWhiteSpace($PublicUrlSource)) { $null } else { $PublicUrlSource.Trim() }
    requestedPublicUrlMatchesServiceDomain = $RequestedPublicUrlMatchesServiceDomain
    checks = [ordered]@{
      health = [ordered]@{
        attempted = (-not $SkipHealthCheck)
        passed = $null
        healthUrl = if ([string]::IsNullOrWhiteSpace($normalizedEffectivePublicUrl)) { $null } else { $normalizedEffectivePublicUrl + "/healthz" }
      }
      liveCapabilities = [ordered]@{
        attempted = (-not $SkipCapabilitiesCheck)
        passed = $null
        endpoint = if ([string]::IsNullOrWhiteSpace($normalizedEffectivePublicUrl)) { $null } else { $normalizedEffectivePublicUrl + "/v1/runtime/live/capabilities" }
      }
    }
    artifacts = [ordered]@{
      self = "artifacts/deploy/railway-api-deploy-summary.json"
    }
  }

  $summaryPath = Write-RailwayApiDeploySummary -Summary $summary
  Write-Host ("[railway-api] Summary artifact: " + $summaryPath)
}

function Run-Cli([string[]]$CliArgs) {
  & railway @CliArgs
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($CliArgs -join " "))
  }
}

function Run-CliCapture([string[]]$CliArgs) {
  $output = & railway @CliArgs 2>&1
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
  if ($LASTEXITCODE -ne 0) {
    Fail ("railway command failed: railway " + ($CliArgs -join " "))
  }
  return ,$output
}

function Set-RailwayVariableIfProvided([string]$Name, [string]$Value, [string]$TargetService, [string]$TargetEnvironment) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  Write-Host ("[railway-api] Setting " + $Name + "...")
  Run-Cli -CliArgs @("variable", "set", "-s", $TargetService, "-e", $TargetEnvironment, "--skip-deploys", ($Name + "=" + $Value))
}

function Ensure-RailwayAuthContext([string]$LogPrefix) {
  $accountToken = $env:RAILWAY_API_TOKEN
  $legacyToken = if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_LEGACY_TOKEN)) { $env:RAILWAY_LEGACY_TOKEN } else { $env:RAILWAY_TOKEN }
  $projectToken = $env:RAILWAY_PROJECT_TOKEN

  function Invoke-AuthProbe {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $script:authProbe = (& railway whoami 2>&1 | Out-String).Trim()
      $script:authProbeExitCode = $LASTEXITCODE
    }
    catch {
      $script:authProbe = [string]$_.Exception.Message
      $script:authProbeExitCode = 1
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($accountToken)) {
    if (-not [string]::IsNullOrWhiteSpace($legacyToken) -and $legacyToken -ne $accountToken) {
      Write-Warning ("[" + $LogPrefix + "] Ignoring RAILWAY_TOKEN because RAILWAY_API_TOKEN is already set.")
    }
    $env:RAILWAY_TOKEN = ""
    Invoke-AuthProbe
    if ($authProbeExitCode -eq 0) {
      Remove-Item Env:RAILWAY_AUTH_PROJECT_MODE -ErrorAction SilentlyContinue
      return
    }

    if (-not [string]::IsNullOrWhiteSpace($authProbe)) {
      Write-Host $authProbe
    }

    if (-not [string]::IsNullOrWhiteSpace($legacyToken) -and $legacyToken -ne $accountToken) {
      $env:RAILWAY_API_TOKEN = $legacyToken
      $env:RAILWAY_TOKEN = ""
      Write-Warning ("[" + $LogPrefix + "] railway whoami failed with RAILWAY_API_TOKEN; retrying legacy RAILWAY_TOKEN fallback.")
      Invoke-AuthProbe
      if ($authProbeExitCode -eq 0) {
        Remove-Item Env:RAILWAY_AUTH_PROJECT_MODE -ErrorAction SilentlyContinue
        return
      }

      if (-not [string]::IsNullOrWhiteSpace($authProbe)) {
        Write-Host $authProbe
      }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($projectToken)) {
    $env:RAILWAY_API_TOKEN = ""
    $env:RAILWAY_TOKEN = $projectToken
    $env:RAILWAY_AUTH_PROJECT_MODE = "true"
    Write-Host ("[" + $LogPrefix + "] RAILWAY_API_TOKEN is empty or failed auth; using RAILWAY_PROJECT_TOKEN as RAILWAY_TOKEN for CLI auth.")
    Invoke-AuthProbe
    if ($authProbeExitCode -eq 0) {
      return
    }
    if (-not [string]::IsNullOrWhiteSpace($authProbe)) {
      Write-Host $authProbe
    }
    Write-Warning ("[" + $LogPrefix + "] railway whoami failed; continuing with project-token fallback mode.")
    return
  }

  if (
    [string]::IsNullOrWhiteSpace($accountToken) -and
    [string]::IsNullOrWhiteSpace($legacyToken) -and
    [string]::IsNullOrWhiteSpace($projectToken)
  ) {
    Invoke-AuthProbe
    if ($authProbeExitCode -eq 0) {
      Remove-Item Env:RAILWAY_AUTH_PROJECT_MODE -ErrorAction SilentlyContinue
      return
    }
    if (-not [string]::IsNullOrWhiteSpace($authProbe)) {
      Write-Host $authProbe
    }
  }

  Remove-Item Env:RAILWAY_AUTH_PROJECT_MODE -ErrorAction SilentlyContinue
  Fail ("[" + $LogPrefix + "] Railway authentication failed. Set RAILWAY_API_TOKEN (account token), or set RAILWAY_TOKEN/RAILWAY_LEGACY_TOKEN (legacy account token), or set RAILWAY_PROJECT_TOKEN, or run 'railway login'.")
}

function Get-LatestDeployment([string]$TargetService, [string]$TargetEnvironment) {
  $args = @("deployment", "list", "--limit", "20", "--json")
  if (-not [string]::IsNullOrWhiteSpace($TargetService)) {
    $args += @("-s", $TargetService)
  }
  if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment)) {
    $args += @("-e", $TargetEnvironment)
  }

  $json = (& railway @args)
  if ($LASTEXITCODE -ne 0) {
    Fail "Unable to load Railway deployment list."
  }

  $items = $json | ConvertFrom-Json
  if ($null -eq $items -or $items.Count -eq 0) {
    return $null
  }
  return $items[0]
}

function Get-DeploymentById([string]$DeploymentId, [string]$TargetService, [string]$TargetEnvironment) {
  $args = @("deployment", "list", "--limit", "30", "--json")
  if (-not [string]::IsNullOrWhiteSpace($TargetService)) {
    $args += @("-s", $TargetService)
  }
  if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment)) {
    $args += @("-e", $TargetEnvironment)
  }

  $json = (& railway @args)
  if ($LASTEXITCODE -ne 0) {
    Fail "Unable to load Railway deployment list."
  }

  $items = $json | ConvertFrom-Json
  if ($null -eq $items) {
    return $null
  }

  return $items | Where-Object { $_.id -eq $DeploymentId } | Select-Object -First 1
}

function Resolve-ServicePublicUrlsFromStatus([object]$StatusPayload, [string]$TargetService, [string]$TargetEnvironment) {
  $resolved = New-Object System.Collections.Generic.List[string]

  if ($null -eq $StatusPayload -or -not ($StatusPayload.PSObject.Properties.Name -contains "environments")) {
    return @()
  }

  $envEdges = $StatusPayload.environments.edges
  if ($null -eq $envEdges) {
    return @()
  }

  foreach ($envEdge in $envEdges) {
    $envNode = $envEdge.node
    if ($null -eq $envNode) {
      continue
    }
    if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment) -and $envNode.name -ne $TargetEnvironment) {
      continue
    }

    $instanceEdges = $envNode.serviceInstances.edges
    if ($null -eq $instanceEdges) {
      continue
    }

    foreach ($instanceEdge in $instanceEdges) {
      $instance = $instanceEdge.node
      if ($null -eq $instance) {
        continue
      }
      if (-not [string]::IsNullOrWhiteSpace($TargetService)) {
        $serviceIdMatch = [string]$instance.serviceId -eq $TargetService
        $serviceNameMatch = [string]$instance.serviceName -eq $TargetService
        if (-not $serviceIdMatch -and -not $serviceNameMatch) {
          continue
        }
      }

      $domains = $instance.domains
      if ($null -eq $domains) {
        continue
      }

      $domainCandidates = @()
      if ($domains.PSObject.Properties.Name -contains "customDomains" -and $null -ne $domains.customDomains) {
        foreach ($item in $domains.customDomains) {
          $domainValue = [string]$item.domain
          if (-not [string]::IsNullOrWhiteSpace($domainValue)) {
            $domainCandidates += $domainValue
          }
        }
      }
      if ($domains.PSObject.Properties.Name -contains "serviceDomains" -and $null -ne $domains.serviceDomains) {
        foreach ($item in $domains.serviceDomains) {
          $domainValue = [string]$item.domain
          if (-not [string]::IsNullOrWhiteSpace($domainValue)) {
            $domainCandidates += $domainValue
          }
        }
      }

      foreach ($domain in $domainCandidates) {
        $normalizedDomain = Normalize-PublicUrl ([string]$domain)
        if ([string]::IsNullOrWhiteSpace($normalizedDomain)) {
          continue
        }
        if (-not $resolved.Contains($normalizedDomain)) {
          $resolved.Add($normalizedDomain)
        }
      }
    }
  }

  return @($resolved.ToArray())
}

function Resolve-ServicePublicUrlFromStatus([object]$StatusPayload, [string]$TargetService, [string]$TargetEnvironment) {
  $resolved = @(Resolve-ServicePublicUrlsFromStatus -StatusPayload $StatusPayload -TargetService $TargetService -TargetEnvironment $TargetEnvironment)
  if ($null -eq $resolved -or $resolved.Count -eq 0) {
    return $null
  }

  return $resolved[0]
}

function Test-ApiHealth([string]$BaseUrl, [int]$TimeoutSec) {
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    return $false
  }
  $healthUrl = $BaseUrl.TrimEnd("/") + "/healthz"
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec $TimeoutSec
    return $null -ne $response -and $response.ok -eq $true -and [string]$response.service -eq "api-backend"
  }
  catch {
    return $false
  }
}

function Get-ApiLiveCapabilities([string]$BaseUrl, [int]$TimeoutSec) {
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    return $null
  }

  $headers = @{ "x-operator-role" = "operator" }
  $capabilitiesUrl = $BaseUrl.TrimEnd("/") + "/v1/runtime/live/capabilities"
  try {
    return Invoke-RestMethod -Uri $capabilitiesUrl -Method GET -Headers $headers -TimeoutSec $TimeoutSec
  }
  catch {
    return $null
  }
}

& railway --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Railway CLI is not installed or unavailable in PATH."
}

Ensure-RailwayAuthContext -LogPrefix "railway-api"

$useProjectTokenFallback = ($env:RAILWAY_AUTH_PROJECT_MODE -eq "true")

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

if ([string]::IsNullOrWhiteSpace($Service)) {
  Fail "Provide -Service (or set RAILWAY_API_SERVICE_ID/RAILWAY_API_SERVICE)."
}

$runtimeEvidenceSigningEnabledValue = if ([string]::IsNullOrWhiteSpace($RuntimeEvidenceSigningEnabled)) {
  ""
} else {
  [string]$RuntimeEvidenceSigningEnabled
}

if (
  [string]::Equals($runtimeEvidenceSigningEnabledValue.Trim(), "true", [System.StringComparison]::OrdinalIgnoreCase) -and
  [string]::IsNullOrWhiteSpace($RuntimeEvidenceSigningPrivateKeyPem) -and
  [string]::IsNullOrWhiteSpace($RuntimeEvidenceSigningPrivateKeyBase64)
) {
  Fail "RUNTIME_EVIDENCE_SIGNING_ENABLED=true requires RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_PEM or RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64."
}

if (-not (Test-Path $ApiPath)) {
  Fail "API path not found: $ApiPath"
}

$apiPackageJsonPath = Join-Path $ApiPath "package.json"
if (-not (Test-Path $apiPackageJsonPath)) {
  Fail "API package.json not found under: $ApiPath"
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$serviceManifestTemplatePath = Resolve-RailwayApiManifestTemplatePath -RepoRoot $repoRoot
if ([string]::IsNullOrWhiteSpace($serviceManifestTemplatePath)) {
  Fail "Railway API manifest template is missing: infra/railway/manifests/api-backend.railway.json"
}

$deployWorkspacePath = New-RailwayApiDeployWorkspace -RepoRoot $repoRoot -ManifestTemplatePath $serviceManifestTemplatePath

if ([string]::IsNullOrWhiteSpace($DeployMessage)) {
  $commit = (& git rev-parse --short HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
    $commit = "unknown"
  }
  $DeployMessage = "deploy api-backend: $commit"
}

Set-RailwayVariableIfProvided -Name "API_CORS_ALLOWED_ORIGINS" -Value $ApiCorsAllowedOrigins -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_API_ENABLED" -Value $LiveApiEnabled -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_DIRECT_MODE_ENABLED" -Value $LiveDirectModeEnabled -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_EPHEMERAL_TOKENS_ENABLED" -Value $LiveEphemeralTokensEnabled -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_DIRECT_MODE_DEFAULT" -Value $LiveDirectModeDefault -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_API_PROTOCOL" -Value $LiveApiProtocol -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "LIVE_MODEL_ID" -Value $LiveModelId -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "GEMINI_API_KEY" -Value $GeminiApiKey -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "RUNTIME_EVIDENCE_SIGNING_ENABLED" -Value $RuntimeEvidenceSigningEnabled -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_PEM" -Value $RuntimeEvidenceSigningPrivateKeyPem -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "RUNTIME_EVIDENCE_SIGNING_PRIVATE_KEY_BASE64" -Value $RuntimeEvidenceSigningPrivateKeyBase64 -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "RUNTIME_EVIDENCE_SIGNING_KEY_ID" -Value $RuntimeEvidenceSigningKeyId -TargetService $Service -TargetEnvironment $Environment
Set-RailwayVariableIfProvided -Name "RUNTIME_EVIDENCE_SIGNING_SIGNER_ID" -Value $RuntimeEvidenceSigningSignerId -TargetService $Service -TargetEnvironment $Environment

try {
  Push-Location $deployWorkspacePath

  if (-not [string]::IsNullOrWhiteSpace($ProjectId) -and -not [string]::IsNullOrWhiteSpace($Service)) {
    $workspaceLinkArgs = @("link", "-p", $ProjectId, "-s", $Service, "-e", $Environment)
    Write-Host "[railway-api] Linking clean deploy worktree to Railway service..."
    $workspaceLinkOutput = @()
    $workspaceLinkExitCode = 1
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $workspaceLinkOutput = (& railway @workspaceLinkArgs 2>&1)
      $workspaceLinkExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($workspaceLinkOutput) {
      $workspaceLinkOutput | ForEach-Object { Write-Host $_ }
    }
    if ($workspaceLinkExitCode -ne 0) {
      if ($env:RAILWAY_AUTH_PROJECT_MODE -eq "true") {
        Write-Warning "[railway-api] clean worktree railway link failed; continuing with direct project/service flags in project-token fallback mode."
      }
      else {
        Fail "Unable to link clean Railway API deploy worktree."
      }
    }
  }

  $deployArgs = @("up", "-d", "-s", $Service, "-e", $Environment, "-m", $DeployMessage)
  if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
    $deployArgs += @("-p", $ProjectId)
  }

  Write-Host "[railway-api] Triggering deployment..."
  $deployOutput = Run-CliCapture -CliArgs $deployArgs
  $deployText = [string]::Join("`n", $deployOutput)

  $deploymentId = $null
  $idMatch = [regex]::Match($deployText, "id=([0-9a-fA-F-]{36})")
  if ($idMatch.Success) {
    $deploymentId = $idMatch.Groups[1].Value
  }

  if ([string]::IsNullOrWhiteSpace($deploymentId)) {
    $latest = Get-LatestDeployment -TargetService $Service -TargetEnvironment $Environment
    if ($null -ne $latest) {
      $deploymentId = [string]$latest.id
    }
  }

  if ([string]::IsNullOrWhiteSpace($deploymentId)) {
    Write-RailwayApiDeployFailureSummary -FailureStatus "deployment_id_unresolved" -DeploymentId $null -ProjectId $ProjectId -Service $Service -Environment $Environment -EffectivePublicUrl $ApiPublicUrl -RequestedPublicUrl $ApiPublicUrl -PublicUrlSource "requested" -SkipHealthCheck:$SkipHealthCheck -SkipCapabilitiesCheck:$SkipCapabilitiesCheck
    Fail "Deployment created but deployment ID could not be resolved."
  }

  Write-Host "[railway-api] Deployment ID: $deploymentId"

  if ($NoWait) {
    $normalizedRequestedPublicUrl = Normalize-PublicUrl $ApiPublicUrl
    $noWaitSummary = [ordered]@{
      schemaVersion = 1
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      status = "triggered"
      deploymentId = $deploymentId
      projectId = $ProjectId
      service = $Service
      environment = $Environment
      requestedPublicUrl = $normalizedRequestedPublicUrl
      effectivePublicUrl = $normalizedRequestedPublicUrl
      resolvedServicePublicUrl = $null
      resolvedServicePublicUrls = @()
      publicUrlSource = if ([string]::IsNullOrWhiteSpace($normalizedRequestedPublicUrl)) { $null } else { "requested" }
      requestedPublicUrlMatchesServiceDomain = $null
      checks = [ordered]@{
        health = [ordered]@{
          attempted = (-not $SkipHealthCheck)
          skipped = [bool]$SkipHealthCheck
          healthUrl = if ([string]::IsNullOrWhiteSpace($normalizedRequestedPublicUrl)) { $null } else { $normalizedRequestedPublicUrl + "/healthz" }
        }
        liveCapabilities = [ordered]@{
          attempted = (-not $SkipCapabilitiesCheck)
          skipped = [bool]$SkipCapabilitiesCheck
          endpoint = if ([string]::IsNullOrWhiteSpace($normalizedRequestedPublicUrl)) { $null } else { $normalizedRequestedPublicUrl + "/v1/runtime/live/capabilities" }
        }
      }
      artifacts = [ordered]@{
        self = "artifacts/deploy/railway-api-deploy-summary.json"
      }
    }
    $noWaitSummaryPath = Write-RailwayApiDeploySummary -Summary $noWaitSummary
    Write-Host ("[railway-api] Summary artifact: " + $noWaitSummaryPath)
    exit 0
  }

  $pending = @("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING")
  for ($attempt = 1; $attempt -le $StatusPollMaxAttempts; $attempt++) {
    $deployment = Get-DeploymentById -DeploymentId $deploymentId -TargetService $Service -TargetEnvironment $Environment
    if ($null -eq $deployment) {
      Write-Host "[railway-api] Waiting for deployment metadata ($attempt/$StatusPollMaxAttempts)..."
    }
    else {
      $state = [string]$deployment.status
      Write-Host "[railway-api] Status ($attempt/$StatusPollMaxAttempts): $state"
      if ($state -eq "SUCCESS") {
        $status = $null
        try {
          $statusJson = (& railway status --json)
          if ($LASTEXITCODE -eq 0) {
            $status = $statusJson | ConvertFrom-Json
          }
        }
        catch {
        }

        $requestedPublicUrl = Normalize-PublicUrl $ApiPublicUrl
        $resolvedServicePublicUrls = @(Resolve-ServicePublicUrlsFromStatus -StatusPayload $status -TargetService $Service -TargetEnvironment $Environment)
        $resolvedServicePublicUrl = if ($resolvedServicePublicUrls.Count -gt 0) { $resolvedServicePublicUrls[0] } else { $null }
        $requestedPublicUrlMatchesServiceDomain = $null
        if (-not [string]::IsNullOrWhiteSpace($requestedPublicUrl) -and $resolvedServicePublicUrls.Count -gt 0) {
          $requestedPublicUrlMatchesServiceDomain = $resolvedServicePublicUrls -contains $requestedPublicUrl
        }
        $publicUrlSource = $null
        if (-not [string]::IsNullOrWhiteSpace($requestedPublicUrl)) {
          if ($resolvedServicePublicUrls.Count -eq 0 -or $requestedPublicUrlMatchesServiceDomain -eq $true) {
            $effectivePublicUrl = $requestedPublicUrl
            $publicUrlSource = "requested"
          }
          else {
            $effectivePublicUrl = $resolvedServicePublicUrl
            $publicUrlSource = "resolved_service_domain"
            Write-Warning ("[railway-api] Requested ApiPublicUrl does not match the resolved target service domains. Requested=" + $requestedPublicUrl + "; resolved=" + ($resolvedServicePublicUrls -join ", "))
          }
        }
        else {
          $effectivePublicUrl = $resolvedServicePublicUrl
          if (-not [string]::IsNullOrWhiteSpace($effectivePublicUrl)) {
            $publicUrlSource = "resolved_service_domain"
          }
        }

        $healthPassed = $null
        if (-not $SkipHealthCheck) {
          $healthPassed = Test-ApiHealth -BaseUrl $effectivePublicUrl -TimeoutSec $HealthCheckTimeoutSec
          if (-not $healthPassed) {
            Write-RailwayApiDeployFailureSummary -FailureStatus "healthcheck_failed" -DeploymentId $deploymentId -ProjectId $ProjectId -Service $Service -Environment $Environment -EffectivePublicUrl $effectivePublicUrl -RequestedPublicUrl $requestedPublicUrl -ResolvedServicePublicUrls $resolvedServicePublicUrls -PublicUrlSource $publicUrlSource -RequestedPublicUrlMatchesServiceDomain $requestedPublicUrlMatchesServiceDomain -SkipHealthCheck:$SkipHealthCheck -SkipCapabilitiesCheck:$SkipCapabilitiesCheck
            Fail ("API health check failed: " + $effectivePublicUrl.TrimEnd("/") + "/healthz")
          }
          Write-Host ("[railway-api] Health check passed: " + $effectivePublicUrl.TrimEnd("/") + "/healthz")
        }

        $liveCapabilities = $null
        if (-not $SkipCapabilitiesCheck) {
          $liveCapabilities = Get-ApiLiveCapabilities -BaseUrl $effectivePublicUrl -TimeoutSec $HealthCheckTimeoutSec
          if ($null -eq $liveCapabilities) {
            Write-RailwayApiDeployFailureSummary -FailureStatus "live_capabilities_failed" -DeploymentId $deploymentId -ProjectId $ProjectId -Service $Service -Environment $Environment -EffectivePublicUrl $effectivePublicUrl -RequestedPublicUrl $requestedPublicUrl -ResolvedServicePublicUrls $resolvedServicePublicUrls -PublicUrlSource $publicUrlSource -RequestedPublicUrlMatchesServiceDomain $requestedPublicUrlMatchesServiceDomain -SkipHealthCheck:$SkipHealthCheck -SkipCapabilitiesCheck:$SkipCapabilitiesCheck
            Fail ("API live capabilities route check failed: " + $effectivePublicUrl.TrimEnd("/") + "/v1/runtime/live/capabilities")
          }
          Write-Host ("[railway-api] Live capabilities route passed: " + $effectivePublicUrl.TrimEnd("/") + "/v1/runtime/live/capabilities")
        }

        $deploySummary = [ordered]@{
          schemaVersion = 1
          generatedAt = (Get-Date).ToUniversalTime().ToString("o")
          status = "success"
          deploymentId = $deploymentId
          projectId = $ProjectId
          service = $Service
          environment = $Environment
          requestedPublicUrl = $requestedPublicUrl
          effectivePublicUrl = $effectivePublicUrl
          resolvedServicePublicUrl = $resolvedServicePublicUrl
          resolvedServicePublicUrls = $resolvedServicePublicUrls
          publicUrlSource = $publicUrlSource
          requestedPublicUrlMatchesServiceDomain = $requestedPublicUrlMatchesServiceDomain
          checks = [ordered]@{
            health = [ordered]@{
              attempted = (-not $SkipHealthCheck)
              passed = $healthPassed
              healthUrl = if ([string]::IsNullOrWhiteSpace($effectivePublicUrl)) { $null } else { $effectivePublicUrl.TrimEnd("/") + "/healthz" }
            }
            liveCapabilities = [ordered]@{
              attempted = (-not $SkipCapabilitiesCheck)
              passed = if ($SkipCapabilitiesCheck) { $null } else { $null -ne $liveCapabilities }
              endpoint = if ([string]::IsNullOrWhiteSpace($effectivePublicUrl)) { $null } else { $effectivePublicUrl.TrimEnd("/") + "/v1/runtime/live/capabilities" }
              preferredMode = if ($null -ne $liveCapabilities -and $null -ne $liveCapabilities.data) { [string]$liveCapabilities.data.preferredMode } else { $null }
              activeMode = if ($null -ne $liveCapabilities -and $null -ne $liveCapabilities.data) { [string]$liveCapabilities.data.activeMode } else { $null }
              provider = if ($null -ne $liveCapabilities -and $null -ne $liveCapabilities.data) { [string]$liveCapabilities.data.provider } else { $null }
              model = if ($null -ne $liveCapabilities -and $null -ne $liveCapabilities.data) { [string]$liveCapabilities.data.model } else { $null }
              ephemeralTokensSupported = if ($null -ne $liveCapabilities -and $null -ne $liveCapabilities.data) { [bool]$liveCapabilities.data.ephemeralTokensSupported } else { $null }
            }
          }
          artifacts = [ordered]@{
            self = "artifacts/deploy/railway-api-deploy-summary.json"
          }
        }
        $deploySummaryPath = Write-RailwayApiDeploySummary -Summary $deploySummary
        Write-Host ("[railway-api] Summary artifact: " + $deploySummaryPath)

        Write-Host ""
        Write-Host "API deployment completed successfully."
        Write-Host "Deployment ID: $deploymentId"
        exit 0
      }
      if ($pending -notcontains $state) {
        Write-RailwayApiDeployFailureSummary -FailureStatus $state.ToLowerInvariant() -DeploymentId $deploymentId -ProjectId $ProjectId -Service $Service -Environment $Environment -EffectivePublicUrl $ApiPublicUrl -RequestedPublicUrl $ApiPublicUrl -PublicUrlSource "requested" -SkipHealthCheck:$SkipHealthCheck -SkipCapabilitiesCheck:$SkipCapabilitiesCheck
        Fail "API deployment finished with non-success status: $state (deploymentId=$deploymentId)"
      }
    }

    if ($attempt -lt $StatusPollMaxAttempts) {
      Start-Sleep -Seconds $StatusPollIntervalSec
    }
  }

  Write-RailwayApiDeployFailureSummary -FailureStatus "timeout" -DeploymentId $deploymentId -ProjectId $ProjectId -Service $Service -Environment $Environment -EffectivePublicUrl $ApiPublicUrl -RequestedPublicUrl $ApiPublicUrl -PublicUrlSource "requested" -SkipHealthCheck:$SkipHealthCheck -SkipCapabilitiesCheck:$SkipCapabilitiesCheck
  Fail "Timed out waiting for API deployment completion (deploymentId=$deploymentId)."
}
finally {
  Pop-Location
  Remove-RailwayApiDeployWorkspace -RepoRoot $repoRoot -WorkspacePath $deployWorkspacePath
}
