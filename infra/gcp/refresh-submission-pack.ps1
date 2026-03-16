param(
  [Parameter(Mandatory = $false)]
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
  [string]$GoogleGenAiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiAuthHeader,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiWsUrl = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",

  [Parameter(Mandatory = $false)]
  [int]$DemoStartupTimeoutSec = 90,

  [Parameter(Mandatory = $false)]
  [int]$DemoRequestTimeoutSec = 45,

  [Parameter(Mandatory = $false)]
  [int]$DemoScenarioRetryMaxAttempts = 2,

  [Parameter(Mandatory = $false)]
  [int]$DemoScenarioRetryBackoffMs = 900,

  [Parameter(Mandatory = $false)]
  [int]$StorytellerGeminiTimeoutMs = 60000,

  [Parameter(Mandatory = $false)]
  [int]$StorytellerVideoPollMs = 5000,

  [Parameter(Mandatory = $false)]
  [int]$StorytellerVideoMaxWaitMs = 105000,

  [Parameter(Mandatory = $false)]
  [string]$StatusJsonPath = "artifacts/release-evidence/submission-refresh-status.json",

  [Parameter(Mandatory = $false)]
  [string]$StorytellerTtsModel = "gemini-2.5-pro-preview-tts",

  [Parameter(Mandatory = $false)]
  [string]$StatusMarkdownPath = "artifacts/release-evidence/submission-refresh-status.md",

  [switch]$SkipPrepareRuntime,
  [switch]$SkipDemoE2E,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [switch]$SkipArtifactSourceRefresh,
  [switch]$SkipVisualPack,
  [switch]$SkipVisualBundle,
  [switch]$SkipArtifactOnlyGate,
  [switch]$RunFullReleaseVerify,
  [switch]$StrictReleaseVerify,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ("[submission-refresh] " + $Message)
}

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $RepoRoot $Path
}

function Read-JsonIfExists {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    return Get-Content $Path -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Read-DotEnvValues {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in (Get-Content $Path)) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      continue
    }

    $name = [string]$matches[1]
    $rawValue = [string]$matches[2]
    $value = $rawValue.Trim()
    if (
      $value.Length -ge 2 -and (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$name] = $value
  }

  return $values
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

function Resolve-SecretValue {
  param(
    [Parameter(Mandatory = $false)]
    [AllowNull()]
    [string]$ExplicitValue,
    [Parameter(Mandatory = $true)]
    [string[]]$EnvNames,
    [Parameter(Mandatory = $false)]
    [string]$SecretName,
    [Parameter(Mandatory = $false)]
    [hashtable]$DotEnvValues,
    [Parameter(Mandatory = $false)]
    [string]$ProjectId
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
      return [pscustomobject][ordered]@{
        value = $ExplicitValue
        source = "parameter"
        present = $true
      }
  }

  foreach ($envName in $EnvNames) {
    $candidate = [Environment]::GetEnvironmentVariable($envName)
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      return [pscustomobject][ordered]@{
        value = $candidate
        source = "env:" + $envName
        present = $true
      }
    }
  }

  if ($null -ne $DotEnvValues) {
    foreach ($envName in $EnvNames) {
      if (-not $DotEnvValues.ContainsKey($envName)) {
        continue
      }

      $candidate = [string]$DotEnvValues[$envName]
      if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        return [pscustomobject][ordered]@{
          value = $candidate
          source = "dotenv:" + $envName
          present = $true
        }
      }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($SecretName) -and -not [string]::IsNullOrWhiteSpace($ProjectId)) {
    $gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($null -ne $gcloud) {
      $raw = & gcloud secrets versions access latest --secret $SecretName --project $ProjectId 2>$null
      if ($LASTEXITCODE -eq 0) {
        $secretValue = [string]$raw
        if (-not [string]::IsNullOrWhiteSpace($secretValue)) {
          return [pscustomobject][ordered]@{
            value = $secretValue.Trim()
            source = "secretManager:" + $SecretName
            present = $true
          }
        }
      }
    }
  }

  return [pscustomobject][ordered]@{
    value = $null
    source = "missing"
    present = $false
  }
}

function Set-SubmissionEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Value,
    [Parameter(Mandatory = $false)]
    [bool]$Sensitive = $false
  )

  Set-Item -Path ("Env:" + $Name) -Value $Value

  $script:AppliedEnv += [pscustomobject][ordered]@{
    name = $Name
    sensitive = $Sensitive
    value = if ($Sensitive) { "<redacted>" } else { $Value }
  }
}

function New-ResolvedSecretValue {
  param(
    [Parameter(Mandatory = $false)]
    [AllowNull()]
    [string]$Value,
    [Parameter(Mandatory = $true)]
    [string]$Source
  )

  $present = -not [string]::IsNullOrWhiteSpace($Value)
  return [pscustomobject][ordered]@{
    value = if ($present) { $Value } else { $null }
    source = if ($present) { $Source } else { "missing" }
    present = $present
  }
}

function Get-NpmCommand {
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($null -ne $npmCmd) {
    return $npmCmd.Source
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($null -ne $npm) {
    return $npm.Source
  }

  throw "npm is not available on PATH."
}

function Invoke-NpmRun {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $npmCommand = Get-NpmCommand
  & $npmCommand @Arguments
}

function Invoke-RecordedStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [Parameter(Mandatory = $false)]
    [bool]$AllowFailure = $false,
    [Parameter(Mandatory = $false)]
    [string[]]$Artifacts = @()
  )

  Write-Step $Name
  $startedAt = Get-Date
  $exitCode = 0
  $errorMessage = $null

  try {
    & $Action
    if ($null -ne $LASTEXITCODE) {
      $exitCode = [int]$LASTEXITCODE
    }
  } catch {
    $exitCode = 1
    $errorMessage = $_.Exception.Message
  }

  $artifactRecords = @(
    $Artifacts |
      ForEach-Object {
        [pscustomobject][ordered]@{
          path = $_
          present = Test-Path $_
        }
      }
  )

  $script:StepRecords += [pscustomobject][ordered]@{
    name = $Name
    startedAt = $startedAt.ToUniversalTime().ToString("o")
    finishedAt = (Get-Date).ToUniversalTime().ToString("o")
    exitCode = $exitCode
    allowFailure = $AllowFailure
    succeeded = ($exitCode -eq 0)
    error = $errorMessage
    artifacts = $artifactRecords
  }

  if ($exitCode -ne 0) {
    $script:Notes += ($Name + " failed with exit code " + $exitCode + ".")
    if (-not [string]::IsNullOrWhiteSpace($errorMessage)) {
      $script:Notes += ($Name + " error: " + $errorMessage)
    }
    if (-not $AllowFailure) {
      throw ($Name + " failed.")
    }
  }
}

function Get-SubmissionSummarySnapshot {
  param([string]$SummaryPath)

  $summary = Read-JsonIfExists -Path $SummaryPath
  if ($null -eq $summary) {
    return $null
  }

  $kpis = Get-ObjectPropertyValue -Object $summary -Name "kpis"
  $scenarios = @(Get-ObjectPropertyValue -Object $summary -Name "scenarios")
  $failedScenarios = @($scenarios | Where-Object { [string](Get-ObjectPropertyValue -Object $_ -Name "status") -ne "passed" })
  $liveApiEnabled = Get-ObjectPropertyValue -Object $kpis -Name "liveApiEnabled"
  if ($null -eq $liveApiEnabled) {
    foreach ($scenario in $scenarios) {
      $scenarioData = Get-ObjectPropertyValue -Object $scenario -Name "data"
      $candidateLiveApiEnabled = Get-ObjectPropertyValue -Object $scenarioData -Name "liveApiEnabled"
      if ($null -ne $candidateLiveApiEnabled) {
        $liveApiEnabled = $candidateLiveApiEnabled
        break
      }
    }
  }
  $translationProvider = Get-ObjectPropertyValue -Object $kpis -Name "translationProvider"
  $storytellerMediaMode = Get-ObjectPropertyValue -Object $kpis -Name "storytellerMediaMode"
  $safeTranslationProvider = $null
  if ($null -ne $translationProvider) {
    $safeTranslationProvider = ([string]$translationProvider) -ne "fallback"
  }
  $safeStoryMediaMode = $null
  if ($null -ne $storytellerMediaMode) {
    $safeStoryMediaMode = ([string]$storytellerMediaMode) -ne "simulated"
  }

  return [pscustomobject][ordered]@{
    success = (Get-ObjectPropertyValue -Object $summary -Name "success") -eq $true
    liveApiEnabled = $liveApiEnabled
    translationProvider = $translationProvider
    translationProviderSubmissionSafe = $safeTranslationProvider
    storytellerMediaMode = $storytellerMediaMode
    storytellerMediaModeSubmissionSafe = $safeStoryMediaMode
    uiExecutorForceSimulation = Get-ObjectPropertyValue -Object $kpis -Name "uiExecutorForceSimulation"
    gatewayWsRoundTripMs = Get-ObjectPropertyValue -Object $kpis -Name "gatewayWsRoundTripMs"
    scenarioRetriesUsedCount = Get-ObjectPropertyValue -Object $kpis -Name "scenarioRetriesUsedCount"
    failedScenarios = @($failedScenarios | ForEach-Object { [string](Get-ObjectPropertyValue -Object $_ -Name "name") })
    failedScenarioCount = $failedScenarios.Count
  }
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$dotEnvPath = Join-Path $repoRoot ".env"
$script:DotEnvValues = Read-DotEnvValues -Path $dotEnvPath
$prepareRuntimeScript = Join-Path $scriptDir "prepare-judge-runtime.ps1"
$resolvedStatusJsonPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $StatusJsonPath
$resolvedStatusMarkdownPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $StatusMarkdownPath
$summaryPath = Join-Path $repoRoot "artifacts\demo-e2e\summary.json"
$policyPath = Join-Path $repoRoot "artifacts\demo-e2e\policy-check.json"
$badgePath = Join-Path $repoRoot "artifacts\demo-e2e\badge.json"
$visualManifestPath = Join-Path $repoRoot "artifacts\judge-visual-evidence\manifest.json"
$visualPresentationPath = Join-Path $repoRoot "artifacts\judge-visual-evidence\presentation.md"
$artifactOnlyManifestPath = Join-Path $repoRoot "artifacts\release-artifact-revalidation\source-run.json"
$script:StepRecords = @()
$script:AppliedEnv = @()
$script:Notes = @()
$blockingReason = $null
$status = "pending"
$finalSummary = $null

try {
  if (-not $SkipPrepareRuntime) {
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
      throw "ProjectId is required unless -SkipPrepareRuntime is supplied."
    }

    $prepareArtifacts = @(
      (Join-Path $repoRoot "artifacts\deploy\gcp-cloud-run-summary.json"),
      (Join-Path $repoRoot "artifacts\deploy\gcp-firestore-summary.json"),
      (Join-Path $repoRoot "artifacts\release-evidence\gcp-runtime-proof.json")
    )

    Invoke-RecordedStep -Name "Prepare GCP judge runtime" -Artifacts $prepareArtifacts -Action {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $prepareRuntimeScript `
        -ProjectId $ProjectId `
        -Region $Region `
        -FirestoreLocation $FirestoreLocation `
        -DatasetId $DatasetId `
        -ImageTag $ImageTag `
        -DryRun:$DryRun
    }
  }

  if (-not $SkipDemoE2E) {
    $googleGenAi = Resolve-SecretValue -ExplicitValue $GoogleGenAiApiKey -EnvNames @(
      "GOOGLE_GENAI_API_KEY",
      "GEMINI_API_KEY",
      "LIVE_AGENT_GEMINI_API_KEY",
      "STORYTELLER_GEMINI_API_KEY",
      "UI_NAVIGATOR_GEMINI_API_KEY"
    ) -SecretName "GOOGLE_GENAI_API_KEY" -DotEnvValues $script:DotEnvValues -ProjectId $ProjectId
    $liveApiKey = Resolve-SecretValue -ExplicitValue $LiveApiApiKey -EnvNames @(
      "LIVE_API_API_KEY"
    ) -SecretName "LIVE_API_API_KEY" -DotEnvValues $script:DotEnvValues -ProjectId $ProjectId
    $liveApiHeader = Resolve-SecretValue -ExplicitValue $LiveApiAuthHeader -EnvNames @(
      "LIVE_API_AUTH_HEADER"
    ) -SecretName "LIVE_API_AUTH_HEADER" -DotEnvValues $script:DotEnvValues -ProjectId $ProjectId

    if ((-not $liveApiKey.present) -and $googleGenAi.present) {
      $liveApiKey = New-ResolvedSecretValue -Value ([string]$googleGenAi.value) -Source ("derived-from:" + $googleGenAi.source)
    }
    if (-not $liveApiHeader.present) {
      $liveApiHeader = New-ResolvedSecretValue -Value "x-goog-api-key" -Source "default:x-goog-api-key"
    }

    $resolvedInputs = [pscustomobject][ordered]@{
      googleGenAiApiKey = [pscustomobject][ordered]@{
        present = $googleGenAi.present
        source = $googleGenAi.source
      }
      liveApiApiKey = [pscustomobject][ordered]@{
        present = $liveApiKey.present
        source = $liveApiKey.source
      }
      liveApiAuthHeader = [pscustomobject][ordered]@{
        present = $liveApiHeader.present
        source = $liveApiHeader.source
      }
    }

    if (-not $googleGenAi.present) {
      throw "Missing Google GenAI key. Provide -GoogleGenAiApiKey or make GOOGLE_GENAI_API_KEY available via env, .env, or Secret Manager."
    }
    if (-not $liveApiKey.present) {
      throw "Missing Live API key. Provide -LiveApiApiKey or make LIVE_API_API_KEY available via env, .env, or Secret Manager."
    }
    if (-not $liveApiHeader.present) {
      throw "Missing Live API auth header. Provide -LiveApiAuthHeader or make LIVE_API_AUTH_HEADER available via env, .env, or Secret Manager."
    }

    Set-SubmissionEnv -Name "LIVE_API_ENABLED" -Value "true"
    Set-SubmissionEnv -Name "LIVE_API_API_KEY" -Value ([string]$liveApiKey.value) -Sensitive $true
    Set-SubmissionEnv -Name "LIVE_API_AUTH_HEADER" -Value ([string]$liveApiHeader.value) -Sensitive $true
    Set-SubmissionEnv -Name "LIVE_API_WS_URL" -Value $LiveApiWsUrl
    Set-SubmissionEnv -Name "LIVE_AGENT_TEXT_PROVIDER" -Value "gemini_api"
    Set-SubmissionEnv -Name "GOOGLE_GENAI_API_KEY" -Value ([string]$googleGenAi.value) -Sensitive $true
    Set-SubmissionEnv -Name "GEMINI_API_KEY" -Value ([string]$googleGenAi.value) -Sensitive $true
    Set-SubmissionEnv -Name "LIVE_AGENT_GEMINI_API_KEY" -Value ([string]$googleGenAi.value) -Sensitive $true
    Set-SubmissionEnv -Name "STORYTELLER_GEMINI_API_KEY" -Value ([string]$googleGenAi.value) -Sensitive $true
    Set-SubmissionEnv -Name "UI_NAVIGATOR_GEMINI_API_KEY" -Value ([string]$googleGenAi.value) -Sensitive $true
    Set-SubmissionEnv -Name "MOONSHOT_API_KEY" -Value ""
    Set-SubmissionEnv -Name "LIVE_AGENT_MOONSHOT_API_KEY" -Value ""
    Set-SubmissionEnv -Name "STORYTELLER_MEDIA_MODE" -Value "default"
    Set-SubmissionEnv -Name "DEMO_E2E_STORYTELLER_MEDIA_MODE" -Value "default"
    Set-SubmissionEnv -Name "STORYTELLER_GEMINI_TIMEOUT_MS" -Value ([string]$StorytellerGeminiTimeoutMs)
    Set-SubmissionEnv -Name "STORYTELLER_VIDEO_POLL_MS" -Value ([string]$StorytellerVideoPollMs)
    Set-SubmissionEnv -Name "STORYTELLER_VIDEO_MAX_WAIT_MS" -Value ([string]$StorytellerVideoMaxWaitMs)
    Set-SubmissionEnv -Name "STORYTELLER_TTS_MODEL" -Value $StorytellerTtsModel
    Set-SubmissionEnv -Name "UI_NAVIGATOR_EXECUTOR_MODE" -Value "remote_http"
    Set-SubmissionEnv -Name "UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE" -Value "failed"
    Set-SubmissionEnv -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "false"
    Set-SubmissionEnv -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "false"
    Set-SubmissionEnv -Name "LIVE_AGENT_USE_GEMINI_CHAT" -Value "true"

    $script:Notes += ("Google GenAI key source: " + $googleGenAi.source)
    $script:Notes += ("Live API key source: " + $liveApiKey.source)
    $script:Notes += ("Live API auth header source: " + $liveApiHeader.source)

    if ($DryRun) {
      $script:Notes += "DryRun requested; demo/policy/badge/visual steps were skipped after env resolution."
    } else {
      Invoke-RecordedStep -Name "Run demo e2e fast with submission-safe env" -AllowFailure $true -Artifacts @($summaryPath) -Action {
        & powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/demo-e2e.ps1" `
          -SkipBuild `
          -StartupTimeoutSec $DemoStartupTimeoutSec `
          -RequestTimeoutSec $DemoRequestTimeoutSec `
          -ScenarioRetryMaxAttempts $DemoScenarioRetryMaxAttempts `
          -ScenarioRetryBackoffMs $DemoScenarioRetryBackoffMs `
          -RestartHealthyServices
      }

      if (-not $SkipPolicy) {
        Invoke-RecordedStep -Name "Run demo policy check" -AllowFailure $true -Artifacts @($policyPath) -Action {
          Invoke-NpmRun -Arguments @("run", "demo:e2e:policy")
        }
      }

      if (-not $SkipBadge) {
        Invoke-RecordedStep -Name "Generate demo badge" -AllowFailure $false -Artifacts @($badgePath) -Action {
          Invoke-NpmRun -Arguments @("run", "demo:e2e:badge")
        }
      }

      if (-not $SkipArtifactSourceRefresh) {
        Invoke-RecordedStep -Name "Refresh local artifact provenance" -AllowFailure $false -Artifacts @($artifactOnlyManifestPath) -Action {
          Invoke-NpmRun -Arguments @("run", "verify:release:artifact:refresh-local-source")
        }
      }

      if (-not $SkipVisualPack) {
        Invoke-RecordedStep -Name "Build judge visual evidence pack" -AllowFailure $true -Artifacts @($visualManifestPath) -Action {
          Invoke-NpmRun -Arguments @("run", "demo:e2e:visual-pack:strict")
        }
      }

      if (-not $SkipVisualBundle) {
        Invoke-RecordedStep -Name "Build judge presentation bundle" -AllowFailure $true -Artifacts @($visualPresentationPath) -Action {
          Invoke-NpmRun -Arguments @("run", "demo:e2e:visual:bundle")
        }
      }

      if (-not $SkipArtifactOnlyGate) {
        Invoke-RecordedStep -Name "Run release artifact-only gate" -AllowFailure $true -Artifacts @($artifactOnlyManifestPath) -Action {
          Invoke-NpmRun -Arguments @("run", "verify:release:artifact-only")
        }
      }

      if ($RunFullReleaseVerify) {
        $releaseArtifacts = @(
          $summaryPath,
          $policyPath,
          $badgePath,
          $artifactOnlyManifestPath
        )
        if ($StrictReleaseVerify) {
          Invoke-RecordedStep -Name "Run strict release verification" -AllowFailure $true -Artifacts $releaseArtifacts -Action {
            Invoke-NpmRun -Arguments @("run", "verify:release:strict")
          }
        } else {
          Invoke-RecordedStep -Name "Run release verification" -AllowFailure $true -Artifacts $releaseArtifacts -Action {
            Invoke-NpmRun -Arguments @("run", "verify:release")
          }
        }
      }
    }
  }

  $finalSummary = Get-SubmissionSummarySnapshot -SummaryPath $summaryPath

  $failedSteps = @($script:StepRecords | Where-Object { $_.succeeded -ne $true })
  $hardFailedSteps = @($failedSteps | Where-Object { $_.allowFailure -ne $true })
  $summarySafe =
    $null -ne $finalSummary -and
    $finalSummary.liveApiEnabled -eq $true -and
    $finalSummary.translationProviderSubmissionSafe -eq $true -and
    $finalSummary.storytellerMediaModeSubmissionSafe -eq $true -and
    $finalSummary.uiExecutorForceSimulation -eq $false

  if ($hardFailedSteps.Count -gt 0) {
    $status = "failed"
    $blockingReason = ($hardFailedSteps[0].name + " failed.")
  } elseif ($failedSteps.Count -gt 0 -or -not $summarySafe) {
    $status = "pending_follow_up"
    if ($null -eq $finalSummary) {
      $blockingReason = "summary.json is missing or unreadable after refresh."
    } elseif (-not $summarySafe) {
      $blockingReason = "Submission-safe summary criteria are still not satisfied."
    } else {
      $blockingReason = ($failedSteps[0].name + " requires follow-up.")
    }
  } else {
    $status = "success"
    $blockingReason = $null
  }
} catch {
  if ([string]::IsNullOrWhiteSpace($blockingReason)) {
    $blockingReason = $_.Exception.Message
  }
  $status = "failed"
} finally {
  $finalSummary = Get-SubmissionSummarySnapshot -SummaryPath $summaryPath
  $statusPayload = [pscustomobject][ordered]@{
    status = $status
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    projectId = $ProjectId
    region = $Region
    datasetId = $DatasetId
    imageTag = $ImageTag
    dryRun = $DryRun.IsPresent
    prepareRuntimeSkipped = $SkipPrepareRuntime.IsPresent
    demoRefreshSkipped = $SkipDemoE2E.IsPresent
    blockingReason = $blockingReason
    notes = $script:Notes
    appliedEnv = $script:AppliedEnv
    steps = $script:StepRecords
    summary = $finalSummary
  }

  Write-Utf8NoBomFile -Path $resolvedStatusJsonPath -Content (($statusPayload | ConvertTo-Json -Depth 12) + "`n")

  $markdown = @(
    "# Submission Refresh Status",
    "",
    "- Status: $status",
    "- Generated at: $($statusPayload.generatedAt)",
    "- Project: $(if ([string]::IsNullOrWhiteSpace($ProjectId)) { "n/a" } else { $ProjectId })",
    "- Region: $Region",
    "- Dataset: $DatasetId",
    "- Image tag: $ImageTag",
    "- Dry run: $($statusPayload.dryRun)",
    "- Prepare runtime skipped: $($statusPayload.prepareRuntimeSkipped)",
    "- Demo refresh skipped: $($statusPayload.demoRefreshSkipped)",
    $(if (-not [string]::IsNullOrWhiteSpace([string]$blockingReason)) { "- Blocking reason: $blockingReason" } else { "- Blocking reason: none" }),
    "",
    "## Applied Env",
    ""
  )

  if ($script:AppliedEnv.Count -eq 0) {
    $markdown += "- none"
  } else {
    foreach ($entry in $script:AppliedEnv) {
      $markdown += ("- " + $entry.name + ": " + $entry.value)
    }
  }

  $markdown += @(
    "",
    "## Steps",
    ""
  )

  if ($script:StepRecords.Count -eq 0) {
    $markdown += "- none"
  } else {
    foreach ($step in $script:StepRecords) {
      $stepStatus = if ($step.succeeded) { "ok" } elseif ($step.allowFailure) { "warning" } else { "failed" }
      $markdown += ("- " + $step.name + ": " + $stepStatus + " (exitCode=" + $step.exitCode + ")")
      if (-not [string]::IsNullOrWhiteSpace([string]$step.error)) {
        $markdown += ("  error: " + $step.error)
      }
      foreach ($artifact in @($step.artifacts)) {
        $markdown += ("  artifact: " + $artifact.path + " (present=" + $artifact.present + ")")
      }
    }
  }

  $markdown += @(
    "",
    "## Summary Snapshot",
    ""
  )

  if ($null -eq $finalSummary) {
    $markdown += "- summary.json not available"
  } else {
    $markdown += ("- success: " + $finalSummary.success)
    $markdown += ("- liveApiEnabled: " + $finalSummary.liveApiEnabled)
    $markdown += ("- translationProvider: " + $finalSummary.translationProvider)
    $markdown += ("- storytellerMediaMode: " + $finalSummary.storytellerMediaMode)
    $markdown += ("- uiExecutorForceSimulation: " + $finalSummary.uiExecutorForceSimulation)
    $markdown += ("- gatewayWsRoundTripMs: " + $finalSummary.gatewayWsRoundTripMs)
    $markdown += ("- scenarioRetriesUsedCount: " + $finalSummary.scenarioRetriesUsedCount)
    if ($finalSummary.failedScenarioCount -gt 0) {
      $markdown += ("- failedScenarios: " + ($finalSummary.failedScenarios -join ", "))
    } else {
      $markdown += "- failedScenarios: none"
    }
  }

  if ($script:Notes.Count -gt 0) {
    $markdown += @(
      "",
      "## Notes",
      ""
    )
    foreach ($note in $script:Notes) {
      $markdown += ("- " + $note)
    }
  }

  Write-Utf8NoBomFile -Path $resolvedStatusMarkdownPath -Content (($markdown -join "`n") + "`n")
}

Write-Host "Submission refresh status JSON: $resolvedStatusJsonPath"
Write-Host "Submission refresh status Markdown: $resolvedStatusMarkdownPath"

if ($status -ne "success") {
  throw ("Submission refresh finished with status '" + $status + "'.")
}
