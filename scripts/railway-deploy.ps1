[CmdletBinding()]
param(
  [string]$ProjectId = $env:RAILWAY_PROJECT_ID,
  [string]$ServiceId = $env:RAILWAY_SERVICE_ID,
  [string]$Environment = $env:RAILWAY_ENVIRONMENT,
  [string]$Workspace = $env:RAILWAY_WORKSPACE,
  [string]$DeployMessage = "",
  [switch]$SkipLink,
  [switch]$SkipReleaseVerification,
  [switch]$StrictReleaseVerification,
  [switch]$SkipPublicBadgeCheck,
  [switch]$SkipRootDescriptorCheck,
  [string]$PublicBadgeEndpoint = $env:PUBLIC_BADGE_ENDPOINT,
  [string]$PublicBadgeDetailsEndpoint = $env:PUBLIC_BADGE_DETAILS_ENDPOINT,
  [string]$RailwayPublicUrl = $env:RAILWAY_PUBLIC_URL,
  [string]$DemoFrontendPublicUrl = $env:DEMO_FRONTEND_PUBLIC_URL,
  [int]$PublicBadgeCheckTimeoutSec = 20,
  [int]$RootDescriptorCheckTimeoutSec = 20,
  [int]$RootDescriptorCheckMaxAttempts = 3,
  [int]$RootDescriptorCheckRetryBackoffSec = 2,
  [switch]$NoWait,
  [switch]$SkipFailureLogs,
  [int]$FailureLogLines = 120,
  [int]$StatusPollMaxAttempts = 60,
  [int]$StatusPollIntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

if ($RootDescriptorCheckMaxAttempts -lt 1) {
  Fail "RootDescriptorCheckMaxAttempts must be >= 1."
}

if ($RootDescriptorCheckRetryBackoffSec -lt 0) {
  Fail "RootDescriptorCheckRetryBackoffSec must be >= 0."
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

function Resolve-NpmCli() {
  if ($env:OS -eq "Windows_NT") {
    return "npm.cmd"
  }
  return "npm"
}

function Get-LatestDeployment([string]$Service, [string]$Env) {
  $args = @("deployment", "list", "--limit", "20", "--json")
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $args += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $args += @("-e", $Env)
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

function Get-DeploymentById([string]$DeploymentId, [string]$Service, [string]$Env) {
  $args = @("deployment", "list", "--limit", "30", "--json")
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $args += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $args += @("-e", $Env)
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

function Resolve-ServiceIdFromStatus([object]$StatusPayload, [string]$TargetEnvironment) {
  if ($null -eq $StatusPayload) {
    return $null
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "service") {
    $serviceNode = $StatusPayload.service
    if ($null -ne $serviceNode -and -not [string]::IsNullOrWhiteSpace([string]$serviceNode.id)) {
      return [string]$serviceNode.id
    }
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "services") {
    $serviceEdges = $StatusPayload.services.edges
    if ($null -ne $serviceEdges) {
      foreach ($edge in $serviceEdges) {
        $serviceNode = $edge.node
        if ($null -ne $serviceNode -and -not [string]::IsNullOrWhiteSpace([string]$serviceNode.id)) {
          return [string]$serviceNode.id
        }
      }
    }
  }

  if ($StatusPayload.PSObject.Properties.Name -contains "environments") {
    $envEdges = $StatusPayload.environments.edges
    if ($null -ne $envEdges) {
      foreach ($envEdge in $envEdges) {
        $envNode = $envEdge.node
        if ($null -eq $envNode) {
          continue
        }
        if (-not [string]::IsNullOrWhiteSpace($TargetEnvironment) -and $envNode.name -ne $TargetEnvironment) {
          continue
        }

        $instances = $envNode.serviceInstances.edges
        if ($null -eq $instances) {
          continue
        }

        foreach ($instanceEdge in $instances) {
          $instance = $instanceEdge.node
          if ($null -ne $instance -and -not [string]::IsNullOrWhiteSpace([string]$instance.serviceId)) {
            return [string]$instance.serviceId
          }
        }
      }
    }
  }

  return $null
}

function Invoke-PublicBadgeCheck(
  [string]$Endpoint,
  [string]$DetailsEndpoint,
  [string]$PublicUrl,
  [int]$TimeoutSec
) {
  $badgeScriptPath = Join-Path $PSScriptRoot "public-badge-check.ps1"
  if (-not (Test-Path $badgeScriptPath)) {
    Fail "Missing helper script: $badgeScriptPath"
  }

  $badgeArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $badgeScriptPath, "-TimeoutSec", [string]$TimeoutSec)
  if (-not [string]::IsNullOrWhiteSpace($Endpoint)) {
    $badgeArgs += @("-BadgeEndpoint", $Endpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($DetailsEndpoint)) {
    $badgeArgs += @("-DetailsEndpoint", $DetailsEndpoint)
  }
  if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) {
    $badgeArgs += @("-RailwayPublicUrl", $PublicUrl)
  }

  Write-Host "[railway-deploy] Running post-deploy public badge endpoint check..."
  & powershell @badgeArgs
  if ($LASTEXITCODE -ne 0) {
    Fail "Post-deploy public badge endpoint check failed."
  }
}

function Invoke-GatewayRootDescriptorCheck(
  [string]$Endpoint,
  [string]$ExpectedUiUrl,
  [int]$TimeoutSec,
  [int]$MaxAttempts,
  [int]$RetryBackoffSec
) {
  if ([string]::IsNullOrWhiteSpace($Endpoint)) {
    Write-Host "[railway-deploy] Effective public URL is empty; skipping gateway root descriptor check."
    return
  }

  $attemptCount = if ($MaxAttempts -ge 1) { [math]::Floor($MaxAttempts) } else { 1 }
  $retryBackoff = if ($RetryBackoffSec -ge 0) { [math]::Floor($RetryBackoffSec) } else { 0 }
  $target = [string]$Endpoint.TrimEnd("/")
  Write-Host ("[railway-deploy] Running gateway root descriptor check: " + $target + "/ (attempts=" + [string]$attemptCount + ")")

  for ($attempt = 1; $attempt -le $attemptCount; $attempt++) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri ($target + "/") -TimeoutSec $TimeoutSec -ErrorAction Stop

      if ($null -eq $response -or $response.ok -ne $true) {
        throw "expected payload.ok=true."
      }

      $serviceName = [string]$response.service
      if ([string]::IsNullOrWhiteSpace($serviceName)) {
        throw "response.service is missing."
      }
      if ($serviceName -ne "realtime-gateway") {
        throw ("expected service 'realtime-gateway', actual '" + $serviceName + "'.")
      }

      $message = [string]$response.message
      if ($message -ne "realtime-gateway is online") {
        throw ("unexpected message '" + $message + "'.")
      }

      $routes = $response.routes
      if ($null -eq $routes) {
        throw "response.routes is missing."
      }

      $expectedRoutes = [ordered]@{
        websocket = "/realtime"
        health = "/healthz"
        status = "/status"
        metrics = "/metrics"
        badge = "/demo-e2e/badge.json"
        badgeDetails = "/demo-e2e/badge-details.json"
      }

      foreach ($routeKey in $expectedRoutes.Keys) {
        $actualRoute = [string]$routes.$routeKey
        if ([string]::IsNullOrWhiteSpace($actualRoute)) {
          throw ("routes." + $routeKey + " is missing.")
        }
        if ($actualRoute -ne [string]$expectedRoutes[$routeKey]) {
          throw (
            "routes." +
            $routeKey +
            " expected '" +
            [string]$expectedRoutes[$routeKey] +
            "', actual '" +
            $actualRoute +
            "'."
          )
        }
      }

      $reportedPublicUrl = [string]$response.publicUrl
      if ([string]::IsNullOrWhiteSpace($reportedPublicUrl)) {
        throw "response.publicUrl is missing."
      }

      $normalizedReportedPublicUrl = $reportedPublicUrl.TrimEnd("/")
      if ($normalizedReportedPublicUrl -ne $target) {
        Write-Warning (
          "[railway-deploy] Gateway root descriptor publicUrl mismatch: expected '" +
          $target +
          "', actual '" +
          $normalizedReportedPublicUrl +
          "'."
        )
      }

      if (-not [string]::IsNullOrWhiteSpace($ExpectedUiUrl)) {
        $reportedUiUrl = [string]$response.uiUrl
        if ([string]::IsNullOrWhiteSpace($reportedUiUrl)) {
          throw "response.uiUrl is missing while expected UI URL was provided."
        }
        $normalizedExpectedUiUrl = [string]$ExpectedUiUrl.TrimEnd("/")
        $normalizedReportedUiUrl = $reportedUiUrl.TrimEnd("/")
        if ($normalizedReportedUiUrl -ne $normalizedExpectedUiUrl) {
          throw (
            "response.uiUrl mismatch (expected '" +
            $normalizedExpectedUiUrl +
            "', actual '" +
            $normalizedReportedUiUrl +
            "')."
          )
        }
      }

      if ($attempt -gt 1) {
        Write-Host ("[railway-deploy] Gateway root descriptor check recovered on attempt " + [string]$attempt + ".")
      }
      return
    }
    catch {
      $reason = $_.Exception.Message
      if ($attempt -ge $attemptCount) {
        Fail (
          "Gateway root descriptor check failed for " +
          $target +
          "/ after " +
          [string]$attemptCount +
          " attempt(s): " +
          $reason
        )
      }

      Write-Warning (
        "[railway-deploy] Gateway root descriptor check attempt " +
        [string]$attempt +
        "/" +
        [string]$attemptCount +
        " failed: " +
        $reason
      )
      if ($retryBackoff -gt 0) {
        Write-Host ("[railway-deploy] Retrying gateway root descriptor check in " + [string]$retryBackoff + "s...")
        Start-Sleep -Seconds $retryBackoff
      }
    }
  }
}

function Show-DeploymentFailureDiagnostics(
  [string]$DeploymentId,
  [string]$Service,
  [string]$Env,
  [int]$Lines
) {
  if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
    return
  }

  if ($SkipFailureLogs) {
    Write-Host "[railway-deploy] Failure diagnostics log capture skipped by flag."
    return
  }

  $lineCount = if ($Lines -gt 0) { $Lines } else { 120 }
  $baseArgs = @("logs", $DeploymentId, "--lines", [string]$lineCount)
  if (-not [string]::IsNullOrWhiteSpace($Service)) {
    $baseArgs += @("-s", $Service)
  }
  if (-not [string]::IsNullOrWhiteSpace($Env)) {
    $baseArgs += @("-e", $Env)
  }

  Write-Host "[railway-deploy] Collecting failure diagnostics (build logs)..."
  & railway @($baseArgs + @("--build"))
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[railway-deploy] Unable to fetch build logs for failed deployment."
  }

  Write-Host "[railway-deploy] Collecting failure diagnostics (deployment logs)..."
  & railway @($baseArgs + @("--deployment"))
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "[railway-deploy] Unable to fetch deployment logs for failed deployment."
  }
}

function Resolve-DeploymentStartCommand([object]$Deployment) {
  if ($null -eq $Deployment) {
    return $null
  }

  if ($Deployment.PSObject.Properties.Name -contains "meta") {
    $meta = $Deployment.meta
    if ($null -ne $meta -and $meta.PSObject.Properties.Name -contains "serviceManifest") {
      $manifest = $meta.serviceManifest
      if (
        $null -ne $manifest -and
        $manifest.PSObject.Properties.Name -contains "deploy" -and
        $null -ne $manifest.deploy -and
        $manifest.deploy.PSObject.Properties.Name -contains "startCommand"
      ) {
        $startCommand = [string]$manifest.deploy.startCommand
        if (-not [string]::IsNullOrWhiteSpace($startCommand)) {
          return $startCommand
        }
      }
    }
  }

  return $null
}

function Resolve-ServicePublicUrlFromStatus([object]$StatusPayload, [string]$Service, [string]$TargetEnvironment) {
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
      if (-not [string]::IsNullOrWhiteSpace($Service) -and [string]$instance.serviceId -ne $Service) {
        continue
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

& railway --version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail "Railway CLI is not installed or unavailable in PATH."
}

if ([string]::IsNullOrWhiteSpace($Environment)) {
  $Environment = "production"
}

if (-not $SkipReleaseVerification) {
  $verificationScript = if ($StrictReleaseVerification) { "verify:release:strict" } else { "verify:release" }
  $npmCli = Resolve-NpmCli
  Write-Host "[railway-deploy] Running pre-deploy quality gate: npm run $verificationScript"
  & $npmCli run $verificationScript
  if ($LASTEXITCODE -ne 0) {
    Fail "Pre-deploy quality gate failed: npm run $verificationScript"
  }
}

if (-not $SkipLink) {
  $hasProjectId = -not [string]::IsNullOrWhiteSpace($ProjectId)
  $hasServiceId = -not [string]::IsNullOrWhiteSpace($ServiceId)

  if ($hasProjectId -and $hasServiceId) {
    $linkArgs = @("link", "-p", $ProjectId, "-s", $ServiceId, "-e", $Environment)
    if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
      $linkArgs += @("-w", $Workspace)
    }
    Write-Host "[railway-deploy] Linking workspace to Railway service..."
    Run-Cli -CliArgs $linkArgs
  }
  elseif (-not $hasProjectId -and -not $hasServiceId) {
    Write-Host "[railway-deploy] -ProjectId/-ServiceId are not set; using existing linked Railway context."
  }
  else {
    Fail "Provide both -ProjectId and -ServiceId together, or omit both to use existing Railway link, or use -SkipLink."
  }
}

$statusJson = (& railway status --json)
if ($LASTEXITCODE -ne 0) {
  Fail "Unable to resolve linked Railway project/service status."
}
$status = $statusJson | ConvertFrom-Json

$resolvedService = if (-not [string]::IsNullOrWhiteSpace($ServiceId)) { $ServiceId } else { Resolve-ServiceIdFromStatus -StatusPayload $status -TargetEnvironment $Environment }
if ([string]::IsNullOrWhiteSpace($resolvedService)) {
  Fail "No Railway service resolved. Link a service first or provide -ServiceId."
}

if ([string]::IsNullOrWhiteSpace($DeployMessage)) {
  $commit = (& git rev-parse --short HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
    $commit = "unknown"
  }
  $DeployMessage = "deploy: $commit"
}

$deployArgs = @("up", "-d", "-m", $DeployMessage, "-s", $resolvedService, "-e", $Environment)
if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
  $deployArgs += @("-p", $ProjectId)
}

Write-Host "[railway-deploy] Triggering deployment..."
$deployOutput = Run-CliCapture -CliArgs $deployArgs
$deployText = [string]::Join("`n", $deployOutput)

$deploymentId = $null
$idMatch = [regex]::Match($deployText, "id=([0-9a-fA-F-]{36})")
if ($idMatch.Success) {
  $deploymentId = $idMatch.Groups[1].Value
}

if (-not $idMatch.Success -and $deployText -match "Usage:\s*railway\s+\[COMMAND\]") {
  Fail "Railway CLI returned global help output instead of deployment logs. Check deploy arguments/service link."
}

if ([string]::IsNullOrWhiteSpace($deploymentId)) {
  $latest = Get-LatestDeployment -Service $resolvedService -Env $Environment
  if ($null -ne $latest) {
    $deploymentId = [string]$latest.id
  }
}

if ([string]::IsNullOrWhiteSpace($deploymentId)) {
  Fail "Deployment created but deployment ID could not be resolved."
}

Write-Host "[railway-deploy] Deployment ID: $deploymentId"

if ($NoWait) {
  if (-not $SkipRootDescriptorCheck) {
    Write-Host "[railway-deploy] Skipping gateway root descriptor check in no-wait mode."
  }
  if (-not $SkipPublicBadgeCheck) {
    Write-Host "[railway-deploy] Skipping public badge endpoint check in no-wait mode."
  }
  Write-Host "[railway-deploy] No-wait mode enabled. Exiting after trigger."
  exit 0
}

$pending = @("QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING")
for ($attempt = 1; $attempt -le $StatusPollMaxAttempts; $attempt++) {
  $deployment = Get-DeploymentById -DeploymentId $deploymentId -Service $resolvedService -Env $Environment
  if ($null -eq $deployment) {
    Write-Host "[railway-deploy] Waiting for deployment metadata ($attempt/$StatusPollMaxAttempts)..."
  }
  else {
    $state = [string]$deployment.status
    Write-Host "[railway-deploy] Status ($attempt/$StatusPollMaxAttempts): $state"
    if ($state -eq "SUCCESS") {
      $effectiveStartCommand = Resolve-DeploymentStartCommand -Deployment $deployment
      if (-not [string]::IsNullOrWhiteSpace($effectiveStartCommand)) {
        Write-Host ("[railway-deploy] Effective start command: " + $effectiveStartCommand)
      }

      $configSource = [string]$deployment.meta.configFile
      if (-not [string]::IsNullOrWhiteSpace($configSource)) {
        Write-Host ("[railway-deploy] Config-as-code source: " + $configSource)
      }

      $effectivePublicUrl = if (-not [string]::IsNullOrWhiteSpace($RailwayPublicUrl)) {
        [string]$RailwayPublicUrl.TrimEnd("/")
      }
      else {
        Resolve-ServicePublicUrlFromStatus -StatusPayload $status -Service $resolvedService -TargetEnvironment $Environment
      }
      if (-not [string]::IsNullOrWhiteSpace($effectivePublicUrl)) {
        Write-Host ("[railway-deploy] Effective public URL: " + $effectivePublicUrl)
      }

      if (-not $SkipRootDescriptorCheck) {
        Invoke-GatewayRootDescriptorCheck -Endpoint $effectivePublicUrl -ExpectedUiUrl $DemoFrontendPublicUrl -TimeoutSec $RootDescriptorCheckTimeoutSec -MaxAttempts $RootDescriptorCheckMaxAttempts -RetryBackoffSec $RootDescriptorCheckRetryBackoffSec
      }
      if (-not $SkipPublicBadgeCheck) {
        Invoke-PublicBadgeCheck -Endpoint $PublicBadgeEndpoint -DetailsEndpoint $PublicBadgeDetailsEndpoint -PublicUrl $effectivePublicUrl -TimeoutSec $PublicBadgeCheckTimeoutSec
      }
      Write-Host ""
      Write-Host "Railway deployment completed successfully."
      Write-Host "Deployment ID: $deploymentId"
      exit 0
    }
    if ($pending -notcontains $state) {
      Show-DeploymentFailureDiagnostics -DeploymentId $deploymentId -Service $resolvedService -Env $Environment -Lines $FailureLogLines
      Fail "Railway deployment finished with non-success status: $state (deploymentId=$deploymentId)"
    }
  }

  if ($attempt -lt $StatusPollMaxAttempts) {
    Start-Sleep -Seconds $StatusPollIntervalSec
  }
}

Show-DeploymentFailureDiagnostics -DeploymentId $deploymentId -Service $resolvedService -Env $Environment -Lines $FailureLogLines
Fail "Timed out waiting for Railway deployment completion (deploymentId=$deploymentId)."
