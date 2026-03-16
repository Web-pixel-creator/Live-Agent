param(
  [Parameter(Mandatory = $false)]
  [switch]$SkipBuild,

  [Parameter(Mandatory = $false)]
  [switch]$SkipServiceStart,

  [Parameter(Mandatory = $false)]
  [switch]$KeepServices,

  [Parameter(Mandatory = $false)]
  [int]$StartupTimeoutSec = 90,

  [Parameter(Mandatory = $false)]
  [int]$LiveIterations = 20,

  [Parameter(Mandatory = $false)]
  [int]$LiveConcurrency = 4,

  [Parameter(Mandatory = $false)]
  [int]$UiIterations = 20,

  [Parameter(Mandatory = $false)]
  [int]$UiConcurrency = 4,

  [Parameter(Mandatory = $false)]
  [int]$GatewayReplayIterations = 8,

  [Parameter(Mandatory = $false)]
  [int]$GatewayReplayConcurrency = 2,

  [Parameter(Mandatory = $false)]
  [int]$GatewayReplayTimeoutMs = 18000,

  [Parameter(Mandatory = $false)]
  [int]$MaxLiveP95Ms = 1800,

  [Parameter(Mandatory = $false)]
  [int]$MaxUiP95Ms = 25000,

  [Parameter(Mandatory = $false)]
  [int]$MaxGatewayReplayP95Ms = 9000,

  [Parameter(Mandatory = $false)]
  [double]$MaxGatewayReplayErrorRatePct = 20.0,

  [Parameter(Mandatory = $false)]
  [double]$MaxAggregateErrorRatePct = 10.0,

  [Parameter(Mandatory = $false)]
  [string]$RequiredUiAdapterMode = "remote_http",

  [Parameter(Mandatory = $false)]
  [string]$OutputPath = "artifacts/perf-load/summary.json",

  [Parameter(Mandatory = $false)]
  [string]$MarkdownOutputPath = "artifacts/perf-load/summary.md",

  [Parameter(Mandatory = $false)]
  [string]$PolicyOutputPath = "artifacts/perf-load/policy-check.md",

  [Parameter(Mandatory = $false)]
  [string]$PolicyJsonOutputPath = "artifacts/perf-load/policy-check.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:StartedProcesses = @()
$script:ScriptDir = Split-Path -Parent $PSCommandPath
$script:RepoRoot = (Resolve-Path (Join-Path $script:ScriptDir "..")).Path
$script:LogDir = Join-Path $script:RepoRoot "artifacts/perf-load/logs"

function Write-Step {
  param([string]$Message)
  Write-Host ("[perf-load] " + $Message)
}

function Set-EnvValue {
  param(
    [string]$Name,
    [string]$Value
  )
  Set-Item -Path ("Env:" + $Name) -Value $Value
}

function Resolve-OutputPath {
  param([string]$Candidate)
  if ([System.IO.Path]::IsPathRooted($Candidate)) {
    return $Candidate
  }
  return Join-Path $script:RepoRoot $Candidate
}

function Try-GetHealth {
  param([string]$Url)
  try {
    return Invoke-RestMethod -Method GET -Uri $Url -TimeoutSec 4
  } catch {
    return $null
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

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Confirm-UiNavigatorRemoteHttpReadiness {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OrchestratorUrl,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedAdapterMode,
    [Parameter(Mandatory = $false)]
    [int]$MaxAttempts = 6,
    [Parameter(Mandatory = $false)]
    [int]$RetryBackoffMs = 500
  )

  $attemptCount = if ($MaxAttempts -ge 1) { $MaxAttempts } else { 1 }
  $lastFailure = "unknown readiness failure"

  for ($attempt = 1; $attempt -le $attemptCount; $attempt += 1) {
    $runId = "perf-load-readiness-" + [guid]::NewGuid().ToString()
    $requestBody = @{
      id = [guid]::NewGuid().ToString()
      userId = "perf-load-readiness-user"
      sessionId = "perf-load-readiness-session"
      runId = $runId
      type = "orchestrator.request"
      source = "frontend"
      ts = (Get-Date).ToUniversalTime().ToString("o")
      payload = @{
        intent = "ui_task"
        input = @{
          goal = "Open a page and verify the visible header."
          url = "https://example.com"
          screenshotRef = "ui://perf-load/readiness/" + $runId
          maxSteps = 4
          visualTesting = @{
            enabled = $false
          }
        }
      }
    } | ConvertTo-Json -Depth 8 -Compress

    try {
      $response = Invoke-RestMethod -Method POST -Uri $OrchestratorUrl -ContentType "application/json" -Body $requestBody -TimeoutSec 15
      $payload = Get-ObjectPropertyValue -Object $response -Name "payload"
      $route = [string](Get-ObjectPropertyValue -Object $payload -Name "route")
      $status = [string](Get-ObjectPropertyValue -Object $payload -Name "status")
      $output = Get-ObjectPropertyValue -Object $payload -Name "output"
      $execution = Get-ObjectPropertyValue -Object $output -Name "execution"
      $adapterMode = [string](Get-ObjectPropertyValue -Object $execution -Name "adapterMode")

      if ($status -eq "completed" -and $route -eq "ui-navigator-agent" -and $adapterMode -eq $ExpectedAdapterMode) {
        Write-Step ("UI adapter readiness confirmed on attempt " + $attempt + ".")
        return
      }

      $lastFailure = "unexpected readiness payload status=" + $status + " route=" + $route + " adapterMode=" + $adapterMode
    } catch {
      $lastFailure = $_.Exception.Message
    }

    if ($attempt -lt $attemptCount -and $RetryBackoffMs -gt 0) {
      Start-Sleep -Milliseconds $RetryBackoffMs
    }
  }

  throw "UI navigator remote_http readiness check failed: $lastFailure"
}

function Wait-ForHealth {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSec,
    [System.Diagnostics.Process]$Process
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if ($null -ne $Process -and $Process.HasExited) {
      throw "$Name process exited before health check passed."
    }

    $health = Try-GetHealth -Url $Url
    if ($null -ne $health -and $health.ok -eq $true) {
      return $health
    }
    Start-Sleep -Milliseconds 700
  }
  throw "Timed out waiting for $Name health endpoint: $Url"
}

function Start-ManagedService {
  param(
    [string]$Name,
    [string]$HealthUrl,
    [string[]]$NodeArgs
  )

  $existingHealth = Try-GetHealth -Url $HealthUrl
  if ($null -ne $existingHealth -and $existingHealth.ok -eq $true) {
    Write-Step "$Name already healthy at $HealthUrl, reusing existing service."
    return
  }

  $stdoutPath = Join-Path $script:LogDir ("$Name.stdout.log")
  $stderrPath = Join-Path $script:LogDir ("$Name.stderr.log")
  New-Item -ItemType File -Force -Path $stdoutPath | Out-Null
  New-Item -ItemType File -Force -Path $stderrPath | Out-Null

  Write-Step "Starting $Name..."
  $process = Start-Process `
    -FilePath "node" `
    -ArgumentList $NodeArgs `
    -WorkingDirectory $script:RepoRoot `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  Wait-ForHealth -Name $Name -Url $HealthUrl -TimeoutSec $StartupTimeoutSec -Process $process | Out-Null

  $script:StartedProcesses += [ordered]@{
    name = $Name
    process = $process
    stdoutPath = $stdoutPath
    stderrPath = $stderrPath
  }
}

function Stop-ManagedServices {
  if ($script:StartedProcesses.Count -eq 0) {
    return
  }

  Write-Step "Stopping managed services..."
  for ($idx = $script:StartedProcesses.Count - 1; $idx -ge 0; $idx -= 1) {
    $entry = $script:StartedProcesses[$idx]
    $proc = $entry.process
    if ($null -eq $proc) {
      continue
    }
    if ($proc.HasExited) {
      continue
    }

    try {
      Stop-Process -Id $proc.Id -ErrorAction Stop
    } catch {
      try {
        Stop-Process -Id $proc.Id -Force -ErrorAction Stop
      } catch {
        Write-Step "Failed to stop $($entry.name) (pid=$($proc.Id)): $($_.Exception.Message)"
      }
    }
  }
}

New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null

$resolvedOutputPath = Resolve-OutputPath -Candidate $OutputPath
$resolvedMarkdownPath = Resolve-OutputPath -Candidate $MarkdownOutputPath
$resolvedPolicyOutputPath = Resolve-OutputPath -Candidate $PolicyOutputPath
$resolvedPolicyJsonOutputPath = Resolve-OutputPath -Candidate $PolicyJsonOutputPath

foreach ($path in @($resolvedOutputPath, $resolvedMarkdownPath, $resolvedPolicyOutputPath, $resolvedPolicyJsonOutputPath)) {
  $dir = Split-Path -Parent $path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

try {
  Set-Location $script:RepoRoot

  Set-EnvValue -Name "FIRESTORE_ENABLED" -Value "false"
  Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_MODE" -Value "remote_http"
  Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_URL" -Value "http://localhost:8090"
  Set-EnvValue -Name "UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE" -Value "failed"
  Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS" -Value "15000"
  Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_MAX_RETRIES" -Value "1"
  Set-EnvValue -Name "UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvValue -Name "UI_EXECUTOR_STRICT_PLAYWRIGHT" -Value "false"
  Set-EnvValue -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "true"
  Set-EnvValue -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "true"
  Set-EnvValue -Name "ORCHESTRATOR_URL" -Value "http://127.0.0.1:8082/orchestrate"

  if (-not $SkipBuild) {
    Write-Step "Running workspace build..."
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed with exit code $LASTEXITCODE."
    }
  } else {
    Write-Step "Skipping build by request."
  }

  if (-not $SkipServiceStart) {
    Write-Step "Ensuring local services are running..."
    Start-ManagedService -Name "ui-executor" -HealthUrl "http://localhost:8090/healthz" -NodeArgs @("--import", "tsx", "apps/ui-executor/src/index.ts")
    Start-ManagedService -Name "orchestrator" -HealthUrl "http://localhost:8082/healthz" -NodeArgs @("--import", "tsx", "agents/orchestrator/src/index.ts")
    Start-ManagedService -Name "api-backend" -HealthUrl "http://localhost:8081/healthz" -NodeArgs @("--import", "tsx", "apps/api-backend/src/index.ts")
    Start-ManagedService -Name "realtime-gateway" -HealthUrl "http://localhost:8080/healthz" -NodeArgs @("--import", "tsx", "apps/realtime-gateway/src/index.ts")
  } else {
    Write-Step "Skipping service startup by request."
  }

  if ($RequiredUiAdapterMode -eq "remote_http") {
    Write-Step "Confirming UI remote_http adapter readiness..."
    Confirm-UiNavigatorRemoteHttpReadiness -OrchestratorUrl "http://127.0.0.1:8082/orchestrate" -ExpectedAdapterMode $RequiredUiAdapterMode
  }

  Write-Step "Running perf-load profile..."
  & node `
    ./scripts/perf-load.mjs `
    --gatewayWsUrl "ws://127.0.0.1:8080/realtime" `
    --gatewayBaseUrl "http://127.0.0.1:8080" `
    --orchestratorBaseUrl "http://127.0.0.1:8082" `
    --apiBaseUrl "http://127.0.0.1:8081" `
    --liveIterations $LiveIterations `
    --liveConcurrency $LiveConcurrency `
    --uiIterations $UiIterations `
    --uiConcurrency $UiConcurrency `
    --gatewayReplayIterations $GatewayReplayIterations `
    --gatewayReplayConcurrency $GatewayReplayConcurrency `
    --gatewayReplayTimeoutMs $GatewayReplayTimeoutMs `
    --maxLiveP95Ms $MaxLiveP95Ms `
    --maxUiP95Ms $MaxUiP95Ms `
    --maxGatewayReplayP95Ms $MaxGatewayReplayP95Ms `
    --maxGatewayReplayErrorRatePct $MaxGatewayReplayErrorRatePct `
    --maxAggregateErrorRatePct $MaxAggregateErrorRatePct `
    --requiredUiAdapterMode $RequiredUiAdapterMode `
    --skipHealthChecks true `
    --output $resolvedOutputPath `
    --markdownOutput $resolvedMarkdownPath
  if ($LASTEXITCODE -ne 0) {
    throw "perf-load profile failed."
  }

  Write-Step "Running perf-load policy check..."
  & node `
    ./scripts/perf-load-policy-check.mjs `
    --input $resolvedOutputPath `
    --output $resolvedPolicyOutputPath `
    --jsonOutput $resolvedPolicyJsonOutputPath `
    --maxLiveP95Ms $MaxLiveP95Ms `
    --maxUiP95Ms $MaxUiP95Ms `
    --maxGatewayReplayP95Ms $MaxGatewayReplayP95Ms `
    --maxGatewayReplayErrorRatePct $MaxGatewayReplayErrorRatePct `
    --maxAggregateErrorRatePct $MaxAggregateErrorRatePct `
    --requiredUiAdapterMode $RequiredUiAdapterMode
  if ($LASTEXITCODE -ne 0) {
    throw "perf-load policy check failed."
  }

  Write-Step "Perf-load artifacts written:"
  Write-Host (" - " + $resolvedOutputPath)
  Write-Host (" - " + $resolvedMarkdownPath)
  Write-Host (" - " + $resolvedPolicyOutputPath)
  Write-Host (" - " + $resolvedPolicyJsonOutputPath)
} finally {
  if ((-not $SkipServiceStart) -and (-not $KeepServices)) {
    Stop-ManagedServices
  } elseif ($KeepServices) {
    Write-Step "KeepServices enabled, managed services left running."
  }
}
