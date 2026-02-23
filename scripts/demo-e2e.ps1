param(
  [Parameter(Mandatory = $false)]
  [switch]$SkipBuild,

  [Parameter(Mandatory = $false)]
  [switch]$SkipServiceStart,

  [Parameter(Mandatory = $false)]
  [switch]$IncludeFrontend,

  [Parameter(Mandatory = $false)]
  [switch]$KeepServices,

  [Parameter(Mandatory = $false)]
  [int]$StartupTimeoutSec = 90,

  [Parameter(Mandatory = $false)]
  [int]$RequestTimeoutSec = 30,

  [Parameter(Mandatory = $false)]
  [int]$ScenarioRetryMaxAttempts = 2,

  [Parameter(Mandatory = $false)]
  [int]$ScenarioRetryBackoffMs = 900,

  [Parameter(Mandatory = $false)]
  [string]$OutputPath = "artifacts/demo-e2e/summary.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:StartedProcesses = @()
$script:ServiceStatuses = @()
$script:ScenarioResults = @()
$script:DemoUserId = "demo-e2e-user"

$script:ScriptDir = Split-Path -Parent $PSCommandPath
$script:RepoRoot = (Resolve-Path (Join-Path $script:ScriptDir "..")).Path
$script:LogDir = Join-Path $script:RepoRoot "artifacts/demo-e2e/logs"

function Write-Step {
  param([string]$Message)
  Write-Host ("[demo-e2e] " + $Message)
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

function Get-FieldValue {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string[]]$Path
  )

  $current = $Object
  foreach ($segment in $Path) {
    if ($null -eq $current) {
      return $null
    }

    if ($current -is [System.Collections.IDictionary]) {
      if ($current.Contains($segment)) {
        $current = $current[$segment]
        continue
      }
      return $null
    }

    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) {
      return $null
    }
    $current = $property.Value
  }

  return $current
}

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $false)]
    [object]$Body,
    [Parameter(Mandatory = $false)]
    [hashtable]$Headers,
    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 30
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    TimeoutSec = $TimeoutSec
  }

  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 40)
  }
  if ($null -ne $Headers -and $Headers.Count -gt 0) {
    $params["Headers"] = $Headers
  }

  return Invoke-RestMethod @params
}

function Invoke-JsonRequestExpectStatus {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $false)]
    [object]$Body,
    [Parameter(Mandatory = $false)]
    [hashtable]$Headers,
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatusCode,
    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 30
  )

  $jsonBody = $null
  if ($null -ne $Body) {
    $jsonBody = $Body | ConvertTo-Json -Depth 40
  }

  $statusCode = $null
  $content = ""

  try {
    $requestParams = @{
      Method = $Method
      Uri = $Uri
      TimeoutSec = $TimeoutSec
      UseBasicParsing = $true
    }
    if ($null -ne $jsonBody) {
      $requestParams["ContentType"] = "application/json"
      $requestParams["Body"] = $jsonBody
    }
    if ($null -ne $Headers -and $Headers.Count -gt 0) {
      $requestParams["Headers"] = $Headers
    }

    $response = Invoke-WebRequest @requestParams
    $statusCode = [int]$response.StatusCode
    $content = if ($null -ne $response.Content) { [string]$response.Content } else { "" }
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -eq $webResponse) {
      throw
    }
    $statusCode = [int]$webResponse.StatusCode
    if ($null -ne $_.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
      $content = [string]$_.ErrorDetails.Message
    }
    try {
      if ([string]::IsNullOrWhiteSpace($content)) {
        $stream = $webResponse.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $content = $reader.ReadToEnd()
          $reader.Close()
        }
      }
    } catch {
      $content = ""
    }
  }

  if ($statusCode -ne $ExpectedStatusCode) {
    throw "Expected HTTP $ExpectedStatusCode but got $statusCode for $Method $Uri"
  }

  $parsedBody = $null
  if (-not [string]::IsNullOrWhiteSpace($content)) {
    try {
      $parsedBody = $content | ConvertFrom-Json
    } catch {
      $parsedBody = $content
    }
  }

  return [ordered]@{
    statusCode = $statusCode
    body = $parsedBody
    raw = $content
  }
}

function Get-HttpStatusCodeFromErrorRecord {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  if ($null -eq $ErrorRecord.Exception -or $null -eq $ErrorRecord.Exception.Response) {
    return $null
  }

  $response = $ErrorRecord.Exception.Response
  try {
    if ($null -ne $response.StatusCode) {
      return [int]$response.StatusCode
    }
  } catch {
    # Ignore conversion failures and fall through to alternate extraction.
  }

  try {
    if ($null -ne $response.StatusCode.value__) {
      return [int]$response.StatusCode.value__
    }
  } catch {
    # Ignore conversion failures and return null.
  }

  return $null
}

function Test-IsTransientRequestFailure {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  $statusCode = Get-HttpStatusCodeFromErrorRecord -ErrorRecord $ErrorRecord
  if ($null -ne $statusCode) {
    if ($statusCode -eq 408 -or $statusCode -eq 429 -or $statusCode -eq 502 -or $statusCode -eq 503 -or $statusCode -eq 504) {
      return $true
    }
    if ($statusCode -ge 500) {
      return $true
    }
    return $false
  }

  $message = ""
  if ($null -ne $ErrorRecord.Exception) {
    $message = [string]$ErrorRecord.Exception.Message
  }
  if ([string]::IsNullOrWhiteSpace($message)) {
    $message = [string]$ErrorRecord
  }

  $normalizedMessage = $message.ToLowerInvariant()
  $transientFragments = @(
    "timed out",
    "timeout",
    "temporarily unavailable",
    "unable to connect",
    "no connection could be made",
    "connection was forcibly closed",
    "connection reset",
    "connection aborted",
    "name resolution",
    "temporary failure",
    "remote host closed",
    "underlying connection was closed"
  )

  foreach ($fragment in $transientFragments) {
    if ($normalizedMessage.Contains($fragment)) {
      return $true
    }
  }

  return $false
}

function Invoke-JsonRequestWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $false)]
    [object]$Body,
    [Parameter(Mandatory = $false)]
    [hashtable]$Headers,
    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 30,
    [Parameter(Mandatory = $false)]
    [int]$MaxAttempts = 2,
    [Parameter(Mandatory = $false)]
    [int]$InitialBackoffMs = 900
  )

  if ($MaxAttempts -lt 1) {
    throw "MaxAttempts must be greater than or equal to 1."
  }

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-JsonRequest -Method $Method -Uri $Uri -Body $Body -Headers $Headers -TimeoutSec $TimeoutSec
      return [ordered]@{
        response = $response
        attempts = $attempt
        retried = ($attempt -gt 1)
      }
    } catch {
      $isTransient = Test-IsTransientRequestFailure -ErrorRecord $_
      if ($attempt -ge $MaxAttempts -or -not $isTransient) {
        throw
      }

      $delayMs = [int]($InitialBackoffMs * [Math]::Pow(2, [double]($attempt - 1)))
      Write-Step ("Transient request failure for {0} {1} (attempt {2}/{3}). Retrying in {4} ms." -f $Method, $Uri, $attempt, $MaxAttempts, $delayMs)
      Start-Sleep -Milliseconds $delayMs
    }
  }

  throw "Request retry loop exhausted for $Method $Uri."
}

function Invoke-NodeJsonCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $rawOutput = & node @Args 2>&1
  $exitCode = $LASTEXITCODE
  $outputText = (($rawOutput | ForEach-Object { $_.ToString() }) -join "`n").Trim()

  if ($exitCode -ne 0) {
    if ([string]::IsNullOrWhiteSpace($outputText)) {
      throw "Node command failed with exit code $exitCode and no output."
    }
    throw "Node command failed with exit code ${exitCode}: $outputText"
  }

  if ([string]::IsNullOrWhiteSpace($outputText)) {
    throw "Node command produced empty output."
  }

  $lines = @($outputText -split "(`r`n|`n|`r)" | Where-Object { $_.Trim().Length -gt 0 })
  if ($lines.Count -eq 0) {
    throw "Node command produced no non-empty lines."
  }

  $jsonLine = $lines[$lines.Count - 1]
  try {
    return $jsonLine | ConvertFrom-Json
  } catch {
    throw "Node command did not return valid JSON line: $jsonLine"
  }
}

function Try-GetHealth {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )
  try {
    return Invoke-JsonRequest -Method GET -Uri $Url -TimeoutSec 4
  } catch {
    return $null
  }
}

function Wait-ForHealth {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSec,
    [Parameter(Mandatory = $false)]
    [System.Diagnostics.Process]$Process
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if ($null -ne $Process -and $Process.HasExited) {
      throw "$Name process exited before health check passed."
    }

    $health = Try-GetHealth -Url $Url
    if ($null -ne $health) {
      return $health
    }
    Start-Sleep -Milliseconds 700
  }

  throw "Timed out waiting for $Name health endpoint: $Url"
}

function Get-LogTail {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $false)]
    [int]$MaxLines = 20
  )

  if (-not (Test-Path -Path $Path)) {
    return ""
  }

  try {
    $lines = Get-Content -Path $Path -Tail $MaxLines -ErrorAction Stop
    return (($lines | ForEach-Object { $_.ToString() }) -join "`n").Trim()
  } catch {
    return ""
  }
}

function Start-ManagedService {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$HealthUrl,
    [Parameter(Mandatory = $true)]
    [string[]]$NodeArgs
  )

  $existingHealth = Try-GetHealth -Url $HealthUrl
  if ($null -ne $existingHealth) {
    Write-Step "$Name already healthy at $HealthUrl, reusing existing service."
    $script:ServiceStatuses += [ordered]@{
      name = $Name
      healthUrl = $HealthUrl
      reused = $true
      pid = $null
      health = $existingHealth
      logs = $null
    }
    return
  }

  $maxAttemptsRaw = [Environment]::GetEnvironmentVariable("DEMO_E2E_SERVICE_START_MAX_ATTEMPTS")
  $maxAttempts = 2
  if (-not [string]::IsNullOrWhiteSpace($maxAttemptsRaw)) {
    $parsedAttempts = 0
    if ([int]::TryParse($maxAttemptsRaw, [ref]$parsedAttempts) -and $parsedAttempts -ge 1) {
      $maxAttempts = $parsedAttempts
    }
  }

  $retryBackoffRaw = [Environment]::GetEnvironmentVariable("DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS")
  $retryBackoffMs = 1200
  if (-not [string]::IsNullOrWhiteSpace($retryBackoffRaw)) {
    $parsedBackoff = 0
    if ([int]::TryParse($retryBackoffRaw, [ref]$parsedBackoff) -and $parsedBackoff -ge 0) {
      $retryBackoffMs = $parsedBackoff
    }
  }

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt += 1) {
    $stdoutPath = Join-Path $script:LogDir ("{0}.attempt{1}.stdout.log" -f $Name, $attempt)
    $stderrPath = Join-Path $script:LogDir ("{0}.attempt{1}.stderr.log" -f $Name, $attempt)
    New-Item -ItemType File -Force -Path $stdoutPath | Out-Null
    New-Item -ItemType File -Force -Path $stderrPath | Out-Null

    if ($attempt -eq 1) {
      Write-Step "Starting $Name..."
    } else {
      Write-Step ("Restarting {0} (attempt {1}/{2})..." -f $Name, $attempt, $maxAttempts)
    }

    $process = Start-Process `
      -FilePath "node" `
      -ArgumentList $NodeArgs `
      -WorkingDirectory $script:RepoRoot `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    try {
      $health = Wait-ForHealth -Name $Name -Url $HealthUrl -TimeoutSec $StartupTimeoutSec -Process $process

      $script:StartedProcesses += [ordered]@{
        name = $Name
        process = $process
        stdoutPath = $stdoutPath
        stderrPath = $stderrPath
      }

      $script:ServiceStatuses += [ordered]@{
        name = $Name
        healthUrl = $HealthUrl
        reused = $false
        pid = $process.Id
        health = $health
        logs = [ordered]@{
          stdout = $stdoutPath
          stderr = $stderrPath
        }
      }
      return
    } catch {
      $attemptError = $_.Exception.Message
      $stderrTail = Get-LogTail -Path $stderrPath -MaxLines 30

      if ($null -ne $process -and -not $process.HasExited) {
        try {
          Stop-Process -Id $process.Id -Force -ErrorAction Stop
        } catch {
          Write-Step ("Failed to stop unhealthy {0} process (pid={1}) during retry: {2}" -f $Name, $process.Id, $_.Exception.Message)
        }
      }

      if ($attempt -ge $maxAttempts) {
        $tailText = if ([string]::IsNullOrWhiteSpace($stderrTail)) { "n/a" } else { $stderrTail }
        throw ("{0} failed to start after {1} attempt(s): {2}`n[{0} stderr tail]`n{3}" -f $Name, $maxAttempts, $attemptError, $tailText)
      }

      Write-Step ("{0} startup attempt {1}/{2} failed: {3}" -f $Name, $attempt, $maxAttempts, $attemptError)
      Start-Sleep -Milliseconds $retryBackoffMs

      $healthAfterBackoff = Try-GetHealth -Url $HealthUrl
      if ($null -ne $healthAfterBackoff) {
        Write-Step "$Name became healthy during retry backoff; reusing service."
        $script:ServiceStatuses += [ordered]@{
          name = $Name
          healthUrl = $HealthUrl
          reused = $true
          pid = $null
          health = $healthAfterBackoff
          logs = $null
        }
        return
      }
    }
  }

  throw "Unreachable startup retry state for $Name."
}

function Assert-ManagedServicePortsAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Services
  )

  foreach ($service in $Services) {
    $serviceName = [string](Get-FieldValue -Object $service -Path @("name"))
    $healthUrl = [string](Get-FieldValue -Object $service -Path @("healthUrl"))
    $port = [int](Get-FieldValue -Object $service -Path @("port"))

    if ($port -le 0 -or [string]::IsNullOrWhiteSpace($healthUrl)) {
      continue
    }

    $existingHealth = Try-GetHealth -Url $healthUrl
    if ($null -ne $existingHealth) {
      continue
    }

    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
      continue
    }

    $listener = $listeners[0]
    $owningProcessId = [int](Get-FieldValue -Object $listener -Path @("OwningProcess"))
    $processName = "unknown"
    $processCommandLine = "n/a"

    if ($owningProcessId -gt 0) {
      $proc = Get-Process -Id $owningProcessId -ErrorAction SilentlyContinue
      if ($null -ne $proc -and -not [string]::IsNullOrWhiteSpace([string]$proc.ProcessName)) {
        $processName = [string]$proc.ProcessName
      }

      try {
        $procMeta = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $owningProcessId)
        $rawCommandLine = [string](Get-FieldValue -Object $procMeta -Path @("CommandLine"))
        if (-not [string]::IsNullOrWhiteSpace($rawCommandLine)) {
          $processCommandLine = $rawCommandLine
        }
      } catch {
        # Best-effort diagnostics only.
      }
    }

    throw (
      "Port conflict before service startup: {0} requires :{1} ({2}), but the port is occupied by pid={3} process={4}. Command: {5}" -f
      $serviceName, $port, $healthUrl, $owningProcessId, $processName, $processCommandLine
    )
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

function New-OrchestratorRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SessionId,
    [Parameter(Mandatory = $true)]
    [string]$RunId,
    [Parameter(Mandatory = $true)]
    [string]$Intent,
    [Parameter(Mandatory = $true)]
    [object]$RequestInput,
    [Parameter(Mandatory = $false)]
    [string]$UserId = $script:DemoUserId
  )

  return [ordered]@{
    id = [Guid]::NewGuid().Guid
    userId = $UserId
    sessionId = $SessionId
    runId = $RunId
    type = "orchestrator.request"
    source = "frontend"
    ts = (Get-Date).ToString("o")
    payload = [ordered]@{
      intent = $Intent
      input = $RequestInput
    }
  }
}

function Invoke-Scenario {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $false)]
    [int]$MaxAttempts = 1,
    [Parameter(Mandatory = $false)]
    [int]$InitialBackoffMs = 900,
    [Parameter(Mandatory = $false)]
    [switch]$RetryTransientFailures,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  if ($MaxAttempts -lt 1) {
    throw "Scenario MaxAttempts must be >= 1."
  }

  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $data = $null
  $errorText = $null
  $status = "failed"
  $attempts = 0
  $attemptErrors = @()

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    $attempts = $attempt
    try {
      $data = & $Action
      $status = "passed"
      $errorText = $null
      break
    } catch {
      $status = "failed"
      $errorText = $_.Exception.Message
      $isTransient = Test-IsTransientRequestFailure -ErrorRecord $_
      $attemptErrors += [ordered]@{
        attempt = $attempt
        transient = $isTransient
        error = $errorText
      }

      $canRetry = ($attempt -lt $MaxAttempts) -and ((-not $RetryTransientFailures) -or $isTransient)
      if (-not $canRetry) {
        break
      }

      $delayMs = [int]($InitialBackoffMs * [Math]::Pow(2, [double]($attempt - 1)))
      if ($delayMs -lt 0) {
        $delayMs = 0
      }
      Write-Step ("Scenario {0}: transient failure on attempt {1}/{2}, retrying in {3} ms." -f $Name, $attempt, $MaxAttempts, $delayMs)
      if ($delayMs -gt 0) {
        Start-Sleep -Milliseconds $delayMs
      }
    }
  }
  $watch.Stop()

  $result = [ordered]@{
    name = $Name
    status = $status
    elapsedMs = [int]$watch.ElapsedMilliseconds
    attempts = $attempts
    maxAttempts = $MaxAttempts
    retried = ($attempts -gt 1)
    retryTransientOnly = [bool]$RetryTransientFailures
    retryableFailureCount = @($attemptErrors | Where-Object { [bool]$_.transient }).Count
    data = $data
    error = $errorText
    attemptErrors = $attemptErrors
  }
  $script:ScenarioResults += $result

  if ($status -eq "passed") {
    if ($result.retried) {
      Write-Step ("Scenario {0}: passed ({1} ms) after {2} attempts" -f $Name, $result.elapsedMs, $result.attempts)
    } else {
      Write-Step ("Scenario {0}: passed ({1} ms)" -f $Name, $result.elapsedMs)
    }
  } else {
    if ($result.retried) {
      Write-Step ("Scenario {0}: failed ({1} ms) after {2} attempts - {3}" -f $Name, $result.elapsedMs, $result.attempts, $errorText)
    } else {
      Write-Step ("Scenario {0}: failed ({1} ms) - {2}" -f $Name, $result.elapsedMs, $errorText)
    }
  }

  return $result
}

function Get-ScenarioData {
  param([string]$Name)
  $result = $script:ScenarioResults | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $result) {
    return $null
  }
  if ($result.status -ne "passed") {
    return $null
  }
  return $result.data
}

function Resolve-OutputPath {
  param([string]$Candidate)
  if ([System.IO.Path]::IsPathRooted($Candidate)) {
    return $Candidate
  }
  return Join-Path $script:RepoRoot $Candidate
}

New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null

$resolvedOutputPath = Resolve-OutputPath -Candidate $OutputPath
$resolvedOutputDir = Split-Path -Parent $resolvedOutputPath
if (-not [string]::IsNullOrWhiteSpace($resolvedOutputDir)) {
  New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
}
$resolvedMarkdownPath = Join-Path $resolvedOutputDir "summary.md"

$fatalError = $null
$sessionId = $null
$sessionCreateResponse = $null
$script:UiApprovalId = $null
$script:UiResumeInput = $null
$script:UiApprovalRunId = $null
$overallSuccess = $false
$nodeVersion = $null

try {
  Set-Location $script:RepoRoot

  $nodeVersion = (& node --version) -join ""

  Set-EnvDefault -Name "FIRESTORE_ENABLED" -Value "false"
  Set-EnvDefault -Name "API_ORCHESTRATOR_TIMEOUT_MS" -Value "15000"
  Set-EnvDefault -Name "API_ORCHESTRATOR_MAX_RETRIES" -Value "1"
  Set-EnvDefault -Name "API_ORCHESTRATOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvDefault -Name "GATEWAY_ORCHESTRATOR_TIMEOUT_MS" -Value "15000"
  Set-EnvDefault -Name "GATEWAY_ORCHESTRATOR_MAX_RETRIES" -Value "1"
  Set-EnvDefault -Name "GATEWAY_ORCHESTRATOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_MODE" -Value "remote_http"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_URL" -Value "http://localhost:8090"
  Set-EnvDefault -Name "UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE" -Value "failed"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS" -Value "15000"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_MAX_RETRIES" -Value "1"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvDefault -Name "UI_EXECUTOR_STRICT_PLAYWRIGHT" -Value "false"
  Set-EnvDefault -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "true"
  Set-EnvDefault -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "true"
  Set-EnvDefault -Name "DEMO_E2E_SERVICE_START_MAX_ATTEMPTS" -Value "2"
  Set-EnvDefault -Name "DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS" -Value "1200"

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
    $servicePortChecks = @(
      [ordered]@{ name = "ui-executor"; port = 8090; healthUrl = "http://localhost:8090/healthz" },
      [ordered]@{ name = "orchestrator"; port = 8082; healthUrl = "http://localhost:8082/healthz" },
      [ordered]@{ name = "api-backend"; port = 8081; healthUrl = "http://localhost:8081/healthz" },
      [ordered]@{ name = "realtime-gateway"; port = 8080; healthUrl = "http://localhost:8080/healthz" }
    )
    if ($IncludeFrontend) {
      $servicePortChecks += [ordered]@{ name = "demo-frontend"; port = 3000; healthUrl = "http://localhost:3000/healthz" }
    }
    Assert-ManagedServicePortsAvailable -Services $servicePortChecks
    Start-ManagedService -Name "ui-executor" -HealthUrl "http://localhost:8090/healthz" -NodeArgs @("--import", "tsx", "apps/ui-executor/src/index.ts")
    Start-ManagedService -Name "orchestrator" -HealthUrl "http://localhost:8082/healthz" -NodeArgs @("--import", "tsx", "agents/orchestrator/src/index.ts")
    Start-ManagedService -Name "api-backend" -HealthUrl "http://localhost:8081/healthz" -NodeArgs @("--import", "tsx", "apps/api-backend/src/index.ts")
    Start-ManagedService -Name "realtime-gateway" -HealthUrl "http://localhost:8080/healthz" -NodeArgs @("--import", "tsx", "apps/realtime-gateway/src/index.ts")
    if ($IncludeFrontend) {
      Start-ManagedService -Name "demo-frontend" -HealthUrl "http://localhost:3000/healthz" -NodeArgs @("--import", "tsx", "apps/demo-frontend/src/server.ts")
    }
  } else {
    Write-Step "Skipping service startup by request."
  }

  $sessionCreateResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/sessions" -Body @{
    userId = $script:DemoUserId
    mode = "multi"
  } -TimeoutSec $RequestTimeoutSec

  $sessionId = [string](Get-FieldValue -Object $sessionCreateResponse -Path @("data", "sessionId"))
  Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($sessionId)) -Message "Failed to create a sessionId."
  Write-Step "Created demo session: $sessionId"

  Invoke-Scenario -Name "live.translation" -Action {
    $runId = "demo-translation-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "translation" -RequestInput @{
      text = "Hello, please confirm price 95 and delivery 10 days."
      targetLanguage = "ru"
    }
    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec

    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "completed") -Message "Translation run did not complete."

    $translation = Get-FieldValue -Object $response -Path @("payload", "output", "translation")
    Assert-Condition -Condition ($null -ne $translation) -Message "Translation payload is missing."
    $liveCapability = Get-FieldValue -Object $response -Path @("payload", "output", "capabilityProfile", "live")
    $reasoningCapability = Get-FieldValue -Object $response -Path @("payload", "output", "capabilityProfile", "reasoning")
    Assert-Condition -Condition ($null -ne $liveCapability) -Message "Missing live capability adapter profile."
    Assert-Condition -Condition ($null -ne $reasoningCapability) -Message "Missing reasoning capability adapter profile."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      status = $status
      provider = [string](Get-FieldValue -Object $translation -Path @("provider"))
      model = [string](Get-FieldValue -Object $translation -Path @("model"))
      sourceLanguage = [string](Get-FieldValue -Object $translation -Path @("sourceLanguage"))
      targetLanguage = [string](Get-FieldValue -Object $translation -Path @("targetLanguage"))
      liveAdapterId = [string](Get-FieldValue -Object $liveCapability -Path @("adapterId"))
      reasoningAdapterId = [string](Get-FieldValue -Object $reasoningCapability -Path @("adapterId"))
      latencyMs = [int](Get-FieldValue -Object $response -Path @("payload", "output", "latencyMs"))
    }
  } | Out-Null

  Invoke-Scenario -Name "live.negotiation" -Action {
    $constraints = @{
      maxPrice = 100
      maxDeliveryDays = 10
      minSla = 99
      forbiddenActions = @("wire", "password")
    }

    $runId1 = "demo-negotiation-round1-" + [Guid]::NewGuid().Guid
    $request1 = New-OrchestratorRequest -SessionId $sessionId -RunId $runId1 -Intent "negotiation" -RequestInput @{
      text = "Initial offer: price 120, delivery 14, sla 97."
      constraints = $constraints
    }
    $response1 = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request1 -TimeoutSec $RequestTimeoutSec
    $status1 = [string](Get-FieldValue -Object $response1 -Path @("payload", "status"))
    Assert-Condition -Condition ($status1 -eq "completed") -Message "Negotiation round 1 failed."

    $runId2 = "demo-negotiation-final-" + [Guid]::NewGuid().Guid
    $request2 = New-OrchestratorRequest -SessionId $sessionId -RunId $runId2 -Intent "negotiation" -RequestInput @{
      text = "We agree on final deal: price 100 delivery 10 sla 99."
      constraints = $constraints
    }
    $response2 = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request2 -TimeoutSec $RequestTimeoutSec
    $status2 = [string](Get-FieldValue -Object $response2 -Path @("payload", "status"))
    Assert-Condition -Condition ($status2 -eq "completed") -Message "Negotiation final round failed."

    $evaluation = Get-FieldValue -Object $response2 -Path @("payload", "output", "negotiation", "evaluation")
    Assert-Condition -Condition ($null -ne $evaluation) -Message "Negotiation evaluation is missing."
    $allSatisfied = [bool](Get-FieldValue -Object $evaluation -Path @("allSatisfied"))
    $requiresUserConfirmation = [bool](Get-FieldValue -Object $response2 -Path @("payload", "output", "negotiation", "requiresUserConfirmation"))
    Assert-Condition -Condition $requiresUserConfirmation -Message "Final negotiation should require explicit user confirmation."
    Assert-Condition -Condition $allSatisfied -Message "Final negotiation constraints are not satisfied."

    return [ordered]@{
      finalRunId = [string](Get-FieldValue -Object $response2 -Path @("runId"))
      allSatisfied = $allSatisfied
      requiresUserConfirmation = $requiresUserConfirmation
      proposedOffer = Get-FieldValue -Object $response2 -Path @("payload", "output", "negotiation", "proposedOffer")
      latencyMs = [int](Get-FieldValue -Object $response2 -Path @("payload", "output", "latencyMs"))
    }
  } | Out-Null

  Invoke-Scenario -Name "storyteller.pipeline" -Action {
    $runId = "demo-story-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "story" -RequestInput @{
      prompt = "Create a short interactive story about a port logistics negotiation."
      audience = "judges"
      style = "cinematic"
      language = "en"
      includeImages = $true
      includeVideo = $true
      mediaMode = "simulated"
      videoFailureRate = 0
      segmentCount = 3
      voiceStyle = "excited storyteller voice, podcast style"
    }
    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec
    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "completed") -Message "Storyteller run did not complete."

    $timeline = Get-FieldValue -Object $response -Path @("payload", "output", "story", "timeline")
    Assert-Condition -Condition ($null -ne $timeline) -Message "Story timeline is missing."
    Assert-Condition -Condition ($timeline.Count -ge 2) -Message "Story timeline has too few segments."
    $storyCapabilityProfile = Get-FieldValue -Object $response -Path @("payload", "output", "generation", "capabilityProfile")
    Assert-Condition -Condition ($null -ne $storyCapabilityProfile) -Message "Missing storyteller capability profile."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $storyCapabilityProfile -Path @("reasoning"))) -Message "Missing storyteller reasoning capability."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $storyCapabilityProfile -Path @("image"))) -Message "Missing storyteller image capability."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $storyCapabilityProfile -Path @("video"))) -Message "Missing storyteller video capability."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $storyCapabilityProfile -Path @("tts"))) -Message "Missing storyteller tts capability."

    $generationMediaMode = [string](Get-FieldValue -Object $response -Path @("payload", "output", "generation", "mediaMode"))
    Assert-Condition -Condition ($generationMediaMode -eq "simulated") -Message "Storyteller mediaMode should be simulated for async video pipeline test."
    $videoAsync = [bool](Get-FieldValue -Object $response -Path @("payload", "output", "generation", "videoAsync"))
    Assert-Condition -Condition $videoAsync -Message "Expected generation.videoAsync=true."

    $assets = @(Get-FieldValue -Object $response -Path @("payload", "output", "assets"))
    $videoAssets = @($assets | Where-Object { $_.kind -eq "video" })
    Assert-Condition -Condition ($videoAssets.Count -ge 2) -Message "Expected at least two video assets."
    $pendingVideoAssets = @($videoAssets | Where-Object { $_.status -eq "pending" })
    Assert-Condition -Condition ($pendingVideoAssets.Count -ge 1) -Message "Expected pending video assets for async pipeline."
    $videoAssetsWithJobId = @($videoAssets | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.jobId) })
    Assert-Condition -Condition ($videoAssetsWithJobId.Count -eq $videoAssets.Count) -Message "Each video asset must be linked to media job id."

    $videoJobs = @(Get-FieldValue -Object $response -Path @("payload", "output", "mediaJobs", "video"))
    Assert-Condition -Condition ($videoJobs.Count -eq $videoAssets.Count) -Message "Video job count must match video asset count."
    $jobsWithIds = @($videoJobs | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.jobId) -and -not [string]::IsNullOrWhiteSpace([string]$_.assetId) })
    Assert-Condition -Condition ($jobsWithIds.Count -eq $videoJobs.Count) -Message "Each video job must contain jobId and assetId."

    $mediaQueue = Get-FieldValue -Object $response -Path @("payload", "output", "mediaJobs", "queue")
    Assert-Condition -Condition ($null -ne $mediaQueue) -Message "Missing storyteller media job queue snapshot."
    $queueBacklog = [int](Get-FieldValue -Object $mediaQueue -Path @("queue", "backlog"))
    Assert-Condition -Condition ($queueBacklog -ge 0) -Message "Invalid storyteller queue backlog."
    $queueWorkers = @(Get-FieldValue -Object $mediaQueue -Path @("workers"))
    Assert-Condition -Condition ($queueWorkers.Count -ge 1) -Message "Storyteller media workers are not visible in queue snapshot."
    $queueRuntimeEnabled = [bool](Get-FieldValue -Object $mediaQueue -Path @("runtime", "enabled"))
    Assert-Condition -Condition $queueRuntimeEnabled -Message "Storyteller media worker runtime should be enabled for dedicated worker mode."
    $queueQuotas = @(Get-FieldValue -Object $mediaQueue -Path @("quotas"))
    Assert-Condition -Condition ($queueQuotas.Count -ge 1) -Message "Storyteller quota visibility is missing in media queue snapshot."
    $veoQuota = $queueQuotas | Where-Object { [string]$_.model -eq "veo-3.1" } | Select-Object -First 1
    Assert-Condition -Condition ($null -ne $veoQuota) -Message "Storyteller media queue quota snapshot must include veo-3.1 model entry."
    $veoQuotaPerWindow = [int](Get-FieldValue -Object $veoQuota -Path @("perWindow"))
    $veoQuotaWindowMs = [int](Get-FieldValue -Object $veoQuota -Path @("windowMs"))
    $veoQuotaUsed = [int](Get-FieldValue -Object $veoQuota -Path @("used"))
    $veoQuotaAvailable = [int](Get-FieldValue -Object $veoQuota -Path @("available"))
    Assert-Condition -Condition ($veoQuotaPerWindow -ge 1) -Message "Invalid storyteller veo quota perWindow."
    Assert-Condition -Condition ($veoQuotaWindowMs -ge 1) -Message "Invalid storyteller veo quota windowMs."
    Assert-Condition -Condition ($veoQuotaUsed -ge 0) -Message "Invalid storyteller veo quota used counter."
    Assert-Condition -Condition ($veoQuotaAvailable -ge 0) -Message "Invalid storyteller veo quota available counter."

    $cacheRunId = "demo-story-cache-" + [Guid]::NewGuid().Guid
    $cacheRequest = New-OrchestratorRequest -SessionId $sessionId -RunId $cacheRunId -Intent "story" -RequestInput @{
      prompt = "Create a short interactive story about a port logistics negotiation."
      audience = "judges"
      style = "cinematic"
      language = "en"
      includeImages = $true
      includeVideo = $true
      mediaMode = "simulated"
      videoFailureRate = 0
      segmentCount = 3
      voiceStyle = "excited storyteller voice, podcast style"
    }
    $cacheResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $cacheRequest -TimeoutSec $RequestTimeoutSec
    $cacheStatus = [string](Get-FieldValue -Object $cacheResponse -Path @("payload", "status"))
    Assert-Condition -Condition ($cacheStatus -eq "completed") -Message "Storyteller cache verification run failed."
    $cacheSnapshot = Get-FieldValue -Object $cacheResponse -Path @("payload", "output", "generation", "cache")
    Assert-Condition -Condition ($null -ne $cacheSnapshot) -Message "Missing storyteller cache snapshot."
    $cacheEnabled = [bool](Get-FieldValue -Object $cacheSnapshot -Path @("enabled"))
    Assert-Condition -Condition $cacheEnabled -Message "Story cache should be enabled."
    $cacheHits = [int](Get-FieldValue -Object $cacheSnapshot -Path @("totals", "hits"))
    Assert-Condition -Condition ($cacheHits -ge 1) -Message "Expected story cache hits after repeated request."
    $cacheEntries = [int](Get-FieldValue -Object $cacheSnapshot -Path @("totals", "entries"))
    Assert-Condition -Condition ($cacheEntries -ge 1) -Message "Expected story cache entries after repeated request."

    $cachePurgeResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/story/cache/purge?reason=demo-e2e-story-cache" -TimeoutSec $RequestTimeoutSec
    $cachePurgedEntries = [int](Get-FieldValue -Object $cachePurgeResponse -Path @("storytellerCache", "totals", "entries"))
    Assert-Condition -Condition ($cachePurgedEntries -eq 0) -Message "Story cache purge endpoint did not clear cache entries."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      fallbackAsset = [bool](Get-FieldValue -Object $response -Path @("payload", "output", "fallbackAsset"))
      timelineSegments = [int]$timeline.Count
      plannerProvider = [string](Get-FieldValue -Object $response -Path @("payload", "output", "generation", "planner", "provider"))
      mediaMode = $generationMediaMode
      videoAsync = $videoAsync
      videoJobsCount = $videoJobs.Count
      videoPendingCount = $pendingVideoAssets.Count
      mediaQueueBacklog = $queueBacklog
      mediaQueueWorkers = $queueWorkers.Count
      mediaQueueRuntimeEnabled = $queueRuntimeEnabled
      mediaQueueQuotaEntries = $queueQuotas.Count
      mediaQueueQuotaModelSeen = ($null -ne $veoQuota)
      cacheEnabled = $cacheEnabled
      cacheHits = $cacheHits
      cacheEntries = $cacheEntries
      cacheInvalidationValidated = ($cachePurgedEntries -eq 0)
      imageAdapterId = [string](Get-FieldValue -Object $storyCapabilityProfile -Path @("image", "adapterId"))
      ttsAdapterId = [string](Get-FieldValue -Object $storyCapabilityProfile -Path @("tts", "adapterId"))
      latencyMs = [int](Get-FieldValue -Object $response -Path @("payload", "output", "latencyMs"))
    }
  } | Out-Null

  Invoke-Scenario -Name "ui.approval.request" -Action {
    $script:UiApprovalRunId = "demo-ui-approval-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $script:UiApprovalRunId -Intent "ui_task" -RequestInput @{
      goal = "Open a payment page and submit order with card details."
      url = "https://example.com"
      screenshotRef = "ui://demo/start"
      formData = @{
        email = "buyer@example.com"
        note = "Order request from automated e2e"
      }
      maxSteps = 6
    }
    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec
    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "accepted") -Message "UI approval flow should return accepted."

    $approvalRequired = [bool](Get-FieldValue -Object $response -Path @("payload", "output", "approvalRequired"))
    Assert-Condition -Condition $approvalRequired -Message "Approval should be required for sensitive UI action."

    $script:UiApprovalId = [string](Get-FieldValue -Object $response -Path @("payload", "output", "approvalId"))
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($script:UiApprovalId)) -Message "Missing approvalId."

    $resumeInputCandidate = Get-FieldValue -Object $response -Path @("payload", "output", "resumeRequestTemplate", "input")
    if ($null -ne $resumeInputCandidate) {
      $script:UiResumeInput = $resumeInputCandidate
    } else {
      $script:UiResumeInput = @{
        goal = "Open a payment page and submit order with card details."
        url = "https://example.com"
        screenshotRef = "ui://demo/start"
        maxSteps = 6
      }
    }

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      approvalId = $script:UiApprovalId
      status = $status
      approvalCategories = Get-FieldValue -Object $response -Path @("payload", "output", "approvalCategories")
      plannerProvider = [string](Get-FieldValue -Object $response -Path @("payload", "output", "planner", "provider"))
    }
  } | Out-Null

  Invoke-Scenario -Name "ui.approval.reject" -Action {
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($script:UiApprovalId)) -Message "Cannot reject approval: approvalId is missing."

    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/approvals/resume" -Body @{
      approvalId = $script:UiApprovalId
      sessionId = $sessionId
      runId = ("demo-ui-reject-" + [Guid]::NewGuid().Guid)
      decision = "rejected"
      reason = "Rejected from demo e2e script."
      intent = "ui_task"
      input = $script:UiResumeInput
    } -TimeoutSec $RequestTimeoutSec

    $resumed = [bool](Get-FieldValue -Object $response -Path @("data", "resumed"))
    Assert-Condition -Condition (-not $resumed) -Message "Rejected approval should not resume execution."
    $decision = [string](Get-FieldValue -Object $response -Path @("data", "approval", "decision"))
    Assert-Condition -Condition ($decision -eq "rejected") -Message "Approval decision should be rejected."

    return [ordered]@{
      approvalId = $script:UiApprovalId
      resumed = $resumed
      decision = $decision
    }
  } | Out-Null

  Invoke-Scenario -Name "ui.approval.approve_resume" -Action {
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($script:UiApprovalId)) -Message "Cannot approve/resume: approvalId is missing."
    $approveResumeTimeoutSec = [Math]::Max($RequestTimeoutSec, 60)

    $resumeRequest = Invoke-JsonRequestWithRetry -Method POST -Uri "http://localhost:8081/v1/approvals/resume" -Body @{
      approvalId = $script:UiApprovalId
      sessionId = $sessionId
      runId = ("demo-ui-approve-" + [Guid]::NewGuid().Guid)
      decision = "approved"
      reason = "Approved from demo e2e script."
      intent = "ui_task"
      input = $script:UiResumeInput
    } -TimeoutSec $approveResumeTimeoutSec -MaxAttempts 2 -InitialBackoffMs 1000
    $response = $resumeRequest.response

    $resumed = [bool](Get-FieldValue -Object $response -Path @("data", "resumed"))
    Assert-Condition -Condition $resumed -Message "Approved approval should resume execution."

    $orchestratorResponse = Get-FieldValue -Object $response -Path @("data", "orchestrator")
    Assert-Condition -Condition ($null -ne $orchestratorResponse) -Message "Missing resumed orchestrator response."

    $orchestratorStatus = [string](Get-FieldValue -Object $orchestratorResponse -Path @("payload", "status"))
    Assert-Condition -Condition ($orchestratorStatus -eq "completed") -Message "Resumed UI execution did not complete."

    $adapterMode = [string](Get-FieldValue -Object $orchestratorResponse -Path @("payload", "output", "execution", "adapterMode"))
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($adapterMode)) -Message "Missing UI execution adapter mode."
    $uiCapabilityProfile = Get-FieldValue -Object $orchestratorResponse -Path @("payload", "output", "capabilityProfile")
    Assert-Condition -Condition ($null -ne $uiCapabilityProfile) -Message "Missing UI capability profile."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $uiCapabilityProfile -Path @("reasoning"))) -Message "Missing UI reasoning capability."
    Assert-Condition -Condition ($null -ne (Get-FieldValue -Object $uiCapabilityProfile -Path @("computer_use"))) -Message "Missing UI computer_use capability."

    return [ordered]@{
      approvalId = $script:UiApprovalId
      resumed = $resumed
      orchestratorStatus = $orchestratorStatus
      adapterMode = $adapterMode
      computerUseAdapterId = [string](Get-FieldValue -Object $uiCapabilityProfile -Path @("computer_use", "adapterId"))
      adapterNotes = Get-FieldValue -Object $orchestratorResponse -Path @("payload", "output", "execution", "adapterNotes")
      retries = [int](Get-FieldValue -Object $orchestratorResponse -Path @("payload", "output", "execution", "retries"))
      timeoutSec = $approveResumeTimeoutSec
      requestAttempts = [int]$resumeRequest.attempts
      requestRetried = [bool]$resumeRequest.retried
    }
  } | Out-Null

  Invoke-Scenario -Name "ui.sandbox.policy_modes" -Action {
    $runId = "demo-ui-sandbox-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "ui_task" -RequestInput @{
      goal = "Delete account and remove billing profile permanently."
      url = "https://example.com/settings"
      screenshotRef = "ui://demo/sandbox"
      maxSteps = 8
      approvalConfirmed = $true
      approvalDecision = "approved"
      approvalReason = "Approved for sandbox validation scenario"
      sandboxPolicyMode = "all"
      sessionRole = "secondary"
    }

    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec
    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "failed") -Message "Sandbox policy scenario should fail in strict mode."

    $sandboxPolicy = Get-FieldValue -Object $response -Path @("payload", "output", "sandboxPolicy")
    Assert-Condition -Condition ($null -ne $sandboxPolicy) -Message "Sandbox policy output is missing."

    $sandboxActive = [bool](Get-FieldValue -Object $sandboxPolicy -Path @("active"))
    $sandboxMode = [string](Get-FieldValue -Object $sandboxPolicy -Path @("effectiveMode"))
    $sandboxReason = [string](Get-FieldValue -Object $sandboxPolicy -Path @("reason"))
    $sandboxSessionClass = [string](Get-FieldValue -Object $sandboxPolicy -Path @("sessionClass"))
    $blockedCategories = @(Get-FieldValue -Object $sandboxPolicy -Path @("blockedCategories"))
    Assert-Condition -Condition $sandboxActive -Message "Sandbox policy should be active for mode=all."
    Assert-Condition -Condition ($sandboxMode -eq "all") -Message "Sandbox mode should resolve to all."
    Assert-Condition -Condition ($sandboxReason -eq "all_sessions") -Message "Sandbox reason should be all_sessions."
    Assert-Condition -Condition ($sandboxSessionClass -eq "non_main") -Message "Sandbox session class should be non_main."
    Assert-Condition -Condition ($blockedCategories -contains "destructive_operation") -Message "Expected destructive_operation category to be blocked by sandbox."

    $executionFinalStatus = [string](Get-FieldValue -Object $response -Path @("payload", "output", "execution", "finalStatus"))
    Assert-Condition -Condition ($executionFinalStatus -eq "failed_sandbox_policy") -Message "Sandbox blocked flow must expose failed_sandbox_policy execution status."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      status = $status
      sandboxActive = $sandboxActive
      sandboxMode = $sandboxMode
      sandboxReason = $sandboxReason
      sandboxSessionClass = $sandboxSessionClass
      blockedCategories = $blockedCategories
      executionFinalStatus = $executionFinalStatus
    }
  } | Out-Null

  Invoke-Scenario `
    -Name "ui.visual_testing" `
    -MaxAttempts $ScenarioRetryMaxAttempts `
    -InitialBackoffMs $ScenarioRetryBackoffMs `
    -RetryTransientFailures `
    -Action {
    $runId = "demo-ui-visual-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "ui_task" -RequestInput @{
      goal = "Open the page and verify dashboard layout/content/interaction checkpoints."
      url = "https://example.com"
      screenshotRef = "ui://demo/visual"
      domSnapshot = "<main><header><button id='refresh'>Refresh</button></header><section id='dashboard'></section></main>"
      accessibilityTree = "main > header > button[name=Refresh]; main > section[name=Dashboard]"
      markHints = @(
        "refresh_button@(192,96)"
        "dashboard_panel@(640,420)"
      )
      maxSteps = 5
      visualTesting = @{
        enabled = $true
        baselineScreenshotRef = "ui://baseline/demo-dashboard"
        expectedAssertions = @(
          "Layout blocks remain aligned without overlap.",
          "Critical content and labels remain visible.",
          "Interactive controls remain usable after task execution."
        )
        simulateRegression = $false
      }
    }

    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec
    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "completed") -Message "UI visual testing run did not complete."

    $visual = Get-FieldValue -Object $response -Path @("payload", "output", "visualTesting")
    Assert-Condition -Condition ($null -ne $visual) -Message "Missing visualTesting report."

    $visualEnabled = [bool](Get-FieldValue -Object $visual -Path @("enabled"))
    Assert-Condition -Condition $visualEnabled -Message "visualTesting report should be enabled."

    $visualStatus = [string](Get-FieldValue -Object $visual -Path @("status"))
    Assert-Condition -Condition ($visualStatus -eq "passed") -Message "Visual testing report status should be passed."

    $checks = @(Get-FieldValue -Object $visual -Path @("checks"))
    Assert-Condition -Condition ($checks.Count -ge 3) -Message "Visual testing report should include at least 3 checks."

    $regressionCount = [int](Get-FieldValue -Object $visual -Path @("regressionCount"))
    Assert-Condition -Condition ($regressionCount -eq 0) -Message "Visual testing run should not have regressions."

    $comparatorMode = [string](Get-FieldValue -Object $visual -Path @("comparator", "mode"))
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($comparatorMode)) -Message "Missing visual comparator mode."

    $executionGrounding = Get-FieldValue -Object $response -Path @("payload", "output", "execution", "grounding")
    Assert-Condition -Condition ($null -ne $executionGrounding) -Message "Missing execution grounding summary."
    $domSeen = [bool](Get-FieldValue -Object $executionGrounding -Path @("domSnapshotProvided"))
    $a11ySeen = [bool](Get-FieldValue -Object $executionGrounding -Path @("accessibilityTreeProvided"))
    $markHintsCount = [int](Get-FieldValue -Object $executionGrounding -Path @("markHintsCount"))
    Assert-Condition -Condition $domSeen -Message "Execution grounding should include domSnapshotProvided=true."
    Assert-Condition -Condition $a11ySeen -Message "Execution grounding should include accessibilityTreeProvided=true."
    Assert-Condition -Condition ($markHintsCount -ge 2) -Message "Execution grounding should include mark hints."

    $adapterNotes = @((Get-FieldValue -Object $response -Path @("payload", "output", "execution", "adapterNotes")))
    $groundingAdapterNoteSeen = ($adapterNotes | Where-Object { [string]$_ -like "grounding_context*" } | Measure-Object).Count -ge 1

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      reportStatus = $visualStatus
      checksCount = $checks.Count
      regressionCount = $regressionCount
      highestSeverity = [string](Get-FieldValue -Object $visual -Path @("highestSeverity"))
      comparatorMode = $comparatorMode
      groundingDomSeen = $domSeen
      groundingAccessibilitySeen = $a11ySeen
      groundingMarkHintsCount = $markHintsCount
      groundingAdapterNoteSeen = $groundingAdapterNoteSeen
    }
  } | Out-Null

  Invoke-Scenario -Name "multi_agent.delegation" -Action {
    $runId = "demo-delegation-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "conversation" -RequestInput @{
      text = "delegate story: write a short branch about a final contract handshake."
    }
    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8082/orchestrate" -Body $request -TimeoutSec $RequestTimeoutSec

    $status = [string](Get-FieldValue -Object $response -Path @("payload", "status"))
    Assert-Condition -Condition ($status -eq "completed") -Message "Delegation request did not complete."

    $delegatedRoute = [string](Get-FieldValue -Object $response -Path @("payload", "output", "delegation", "delegatedRoute"))
    Assert-Condition -Condition ($delegatedRoute -eq "storyteller-agent") -Message "Delegation route mismatch."

    $delegatedStatus = [string](Get-FieldValue -Object $response -Path @("payload", "output", "delegation", "delegatedStatus"))
    $routingMode = [string](Get-FieldValue -Object $response -Path @("payload", "output", "routing", "mode"))
    $routingReason = [string](Get-FieldValue -Object $response -Path @("payload", "output", "routing", "reason"))
    $routingRoute = [string](Get-FieldValue -Object $response -Path @("payload", "output", "routing", "route"))
    $routingConfidenceRaw = Get-FieldValue -Object $response -Path @("payload", "output", "routing", "confidence")
    $routingConfidence = $null
    if ($null -ne $routingConfidenceRaw -and -not [string]::IsNullOrWhiteSpace([string]$routingConfidenceRaw)) {
      $routingConfidence = [double]$routingConfidenceRaw
    }
    Assert-Condition -Condition (@("deterministic", "assistive_override", "assistive_match", "assistive_fallback") -contains $routingMode) -Message "Routing mode is invalid for delegation scenario."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($routingReason)) -Message "Routing reason is missing for delegation scenario."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($routingRoute)) -Message "Routing route is missing for delegation scenario."
    if ($null -ne $routingConfidence) {
      Assert-Condition -Condition ($routingConfidence -ge 0 -and $routingConfidence -le 1) -Message "Routing confidence must be in [0..1] when present."
    }

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      delegatedRoute = $delegatedRoute
      delegatedStatus = $delegatedStatus
      routingMode = $routingMode
      routingReason = $routingReason
      routingRoute = $routingRoute
      routingConfidence = $routingConfidence
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.roundtrip" -Action {
    $runId = "demo-gateway-ws-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(4000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket gateway check returned ok=false."

    $responseStatus = [string](Get-FieldValue -Object $result -Path @("responseStatus"))
    $responseRoute = [string](Get-FieldValue -Object $result -Path @("responseRoute"))
    $contextValidated = [bool](Get-FieldValue -Object $result -Path @("contextValidated"))
    $sessionStateCount = [int](Get-FieldValue -Object $result -Path @("sessionStateCount"))
    Assert-Condition -Condition ($responseStatus -eq "completed") -Message "WebSocket response status is not completed."
    Assert-Condition -Condition ($responseRoute -eq "live-agent") -Message "WebSocket response route is not live-agent."
    Assert-Condition -Condition $contextValidated -Message "WebSocket session/run context validation failed."
    Assert-Condition -Condition ($sessionStateCount -ge 3) -Message "Expected at least 3 session.state transitions."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("runId"))
      userId = [string](Get-FieldValue -Object $result -Path @("userId"))
      responseStatus = $responseStatus
      responseRoute = $responseRoute
      roundTripMs = [int](Get-FieldValue -Object $result -Path @("roundTripMs"))
      contextValidated = $contextValidated
      sessionStateCount = $sessionStateCount
      sessionStateTransitions = @((Get-FieldValue -Object $result -Path @("sessionStateTransitions")))
      connectedType = [string](Get-FieldValue -Object $result -Path @("connectedType"))
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
      translationProvider = [string](Get-FieldValue -Object $result -Path @("translationProvider"))
      translationModel = [string](Get-FieldValue -Object $result -Path @("translationModel"))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.task_progress" -Action {
    $runId = "demo-gateway-ws-task-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(4000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-task-progress-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--gatewayHttpBase",
      "http://localhost:8080",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket task progress check returned ok=false."

    $taskId = [string](Get-FieldValue -Object $result -Path @("taskId"))
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($taskId)) -Message "Task progress check did not return taskId."

    $taskStatus = [string](Get-FieldValue -Object $result -Path @("taskStatus"))
    $allowedTaskStatuses = @("running", "pending_approval")
    Assert-Condition -Condition ($allowedTaskStatuses -contains $taskStatus) -Message "Unexpected active task status."

    $taskProgressCount = [int](Get-FieldValue -Object $result -Path @("taskProgressCount"))
    Assert-Condition -Condition ($taskProgressCount -ge 1) -Message "Expected at least one task.progress event."

    $activeTaskCount = [int](Get-FieldValue -Object $result -Path @("activeTaskCount"))
    Assert-Condition -Condition ($activeTaskCount -ge 1) -Message "Expected active task list to contain at least one task."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("runId"))
      taskId = $taskId
      taskStatus = $taskStatus
      taskProgressCount = $taskProgressCount
      activeTaskCount = $activeTaskCount
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.request_replay" -Action {
    $runId = "demo-gateway-ws-replay-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(4000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-replay-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket replay check returned ok=false."

    $replayEventCount = [int](Get-FieldValue -Object $result -Path @("replayEventCount"))
    $taskStartedCount = [int](Get-FieldValue -Object $result -Path @("taskStartedCount"))
    $responseIdReused = [bool](Get-FieldValue -Object $result -Path @("responseIdReused"))
    Assert-Condition -Condition ($replayEventCount -ge 1) -Message "Expected at least one gateway.request_replayed event."
    Assert-Condition -Condition ($taskStartedCount -eq 1) -Message "Expected exactly one task.started event for replay scenario."
    Assert-Condition -Condition $responseIdReused -Message "Expected response envelope id reuse for replayed request."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("runId"))
      replayEventCount = $replayEventCount
      replayEventType = [string](Get-FieldValue -Object $result -Path @("replayEventType"))
      replayAgeMs = [int](Get-FieldValue -Object $result -Path @("replayAgeMs"))
      taskStartedCount = $taskStartedCount
      responseIdReused = $responseIdReused
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.interrupt_signal" -Action {
    $runId = "demo-gateway-ws-interrupt-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(4000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-interrupt-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs,
      "--reason",
      "demo_interrupt_checkpoint"
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket interrupt signal check returned ok=false."

    $interruptEventType = [string](Get-FieldValue -Object $result -Path @("interruptEventType"))
    $allowedInterruptEvents = @("live.interrupt.requested", "live.bridge.unavailable")
    Assert-Condition -Condition ($allowedInterruptEvents -contains $interruptEventType) -Message "Unexpected interrupt event type."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("runId"))
      connectedType = [string](Get-FieldValue -Object $result -Path @("connectedType"))
      liveApiEnabled = Get-FieldValue -Object $result -Path @("liveApiEnabled")
      interruptEventType = $interruptEventType
      interruptReason = [string](Get-FieldValue -Object $result -Path @("interruptReason"))
      interruptLatencyMs = Get-FieldValue -Object $result -Path @("interruptLatencyMs")
      interruptLatencySource = [string](Get-FieldValue -Object $result -Path @("interruptLatencySource"))
      interruptLatencyMeasured = [bool](Get-FieldValue -Object $result -Path @("interruptLatencyMeasured"))
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.invalid_envelope" -Action {
    $timeoutMs = [Math]::Max(4000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-invalid-envelope-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket invalid-envelope check returned ok=false."

    $code = [string](Get-FieldValue -Object $result -Path @("code"))
    $traceId = [string](Get-FieldValue -Object $result -Path @("traceId"))
    Assert-Condition -Condition ($code -eq "GATEWAY_INVALID_ENVELOPE") -Message "Unexpected gateway error code for invalid envelope."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($traceId)) -Message "Invalid-envelope gateway error is missing traceId."

    return [ordered]@{
      code = $code
      traceId = $traceId
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.binding_mismatch" -Action {
    $runId = "demo-gateway-ws-binding-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(5000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-binding-mismatch-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket binding-mismatch check returned ok=false."

    $sessionMismatchCode = [string](Get-FieldValue -Object $result -Path @("sessionMismatchCode"))
    $sessionMismatchTraceId = [string](Get-FieldValue -Object $result -Path @("sessionMismatchTraceId"))
    $userMismatchCode = [string](Get-FieldValue -Object $result -Path @("userMismatchCode"))
    $userMismatchTraceId = [string](Get-FieldValue -Object $result -Path @("userMismatchTraceId"))
    Assert-Condition -Condition ($sessionMismatchCode -eq "GATEWAY_SESSION_MISMATCH") -Message "Unexpected gateway error code for session mismatch."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($sessionMismatchTraceId)) -Message "Session mismatch gateway error is missing traceId."
    Assert-Condition -Condition ($userMismatchCode -eq "GATEWAY_USER_MISMATCH") -Message "Unexpected gateway error code for user mismatch."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($userMismatchTraceId)) -Message "User mismatch gateway error is missing traceId."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("firstRunId"))
      firstResponseStatus = [string](Get-FieldValue -Object $result -Path @("firstResponseStatus"))
      sessionMismatchCode = $sessionMismatchCode
      sessionMismatchTraceId = $sessionMismatchTraceId
      userMismatchCode = $userMismatchCode
      userMismatchTraceId = $userMismatchTraceId
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario -Name "gateway.websocket.draining_rejection" -Action {
    $runId = "demo-gateway-ws-drain-" + [Guid]::NewGuid().Guid
    $timeoutMs = [Math]::Max(6000, $RequestTimeoutSec * 1000)
    $result = Invoke-NodeJsonCommand -Args @(
      "scripts/gateway-ws-draining-check.mjs",
      "--url",
      "ws://localhost:8080/realtime",
      "--sessionId",
      $sessionId,
      "--runId",
      $runId,
      "--userId",
      $script:DemoUserId,
      "--timeoutMs",
      [string]$timeoutMs
    )

    $ok = [bool](Get-FieldValue -Object $result -Path @("ok"))
    Assert-Condition -Condition $ok -Message "WebSocket draining-rejection check returned ok=false."

    $drainingCode = [string](Get-FieldValue -Object $result -Path @("drainingCode"))
    $drainingTraceId = [string](Get-FieldValue -Object $result -Path @("drainingTraceId"))
    $recoveryStatus = [string](Get-FieldValue -Object $result -Path @("recoveryStatus"))
    $drainState = [string](Get-FieldValue -Object $result -Path @("drainState"))
    $warmupState = [string](Get-FieldValue -Object $result -Path @("warmupState"))
    Assert-Condition -Condition ($drainingCode -eq "GATEWAY_DRAINING") -Message "Unexpected gateway error code for drain-mode rejection."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($drainingTraceId)) -Message "Drain-mode gateway error is missing traceId."
    Assert-Condition -Condition ($recoveryStatus -eq "completed") -Message "Recovery websocket request should complete after warmup."

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $result -Path @("runIdBase"))
      drainState = $drainState
      warmupState = $warmupState
      drainingCode = $drainingCode
      drainingTraceId = $drainingTraceId
      drainingTraceIdPresent = (-not [string]::IsNullOrWhiteSpace($drainingTraceId))
      recoveryStatus = $recoveryStatus
      recoveryRoute = [string](Get-FieldValue -Object $result -Path @("recoveryRoute"))
      eventTypes = @((Get-FieldValue -Object $result -Path @("eventTypes")))
    }
  } | Out-Null

  Invoke-Scenario `
    -Name "operator.console.actions" `
    -MaxAttempts $ScenarioRetryMaxAttempts `
    -InitialBackoffMs $ScenarioRetryBackoffMs `
    -RetryTransientFailures `
    -Action {
    $operatorHeaders = @{
      "x-operator-role" = "operator"
    }
    $adminHeaders = @{
      "x-operator-role" = "admin"
    }
    $deviceNodeId = "desktop-main-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

    $deviceUpsertResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/device-nodes" -Headers $adminHeaders -Body @{
      nodeId = $deviceNodeId
      displayName = "E2E Desktop Main"
      kind = "desktop"
      platform = "windows-11"
      executorUrl = "http://localhost:8090/execute"
      status = "online"
      capabilities = @("screen", "click", "type")
      trustLevel = "reviewed"
      updatedBy = "demo-e2e-admin"
    } -TimeoutSec $RequestTimeoutSec
    $deviceNodeCreated = Get-FieldValue -Object $deviceUpsertResponse -Path @("data")
    $deviceNodeCreatedId = [string](Get-FieldValue -Object $deviceNodeCreated -Path @("nodeId"))
    $deviceNodeCreatedVersion = [int](Get-FieldValue -Object $deviceNodeCreated -Path @("version"))
    Assert-Condition -Condition ($deviceNodeCreatedId -eq $deviceNodeId) -Message "Device node upsert returned unexpected nodeId."
    Assert-Condition -Condition ($deviceNodeCreatedVersion -ge 1) -Message "Device node upsert should set version >= 1."

    $deviceUpdateResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/device-nodes" -Headers $adminHeaders -Body @{
      nodeId = $deviceNodeId
      displayName = "E2E Desktop Main Updated"
      kind = "desktop"
      platform = "windows-11"
      executorUrl = "http://localhost:8090/execute"
      status = "online"
      capabilities = @("screen", "click", "type", "scroll")
      trustLevel = "trusted"
      updatedBy = "demo-e2e-admin"
      expectedVersion = $deviceNodeCreatedVersion
    } -TimeoutSec $RequestTimeoutSec
    $deviceNodeUpdated = Get-FieldValue -Object $deviceUpdateResponse -Path @("data")
    $deviceNodeUpdatedVersion = [int](Get-FieldValue -Object $deviceNodeUpdated -Path @("version"))
    $deviceNodeUpdatedStatus = [string](Get-FieldValue -Object $deviceNodeUpdated -Path @("status"))
    Assert-Condition -Condition ($deviceNodeUpdatedVersion -gt $deviceNodeCreatedVersion) -Message "Device node expected-version update should increment version."
    Assert-Condition -Condition ($deviceNodeUpdatedStatus -eq "online") -Message "Device node expected-version update should preserve online status."

    $deviceVersionConflictResponse = Invoke-JsonRequestExpectStatus -Method POST -Uri "http://localhost:8081/v1/device-nodes" -Headers $adminHeaders -Body @{
      nodeId = $deviceNodeId
      displayName = "E2E Desktop Main Conflict"
      kind = "desktop"
      platform = "windows-11"
      executorUrl = "http://localhost:8090/execute"
      status = "online"
      capabilities = @("screen", "click", "type", "scroll")
      trustLevel = "trusted"
      updatedBy = "demo-e2e-admin"
      expectedVersion = $deviceNodeCreatedVersion
    } -ExpectedStatusCode 409 -TimeoutSec $RequestTimeoutSec
    $deviceVersionConflictStatusCode = [int](Get-FieldValue -Object $deviceVersionConflictResponse -Path @("statusCode"))
    $deviceVersionConflictCode = [string](Get-FieldValue -Object $deviceVersionConflictResponse -Path @("body", "error", "code"))
    $deviceVersionConflictExpectedVersion = [int](Get-FieldValue -Object $deviceVersionConflictResponse -Path @("body", "error", "details", "expectedVersion"))
    $deviceVersionConflictActualVersion = [int](Get-FieldValue -Object $deviceVersionConflictResponse -Path @("body", "error", "details", "actualVersion"))
    Assert-Condition -Condition ($deviceVersionConflictStatusCode -eq 409) -Message "Device node stale expectedVersion should return HTTP 409."
    Assert-Condition -Condition ($deviceVersionConflictCode -eq "API_DEVICE_NODE_VERSION_CONFLICT") -Message "Device node stale expectedVersion should return API_DEVICE_NODE_VERSION_CONFLICT."
    Assert-Condition -Condition ($deviceVersionConflictExpectedVersion -eq $deviceNodeCreatedVersion) -Message "Device node version conflict should echo stale expectedVersion."
    Assert-Condition -Condition ($deviceVersionConflictActualVersion -ge $deviceNodeUpdatedVersion) -Message "Device node version conflict should expose actualVersion >= updated version."

    $deviceHeartbeatResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/device-nodes/heartbeat" -Headers $operatorHeaders -Body @{
      nodeId = $deviceNodeId
      status = "degraded"
      metadata = @{
        source = "demo-e2e"
        heartbeat = $true
      }
    } -TimeoutSec $RequestTimeoutSec
    $deviceNodeHeartbeat = Get-FieldValue -Object $deviceHeartbeatResponse -Path @("data")
    $deviceNodeHeartbeatStatus = [string](Get-FieldValue -Object $deviceNodeHeartbeat -Path @("status"))
    Assert-Condition -Condition ($deviceNodeHeartbeatStatus -eq "degraded") -Message "Device node heartbeat should set status=degraded."

    $deviceLookupResponse = Invoke-JsonRequest -Method GET -Uri "http://localhost:8081/v1/device-nodes/$([System.Uri]::EscapeDataString($deviceNodeId))" -Headers $operatorHeaders -TimeoutSec $RequestTimeoutSec
    $deviceLookupNode = Get-FieldValue -Object $deviceLookupResponse -Path @("data")
    $deviceLookupNodeId = [string](Get-FieldValue -Object $deviceLookupNode -Path @("nodeId"))
    $deviceLookupStatus = [string](Get-FieldValue -Object $deviceLookupNode -Path @("status"))
    $deviceLookupVersion = [int](Get-FieldValue -Object $deviceLookupNode -Path @("version"))
    $deviceLookupLastSeenAt = [string](Get-FieldValue -Object $deviceLookupNode -Path @("lastSeenAt"))
    Assert-Condition -Condition ($deviceLookupNodeId -eq $deviceNodeId) -Message "Device node status lookup returned unexpected nodeId."
    Assert-Condition -Condition ($deviceLookupStatus -eq "degraded") -Message "Device node status lookup should return degraded status after heartbeat."
    Assert-Condition -Condition ($deviceLookupVersion -gt $deviceNodeUpdatedVersion) -Message "Device node status lookup version should increase after expected-version update + heartbeat."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($deviceLookupLastSeenAt)) -Message "Device node status lookup should include lastSeenAt."

    $summaryResponse = Invoke-JsonRequest -Method GET -Uri "http://localhost:8081/v1/operator/summary" -Headers $operatorHeaders -TimeoutSec $RequestTimeoutSec
    $summaryData = Get-FieldValue -Object $summaryResponse -Path @("data")
    Assert-Condition -Condition ($null -ne $summaryData) -Message "Operator summary payload is missing."

    $activeTasks = @(Get-FieldValue -Object $summaryData -Path @("activeTasks", "data"))
    Assert-Condition -Condition ($activeTasks.Count -ge 1) -Message "Operator summary should include at least one active task."

    $taskQueue = Get-FieldValue -Object $summaryData -Path @("taskQueue")
    Assert-Condition -Condition ($null -ne $taskQueue) -Message "Operator summary taskQueue block is missing."
    $taskQueueTotalRaw = Get-FieldValue -Object $taskQueue -Path @("total")
    $taskQueueQueuedRaw = Get-FieldValue -Object $taskQueue -Path @("statusCounts", "queued")
    $taskQueueRunningRaw = Get-FieldValue -Object $taskQueue -Path @("statusCounts", "running")
    $taskQueuePendingApprovalRaw = Get-FieldValue -Object $taskQueue -Path @("statusCounts", "pendingApproval")
    $taskQueueOtherRaw = Get-FieldValue -Object $taskQueue -Path @("statusCounts", "other")
    $taskQueueStaleCountRaw = Get-FieldValue -Object $taskQueue -Path @("staleCount")
    $taskQueueStaleThresholdMsRaw = Get-FieldValue -Object $taskQueue -Path @("staleThresholdMs")
    $taskQueueMaxAgeMsRaw = Get-FieldValue -Object $taskQueue -Path @("maxAgeMs")
    Assert-Condition -Condition ($null -ne $taskQueueTotalRaw) -Message "Operator summary taskQueue.total is missing."
    Assert-Condition -Condition ($null -ne $taskQueueQueuedRaw) -Message "Operator summary taskQueue.statusCounts.queued is missing."
    Assert-Condition -Condition ($null -ne $taskQueueRunningRaw) -Message "Operator summary taskQueue.statusCounts.running is missing."
    Assert-Condition -Condition ($null -ne $taskQueuePendingApprovalRaw) -Message "Operator summary taskQueue.statusCounts.pendingApproval is missing."
    Assert-Condition -Condition ($null -ne $taskQueueOtherRaw) -Message "Operator summary taskQueue.statusCounts.other is missing."
    Assert-Condition -Condition ($null -ne $taskQueueStaleCountRaw) -Message "Operator summary taskQueue.staleCount is missing."
    Assert-Condition -Condition ($null -ne $taskQueueStaleThresholdMsRaw) -Message "Operator summary taskQueue.staleThresholdMs is missing."
    Assert-Condition -Condition ($null -ne $taskQueueMaxAgeMsRaw) -Message "Operator summary taskQueue.maxAgeMs is missing."
    $taskQueueTotal = [int]$taskQueueTotalRaw
    $taskQueueQueued = [int]$taskQueueQueuedRaw
    $taskQueueRunning = [int]$taskQueueRunningRaw
    $taskQueuePendingApproval = [int]$taskQueuePendingApprovalRaw
    $taskQueueOther = [int]$taskQueueOtherRaw
    $taskQueueStaleCount = [int]$taskQueueStaleCountRaw
    $taskQueueStaleThresholdMs = [int]$taskQueueStaleThresholdMsRaw
    $taskQueueMaxAgeMs = [int]$taskQueueMaxAgeMsRaw
    $taskQueuePressureLevel = [string](Get-FieldValue -Object $taskQueue -Path @("pressureLevel"))
    $allowedTaskQueuePressureLevels = @("idle", "healthy", "elevated")
    Assert-Condition -Condition ($allowedTaskQueuePressureLevels -contains $taskQueuePressureLevel) -Message "Operator summary taskQueue pressureLevel is invalid."
    Assert-Condition -Condition ($taskQueueTotal -eq $activeTasks.Count) -Message "Operator summary taskQueue total must equal activeTasks count."
    Assert-Condition -Condition (($taskQueueQueued + $taskQueueRunning + $taskQueuePendingApproval + $taskQueueOther) -eq $taskQueueTotal) -Message "Operator summary taskQueue statusCounts must sum to total."
    Assert-Condition -Condition ($taskQueueStaleCount -ge 0) -Message "Operator summary taskQueue staleCount must be >= 0."
    Assert-Condition -Condition ($taskQueueStaleThresholdMs -gt 0) -Message "Operator summary taskQueue staleThresholdMs must be > 0."
    Assert-Condition -Condition ($taskQueueMaxAgeMs -ge 0) -Message "Operator summary taskQueue maxAgeMs must be >= 0."
    $taskQueueSummaryValidated = (
      $taskQueueTotal -eq $activeTasks.Count -and
      ($taskQueueQueued + $taskQueueRunning + $taskQueuePendingApproval + $taskQueueOther) -eq $taskQueueTotal -and
      $taskQueueStaleCount -ge 0 -and
      $taskQueueStaleThresholdMs -gt 0 -and
      $taskQueueMaxAgeMs -ge 0 -and
      ($allowedTaskQueuePressureLevels -contains $taskQueuePressureLevel)
    )

    $deviceNodeHealth = Get-FieldValue -Object $summaryData -Path @("deviceNodes")
    Assert-Condition -Condition ($null -ne $deviceNodeHealth) -Message "Operator summary deviceNodes block is missing."
    $deviceNodeSummaryTotal = [int](Get-FieldValue -Object $deviceNodeHealth -Path @("total"))
    $deviceNodeSummaryDegraded = [int](Get-FieldValue -Object $deviceNodeHealth -Path @("statusCounts", "degraded"))
    $deviceNodeSummaryStale = [int](Get-FieldValue -Object $deviceNodeHealth -Path @("staleCount"))
    $deviceNodeSummaryMissingHeartbeat = [int](Get-FieldValue -Object $deviceNodeHealth -Path @("missingHeartbeatCount"))
    Assert-Condition -Condition ($deviceNodeSummaryTotal -ge 1) -Message "Operator summary deviceNodes.total should be >= 1."
    Assert-Condition -Condition ($deviceNodeSummaryDegraded -ge 1) -Message "Operator summary deviceNodes.degraded should be >= 1 after degraded heartbeat."
    Assert-Condition -Condition ($deviceNodeSummaryStale -ge 0) -Message "Operator summary deviceNodes.staleCount must be >= 0."
    Assert-Condition -Condition ($deviceNodeSummaryMissingHeartbeat -ge 0) -Message "Operator summary deviceNodes.missingHeartbeatCount must be >= 0."
    $deviceNodeRecent = @(Get-FieldValue -Object $deviceNodeHealth -Path @("recent"))
    $recentLookup = @($deviceNodeRecent | Where-Object {
      [string](Get-FieldValue -Object $_ -Path @("nodeId")) -eq $deviceNodeId -and
      [string](Get-FieldValue -Object $_ -Path @("status")) -eq "degraded"
    })
    Assert-Condition -Condition ($recentLookup.Count -ge 1) -Message "Operator summary deviceNodes.recent should include the degraded test node."

    $traceTotals = Get-FieldValue -Object $summaryData -Path @("traces", "totals")
    Assert-Condition -Condition ($null -ne $traceTotals) -Message "Operator summary traces.totals is missing."
    $traceRuns = [int](Get-FieldValue -Object $traceTotals -Path @("runsConsidered"))
    $traceEvents = [int](Get-FieldValue -Object $traceTotals -Path @("eventsConsidered"))
    $traceUiRuns = [int](Get-FieldValue -Object $traceTotals -Path @("uiTraceRuns"))
    $traceApprovals = [int](Get-FieldValue -Object $traceTotals -Path @("approvalLinkedRuns"))
    $traceScreenshots = [int](Get-FieldValue -Object $traceTotals -Path @("screenshotRefs"))
    Assert-Condition -Condition ($traceRuns -ge 1) -Message "Operator traces should include at least one run."
    Assert-Condition -Condition ($traceApprovals -ge 1) -Message "Operator traces should include approval-linked runs."

    $liveBridgeHealth = Get-FieldValue -Object $summaryData -Path @("traces", "liveBridgeHealth")
    Assert-Condition -Condition ($null -ne $liveBridgeHealth) -Message "Operator summary traces.liveBridgeHealth is missing."
    $liveBridgeHealthState = [string](Get-FieldValue -Object $liveBridgeHealth -Path @("state"))
    $liveBridgeHealthDegradedEvents = [int](Get-FieldValue -Object $liveBridgeHealth -Path @("degradedEvents"))
    $liveBridgeHealthRecoveredEvents = [int](Get-FieldValue -Object $liveBridgeHealth -Path @("recoveredEvents"))
    $liveBridgeHealthWatchdogReconnectEvents = [int](Get-FieldValue -Object $liveBridgeHealth -Path @("watchdogReconnectEvents"))
    $liveBridgeHealthBridgeErrorEvents = [int](Get-FieldValue -Object $liveBridgeHealth -Path @("bridgeErrorEvents"))
    $liveBridgeHealthUnavailableEvents = [int](Get-FieldValue -Object $liveBridgeHealth -Path @("unavailableEvents"))
    $liveBridgeHealthConnectTimeoutEventsRaw = Get-FieldValue -Object $liveBridgeHealth -Path @("connectTimeoutEvents")
    $liveBridgeHealthProbeStartedEventsRaw = Get-FieldValue -Object $liveBridgeHealth -Path @("probeStartedEvents")
    $liveBridgeHealthPingSentEventsRaw = Get-FieldValue -Object $liveBridgeHealth -Path @("pingSentEvents")
    $liveBridgeHealthPongEventsRaw = Get-FieldValue -Object $liveBridgeHealth -Path @("pongEvents")
    $liveBridgeHealthPingErrorEventsRaw = Get-FieldValue -Object $liveBridgeHealth -Path @("pingErrorEvents")
    Assert-Condition -Condition ($null -ne $liveBridgeHealthConnectTimeoutEventsRaw) -Message "Operator summary live bridge connectTimeoutEvents is missing."
    Assert-Condition -Condition ($null -ne $liveBridgeHealthProbeStartedEventsRaw) -Message "Operator summary live bridge probeStartedEvents is missing."
    Assert-Condition -Condition ($null -ne $liveBridgeHealthPingSentEventsRaw) -Message "Operator summary live bridge pingSentEvents is missing."
    Assert-Condition -Condition ($null -ne $liveBridgeHealthPongEventsRaw) -Message "Operator summary live bridge pongEvents is missing."
    Assert-Condition -Condition ($null -ne $liveBridgeHealthPingErrorEventsRaw) -Message "Operator summary live bridge pingErrorEvents is missing."
    $liveBridgeHealthConnectTimeoutEvents = [int]$liveBridgeHealthConnectTimeoutEventsRaw
    $liveBridgeHealthProbeStartedEvents = [int]$liveBridgeHealthProbeStartedEventsRaw
    $liveBridgeHealthPingSentEvents = [int]$liveBridgeHealthPingSentEventsRaw
    $liveBridgeHealthPongEvents = [int]$liveBridgeHealthPongEventsRaw
    $liveBridgeHealthPingErrorEvents = [int]$liveBridgeHealthPingErrorEventsRaw
    $liveBridgeHealthLastEventType = [string](Get-FieldValue -Object $liveBridgeHealth -Path @("lastEventType"))
    Assert-Condition -Condition ($liveBridgeHealthConnectTimeoutEvents -ge 0) -Message "Operator summary live bridge connectTimeoutEvents must be >= 0."
    Assert-Condition -Condition ($liveBridgeHealthProbeStartedEvents -ge 0) -Message "Operator summary live bridge probeStartedEvents must be >= 0."
    Assert-Condition -Condition ($liveBridgeHealthPingSentEvents -ge 0) -Message "Operator summary live bridge pingSentEvents must be >= 0."
    Assert-Condition -Condition ($liveBridgeHealthPongEvents -ge 0) -Message "Operator summary live bridge pongEvents must be >= 0."
    Assert-Condition -Condition ($liveBridgeHealthPingErrorEvents -ge 0) -Message "Operator summary live bridge pingErrorEvents must be >= 0."
    $allowedHealthStates = @("healthy", "degraded", "unknown")
    Assert-Condition -Condition ($allowedHealthStates -contains $liveBridgeHealthState) -Message "Operator summary live bridge state is invalid."

    $taskId = [string](Get-FieldValue -Object $activeTasks[0] -Path @("taskId"))
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($taskId)) -Message "Operator summary active task is missing taskId."

    $cancelResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $operatorHeaders -Body @{
      action = "cancel_task"
      taskId = $taskId
      reason = "demo operator cancel"
    } -TimeoutSec $RequestTimeoutSec
    $cancelStatus = [string](Get-FieldValue -Object $cancelResponse -Path @("data", "result", "data", "status"))
    Assert-Condition -Condition ($cancelStatus -eq "failed") -Message "Operator cancel_task should mark task as failed."

    $retryResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $operatorHeaders -Body @{
      action = "retry_task"
      taskId = $taskId
      reason = "demo operator retry"
    } -TimeoutSec $RequestTimeoutSec
    $retryStatus = [string](Get-FieldValue -Object $retryResponse -Path @("data", "result", "data", "status"))
    Assert-Condition -Condition ($retryStatus -eq "queued") -Message "Operator retry_task should mark task as queued."

    $forbiddenFailover = Invoke-JsonRequestExpectStatus -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $operatorHeaders -Body @{
      action = "failover"
      targetService = "orchestrator"
      operation = "drain"
    } -ExpectedStatusCode 403 -TimeoutSec $RequestTimeoutSec
    $forbiddenCode = [string](Get-FieldValue -Object $forbiddenFailover -Path @("body", "error", "code"))
    Assert-Condition -Condition ($forbiddenCode -eq "API_OPERATOR_ADMIN_REQUIRED") -Message "Expected admin-required error for operator failover."

    $drainResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $adminHeaders -Body @{
      action = "failover"
      targetService = "orchestrator"
      operation = "drain"
      reason = "demo admin drain"
    } -TimeoutSec $RequestTimeoutSec
    $drainState = [string](Get-FieldValue -Object $drainResponse -Path @("data", "result", "runtime", "state"))
    Assert-Condition -Condition ($drainState -eq "draining") -Message "Admin failover drain should set orchestrator to draining."

    $warmupResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $adminHeaders -Body @{
      action = "failover"
      targetService = "orchestrator"
      operation = "warmup"
      reason = "demo admin warmup"
    } -TimeoutSec $RequestTimeoutSec
    $warmupState = [string](Get-FieldValue -Object $warmupResponse -Path @("data", "result", "runtime", "state"))
    Assert-Condition -Condition ($warmupState -eq "ready") -Message "Admin failover warmup should set orchestrator back to ready."

    $uiExecutorDrainResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $adminHeaders -Body @{
      action = "failover"
      targetService = "ui-executor"
      operation = "drain"
      reason = "demo admin ui-executor drain"
    } -TimeoutSec $RequestTimeoutSec
    $uiExecutorDrainState = [string](Get-FieldValue -Object $uiExecutorDrainResponse -Path @("data", "result", "runtime", "state"))
    Assert-Condition -Condition ($uiExecutorDrainState -eq "draining") -Message "Admin failover drain should set ui-executor to draining."

    $uiExecutorWarmupResponse = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/operator/actions" -Headers $adminHeaders -Body @{
      action = "failover"
      targetService = "ui-executor"
      operation = "warmup"
      reason = "demo admin ui-executor warmup"
    } -TimeoutSec $RequestTimeoutSec
    $uiExecutorWarmupState = [string](Get-FieldValue -Object $uiExecutorWarmupResponse -Path @("data", "result", "runtime", "state"))
    Assert-Condition -Condition ($uiExecutorWarmupState -eq "ready") -Message "Admin failover warmup should set ui-executor back to ready."
    $uiExecutorFailoverValidated = ($uiExecutorDrainState -eq "draining" -and $uiExecutorWarmupState -eq "ready")
    Assert-Condition -Condition $uiExecutorFailoverValidated -Message "ui-executor failover drain/warmup validation failed."

    $postSummaryResponse = Invoke-JsonRequest -Method GET -Uri "http://localhost:8081/v1/operator/summary" -Headers $operatorHeaders -TimeoutSec $RequestTimeoutSec
    $postSummaryData = Get-FieldValue -Object $postSummaryResponse -Path @("data")
    $operatorActionsBlock = Get-FieldValue -Object $postSummaryData -Path @("operatorActions")
    $operatorAuditTotal = [int](Get-FieldValue -Object $operatorActionsBlock -Path @("total"))
    $operatorAuditRecent = @(Get-FieldValue -Object $operatorActionsBlock -Path @("recent"))
    Assert-Condition -Condition ($operatorAuditTotal -ge 4) -Message "Operator audit trail should include recent operator actions."
    Assert-Condition -Condition ($operatorAuditRecent.Count -ge 1) -Message "Operator audit trail recent entries should not be empty."

    return [ordered]@{
      taskId = $taskId
      summaryActiveTasks = $activeTasks.Count
      cancelStatus = $cancelStatus
      retryStatus = $retryStatus
      forbiddenCode = $forbiddenCode
      drainState = $drainState
      warmupState = $warmupState
      uiExecutorDrainState = $uiExecutorDrainState
      uiExecutorWarmupState = $uiExecutorWarmupState
      uiExecutorFailoverValidated = $uiExecutorFailoverValidated
      operatorAuditTotal = $operatorAuditTotal
      traceRuns = $traceRuns
      traceEvents = $traceEvents
      traceUiRuns = $traceUiRuns
      traceApprovals = $traceApprovals
      traceScreenshots = $traceScreenshots
      liveBridgeHealthState = $liveBridgeHealthState
      liveBridgeHealthDegradedEvents = $liveBridgeHealthDegradedEvents
      liveBridgeHealthRecoveredEvents = $liveBridgeHealthRecoveredEvents
      liveBridgeHealthWatchdogReconnectEvents = $liveBridgeHealthWatchdogReconnectEvents
      liveBridgeHealthBridgeErrorEvents = $liveBridgeHealthBridgeErrorEvents
      liveBridgeHealthUnavailableEvents = $liveBridgeHealthUnavailableEvents
      liveBridgeHealthConnectTimeoutEvents = $liveBridgeHealthConnectTimeoutEvents
      liveBridgeHealthProbeStartedEvents = $liveBridgeHealthProbeStartedEvents
      liveBridgeHealthPingSentEvents = $liveBridgeHealthPingSentEvents
      liveBridgeHealthPongEvents = $liveBridgeHealthPongEvents
      liveBridgeHealthPingErrorEvents = $liveBridgeHealthPingErrorEvents
      liveBridgeHealthLastEventType = $liveBridgeHealthLastEventType
      liveBridgeHealthProbeTelemetryValidated = $true
      liveBridgeHealthBlockValidated = $true
      taskQueueTotal = $taskQueueTotal
      taskQueueQueued = $taskQueueQueued
      taskQueueRunning = $taskQueueRunning
      taskQueuePendingApproval = $taskQueuePendingApproval
      taskQueueOther = $taskQueueOther
      taskQueueStaleCount = $taskQueueStaleCount
      taskQueueStaleThresholdMs = $taskQueueStaleThresholdMs
      taskQueueMaxAgeMs = $taskQueueMaxAgeMs
      taskQueuePressureLevel = $taskQueuePressureLevel
      taskQueueSummaryValidated = $taskQueueSummaryValidated
      deviceNodeId = $deviceNodeId
      deviceNodeCreatedVersion = $deviceNodeCreatedVersion
      deviceNodeUpdatedVersion = $deviceNodeUpdatedVersion
      deviceNodeUpdatedStatus = $deviceNodeUpdatedStatus
      deviceNodeHeartbeatStatus = $deviceNodeHeartbeatStatus
      deviceNodeLookupStatus = $deviceLookupStatus
      deviceNodeLookupVersion = $deviceLookupVersion
      deviceNodeLookupLastSeenAt = $deviceLookupLastSeenAt
      deviceNodeLookupValidated = $true
      deviceNodeVersionConflictStatusCode = $deviceVersionConflictStatusCode
      deviceNodeVersionConflictCode = $deviceVersionConflictCode
      deviceNodeVersionConflictExpectedVersion = $deviceVersionConflictExpectedVersion
      deviceNodeVersionConflictActualVersion = $deviceVersionConflictActualVersion
      deviceNodeVersionConflictValidated = $true
      deviceNodeSummaryTotal = $deviceNodeSummaryTotal
      deviceNodeSummaryDegraded = $deviceNodeSummaryDegraded
      deviceNodeSummaryStale = $deviceNodeSummaryStale
      deviceNodeSummaryMissingHeartbeat = $deviceNodeSummaryMissingHeartbeat
      deviceNodeSummaryRecentContainsLookup = ($recentLookup.Count -ge 1)
      deviceNodeHealthSummaryValidated = $true
    }
  } | Out-Null

  Invoke-Scenario -Name "operator.device_nodes.lifecycle" -Action {
    $operatorActions = Get-ScenarioData -Name "operator.console.actions"
    Assert-Condition -Condition ($null -ne $operatorActions) -Message "operator.console.actions scenario must pass before operator.device_nodes.lifecycle."

    $deviceNodeId = [string](Get-FieldValue -Object $operatorActions -Path @("deviceNodeId"))
    $createdVersion = [int](Get-FieldValue -Object $operatorActions -Path @("deviceNodeCreatedVersion"))
    $updatedVersion = [int](Get-FieldValue -Object $operatorActions -Path @("deviceNodeUpdatedVersion"))
    $lookupVersion = [int](Get-FieldValue -Object $operatorActions -Path @("deviceNodeLookupVersion"))
    $lookupStatus = [string](Get-FieldValue -Object $operatorActions -Path @("deviceNodeLookupStatus"))
    $heartbeatStatus = [string](Get-FieldValue -Object $operatorActions -Path @("deviceNodeHeartbeatStatus"))
    $versionConflictValidated = [bool](Get-FieldValue -Object $operatorActions -Path @("deviceNodeVersionConflictValidated"))
    $healthSummaryValidated = [bool](Get-FieldValue -Object $operatorActions -Path @("deviceNodeHealthSummaryValidated"))
    $summaryTotal = [int](Get-FieldValue -Object $operatorActions -Path @("deviceNodeSummaryTotal"))
    $summaryDegraded = [int](Get-FieldValue -Object $operatorActions -Path @("deviceNodeSummaryDegraded"))
    $summaryRecentContainsLookup = [bool](Get-FieldValue -Object $operatorActions -Path @("deviceNodeSummaryRecentContainsLookup"))

    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($deviceNodeId)) -Message "Device node lifecycle proof is missing nodeId."
    Assert-Condition -Condition ($updatedVersion -gt $createdVersion) -Message "Device node update should increment version."
    Assert-Condition -Condition ($lookupVersion -gt $updatedVersion) -Message "Device node lookup version should increase after heartbeat."
    Assert-Condition -Condition ($heartbeatStatus -eq "degraded") -Message "Device node heartbeat status should be degraded in lifecycle proof."
    Assert-Condition -Condition ($lookupStatus -eq "degraded") -Message "Device node lookup status should be degraded in lifecycle proof."
    Assert-Condition -Condition $versionConflictValidated -Message "Device node lifecycle proof requires version conflict guard validation."
    Assert-Condition -Condition $healthSummaryValidated -Message "Device node lifecycle proof requires operator health summary validation."
    Assert-Condition -Condition ($summaryTotal -ge 1) -Message "Device node lifecycle proof requires summary total >= 1."
    Assert-Condition -Condition ($summaryDegraded -ge 1) -Message "Device node lifecycle proof requires summary degraded >= 1."
    Assert-Condition -Condition $summaryRecentContainsLookup -Message "Device node lifecycle proof requires recent lookup entry."

    return [ordered]@{
      deviceNodeId = $deviceNodeId
      createdVersion = $createdVersion
      updatedVersion = $updatedVersion
      lookupVersion = $lookupVersion
      heartbeatStatus = $heartbeatStatus
      lookupStatus = $lookupStatus
      versionConflictValidated = $versionConflictValidated
      healthSummaryValidated = $healthSummaryValidated
      summaryTotal = $summaryTotal
      summaryDegraded = $summaryDegraded
      summaryRecentContainsLookup = $summaryRecentContainsLookup
    }
  } | Out-Null

  Invoke-Scenario -Name "api.approvals.list" -Action {
    $url = "http://localhost:8081/v1/approvals?sessionId=$sessionId&limit=20"
    $response = Invoke-JsonRequest -Method GET -Uri $url -TimeoutSec $RequestTimeoutSec
    $total = [int](Get-FieldValue -Object $response -Path @("total"))
    Assert-Condition -Condition ($total -ge 1) -Message "Expected at least one approval record."

    $recordsRaw = Get-FieldValue -Object $response -Path @("data")
    $records = @($recordsRaw)
    $matching = @($records | Where-Object { $_.approvalId -eq $script:UiApprovalId })
    Assert-Condition -Condition ($matching.Count -ge 1) -Message "Approval list does not include the expected approvalId."

    $latestDecision = [string]$matching[0].decision
    Assert-Condition -Condition ($latestDecision -eq "approved") -Message "Expected final approval decision to be approved."

    return [ordered]@{
      total = $total
      approvalId = $script:UiApprovalId
      latestDecision = $latestDecision
    }
  } | Out-Null

  Invoke-Scenario -Name "api.approvals.resume.invalid_intent" -Action {
    $response = Invoke-JsonRequestExpectStatus `
      -Method POST `
      -Uri "http://localhost:8081/v1/approvals/resume" `
      -Body @{
        approvalId = ("approval-invalid-intent-" + [Guid]::NewGuid().Guid)
        sessionId = $sessionId
        runId = ("run-invalid-intent-" + [Guid]::NewGuid().Guid)
        decision = "approved"
        reason = "Intent contract negative test"
        intent = "conversation"
        input = @{
          text = "should fail"
        }
      } `
      -ExpectedStatusCode 400 `
      -TimeoutSec $RequestTimeoutSec

    $parsedBody = $null
    if ($null -ne $response.body) {
      if ($response.body -is [string]) {
        try {
          $parsedBody = $response.body | ConvertFrom-Json
        } catch {
          $parsedBody = $null
        }
      } else {
        $parsedBody = $response.body
      }
    }

    if ($null -eq $parsedBody -and -not [string]::IsNullOrWhiteSpace($response.raw)) {
      try {
        $parsedBody = $response.raw | ConvertFrom-Json
      } catch {
        $parsedBody = $null
      }
    }

    $errorCode = [string](Get-FieldValue -Object $parsedBody -Path @("error", "code"))
    $errorText = [string](Get-FieldValue -Object $parsedBody -Path @("error", "message"))
    $errorTraceId = [string](Get-FieldValue -Object $parsedBody -Path @("error", "traceId"))
    Assert-Condition -Condition ($errorCode -eq "API_INVALID_INTENT") -Message "Unexpected error code for invalid intent."
    Assert-Condition -Condition ($errorText -eq "intent must be ui_task for approvals resume flow") -Message "Unexpected error message for invalid intent."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($errorTraceId)) -Message "Invalid intent error missing traceId."

    return [ordered]@{
      statusCode = [int]$response.statusCode
      code = $errorCode
      error = $errorText
      traceId = $errorTraceId
    }
  } | Out-Null

  Invoke-Scenario -Name "api.sessions.versioning" -Action {
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($sessionId)) -Message "Session versioning scenario requires a valid sessionId."

    $initialVersion = [int](Get-FieldValue -Object $sessionCreateResponse -Path @("data", "version"))
    Assert-Condition -Condition ($initialVersion -ge 1) -Message "Session create response should include version >= 1."

    $mutationId = "demo-session-versioning-" + [Guid]::NewGuid().Guid
    $pauseResponse = Invoke-JsonRequest -Method PATCH -Uri "http://localhost:8081/v1/sessions/$([System.Uri]::EscapeDataString($sessionId))" -Body @{
      status = "paused"
      expectedVersion = $initialVersion
      idempotencyKey = $mutationId
    } -TimeoutSec $RequestTimeoutSec
    $pauseSession = Get-FieldValue -Object $pauseResponse -Path @("data")
    $pauseVersion = [int](Get-FieldValue -Object $pauseSession -Path @("version"))
    $pauseStatus = [string](Get-FieldValue -Object $pauseSession -Path @("status"))
    $pauseOutcome = [string](Get-FieldValue -Object $pauseResponse -Path @("meta", "outcome"))
    Assert-Condition -Condition ($pauseVersion -gt $initialVersion) -Message "Session version should increment after pause update."
    Assert-Condition -Condition ($pauseStatus -eq "paused") -Message "Session status should become paused."
    Assert-Condition -Condition ($pauseOutcome -eq "updated") -Message "Initial session mutation should return outcome=updated."

    $replayResponse = Invoke-JsonRequest -Method PATCH -Uri "http://localhost:8081/v1/sessions/$([System.Uri]::EscapeDataString($sessionId))" -Body @{
      status = "paused"
      expectedVersion = $initialVersion
      idempotencyKey = $mutationId
    } -TimeoutSec $RequestTimeoutSec
    $replaySession = Get-FieldValue -Object $replayResponse -Path @("data")
    $replayVersion = [int](Get-FieldValue -Object $replaySession -Path @("version"))
    $replayStatus = [string](Get-FieldValue -Object $replaySession -Path @("status"))
    $replayOutcome = [string](Get-FieldValue -Object $replayResponse -Path @("meta", "outcome"))
    Assert-Condition -Condition ($replayVersion -eq $pauseVersion) -Message "Session idempotent replay should keep same version."
    Assert-Condition -Condition ($replayStatus -eq "paused") -Message "Session idempotent replay should preserve paused status."
    Assert-Condition -Condition ($replayOutcome -eq "idempotent_replay") -Message "Session idempotent replay should return outcome=idempotent_replay."

    $versionConflictResponse = Invoke-JsonRequestExpectStatus -Method PATCH -Uri "http://localhost:8081/v1/sessions/$([System.Uri]::EscapeDataString($sessionId))" -Body @{
      status = "active"
      expectedVersion = $initialVersion
      idempotencyKey = ("demo-session-version-conflict-" + [Guid]::NewGuid().Guid)
    } -ExpectedStatusCode 409 -TimeoutSec $RequestTimeoutSec
    $versionConflictCode = [string](Get-FieldValue -Object $versionConflictResponse -Path @("body", "error", "code"))
    Assert-Condition -Condition ($versionConflictCode -eq "API_SESSION_VERSION_CONFLICT") -Message "Stale expectedVersion must return API_SESSION_VERSION_CONFLICT."

    $idempotencyConflictResponse = Invoke-JsonRequestExpectStatus -Method PATCH -Uri "http://localhost:8081/v1/sessions/$([System.Uri]::EscapeDataString($sessionId))" -Body @{
      status = "active"
      idempotencyKey = $mutationId
    } -ExpectedStatusCode 409 -TimeoutSec $RequestTimeoutSec
    $idempotencyConflictCode = [string](Get-FieldValue -Object $idempotencyConflictResponse -Path @("body", "error", "code"))
    Assert-Condition -Condition ($idempotencyConflictCode -eq "API_SESSION_IDEMPOTENCY_CONFLICT") -Message "Changed payload with same idempotency key must return API_SESSION_IDEMPOTENCY_CONFLICT."

    $restoreMutationId = "demo-session-restore-" + [Guid]::NewGuid().Guid
    $restoreResponse = Invoke-JsonRequest -Method PATCH -Uri "http://localhost:8081/v1/sessions/$([System.Uri]::EscapeDataString($sessionId))" -Body @{
      status = "active"
      expectedVersion = $replayVersion
      idempotencyKey = $restoreMutationId
    } -TimeoutSec $RequestTimeoutSec
    $restoreSession = Get-FieldValue -Object $restoreResponse -Path @("data")
    $restoreVersion = [int](Get-FieldValue -Object $restoreSession -Path @("version"))
    $restoreStatus = [string](Get-FieldValue -Object $restoreSession -Path @("status"))
    $restoreOutcome = [string](Get-FieldValue -Object $restoreResponse -Path @("meta", "outcome"))
    Assert-Condition -Condition ($restoreVersion -gt $replayVersion) -Message "Session restore should increment version."
    Assert-Condition -Condition ($restoreStatus -eq "active") -Message "Session restore should return active status."
    Assert-Condition -Condition ($restoreOutcome -eq "updated") -Message "Session restore should return outcome=updated."

    return [ordered]@{
      initialVersion = $initialVersion
      pausedVersion = $pauseVersion
      pausedStatus = $pauseStatus
      idempotencyReplayOutcome = $replayOutcome
      idempotencyReplayVersion = $replayVersion
      versionConflictCode = $versionConflictCode
      idempotencyConflictCode = $idempotencyConflictCode
      restoredVersion = $restoreVersion
      restoredStatus = $restoreStatus
    }
  } | Out-Null

  Invoke-Scenario -Name "runtime.lifecycle.endpoints" -Action {
    $services = @(
      @{ name = "ui-executor"; baseUrl = "http://localhost:8090" },
      @{ name = "realtime-gateway"; baseUrl = "http://localhost:8080" },
      @{ name = "api-backend"; baseUrl = "http://localhost:8081" },
      @{ name = "orchestrator"; baseUrl = "http://localhost:8082" }
    )

    $results = @()
    $profileValidated = $true
    $analyticsValidated = $true
    $analyticsSplitTargetsValidated = $true
    $transportValidated = $true
    foreach ($service in $services) {
      $baseUrl = [string]$service.baseUrl
      $serviceName = [string]$service.name

      $healthBefore = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/healthz") -TimeoutSec $RequestTimeoutSec
      $healthBeforeOk = [bool](Get-FieldValue -Object $healthBefore -Path @("ok"))
      Assert-Condition -Condition $healthBeforeOk -Message ("Health check failed for " + $serviceName)

      $statusBefore = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/status") -TimeoutSec $RequestTimeoutSec
      $stateBefore = [string](Get-FieldValue -Object $statusBefore -Path @("runtime", "state"))
      Assert-Condition -Condition ($stateBefore -eq "ready") -Message ("Expected ready state before drain for " + $serviceName)
      $runtimeProfile = Get-FieldValue -Object $statusBefore -Path @("runtime", "profile")
      Assert-Condition -Condition ($null -ne $runtimeProfile) -Message ("Missing runtime profile in /status for " + $serviceName)
      $profileName = [string](Get-FieldValue -Object $runtimeProfile -Path @("profile"))
      $profileEnvironment = [string](Get-FieldValue -Object $runtimeProfile -Path @("environment"))
      $profileLocalFirst = [bool](Get-FieldValue -Object $runtimeProfile -Path @("localFirst"))
      Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($profileName)) -Message ("Missing runtime profile name for " + $serviceName)
      Assert-Condition -Condition (@("dev", "staging", "prod") -contains $profileEnvironment) -Message ("Invalid runtime profile environment for " + $serviceName)

      $runtimeAnalytics = Get-FieldValue -Object $statusBefore -Path @("runtime", "analytics")
      Assert-Condition -Condition ($null -ne $runtimeAnalytics) -Message ("Missing runtime analytics block in /status for " + $serviceName)
      $analyticsEnabled = [bool](Get-FieldValue -Object $runtimeAnalytics -Path @("enabled"))
      $analyticsReason = [string](Get-FieldValue -Object $runtimeAnalytics -Path @("reason"))
      $analyticsMetricsTarget = [string](Get-FieldValue -Object $runtimeAnalytics -Path @("metricsTarget"))
      $analyticsEventsTarget = [string](Get-FieldValue -Object $runtimeAnalytics -Path @("eventsTarget"))
      $analyticsSampleRate = [double](Get-FieldValue -Object $runtimeAnalytics -Path @("sampleRate"))
      Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($analyticsReason)) -Message ("Missing analytics reason in /status for " + $serviceName)
      Assert-Condition -Condition (@("disabled", "cloud_monitoring", "bigquery") -contains $analyticsMetricsTarget) -Message ("Invalid analytics metrics target for " + $serviceName)
      Assert-Condition -Condition (@("disabled", "cloud_monitoring", "bigquery") -contains $analyticsEventsTarget) -Message ("Invalid analytics events target for " + $serviceName)
      Assert-Condition -Condition ($analyticsSampleRate -ge 0 -and $analyticsSampleRate -le 1) -Message ("Invalid analytics sampleRate for " + $serviceName)
      if ($analyticsEnabled) {
        Assert-Condition -Condition ($analyticsMetricsTarget -eq "cloud_monitoring") -Message ("Enabled analytics must use cloud_monitoring metrics target for " + $serviceName)
        Assert-Condition -Condition ($analyticsEventsTarget -eq "bigquery") -Message ("Enabled analytics must use bigquery events target for " + $serviceName)
      }

      $transportRequestedMode = $null
      $transportActiveMode = $null
      $transportFallbackActive = $null
      $transportWebrtcEnabled = $null
      $transportWebrtcReady = $null
      $transportWebrtcReason = $null
      if ($serviceName -eq "realtime-gateway") {
        $runtimeTransport = Get-FieldValue -Object $statusBefore -Path @("runtime", "transport")
        Assert-Condition -Condition ($null -ne $runtimeTransport) -Message "Missing runtime transport block in /status for realtime-gateway"
        $transportRequestedMode = [string](Get-FieldValue -Object $runtimeTransport -Path @("requestedMode"))
        $transportActiveMode = [string](Get-FieldValue -Object $runtimeTransport -Path @("activeMode"))
        $transportFallbackActive = [bool](Get-FieldValue -Object $runtimeTransport -Path @("fallbackActive"))
        $transportWebrtc = Get-FieldValue -Object $runtimeTransport -Path @("webrtc")
        Assert-Condition -Condition ($null -ne $transportWebrtc) -Message "Missing runtime transport.webrtc block in /status for realtime-gateway"
        $transportWebrtcEnabled = [bool](Get-FieldValue -Object $transportWebrtc -Path @("enabled"))
        $transportWebrtcReady = [bool](Get-FieldValue -Object $transportWebrtc -Path @("ready"))
        $transportWebrtcReason = [string](Get-FieldValue -Object $transportWebrtc -Path @("reason"))

        Assert-Condition -Condition (@("websocket", "webrtc") -contains $transportRequestedMode) -Message "Invalid runtime transport requestedMode for realtime-gateway"
        Assert-Condition -Condition ($transportActiveMode -eq "websocket") -Message "MVP active transport must remain websocket for realtime-gateway"
        if ($transportRequestedMode -eq "webrtc") {
          Assert-Condition -Condition $transportFallbackActive -Message "WebRTC requested mode must surface fallbackActive=true until transport path is implemented"
          Assert-Condition -Condition (-not $transportWebrtcReady) -Message "WebRTC requested mode must report webrtc.ready=false in current MVP baseline"
          Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($transportWebrtcReason)) -Message "WebRTC requested mode must expose non-empty webrtc.reason"
        } else {
          Assert-Condition -Condition (-not $transportFallbackActive) -Message "WebSocket requested mode must keep fallbackActive=false"
        }
      }

      $versionResponse = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/version") -TimeoutSec $RequestTimeoutSec
      $version = [string](Get-FieldValue -Object $versionResponse -Path @("version"))
      Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($version)) -Message ("Version is missing for " + $serviceName)

      $drainResponse = Invoke-JsonRequest -Method POST -Uri ($baseUrl + "/drain") -Body @{} -TimeoutSec $RequestTimeoutSec
      $stateDuringDrain = [string](Get-FieldValue -Object $drainResponse -Path @("runtime", "state"))
      Assert-Condition -Condition ($stateDuringDrain -eq "draining") -Message ("Expected draining state after drain for " + $serviceName)

      $statusDuringDrain = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/status") -TimeoutSec $RequestTimeoutSec
      $drainingFlag = [bool](Get-FieldValue -Object $statusDuringDrain -Path @("runtime", "draining"))
      Assert-Condition -Condition $drainingFlag -Message ("Expected runtime.draining=true for " + $serviceName)

      $warmupResponse = Invoke-JsonRequest -Method POST -Uri ($baseUrl + "/warmup") -Body @{} -TimeoutSec $RequestTimeoutSec
      $stateAfterWarmup = [string](Get-FieldValue -Object $warmupResponse -Path @("runtime", "state"))
      Assert-Condition -Condition ($stateAfterWarmup -eq "ready") -Message ("Expected ready state after warmup for " + $serviceName)

      $healthAfter = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/healthz") -TimeoutSec $RequestTimeoutSec
      $healthAfterOk = [bool](Get-FieldValue -Object $healthAfter -Path @("ok"))
      Assert-Condition -Condition $healthAfterOk -Message ("Health check failed after warmup for " + $serviceName)

      $results += [ordered]@{
        name = $serviceName
        version = $version
        runtimeProfile = $profileName
        runtimeEnvironment = $profileEnvironment
        runtimeLocalFirst = $profileLocalFirst
        analyticsEnabled = $analyticsEnabled
        analyticsReason = $analyticsReason
        analyticsMetricsTarget = $analyticsMetricsTarget
        analyticsEventsTarget = $analyticsEventsTarget
        analyticsSampleRate = $analyticsSampleRate
        transportRequestedMode = $transportRequestedMode
        transportActiveMode = $transportActiveMode
        transportFallbackActive = $transportFallbackActive
        transportWebrtcEnabled = $transportWebrtcEnabled
        transportWebrtcReady = $transportWebrtcReady
        transportWebrtcReason = $transportWebrtcReason
        stateBefore = $stateBefore
        stateDuringDrain = $stateDuringDrain
        stateAfterWarmup = $stateAfterWarmup
      }

      if ([string]::IsNullOrWhiteSpace($profileName)) {
        $profileValidated = $false
      }
      if ([string]::IsNullOrWhiteSpace($analyticsReason)) {
        $analyticsValidated = $false
      }
      if ($analyticsEnabled -and ($analyticsMetricsTarget -ne "cloud_monitoring" -or $analyticsEventsTarget -ne "bigquery")) {
        $analyticsSplitTargetsValidated = $false
      }
      if ($serviceName -eq "realtime-gateway" -and [string]::IsNullOrWhiteSpace($transportActiveMode)) {
        $transportValidated = $false
      }
    }

    $gatewayTransport = $results | Where-Object { $_.name -eq "realtime-gateway" } | Select-Object -First 1

    return [ordered]@{
      services = $results
      count = $results.Count
      profileValidated = $profileValidated
      analyticsValidated = $analyticsValidated
      analyticsSplitTargetsValidated = $analyticsSplitTargetsValidated
      transportValidated = $transportValidated
      analyticsServices = (@($results | Where-Object { -not [string]::IsNullOrWhiteSpace($_.analyticsReason) })).Count
      analyticsEnabledServices = (@($results | Where-Object { $_.analyticsEnabled -eq $true })).Count
      transportServices = (@($results | Where-Object { -not [string]::IsNullOrWhiteSpace($_.transportActiveMode) })).Count
      gatewayTransportRequestedMode = if ($null -ne $gatewayTransport) { $gatewayTransport.transportRequestedMode } else { $null }
      gatewayTransportActiveMode = if ($null -ne $gatewayTransport) { $gatewayTransport.transportActiveMode } else { $null }
      gatewayTransportFallbackActive = if ($null -ne $gatewayTransport) { $gatewayTransport.transportFallbackActive } else { $null }
      localFirstServices = (@($results | Where-Object { $_.runtimeLocalFirst -eq $true })).Count
    }
  } | Out-Null

  Invoke-Scenario -Name "runtime.metrics.endpoints" -Action {
    $services = @(
      @{ name = "ui-executor"; baseUrl = "http://localhost:8090" },
      @{ name = "realtime-gateway"; baseUrl = "http://localhost:8080" },
      @{ name = "api-backend"; baseUrl = "http://localhost:8081" },
      @{ name = "orchestrator"; baseUrl = "http://localhost:8082" }
    )

    $results = @()
    foreach ($service in $services) {
      $baseUrl = [string]$service.baseUrl
      $serviceName = [string]$service.name

      $response = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/metrics") -TimeoutSec $RequestTimeoutSec
      $ok = [bool](Get-FieldValue -Object $response -Path @("ok"))
      Assert-Condition -Condition $ok -Message ("Metrics endpoint failed for " + $serviceName)

      $totalCount = [int](Get-FieldValue -Object $response -Path @("metrics", "totalCount"))
      Assert-Condition -Condition ($totalCount -ge 1) -Message ("Metrics totalCount must be >= 1 for " + $serviceName)

      $errorRate = [double](Get-FieldValue -Object $response -Path @("metrics", "errorRatePct"))
      Assert-Condition -Condition ($errorRate -ge 0) -Message ("Metrics errorRatePct must be >= 0 for " + $serviceName)

      $p95 = [double](Get-FieldValue -Object $response -Path @("metrics", "latencyMs", "p95"))
      Assert-Condition -Condition ($p95 -ge 0) -Message ("Metrics latency p95 must be >= 0 for " + $serviceName)

      $operations = @(Get-FieldValue -Object $response -Path @("metrics", "operations"))
      Assert-Condition -Condition ($operations.Count -ge 1) -Message ("Metrics operations list is empty for " + $serviceName)

      $results += [ordered]@{
        name = $serviceName
        totalCount = $totalCount
        errorRatePct = $errorRate
        p95Ms = $p95
        operations = $operations.Count
      }
    }

    $maxP95 = ($results | ForEach-Object { [double]$_.p95Ms } | Measure-Object -Maximum).Maximum
    return [ordered]@{
      services = $results
      count = $results.Count
      maxP95Ms = [int]$maxP95
    }
  } | Out-Null

  $failedScenarios = @($script:ScenarioResults | Where-Object { $_.status -ne "passed" })
  $overallSuccess = ($failedScenarios.Count -eq 0)
} catch {
  $fatalError = $_.Exception.Message
  $overallSuccess = $false
} finally {
  if ((-not $SkipServiceStart) -and (-not $KeepServices)) {
    Stop-ManagedServices
  } elseif ($KeepServices) {
    Write-Step "KeepServices enabled, managed services left running."
  }
}

$translationData = Get-ScenarioData -Name "live.translation"
$negotiationData = Get-ScenarioData -Name "live.negotiation"
$storyData = Get-ScenarioData -Name "storyteller.pipeline"
$uiApproveData = Get-ScenarioData -Name "ui.approval.approve_resume"
$uiSandboxData = Get-ScenarioData -Name "ui.sandbox.policy_modes"
$uiVisualTestingData = Get-ScenarioData -Name "ui.visual_testing"
$delegationData = Get-ScenarioData -Name "multi_agent.delegation"
$gatewayWsData = Get-ScenarioData -Name "gateway.websocket.roundtrip"
$gatewayWsTaskData = Get-ScenarioData -Name "gateway.websocket.task_progress"
$gatewayWsReplayData = Get-ScenarioData -Name "gateway.websocket.request_replay"
$gatewayWsInterruptData = Get-ScenarioData -Name "gateway.websocket.interrupt_signal"
$gatewayWsInvalidData = Get-ScenarioData -Name "gateway.websocket.invalid_envelope"
$gatewayWsBindingMismatchData = Get-ScenarioData -Name "gateway.websocket.binding_mismatch"
$gatewayWsDrainingData = Get-ScenarioData -Name "gateway.websocket.draining_rejection"
$operatorActionsData = Get-ScenarioData -Name "operator.console.actions"
$approvalsListData = Get-ScenarioData -Name "api.approvals.list"
$approvalsInvalidIntentData = Get-ScenarioData -Name "api.approvals.resume.invalid_intent"
$sessionVersioningData = Get-ScenarioData -Name "api.sessions.versioning"
$runtimeLifecycleData = Get-ScenarioData -Name "runtime.lifecycle.endpoints"
$runtimeMetricsData = Get-ScenarioData -Name "runtime.metrics.endpoints"
$uiVisualTestingScenario = @($script:ScenarioResults | Where-Object { $_.name -eq "ui.visual_testing" } | Select-Object -First 1)
$operatorActionsScenario = @($script:ScenarioResults | Where-Object { $_.name -eq "operator.console.actions" } | Select-Object -First 1)
$scenarioRetriedSet = @($script:ScenarioResults | Where-Object { [bool]$_.retried })
$scenarioRetryableFailuresTotal = @($script:ScenarioResults | ForEach-Object { [int]$_.retryableFailureCount } | Measure-Object -Sum).Sum
$uiExecutorService = $script:ServiceStatuses | Where-Object { $_.name -eq "ui-executor" } | Select-Object -First 1
$uiExecutorLifecycleService = $null
if ($null -ne $runtimeLifecycleData) {
  $uiExecutorLifecycleService = @($runtimeLifecycleData.services | Where-Object { $_.name -eq "ui-executor" }) | Select-Object -First 1
}

$summary = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  success = $overallSuccess
  fatalError = $fatalError
  environment = [ordered]@{
    repoRoot = $script:RepoRoot
    powershellVersion = $PSVersionTable.PSVersion.ToString()
    nodeVersion = $nodeVersion
  }
  options = [ordered]@{
    skipBuild = [bool]$SkipBuild
    skipServiceStart = [bool]$SkipServiceStart
    includeFrontend = [bool]$IncludeFrontend
    keepServices = [bool]$KeepServices
    startupTimeoutSec = $StartupTimeoutSec
    requestTimeoutSec = $RequestTimeoutSec
    scenarioRetryMaxAttempts = $ScenarioRetryMaxAttempts
    scenarioRetryBackoffMs = $ScenarioRetryBackoffMs
    uiNavigatorRemoteHttpFallbackMode = [Environment]::GetEnvironmentVariable("UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE")
    serviceStartMaxAttempts = [Environment]::GetEnvironmentVariable("DEMO_E2E_SERVICE_START_MAX_ATTEMPTS")
    serviceStartRetryBackoffMs = [Environment]::GetEnvironmentVariable("DEMO_E2E_SERVICE_START_RETRY_BACKOFF_MS")
  }
  session = [ordered]@{
    sessionId = $sessionId
    createResponse = $sessionCreateResponse
  }
  services = $script:ServiceStatuses
  scenarios = $script:ScenarioResults
  kpis = [ordered]@{
    translationProvider = if ($null -ne $translationData) { $translationData.provider } else { $null }
    negotiationConstraintsSatisfied = if ($null -ne $negotiationData) { $negotiationData.allSatisfied } else { $null }
    negotiationRequiresUserConfirmation = if ($null -ne $negotiationData) { $negotiationData.requiresUserConfirmation } else { $null }
    storytellerFallbackAsset = if ($null -ne $storyData) { $storyData.fallbackAsset } else { $null }
    storytellerMediaMode = if ($null -ne $storyData) { $storyData.mediaMode } else { $null }
    storytellerVideoAsync = if ($null -ne $storyData) { $storyData.videoAsync } else { $null }
    storytellerVideoJobsCount = if ($null -ne $storyData) { $storyData.videoJobsCount } else { $null }
    storytellerVideoPendingCount = if ($null -ne $storyData) { $storyData.videoPendingCount } else { $null }
    storytellerMediaQueueBacklog = if ($null -ne $storyData) { $storyData.mediaQueueBacklog } else { $null }
    storytellerMediaQueueWorkers = if ($null -ne $storyData) { $storyData.mediaQueueWorkers } else { $null }
    storytellerMediaQueueRuntimeEnabled = if ($null -ne $storyData) { $storyData.mediaQueueRuntimeEnabled } else { $null }
    storytellerMediaQueueQuotaEntries = if ($null -ne $storyData) { $storyData.mediaQueueQuotaEntries } else { $null }
    storytellerMediaQueueQuotaModelSeen = if ($null -ne $storyData) { $storyData.mediaQueueQuotaModelSeen } else { $null }
    storytellerMediaQueueVisible = if (
      $null -ne $storyData -and
      [int]$storyData.mediaQueueBacklog -ge 0 -and
      [int]$storyData.mediaQueueWorkers -ge 1 -and
      $storyData.mediaQueueRuntimeEnabled -eq $true
    ) { $true } else { $false }
    storytellerMediaQueueQuotaValidated = if (
      $null -ne $storyData -and
      [int]$storyData.mediaQueueQuotaEntries -ge 1 -and
      $storyData.mediaQueueQuotaModelSeen -eq $true
    ) { $true } else { $false }
    storytellerCacheEnabled = if ($null -ne $storyData) { $storyData.cacheEnabled } else { $null }
    storytellerCacheHits = if ($null -ne $storyData) { $storyData.cacheHits } else { $null }
    storytellerCacheEntries = if ($null -ne $storyData) { $storyData.cacheEntries } else { $null }
    storytellerCacheInvalidationValidated = if ($null -ne $storyData) { $storyData.cacheInvalidationValidated } else { $null }
    storytellerCacheHitValidated = if (
      $null -ne $storyData -and
      $storyData.cacheEnabled -eq $true -and
      [int]$storyData.cacheHits -ge 1 -and
      [int]$storyData.cacheEntries -ge 1
    ) { $true } else { $false }
    storytellerVideoAsyncValidated = if (
      $null -ne $storyData -and
      $storyData.mediaMode -eq "simulated" -and
      $storyData.videoAsync -eq $true -and
      [int]$storyData.videoJobsCount -ge 1 -and
      [int]$storyData.videoPendingCount -ge 1
    ) { $true } else { $false }
    uiAdapterMode = if ($null -ne $uiApproveData) { $uiApproveData.adapterMode } else { $null }
    uiAdapterRetries = if ($null -ne $uiApproveData) { $uiApproveData.retries } else { $null }
    uiExecutorMode = if ($null -ne $uiExecutorService) { Get-FieldValue -Object $uiExecutorService -Path @("health", "mode") } else { $null }
    uiExecutorForceSimulation = if ($null -ne $uiExecutorService) { Get-FieldValue -Object $uiExecutorService -Path @("health", "forceSimulation") } else { $null }
    uiExecutorRuntimeValidated = if (
      $null -ne $uiExecutorService -and
      [string](Get-FieldValue -Object $uiExecutorService -Path @("health", "mode")) -eq "remote_http" -and
      [bool](Get-FieldValue -Object $uiExecutorService -Path @("health", "forceSimulation")) -eq $true
    ) { $true } else { $false }
    uiExecutorLifecycleValidated = if (
      $null -ne $uiExecutorLifecycleService -and
      [string](Get-FieldValue -Object $uiExecutorLifecycleService -Path @("stateBefore")) -eq "ready" -and
      [string](Get-FieldValue -Object $uiExecutorLifecycleService -Path @("stateDuringDrain")) -eq "draining" -and
      [string](Get-FieldValue -Object $uiExecutorLifecycleService -Path @("stateAfterWarmup")) -eq "ready" -and
      -not [string]::IsNullOrWhiteSpace([string](Get-FieldValue -Object $uiExecutorLifecycleService -Path @("runtimeProfile"))) -and
      -not [string]::IsNullOrWhiteSpace([string](Get-FieldValue -Object $uiExecutorLifecycleService -Path @("version")))
    ) { $true } else { $false }
    uiApprovalResumeRequestAttempts = if ($null -ne $uiApproveData) { $uiApproveData.requestAttempts } else { $null }
    uiApprovalResumeRequestRetried = if ($null -ne $uiApproveData) { $uiApproveData.requestRetried } else { $null }
    sandboxPolicyMode = if ($null -ne $uiSandboxData) { $uiSandboxData.sandboxMode } else { $null }
    sandboxPolicyActive = if ($null -ne $uiSandboxData) { $uiSandboxData.sandboxActive } else { $null }
    sandboxPolicyReason = if ($null -ne $uiSandboxData) { $uiSandboxData.sandboxReason } else { $null }
    sandboxPolicyBlockedCategories = if ($null -ne $uiSandboxData) { $uiSandboxData.blockedCategories } else { @() }
    sandboxPolicyExecutionStatus = if ($null -ne $uiSandboxData) { $uiSandboxData.executionFinalStatus } else { $null }
    sandboxPolicyValidated = if (
      $null -ne $uiSandboxData -and
      [string]$uiSandboxData.status -eq "failed" -and
      [bool]$uiSandboxData.sandboxActive -eq $true -and
      [string]$uiSandboxData.sandboxMode -eq "all" -and
      [string]$uiSandboxData.executionFinalStatus -eq "failed_sandbox_policy"
    ) { $true } else { $false }
    visualTestingStatus = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.reportStatus } else { $null }
    visualChecksCount = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.checksCount } else { $null }
    visualRegressionCount = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.regressionCount } else { $null }
    visualComparatorMode = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.comparatorMode } else { $null }
    uiGroundingDomSeen = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.groundingDomSeen } else { $null }
    uiGroundingAccessibilitySeen = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.groundingAccessibilitySeen } else { $null }
    uiGroundingMarkHintsCount = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.groundingMarkHintsCount } else { $null }
    uiGroundingAdapterNoteSeen = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.groundingAdapterNoteSeen } else { $null }
    uiGroundingSignalsValidated = if (
      $null -ne $uiVisualTestingData -and
      [bool]$uiVisualTestingData.groundingDomSeen -eq $true -and
      [bool]$uiVisualTestingData.groundingAccessibilitySeen -eq $true -and
      [int]$uiVisualTestingData.groundingMarkHintsCount -ge 2 -and
      [bool]$uiVisualTestingData.groundingAdapterNoteSeen -eq $true
    ) { $true } else { $false }
    visualTestingValidated = if (
      $null -ne $uiVisualTestingData -and
      $uiVisualTestingData.reportStatus -eq "passed" -and
      [int]$uiVisualTestingData.checksCount -ge 3 -and
      [int]$uiVisualTestingData.regressionCount -eq 0
    ) { $true } else { $false }
    scenarioRetriesUsedCount = $scenarioRetriedSet.Count
    scenarioRetriesUsedNames = @($scenarioRetriedSet | ForEach-Object { [string]$_.name })
    scenarioRetryableFailuresTotal = [int]$scenarioRetryableFailuresTotal
    uiVisualTestingScenarioAttempts = if ($uiVisualTestingScenario.Count -gt 0) { [int]$uiVisualTestingScenario[0].attempts } else { $null }
    operatorConsoleActionsScenarioAttempts = if ($operatorActionsScenario.Count -gt 0) { [int]$operatorActionsScenario[0].attempts } else { $null }
    delegatedRoute = if ($null -ne $delegationData) { $delegationData.delegatedRoute } else { $null }
    assistiveRouterMode = if ($null -ne $delegationData) { $delegationData.routingMode } else { $null }
    assistiveRouterReason = if ($null -ne $delegationData) { $delegationData.routingReason } else { $null }
    assistiveRouterRoute = if ($null -ne $delegationData) { $delegationData.routingRoute } else { $null }
    assistiveRouterConfidence = if ($null -ne $delegationData) { $delegationData.routingConfidence } else { $null }
    assistiveRouterDiagnosticsValidated = if (
      $null -ne $delegationData -and
      @("deterministic", "assistive_override", "assistive_match", "assistive_fallback") -contains [string]$delegationData.routingMode -and
      -not [string]::IsNullOrWhiteSpace([string]$delegationData.routingReason) -and
      -not [string]::IsNullOrWhiteSpace([string]$delegationData.routingRoute) -and
      (
        $null -eq $delegationData.routingConfidence -or
        (
          [double]$delegationData.routingConfidence -ge 0 -and
          [double]$delegationData.routingConfidence -le 1
        )
      )
    ) { $true } else { $false }
    gatewayWsRoundTripMs = if ($null -ne $gatewayWsData) { $gatewayWsData.roundTripMs } else { $null }
    gatewayWsResponseStatus = if ($null -ne $gatewayWsData) { $gatewayWsData.responseStatus } else { $null }
    sessionRunBindingValidated = if ($null -ne $gatewayWsData) { $gatewayWsData.contextValidated } else { $false }
    sessionStateTransitionsObserved = if ($null -ne $gatewayWsData) { $gatewayWsData.sessionStateCount } else { $null }
    taskProgressEventsObserved = if ($null -ne $gatewayWsTaskData) { $gatewayWsTaskData.taskProgressCount } else { $null }
    activeTasksVisible = if ($null -ne $gatewayWsTaskData) { $gatewayWsTaskData.activeTaskCount } else { $null }
    gatewayRequestReplayEventCount = if ($null -ne $gatewayWsReplayData) { $gatewayWsReplayData.replayEventCount } else { $null }
    gatewayRequestReplayTaskStartedCount = if ($null -ne $gatewayWsReplayData) { $gatewayWsReplayData.taskStartedCount } else { $null }
    gatewayRequestReplayResponseIdReused = if ($null -ne $gatewayWsReplayData) { $gatewayWsReplayData.responseIdReused } else { $false }
    gatewayRequestReplayValidated = if (
      $null -ne $gatewayWsReplayData -and
      [int]$gatewayWsReplayData.replayEventCount -ge 1 -and
      [int]$gatewayWsReplayData.taskStartedCount -eq 1 -and
      [bool]$gatewayWsReplayData.responseIdReused -eq $true
    ) { $true } else { $false }
    gatewayInterruptEventType = if ($null -ne $gatewayWsInterruptData) { $gatewayWsInterruptData.interruptEventType } else { $null }
    gatewayInterruptHandled = if ($null -ne $gatewayWsInterruptData) { $true } else { $false }
    gatewayInterruptLatencyMs = if ($null -ne $gatewayWsInterruptData) { $gatewayWsInterruptData.interruptLatencyMs } else { $null }
    gatewayInterruptLatencySource = if ($null -ne $gatewayWsInterruptData) { $gatewayWsInterruptData.interruptLatencySource } else { $null }
    gatewayInterruptLatencyMeasured = if ($null -ne $gatewayWsInterruptData) { $gatewayWsInterruptData.interruptLatencyMeasured } else { $false }
    gatewayWsInvalidEnvelopeCode = if ($null -ne $gatewayWsInvalidData) { $gatewayWsInvalidData.code } else { $null }
    gatewayWsSessionMismatchCode = if ($null -ne $gatewayWsBindingMismatchData) { $gatewayWsBindingMismatchData.sessionMismatchCode } else { $null }
    gatewayWsUserMismatchCode = if ($null -ne $gatewayWsBindingMismatchData) { $gatewayWsBindingMismatchData.userMismatchCode } else { $null }
    gatewayWsBindingMismatchValidated = if (
      $null -ne $gatewayWsBindingMismatchData -and
      [string]$gatewayWsBindingMismatchData.firstResponseStatus -eq "completed" -and
      [string]$gatewayWsBindingMismatchData.sessionMismatchCode -eq "GATEWAY_SESSION_MISMATCH" -and
      -not [string]::IsNullOrWhiteSpace([string]$gatewayWsBindingMismatchData.sessionMismatchTraceId) -and
      [string]$gatewayWsBindingMismatchData.userMismatchCode -eq "GATEWAY_USER_MISMATCH" -and
      -not [string]::IsNullOrWhiteSpace([string]$gatewayWsBindingMismatchData.userMismatchTraceId)
    ) { $true } else { $false }
    gatewayWsDrainingCode = if ($null -ne $gatewayWsDrainingData) { $gatewayWsDrainingData.drainingCode } else { $null }
    gatewayWsDrainingTraceIdPresent = if ($null -ne $gatewayWsDrainingData) { $gatewayWsDrainingData.drainingTraceIdPresent } else { $false }
    gatewayWsDrainingRecoveryStatus = if ($null -ne $gatewayWsDrainingData) { $gatewayWsDrainingData.recoveryStatus } else { $null }
    gatewayWsDrainingValidated = if (
      $null -ne $gatewayWsDrainingData -and
      [string]$gatewayWsDrainingData.drainingCode -eq "GATEWAY_DRAINING" -and
      [bool]$gatewayWsDrainingData.drainingTraceIdPresent -eq $true -and
      [string]$gatewayWsDrainingData.recoveryStatus -eq "completed" -and
      [string]$gatewayWsDrainingData.drainState -eq "draining" -and
      [string]$gatewayWsDrainingData.warmupState -eq "ready"
    ) { $true } else { $false }
    operatorSummaryActiveTasks = if ($null -ne $operatorActionsData) { $operatorActionsData.summaryActiveTasks } else { $null }
    operatorCancelStatus = if ($null -ne $operatorActionsData) { $operatorActionsData.cancelStatus } else { $null }
    operatorRetryStatus = if ($null -ne $operatorActionsData) { $operatorActionsData.retryStatus } else { $null }
    operatorFailoverForbiddenCode = if ($null -ne $operatorActionsData) { $operatorActionsData.forbiddenCode } else { $null }
    operatorFailoverDrainState = if ($null -ne $operatorActionsData) { $operatorActionsData.drainState } else { $null }
    operatorFailoverWarmupState = if ($null -ne $operatorActionsData) { $operatorActionsData.warmupState } else { $null }
    operatorFailoverUiExecutorDrainState = if ($null -ne $operatorActionsData) { $operatorActionsData.uiExecutorDrainState } else { $null }
    operatorFailoverUiExecutorWarmupState = if ($null -ne $operatorActionsData) { $operatorActionsData.uiExecutorWarmupState } else { $null }
    operatorFailoverUiExecutorValidated = if ($null -ne $operatorActionsData) { $operatorActionsData.uiExecutorFailoverValidated } else { $false }
    operatorAuditTotal = if ($null -ne $operatorActionsData) { $operatorActionsData.operatorAuditTotal } else { $null }
    operatorTraceRuns = if ($null -ne $operatorActionsData) { $operatorActionsData.traceRuns } else { $null }
    operatorTraceEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.traceEvents } else { $null }
    operatorTraceUiRuns = if ($null -ne $operatorActionsData) { $operatorActionsData.traceUiRuns } else { $null }
    operatorTraceApprovals = if ($null -ne $operatorActionsData) { $operatorActionsData.traceApprovals } else { $null }
    operatorTraceScreenshots = if ($null -ne $operatorActionsData) { $operatorActionsData.traceScreenshots } else { $null }
    operatorLiveBridgeHealthState = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthState } else { $null }
    operatorLiveBridgeHealthDegradedEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthDegradedEvents } else { $null }
    operatorLiveBridgeHealthRecoveredEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthRecoveredEvents } else { $null }
    operatorLiveBridgeHealthWatchdogReconnectEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthWatchdogReconnectEvents } else { $null }
    operatorLiveBridgeHealthBridgeErrorEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthBridgeErrorEvents } else { $null }
    operatorLiveBridgeHealthUnavailableEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthUnavailableEvents } else { $null }
    operatorLiveBridgeHealthConnectTimeoutEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthConnectTimeoutEvents } else { $null }
    operatorLiveBridgeHealthProbeStartedEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthProbeStartedEvents } else { $null }
    operatorLiveBridgeHealthPingSentEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthPingSentEvents } else { $null }
    operatorLiveBridgeHealthPongEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthPongEvents } else { $null }
    operatorLiveBridgeHealthPingErrorEvents = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthPingErrorEvents } else { $null }
    operatorLiveBridgeHealthLastEventType = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthLastEventType } else { $null }
    operatorTaskQueueTotal = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueTotal } else { $null }
    operatorTaskQueueQueued = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueQueued } else { $null }
    operatorTaskQueueRunning = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueRunning } else { $null }
    operatorTaskQueuePendingApproval = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueuePendingApproval } else { $null }
    operatorTaskQueueOther = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueOther } else { $null }
    operatorTaskQueueStaleCount = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueStaleCount } else { $null }
    operatorTaskQueueStaleThresholdMs = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueStaleThresholdMs } else { $null }
    operatorTaskQueueMaxAgeMs = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueueMaxAgeMs } else { $null }
    operatorTaskQueuePressureLevel = if ($null -ne $operatorActionsData) { $operatorActionsData.taskQueuePressureLevel } else { $null }
    operatorTaskQueueSummaryValidated = if (
      $null -ne $operatorActionsData -and
      [bool]$operatorActionsData.taskQueueSummaryValidated -eq $true -and
      [int]$operatorActionsData.taskQueueTotal -ge 1 -and
      [int]$operatorActionsData.taskQueueStaleCount -ge 0 -and
      [int]$operatorActionsData.taskQueueStaleThresholdMs -gt 0 -and
      [int]$operatorActionsData.taskQueueMaxAgeMs -ge 0 -and
      @("idle", "healthy", "elevated") -contains [string]$operatorActionsData.taskQueuePressureLevel
    ) { $true } else { $false }
    operatorDeviceNodeId = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeId } else { $null }
    operatorDeviceNodeCreatedVersion = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeCreatedVersion } else { $null }
    operatorDeviceNodeUpdatedVersion = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeUpdatedVersion } else { $null }
    operatorDeviceNodeUpdatedStatus = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeUpdatedStatus } else { $null }
    operatorDeviceNodeHeartbeatStatus = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeHeartbeatStatus } else { $null }
    operatorDeviceNodeLookupStatus = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeLookupStatus } else { $null }
    operatorDeviceNodeLookupVersion = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeLookupVersion } else { $null }
    operatorDeviceNodeLookupLastSeenAt = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeLookupLastSeenAt } else { $null }
    operatorDeviceNodeVersionConflictStatusCode = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeVersionConflictStatusCode } else { $null }
    operatorDeviceNodeVersionConflictCode = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeVersionConflictCode } else { $null }
    operatorDeviceNodeVersionConflictExpectedVersion = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeVersionConflictExpectedVersion } else { $null }
    operatorDeviceNodeVersionConflictActualVersion = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeVersionConflictActualVersion } else { $null }
    operatorDeviceNodeSummaryTotal = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeSummaryTotal } else { $null }
    operatorDeviceNodeSummaryDegraded = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeSummaryDegraded } else { $null }
    operatorDeviceNodeSummaryStale = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeSummaryStale } else { $null }
    operatorDeviceNodeSummaryMissingHeartbeat = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeSummaryMissingHeartbeat } else { $null }
    operatorDeviceNodeSummaryRecentContainsLookup = if ($null -ne $operatorActionsData) { $operatorActionsData.deviceNodeSummaryRecentContainsLookup } else { $false }
    operatorLiveBridgeHealthBlockValidated = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthBlockValidated } else { $false }
    operatorLiveBridgeProbeTelemetryValidated = if ($null -ne $operatorActionsData) { $operatorActionsData.liveBridgeHealthProbeTelemetryValidated } else { $false }
    operatorDeviceNodeLookupValidated = if (
      $null -ne $operatorActionsData -and
      [bool]$operatorActionsData.deviceNodeLookupValidated -eq $true -and
      -not [string]::IsNullOrWhiteSpace([string]$operatorActionsData.deviceNodeId) -and
      [int]$operatorActionsData.deviceNodeUpdatedVersion -gt [int]$operatorActionsData.deviceNodeCreatedVersion -and
      [string]$operatorActionsData.deviceNodeUpdatedStatus -eq "online" -and
      [string]$operatorActionsData.deviceNodeHeartbeatStatus -eq "degraded" -and
      [string]$operatorActionsData.deviceNodeLookupStatus -eq "degraded" -and
      [int]$operatorActionsData.deviceNodeLookupVersion -gt [int]$operatorActionsData.deviceNodeUpdatedVersion -and
      -not [string]::IsNullOrWhiteSpace([string]$operatorActionsData.deviceNodeLookupLastSeenAt)
    ) { $true } else { $false }
    operatorDeviceNodeVersionConflictValidated = if (
      $null -ne $operatorActionsData -and
      [bool]$operatorActionsData.deviceNodeVersionConflictValidated -eq $true -and
      [int]$operatorActionsData.deviceNodeVersionConflictStatusCode -eq 409 -and
      [string]$operatorActionsData.deviceNodeVersionConflictCode -eq "API_DEVICE_NODE_VERSION_CONFLICT" -and
      [int]$operatorActionsData.deviceNodeVersionConflictExpectedVersion -eq [int]$operatorActionsData.deviceNodeCreatedVersion -and
      [int]$operatorActionsData.deviceNodeVersionConflictActualVersion -ge [int]$operatorActionsData.deviceNodeUpdatedVersion
    ) { $true } else { $false }
    operatorDeviceNodeHealthSummaryValidated = if (
      $null -ne $operatorActionsData -and
      [bool]$operatorActionsData.deviceNodeHealthSummaryValidated -eq $true -and
      [int]$operatorActionsData.deviceNodeSummaryTotal -ge 1 -and
      [int]$operatorActionsData.deviceNodeSummaryDegraded -ge 1 -and
      [int]$operatorActionsData.deviceNodeSummaryStale -ge 0 -and
      [int]$operatorActionsData.deviceNodeSummaryMissingHeartbeat -ge 0 -and
      [bool]$operatorActionsData.deviceNodeSummaryRecentContainsLookup -eq $true
    ) { $true } else { $false }
    operatorAuditTrailValidated = if (
      $null -ne $operatorActionsData -and
      [int]$operatorActionsData.operatorAuditTotal -ge 4
    ) { $true } else { $false }
    operatorTraceCoverageValidated = if (
      $null -ne $operatorActionsData -and
      [int]$operatorActionsData.traceRuns -ge 1 -and
      [int]$operatorActionsData.traceApprovals -ge 1
    ) { $true } else { $false }
    operatorActionsValidated = if (
      $null -ne $operatorActionsData -and
      [int]$operatorActionsData.summaryActiveTasks -ge 1 -and
      [string]$operatorActionsData.cancelStatus -eq "failed" -and
      [string]$operatorActionsData.retryStatus -eq "queued" -and
      [string]$operatorActionsData.forbiddenCode -eq "API_OPERATOR_ADMIN_REQUIRED" -and
      [string]$operatorActionsData.drainState -eq "draining" -and
      [string]$operatorActionsData.warmupState -eq "ready"
    ) { $true } else { $false }
    approvalsRecorded = if ($null -ne $approvalsListData) { $approvalsListData.total } else { $null }
    approvalsInvalidIntentStatusCode = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.statusCode } else { $null }
    approvalsInvalidIntentCode = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.code } else { $null }
    approvalsInvalidIntentTraceId = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.traceId } else { $null }
    sessionVersionConflictCode = if ($null -ne $sessionVersioningData) { $sessionVersioningData.versionConflictCode } else { $null }
    sessionIdempotencyReplayOutcome = if ($null -ne $sessionVersioningData) { $sessionVersioningData.idempotencyReplayOutcome } else { $null }
    sessionIdempotencyConflictCode = if ($null -ne $sessionVersioningData) { $sessionVersioningData.idempotencyConflictCode } else { $null }
    sessionStatusRestored = if ($null -ne $sessionVersioningData) { $sessionVersioningData.restoredStatus } else { $null }
    sessionVersioningValidated = if (
      $null -ne $sessionVersioningData -and
      [int]$sessionVersioningData.pausedVersion -gt [int]$sessionVersioningData.initialVersion -and
      [string]$sessionVersioningData.pausedStatus -eq "paused" -and
      [string]$sessionVersioningData.idempotencyReplayOutcome -eq "idempotent_replay" -and
      [string]$sessionVersioningData.versionConflictCode -eq "API_SESSION_VERSION_CONFLICT" -and
      [string]$sessionVersioningData.idempotencyConflictCode -eq "API_SESSION_IDEMPOTENCY_CONFLICT" -and
      [string]$sessionVersioningData.restoredStatus -eq "active" -and
      [int]$sessionVersioningData.restoredVersion -gt [int]$sessionVersioningData.idempotencyReplayVersion
    ) { $true } else { $false }
    lifecycleEndpointsValidated = if ($null -ne $runtimeLifecycleData) { $true } else { $false }
    runtimeProfileValidated = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.profileValidated } else { $false }
    analyticsRuntimeVisible = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.analyticsValidated } else { $false }
    analyticsServicesValidated = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.analyticsServices } else { $null }
    analyticsSplitTargetsValidated = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.analyticsSplitTargetsValidated } else { $false }
    analyticsEnabledServices = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.analyticsEnabledServices } else { $null }
    transportModeValidated = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.transportValidated } else { $false }
    transportServicesValidated = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.transportServices } else { $null }
    gatewayTransportRequestedMode = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.gatewayTransportRequestedMode } else { $null }
    gatewayTransportActiveMode = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.gatewayTransportActiveMode } else { $null }
    gatewayTransportFallbackActive = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.gatewayTransportFallbackActive } else { $null }
    runtimeLocalFirstServices = if ($null -ne $runtimeLifecycleData) { $runtimeLifecycleData.localFirstServices } else { $null }
    metricsEndpointsValidated = if ($null -ne $runtimeMetricsData) { $true } else { $false }
    metricsServicesValidated = if ($null -ne $runtimeMetricsData) { $runtimeMetricsData.count } else { $null }
    capabilityAdaptersValidated = if (
      $null -ne $translationData -and
      -not [string]::IsNullOrWhiteSpace([string]$translationData.liveAdapterId) -and
      -not [string]::IsNullOrWhiteSpace([string]$translationData.reasoningAdapterId) -and
      $null -ne $storyData -and
      -not [string]::IsNullOrWhiteSpace([string]$storyData.imageAdapterId) -and
      -not [string]::IsNullOrWhiteSpace([string]$storyData.ttsAdapterId) -and
      $null -ne $uiApproveData -and
      -not [string]::IsNullOrWhiteSpace([string]$uiApproveData.computerUseAdapterId)
    ) { $true } else { $false }
  }
  artifacts = [ordered]@{
    summaryJsonPath = $resolvedOutputPath
    summaryMarkdownPath = $resolvedMarkdownPath
  }
}

($summary | ConvertTo-Json -Depth 60) | Set-Content -Path $resolvedOutputPath -Encoding UTF8

Write-Step "Summary written: $resolvedOutputPath"
$reportResult = Invoke-NodeJsonCommand -Args @(
  "scripts/demo-e2e-report.mjs",
  "--input",
  $resolvedOutputPath,
  "--output",
  $resolvedMarkdownPath
)
Write-Step ("Markdown report written: " + [string](Get-FieldValue -Object $reportResult -Path @("output")))
foreach ($item in $script:ScenarioResults) {
  Write-Host (" - {0}: {1} ({2} ms)" -f $item.name, $item.status, $item.elapsedMs)
}

if ($fatalError) {
  throw "demo-e2e fatal error: $fatalError"
}
if (-not $overallSuccess) {
  throw "demo-e2e completed with failed scenarios. See $resolvedOutputPath"
}

Write-Step "All scenarios passed."
