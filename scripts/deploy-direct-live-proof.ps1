[CmdletBinding()]
param(
  [string]$FrontendPublicUrl = $(if (-not [string]::IsNullOrWhiteSpace($env:FRONTEND_PUBLIC_URL)) { $env:FRONTEND_PUBLIC_URL } else { "https://live-agent-frontend-production.up.railway.app" }),
  [string]$ApiPublicUrl = "",
  [string]$OutputPath = "artifacts/deploy/direct-live-proof.json",
  [string]$MarkdownOutputPath = "artifacts/deploy/direct-live-proof.md",
  [string]$ScreenshotPath = "artifacts/deploy/direct-live-proof.png",
  [int]$TimeoutSec = 90,
  [string]$SessionId = "",
  [string]$UserId = "demo-e2e-user",
  [string]$BrowserSmokeScriptPath = "",
  [switch]$FailOnSkip,
  [switch]$RequireCaseWikiEvidenceSignature,
  [string]$ExpectedCaseWikiEvidenceSignatureStatus = "",
  [switch]$Headed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  throw $Message
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

function Invoke-JsonGet {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSec
  )

  return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec $TimeoutSec
}

function Resolve-ApiPublicUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FrontendBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ExplicitApiPublicUrl,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSec
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitApiPublicUrl)) {
    return [ordered]@{
      apiPublicUrl = $ExplicitApiPublicUrl.Trim().TrimEnd("/")
      source = "explicit"
    }
  }

  $config = Invoke-JsonGet -Uri ($FrontendBaseUrl.TrimEnd("/") + "/config.json") -TimeoutSec $TimeoutSec
  $configRuntime = if ($null -ne $config.runtime) { $config.runtime } else { $null }
  $resolved = ""
  if ($null -ne $configRuntime -and -not [string]::IsNullOrWhiteSpace([string]$configRuntime.apiBaseUrl)) {
    $resolved = [string]$configRuntime.apiBaseUrl
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$config.apiBaseUrl)) {
    $resolved = [string]$config.apiBaseUrl
  }

  if ([string]::IsNullOrWhiteSpace($resolved)) {
    Fail ("Unable to resolve apiBaseUrl from " + $FrontendBaseUrl.TrimEnd("/") + "/config.json")
  }

  return [ordered]@{
    apiPublicUrl = $resolved.Trim().TrimEnd("/")
    source = "frontend_config"
  }
}

function Find-JsonLine {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Lines
  )

  for ($index = $Lines.Count - 1; $index -ge 0; $index -= 1) {
    $candidate = [string]$Lines[$index]
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    $trimmed = $candidate.Trim()
    if ($trimmed.StartsWith("{") -and $trimmed.EndsWith("}")) {
      return $trimmed
    }
  }

  return $null
}

function New-MarkdownSummary {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Summary
  )

  $runtimePreferredMode = if ($null -ne $Summary.runtimeStatus -and $null -ne $Summary.runtimeStatus.preferredMode) { [string]$Summary.runtimeStatus.preferredMode } else { "" }
  $runtimeActiveMode = if ($null -ne $Summary.runtimeStatus -and $null -ne $Summary.runtimeStatus.activeMode) { [string]$Summary.runtimeStatus.activeMode } else { "" }
  $runtimeProvider = if ($null -ne $Summary.runtimeStatus -and $null -ne $Summary.runtimeStatus.provider) { [string]$Summary.runtimeStatus.provider } else { "" }
  $runtimeModel = if ($null -ne $Summary.runtimeStatus -and $null -ne $Summary.runtimeStatus.model) { [string]$Summary.runtimeStatus.model } else { "" }
  $runtimeEphemeralTokensSupported = if ($null -ne $Summary.runtimeStatus -and $null -ne $Summary.runtimeStatus.ephemeralTokensSupported) { [string]$Summary.runtimeStatus.ephemeralTokensSupported } else { "" }
  $uiConnectionStatus = if ($null -ne $Summary.ui -and $null -ne $Summary.ui.connectionStatus) { [string]$Summary.ui.connectionStatus } else { "" }
  $uiModeStatus = if ($null -ne $Summary.ui -and $null -ne $Summary.ui.modeStatus) { [string]$Summary.ui.modeStatus } else { "" }
  $uiSessionState = if ($null -ne $Summary.ui -and $null -ne $Summary.ui.sessionState) { [string]$Summary.ui.sessionState } else { "" }
  $replayTransportMode = if ($null -ne $Summary.replay -and $null -ne $Summary.replay.liveTransport -and $null -ne $Summary.replay.liveTransport.activeMode) { [string]$Summary.replay.liveTransport.activeMode } else { "" }
  $replayEvidenceSource = if ($null -ne $Summary.replay -and $null -ne $Summary.replay.liveTransport -and $null -ne $Summary.replay.liveTransport.evidenceSource) { [string]$Summary.replay.liveTransport.evidenceSource } else { "" }
  $caseWikiSessionId = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.sessionId) { [string]$Summary.caseWiki.sessionId } else { "" }
  $caseWikiOverviewStatus = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.overviewStatus) { [string]$Summary.caseWiki.overviewStatus } else { "" }
  $caseWikiFocusKind = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.focusKind) { [string]$Summary.caseWiki.focusKind } else { "" }
  $caseWikiFocusLabel = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.focusLabel) { [string]$Summary.caseWiki.focusLabel } else { "" }
  $caseWikiNextAction = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.recommendedNextAction) { [string]$Summary.caseWiki.recommendedNextAction } else { "" }
  $caseWikiSignatureStatus = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.evidenceSignature -and $null -ne $Summary.caseWiki.evidenceSignature.status) { [string]$Summary.caseWiki.evidenceSignature.status } else { "" }
  $caseWikiSignatureSignerId = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.evidenceSignature -and $null -ne $Summary.caseWiki.evidenceSignature.signerId) { [string]$Summary.caseWiki.evidenceSignature.signerId } else { "" }
  $caseWikiSignatureSignedAt = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.evidenceSignature -and $null -ne $Summary.caseWiki.evidenceSignature.signedAt) { [string]$Summary.caseWiki.evidenceSignature.signedAt } else { "" }
  $caseWikiSignaturePresent = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.evidenceSignature -and $null -ne $Summary.caseWiki.evidenceSignature.signaturePresent) { [string]$Summary.caseWiki.evidenceSignature.signaturePresent } else { "" }
  $caseWikiSignaturePayloadHash = if ($null -ne $Summary.caseWiki -and $null -ne $Summary.caseWiki.evidenceSignature -and $null -ne $Summary.caseWiki.evidenceSignature.payloadHash) { [string]$Summary.caseWiki.evidenceSignature.payloadHash } else { "" }

  $lines = @(
    "# Direct Live Proof",
    "",
    "- Status: $($Summary.status)",
    "- Generated At (UTC): $($Summary.generatedAt)",
    "- Frontend URL: $($Summary.frontendPublicUrl)",
    "- API URL: $($Summary.apiPublicUrl)",
    "- API URL Source: $($Summary.apiPublicUrlSource)",
    "- Requested Session ID: $($Summary.requestedSessionId)",
    "- Observed Session ID: $($Summary.sessionId)",
    "- User ID: $($Summary.userId)",
    "- Runtime Preferred Mode: $runtimePreferredMode",
    "- Runtime Active Mode: $runtimeActiveMode",
    "- Runtime Provider: $runtimeProvider",
    "- Runtime Model: $runtimeModel",
    "- Ephemeral Tokens Supported: $runtimeEphemeralTokensSupported",
    "- UI Connection: $uiConnectionStatus",
    "- UI Mode: $uiModeStatus",
    "- UI Session State: $uiSessionState",
    "- Replay Transport: $replayTransportMode",
    "- Replay Evidence Source: $replayEvidenceSource",
    "- Case Wiki Session ID: $caseWikiSessionId",
    "- Case Wiki Overview Status: $caseWikiOverviewStatus",
    "- Case Wiki Focus: $caseWikiFocusKind / $caseWikiFocusLabel",
    "- Case Wiki Next Action: $caseWikiNextAction",
    "- Case Wiki Signature Status: $caseWikiSignatureStatus",
    "- Case Wiki Signature Signer: $caseWikiSignatureSignerId",
    "- Case Wiki Signature Signed At: $caseWikiSignatureSignedAt",
    "- Case Wiki Signature Present: $caseWikiSignaturePresent",
    "- Case Wiki Payload Hash: $caseWikiSignaturePayloadHash",
    "- Screenshot: $($Summary.screenshotPath)",
    "- Summary: $($Summary.summary)"
  )

  if (-not [string]::IsNullOrWhiteSpace([string]$Summary.reason)) {
    $lines += ""
    $lines += "## Reason"
    $lines += ""
    $lines += [string]$Summary.reason
  }

  return ($lines -join "`n")
}

$resolvedFrontendPublicUrl = $FrontendPublicUrl.Trim().TrimEnd("/")
if ([string]::IsNullOrWhiteSpace($resolvedFrontendPublicUrl)) {
  Fail "FrontendPublicUrl is required."
}

if ($TimeoutSec -lt 5) {
  Fail "TimeoutSec must be >= 5."
}

if (
  -not [string]::IsNullOrWhiteSpace($ExpectedCaseWikiEvidenceSignatureStatus) -and
  $ExpectedCaseWikiEvidenceSignatureStatus -notin @("signed", "unsigned")
) {
  Fail "ExpectedCaseWikiEvidenceSignatureStatus must be 'signed' or 'unsigned' when provided."
}

$resolvedBrowserSmokeScriptPath = if (-not [string]::IsNullOrWhiteSpace($BrowserSmokeScriptPath)) {
  $BrowserSmokeScriptPath
} else {
  Join-Path $PSScriptRoot "demo-e2e-direct-live-browser-smoke.mjs"
}

if (-not (Test-Path $resolvedBrowserSmokeScriptPath)) {
  Fail ("Missing browser smoke script: " + $resolvedBrowserSmokeScriptPath)
}

$resolvedApi = Resolve-ApiPublicUrl -FrontendBaseUrl $resolvedFrontendPublicUrl -ExplicitApiPublicUrl $ApiPublicUrl -TimeoutSec $TimeoutSec
$resolvedApiPublicUrl = [string]$resolvedApi.apiPublicUrl
$resolvedApiPublicUrlSource = [string]$resolvedApi.source

$resolvedSessionId = if (-not [string]::IsNullOrWhiteSpace($SessionId)) {
  $SessionId.Trim()
} else {
  "deploy-direct-live-proof-" + ([Guid]::NewGuid().ToString())
}

$browserSmokeArgs = @(
  $resolvedBrowserSmokeScriptPath,
  "--frontendBaseUrl", $resolvedFrontendPublicUrl,
  "--apiBaseUrl", $resolvedApiPublicUrl,
  "--sessionId", $resolvedSessionId,
  "--userId", $UserId,
  "--output", $OutputPath,
  "--screenshot", $ScreenshotPath,
  "--timeoutMs", ([string]($TimeoutSec * 1000))
)
if ($Headed) {
  $browserSmokeArgs += "--headed"
}

$browserSmokeOutput = & node @browserSmokeArgs 2>&1
$browserSmokeExitCode = $LASTEXITCODE
$browserSmokeLines = @($browserSmokeOutput | ForEach-Object { $_.ToString() })
$browserSmokeJsonLine = Find-JsonLine -Lines $browserSmokeLines
if ([string]::IsNullOrWhiteSpace($browserSmokeJsonLine)) {
  Fail ("Direct-live browser smoke did not emit JSON summary.`n" + ($browserSmokeLines -join "`n"))
}

$smokeSummary = $browserSmokeJsonLine | ConvertFrom-Json
$summary = [ordered]@{
  schemaVersion = 1
  generatedAt = [string]$smokeSummary.generatedAt
  status = [string]$smokeSummary.status
  reason = if ($null -ne $smokeSummary.reason) { [string]$smokeSummary.reason } else { $null }
  frontendPublicUrl = $resolvedFrontendPublicUrl
  apiPublicUrl = $resolvedApiPublicUrl
  apiPublicUrlSource = $resolvedApiPublicUrlSource
  requestedSessionId = if ($null -ne $smokeSummary.requestedSessionId) { [string]$smokeSummary.requestedSessionId } else { $resolvedSessionId }
  sessionId = if ($null -ne $smokeSummary.sessionId) { [string]$smokeSummary.sessionId } else { $null }
  userId = if ($null -ne $smokeSummary.userId) { [string]$smokeSummary.userId } else { $UserId }
  runtimeStatus = $smokeSummary.runtimeStatus
  ui = $smokeSummary.ui
  replay = $smokeSummary.replay
  caseWiki = $smokeSummary.caseWiki
  screenshotPath = if ($null -ne $smokeSummary.screenshotPath) { [string]$smokeSummary.screenshotPath } else { $null }
  summary = if ($null -ne $smokeSummary.summary) { [string]$smokeSummary.summary } else { "" }
  browserSmokeExitCode = $browserSmokeExitCode
  browserSmokeOutputPath = if ($null -ne $smokeSummary.outputPath) { [string]$smokeSummary.outputPath } else { $OutputPath }
}

$requiredCaseWikiSignatureStatus = if (-not [string]::IsNullOrWhiteSpace($ExpectedCaseWikiEvidenceSignatureStatus)) {
  $ExpectedCaseWikiEvidenceSignatureStatus
} elseif ($RequireCaseWikiEvidenceSignature) {
  "signed"
} else {
  ""
}

if (-not [string]::IsNullOrWhiteSpace($requiredCaseWikiSignatureStatus)) {
  $caseWikiEvidenceSignature = if ($null -ne $summary.caseWiki) { $summary.caseWiki.evidenceSignature } else { $null }
  $observedCaseWikiSignatureStatus = if ($null -ne $caseWikiEvidenceSignature -and $null -ne $caseWikiEvidenceSignature.status) { [string]$caseWikiEvidenceSignature.status } else { "" }
  $observedCaseWikiSignaturePresent = if ($null -ne $caseWikiEvidenceSignature -and $null -ne $caseWikiEvidenceSignature.signaturePresent) { [bool]$caseWikiEvidenceSignature.signaturePresent } else { $null }
  $caseWikiSignatureFailure = $null

  if ($null -eq $caseWikiEvidenceSignature) {
    $caseWikiSignatureFailure = "runtime case wiki evidenceSignature was not captured for the observed session"
  } elseif ($observedCaseWikiSignatureStatus -ne $requiredCaseWikiSignatureStatus) {
    $caseWikiSignatureFailure = "runtime case wiki evidenceSignature.status expected '$requiredCaseWikiSignatureStatus' but observed '$observedCaseWikiSignatureStatus'"
  } elseif ($requiredCaseWikiSignatureStatus -eq "signed" -and $observedCaseWikiSignaturePresent -ne $true) {
    $caseWikiSignatureFailure = "runtime case wiki evidenceSignature.status was 'signed' but signature bytes were missing"
  } elseif ($requiredCaseWikiSignatureStatus -eq "unsigned" -and $observedCaseWikiSignaturePresent -eq $true) {
    $caseWikiSignatureFailure = "runtime case wiki evidenceSignature.status was 'unsigned' but signature bytes were present"
  }

  if (-not [string]::IsNullOrWhiteSpace($caseWikiSignatureFailure)) {
    $summary.status = "fail"
    if ([string]::IsNullOrWhiteSpace([string]$summary.reason)) {
      $summary.reason = $caseWikiSignatureFailure
    }
    else {
      $summary.reason = ([string]$summary.reason + " | " + $caseWikiSignatureFailure)
    }
    $summary.summary = $caseWikiSignatureFailure
  }
}

$json = $summary | ConvertTo-Json -Depth 20
$markdown = New-MarkdownSummary -Summary $summary
Write-Utf8NoBomFile -Path $OutputPath -Content $json
Write-Utf8NoBomFile -Path $MarkdownOutputPath -Content $markdown

Write-Host ("direct_live.proof.status: " + $summary.status)
Write-Host ("direct_live.proof.json: " + $OutputPath)
Write-Host ("direct_live.proof.md: " + $MarkdownOutputPath)
if ($null -ne $summary.caseWiki -and $null -ne $summary.caseWiki.evidenceSignature) {
  Write-Host ("direct_live.proof.case_wiki.signature_status: " + [string]$summary.caseWiki.evidenceSignature.status)
}

if ($summary.status -eq "pass") {
  exit 0
}
if ($summary.status -eq "skipped" -and -not $FailOnSkip) {
  exit 0
}

Fail ("Direct-live proof failed. See " + $OutputPath)
