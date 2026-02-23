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

function Set-EnvDefault {
  param(
    [string]$Name,
    [string]$Value
  )
  $existing = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($existing)) {
    Set-Item -Path ("Env:" + $Name) -Value $Value
  }
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

  Set-EnvDefault -Name "FIRESTORE_ENABLED" -Value "false"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_MODE" -Value "remote_http"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_URL" -Value "http://localhost:8090"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS" -Value "15000"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_MAX_RETRIES" -Value "1"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvDefault -Name "UI_EXECUTOR_STRICT_PLAYWRIGHT" -Value "false"
  Set-EnvDefault -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "true"
  Set-EnvDefault -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "true"
  Set-EnvDefault -Name "ORCHESTRATOR_URL" -Value "http://127.0.0.1:8082/orchestrate"

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
