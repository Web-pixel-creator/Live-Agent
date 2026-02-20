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
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $data = $null
  $errorText = $null
  $status = "passed"

  try {
    $data = & $Action
  } catch {
    $status = "failed"
    $errorText = $_.Exception.Message
  } finally {
    $watch.Stop()
  }

  $result = [ordered]@{
    name = $Name
    status = $status
    elapsedMs = [int]$watch.ElapsedMilliseconds
    data = $data
    error = $errorText
  }
  $script:ScenarioResults += $result

  if ($status -eq "passed") {
    Write-Step ("Scenario {0}: passed ({1} ms)" -f $Name, $result.elapsedMs)
  } else {
    Write-Step ("Scenario {0}: failed ({1} ms) - {2}" -f $Name, $result.elapsedMs, $errorText)
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
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_TIMEOUT_MS" -Value "15000"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_MAX_RETRIES" -Value "1"
  Set-EnvDefault -Name "UI_NAVIGATOR_EXECUTOR_RETRY_BACKOFF_MS" -Value "300"
  Set-EnvDefault -Name "UI_EXECUTOR_STRICT_PLAYWRIGHT" -Value "false"
  Set-EnvDefault -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "true"

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

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      fallbackAsset = [bool](Get-FieldValue -Object $response -Path @("payload", "output", "fallbackAsset"))
      timelineSegments = [int]$timeline.Count
      plannerProvider = [string](Get-FieldValue -Object $response -Path @("payload", "output", "generation", "planner", "provider"))
      mediaMode = $generationMediaMode
      videoAsync = $videoAsync
      videoJobsCount = $videoJobs.Count
      videoPendingCount = $pendingVideoAssets.Count
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

    $response = Invoke-JsonRequest -Method POST -Uri "http://localhost:8081/v1/approvals/resume" -Body @{
      approvalId = $script:UiApprovalId
      sessionId = $sessionId
      runId = ("demo-ui-approve-" + [Guid]::NewGuid().Guid)
      decision = "approved"
      reason = "Approved from demo e2e script."
      intent = "ui_task"
      input = $script:UiResumeInput
    } -TimeoutSec $RequestTimeoutSec

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
    }
  } | Out-Null

  Invoke-Scenario -Name "ui.visual_testing" -Action {
    $runId = "demo-ui-visual-" + [Guid]::NewGuid().Guid
    $request = New-OrchestratorRequest -SessionId $sessionId -RunId $runId -Intent "ui_task" -RequestInput @{
      goal = "Open the page and verify dashboard layout/content/interaction checkpoints."
      url = "https://example.com"
      screenshotRef = "ui://demo/visual"
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

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      reportStatus = $visualStatus
      checksCount = $checks.Count
      regressionCount = $regressionCount
      highestSeverity = [string](Get-FieldValue -Object $visual -Path @("highestSeverity"))
      comparatorMode = $comparatorMode
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

    return [ordered]@{
      runId = [string](Get-FieldValue -Object $response -Path @("runId"))
      delegatedRoute = $delegatedRoute
      delegatedStatus = $delegatedStatus
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

  Invoke-Scenario -Name "runtime.lifecycle.endpoints" -Action {
    $services = @(
      @{ name = "realtime-gateway"; baseUrl = "http://localhost:8080" },
      @{ name = "api-backend"; baseUrl = "http://localhost:8081" },
      @{ name = "orchestrator"; baseUrl = "http://localhost:8082" }
    )

    $results = @()
    foreach ($service in $services) {
      $baseUrl = [string]$service.baseUrl
      $serviceName = [string]$service.name

      $healthBefore = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/healthz") -TimeoutSec $RequestTimeoutSec
      $healthBeforeOk = [bool](Get-FieldValue -Object $healthBefore -Path @("ok"))
      Assert-Condition -Condition $healthBeforeOk -Message ("Health check failed for " + $serviceName)

      $statusBefore = Invoke-JsonRequest -Method GET -Uri ($baseUrl + "/status") -TimeoutSec $RequestTimeoutSec
      $stateBefore = [string](Get-FieldValue -Object $statusBefore -Path @("runtime", "state"))
      Assert-Condition -Condition ($stateBefore -eq "ready") -Message ("Expected ready state before drain for " + $serviceName)

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
        stateBefore = $stateBefore
        stateDuringDrain = $stateDuringDrain
        stateAfterWarmup = $stateAfterWarmup
      }
    }

    return [ordered]@{
      services = $results
      count = $results.Count
    }
  } | Out-Null

  Invoke-Scenario -Name "runtime.metrics.endpoints" -Action {
    $services = @(
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
$uiVisualTestingData = Get-ScenarioData -Name "ui.visual_testing"
$delegationData = Get-ScenarioData -Name "multi_agent.delegation"
$gatewayWsData = Get-ScenarioData -Name "gateway.websocket.roundtrip"
$gatewayWsTaskData = Get-ScenarioData -Name "gateway.websocket.task_progress"
$gatewayWsInterruptData = Get-ScenarioData -Name "gateway.websocket.interrupt_signal"
$gatewayWsInvalidData = Get-ScenarioData -Name "gateway.websocket.invalid_envelope"
$approvalsListData = Get-ScenarioData -Name "api.approvals.list"
$approvalsInvalidIntentData = Get-ScenarioData -Name "api.approvals.resume.invalid_intent"
$runtimeLifecycleData = Get-ScenarioData -Name "runtime.lifecycle.endpoints"
$runtimeMetricsData = Get-ScenarioData -Name "runtime.metrics.endpoints"

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
    storytellerVideoAsyncValidated = if (
      $null -ne $storyData -and
      $storyData.mediaMode -eq "simulated" -and
      $storyData.videoAsync -eq $true -and
      [int]$storyData.videoJobsCount -ge 1 -and
      [int]$storyData.videoPendingCount -ge 1
    ) { $true } else { $false }
    uiAdapterMode = if ($null -ne $uiApproveData) { $uiApproveData.adapterMode } else { $null }
    uiAdapterRetries = if ($null -ne $uiApproveData) { $uiApproveData.retries } else { $null }
    visualTestingStatus = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.reportStatus } else { $null }
    visualChecksCount = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.checksCount } else { $null }
    visualRegressionCount = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.regressionCount } else { $null }
    visualComparatorMode = if ($null -ne $uiVisualTestingData) { $uiVisualTestingData.comparatorMode } else { $null }
    visualTestingValidated = if (
      $null -ne $uiVisualTestingData -and
      $uiVisualTestingData.reportStatus -eq "passed" -and
      [int]$uiVisualTestingData.checksCount -ge 3 -and
      [int]$uiVisualTestingData.regressionCount -eq 0
    ) { $true } else { $false }
    delegatedRoute = if ($null -ne $delegationData) { $delegationData.delegatedRoute } else { $null }
    gatewayWsRoundTripMs = if ($null -ne $gatewayWsData) { $gatewayWsData.roundTripMs } else { $null }
    gatewayWsResponseStatus = if ($null -ne $gatewayWsData) { $gatewayWsData.responseStatus } else { $null }
    sessionRunBindingValidated = if ($null -ne $gatewayWsData) { $gatewayWsData.contextValidated } else { $false }
    sessionStateTransitionsObserved = if ($null -ne $gatewayWsData) { $gatewayWsData.sessionStateCount } else { $null }
    taskProgressEventsObserved = if ($null -ne $gatewayWsTaskData) { $gatewayWsTaskData.taskProgressCount } else { $null }
    activeTasksVisible = if ($null -ne $gatewayWsTaskData) { $gatewayWsTaskData.activeTaskCount } else { $null }
    gatewayInterruptEventType = if ($null -ne $gatewayWsInterruptData) { $gatewayWsInterruptData.interruptEventType } else { $null }
    gatewayInterruptHandled = if ($null -ne $gatewayWsInterruptData) { $true } else { $false }
    gatewayWsInvalidEnvelopeCode = if ($null -ne $gatewayWsInvalidData) { $gatewayWsInvalidData.code } else { $null }
    approvalsRecorded = if ($null -ne $approvalsListData) { $approvalsListData.total } else { $null }
    approvalsInvalidIntentStatusCode = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.statusCode } else { $null }
    approvalsInvalidIntentCode = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.code } else { $null }
    approvalsInvalidIntentTraceId = if ($null -ne $approvalsInvalidIntentData) { $approvalsInvalidIntentData.traceId } else { $null }
    lifecycleEndpointsValidated = if ($null -ne $runtimeLifecycleData) { $true } else { $false }
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
