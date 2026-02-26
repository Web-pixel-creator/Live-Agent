[CmdletBinding()]
param(
  [string]$ProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$Service = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE_ID)) { $env:RAILWAY_FRONTEND_SERVICE_ID } elseif (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_FRONTEND_SERVICE)) { $env:RAILWAY_FRONTEND_SERVICE } else { "Live-Agent-Frontend" }),
  [string]$Environment = $env:RAILWAY_ENVIRONMENT,
  [string]$FrontendPath = "apps/demo-frontend",
  [string]$DeployMessage = "",
  [string]$FrontendWsUrl = $env:FRONTEND_WS_URL,
  [string]$FrontendApiBaseUrl = $env:FRONTEND_API_BASE_URL,
  [switch]$NoWait,
  [switch]$SkipHealthCheck,
  [int]$HealthCheckTimeoutSec = 20,
  [int]$StatusPollMaxAttempts = 60,
  [int]$StatusPollIntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
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

function Resolve-ServicePublicUrlFromStatus([object]$StatusPayload, [string]$TargetService, [string]$TargetEnvironment) {
  if ($null -eq $StatusPayload -or -not ($StatusPayload.PSObject.Properties.Name -contains "environments")) {
    return $null
  }

  $envEdges = $StatusPayload.environments.edges
  if ($null -eq $envEdges) {
    return $null
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
        if ([string]::IsNullOrWhiteSpace($domain)) {
          continue
        }
        if ($domain -match "^https?://") {
          return $domain.TrimEnd("/")
        }
        return ("https://" + $domain.Trim())
      }
    }
  }

  return $null
}

function Test-FrontendHealth([string]$BaseUrl, [int]$TimeoutSec) {
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    return $false
  }
  $healthUrl = $BaseUrl.TrimEnd("/") + "/healthz"
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec $TimeoutSec
    return $null -ne $response -and $response.ok -eq $true
  } catch {
    return $false
  }
}

& railway --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Railway CLI is not installed or unavailable in PATH."
}

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

if ([string]::IsNullOrWhiteSpace($Service)) {
  Fail "Provide -Service (or set RAILWAY_FRONTEND_SERVICE_ID/RAILWAY_FRONTEND_SERVICE)."
}

if (-not (Test-Path $FrontendPath)) {
  Fail "Frontend path not found: $FrontendPath"
}

$frontendPackageJsonPath = Join-Path $FrontendPath "package.json"
if (-not (Test-Path $frontendPackageJsonPath)) {
  Fail "Frontend package.json not found under: $FrontendPath"
}

if ([string]::IsNullOrWhiteSpace($DeployMessage)) {
  $commit = (& git rev-parse --short HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
    $commit = "unknown"
  }
  $DeployMessage = "deploy frontend: $commit"
}

if (-not [string]::IsNullOrWhiteSpace($FrontendWsUrl)) {
  Write-Host "[railway-frontend] Setting FRONTEND_WS_URL..."
  Run-Cli -CliArgs @("variable", "set", "-s", $Service, "-e", $Environment, "--skip-deploys", "FRONTEND_WS_URL=$FrontendWsUrl")
}

if (-not [string]::IsNullOrWhiteSpace($FrontendApiBaseUrl)) {
  Write-Host "[railway-frontend] Setting FRONTEND_API_BASE_URL..."
  Run-Cli -CliArgs @("variable", "set", "-s", $Service, "-e", $Environment, "--skip-deploys", "FRONTEND_API_BASE_URL=$FrontendApiBaseUrl")
}

$deployArgs = @("up", $FrontendPath, "--path-as-root", "-d", "-s", $Service, "-e", $Environment, "-m", $DeployMessage)
if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
  $deployArgs += @("-p", $ProjectId)
}

Write-Host "[railway-frontend] Triggering deployment..."
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
  Fail "Deployment created but deployment ID could not be resolved."
}

Write-Host "[railway-frontend] Deployment ID: $deploymentId"

if ($NoWait) {
  Write-Host "[railway-frontend] No-wait mode enabled. Exiting after trigger."
  exit 0
}

$pending = @("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING")
for ($attempt = 1; $attempt -le $StatusPollMaxAttempts; $attempt++) {
  $deployment = Get-DeploymentById -DeploymentId $deploymentId -TargetService $Service -TargetEnvironment $Environment
  if ($null -eq $deployment) {
    Write-Host "[railway-frontend] Waiting for deployment metadata ($attempt/$StatusPollMaxAttempts)..."
  }
  else {
    $state = [string]$deployment.status
    Write-Host "[railway-frontend] Status ($attempt/$StatusPollMaxAttempts): $state"
    if ($state -eq "SUCCESS") {
      $status = $null
      try {
        $statusJson = (& railway status --json)
        if ($LASTEXITCODE -eq 0) {
          $status = $statusJson | ConvertFrom-Json
        }
      } catch {
      }

      $effectivePublicUrl = Resolve-ServicePublicUrlFromStatus -StatusPayload $status -TargetService $Service -TargetEnvironment $Environment
      if (-not [string]::IsNullOrWhiteSpace($effectivePublicUrl)) {
        Write-Host ("[railway-frontend] Effective public URL: " + $effectivePublicUrl)
        if (-not $SkipHealthCheck) {
          if (Test-FrontendHealth -BaseUrl $effectivePublicUrl -TimeoutSec $HealthCheckTimeoutSec) {
            Write-Host ("[railway-frontend] Health check passed: " + $effectivePublicUrl.TrimEnd("/") + "/healthz")
          } else {
            Write-Warning ("[railway-frontend] Health check failed: " + $effectivePublicUrl.TrimEnd("/") + "/healthz")
          }
        }
      }

      Write-Host ""
      Write-Host "Frontend deployment completed successfully."
      Write-Host "Deployment ID: $deploymentId"
      exit 0
    }
    if ($pending -notcontains $state) {
      Fail "Frontend deployment finished with non-success status: $state (deploymentId=$deploymentId)"
    }
  }

  if ($attempt -lt $StatusPollMaxAttempts) {
    Start-Sleep -Seconds $StatusPollIntervalSec
  }
}

Fail "Timed out waiting for frontend deployment completion (deploymentId=$deploymentId)."
