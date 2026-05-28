[CmdletBinding()]
param(
  [string]$GatewayPublicUrl = $(if (-not [string]::IsNullOrWhiteSpace($env:RAILWAY_PUBLIC_URL)) { $env:RAILWAY_PUBLIC_URL } else { "https://live-agent-production.up.railway.app" }),
  [string]$FrontendPublicUrl = $(if (-not [string]::IsNullOrWhiteSpace($env:FRONTEND_PUBLIC_URL)) { $env:FRONTEND_PUBLIC_URL } else { "https://live-agent-frontend-production.up.railway.app" }),
  [string]$OutputPath = "artifacts/deploy/production-smoke.json",
  [string]$MarkdownOutputPath = "artifacts/deploy/production-smoke.md",
  [int]$TimeoutSec = 30,
  [switch]$AllowFailingEvidence
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

function Invoke-HtmlGet {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSec
  )

  return Invoke-WebRequest -Method Get -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec
}

function Get-HtmlTitle {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html
  )

  $match = [regex]::Match($Html, "<title>(.*?)</title>", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success) {
    return [string]$match.Groups[1].Value
  }

  return ""
}

function Test-HtmlMarker {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html,
    [Parameter(Mandatory = $true)]
    [string]$Marker
  )

  return $Html.Contains($Marker)
}

function New-MarkdownSummary {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Summary
  )

  function Get-MarkdownFieldValue {
    param(
      [Parameter(Mandatory = $false)]
      [object]$Value,
      [Parameter(Mandatory = $true)]
      [string[]]$Path,
      [Parameter(Mandatory = $true)]
      [string]$DefaultValue
    )

    $current = $Value
    foreach ($segment in $Path) {
      if ($null -eq $current) {
        return $DefaultValue
      }

      if ($current -is [System.Collections.IDictionary]) {
        if (-not $current.Contains($segment)) {
          return $DefaultValue
        }
        $current = $current[$segment]
        continue
      }

      $property = $current.PSObject.Properties[$segment]
      if ($null -eq $property) {
        return $DefaultValue
      }
      $current = $property.Value
    }

    if ($null -eq $current) {
      return $DefaultValue
    }

    $text = [string]$current
    if ([string]::IsNullOrWhiteSpace($text)) {
      return $DefaultValue
    }

    return $text
  }

  $lines = @(
    "# Production Smoke",
    "",
    "- Status: $(Get-MarkdownFieldValue -Value $Summary -Path @("status") -DefaultValue "unknown")",
    "- Generated At (UTC): $(Get-MarkdownFieldValue -Value $Summary -Path @("generatedAt") -DefaultValue "n/a")",
    "- Gateway URL: $(Get-MarkdownFieldValue -Value $Summary -Path @("gateway", "url") -DefaultValue "n/a")",
    "- Frontend URL: $(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "url") -DefaultValue "n/a")",
    "- Badge: $(Get-MarkdownFieldValue -Value $Summary -Path @("badge", "label") -DefaultValue "n/a") -> $(Get-MarkdownFieldValue -Value $Summary -Path @("badge", "message") -DefaultValue "n/a") ($(Get-MarkdownFieldValue -Value $Summary -Path @("badge", "color") -DefaultValue "n/a"))",
    "- Gateway Runtime: state=$(Get-MarkdownFieldValue -Value $Summary -Path @("gateway", "runtimeState") -DefaultValue "n/a"), ready=$(Get-MarkdownFieldValue -Value $Summary -Path @("gateway", "ready") -DefaultValue "n/a"), draining=$(Get-MarkdownFieldValue -Value $Summary -Path @("gateway", "draining") -DefaultValue "n/a")",
    "- Gateway UI URL: $(Get-MarkdownFieldValue -Value $Summary -Path @("gateway", "uiUrl") -DefaultValue "n/a")",
    "- Frontend Health: ok=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "healthOk") -DefaultValue "n/a"), service=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "healthService") -DefaultValue "n/a")",
    "- Frontend Title: $(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "title") -DefaultValue "n/a")",
    "- Frontend Markers: AI Action Desk=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "markers", "aiActionDesk") -DefaultValue "n/a"), Case Workspace=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "markers", "caseWorkspace") -DefaultValue "n/a"), Operator Console=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "markers", "operatorConsole") -DefaultValue "n/a"), Session Boundary=$(Get-MarkdownFieldValue -Value $Summary -Path @("frontend", "markers", "sessionBoundary") -DefaultValue "n/a")"
  )

  $hasError = $false
  if ($Summary -is [System.Collections.IDictionary]) {
    $hasError = $Summary.Contains("error")
  } elseif ($null -ne $Summary.PSObject.Properties["error"]) {
    $hasError = $true
  }

  if ($hasError -and $null -ne $Summary.error) {
    $lines += ""
    $lines += "## Error"
    $lines += ""
    $lines += $Summary.error.message
  }

  return ($lines -join "`n")
}

$resolvedGatewayPublicUrl = $GatewayPublicUrl.TrimEnd("/")
$resolvedFrontendPublicUrl = $FrontendPublicUrl.TrimEnd("/")
$publicBadgeCheckScriptPath = Join-Path $PSScriptRoot "public-badge-check.ps1"

$summary = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  status = "fail"
  gateway = [ordered]@{
    url = $resolvedGatewayPublicUrl
  }
  badge = [ordered]@{
    endpoint = ($resolvedGatewayPublicUrl + "/demo-e2e/badge.json")
    detailsEndpoint = ($resolvedGatewayPublicUrl + "/demo-e2e/badge-details.json")
  }
  frontend = [ordered]@{
    url = $resolvedFrontendPublicUrl
    healthUrl = ($resolvedFrontendPublicUrl + "/healthz")
  }
}

try {
  if (-not (Test-Path $publicBadgeCheckScriptPath)) {
    Fail ("Missing helper script: " + $publicBadgeCheckScriptPath)
  }

  $publicBadgeCheckArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $publicBadgeCheckScriptPath,
    "-RailwayPublicUrl",
    $resolvedGatewayPublicUrl,
    "-TimeoutSec",
    [string]$TimeoutSec
  )
  if ($AllowFailingEvidence) {
    $publicBadgeCheckArgs += "-AllowFailingEvidence"
  }

  $publicBadgeCheckOutput = & powershell @publicBadgeCheckArgs 2>&1
  $publicBadgeCheckExitCode = $LASTEXITCODE
  $publicBadgeCheckText = (($publicBadgeCheckOutput | ForEach-Object { $_.ToString() }) -join "`n").Trim()
  $summary.badge["helperValidated"] = ($publicBadgeCheckExitCode -eq 0)
  $summary.badge["helperOutput"] = $publicBadgeCheckText
  if ($publicBadgeCheckExitCode -ne 0) {
    Fail ("Public badge helper failed: " + $publicBadgeCheckText)
  }

  $gatewayRoot = Invoke-JsonGet -Uri ($resolvedGatewayPublicUrl + "/") -TimeoutSec $TimeoutSec
  if ($gatewayRoot.ok -ne $true) {
    Fail "Gateway root descriptor did not report ok=true."
  }
  if ([string]$gatewayRoot.service -ne "realtime-gateway") {
    Fail ("Gateway root descriptor service mismatch: " + [string]$gatewayRoot.service)
  }
  if ($null -eq $gatewayRoot.runtime) {
    Fail "Gateway root descriptor runtime block is missing."
  }
  if ($gatewayRoot.runtime.ready -ne $true) {
    Fail "Gateway runtime is not ready."
  }
  if ([string]$gatewayRoot.runtime.state -ne "ready") {
    Fail ("Gateway runtime.state expected 'ready', actual '" + [string]$gatewayRoot.runtime.state + "'.")
  }
  if ([string]$gatewayRoot.uiUrl -ne $resolvedFrontendPublicUrl) {
    Fail ("Gateway root descriptor uiUrl mismatch: expected '" + $resolvedFrontendPublicUrl + "', actual '" + [string]$gatewayRoot.uiUrl + "'.")
  }
  if ([string]$gatewayRoot.publicUrl -ne $resolvedGatewayPublicUrl) {
    Fail ("Gateway root descriptor publicUrl mismatch: expected '" + $resolvedGatewayPublicUrl + "', actual '" + [string]$gatewayRoot.publicUrl + "'.")
  }
  if ($null -eq $gatewayRoot.routes -or [string]$gatewayRoot.routes.health -ne "/healthz") {
    Fail "Gateway root descriptor routes.health must equal /healthz."
  }

  $badge = Invoke-JsonGet -Uri $summary.badge.endpoint -TimeoutSec $TimeoutSec
  $details = Invoke-JsonGet -Uri $summary.badge.detailsEndpoint -TimeoutSec $TimeoutSec

  $summary.gateway["service"] = [string]$gatewayRoot.service
  $summary.gateway["runtimeState"] = [string]$gatewayRoot.runtime.state
  $summary.gateway["ready"] = ($gatewayRoot.runtime.ready -eq $true)
  $summary.gateway["draining"] = ($gatewayRoot.runtime.draining -eq $true)
  $summary.gateway["uiUrl"] = [string]$gatewayRoot.uiUrl
  $summary.gateway["publicUrl"] = [string]$gatewayRoot.publicUrl
  $summary.gateway["healthRoute"] = [string]$gatewayRoot.routes.health
  $summary.gateway["metricsRoute"] = [string]$gatewayRoot.routes.metrics

  $summary.badge["label"] = [string]$badge.label
  $summary.badge["message"] = [string]$badge.message
  $summary.badge["color"] = [string]$badge.color
  $summary.badge["checks"] = $details.checks
  $summary.badge["violations"] = $details.violations
  $summary.badge["roundTripMs"] = $details.roundTripMs
  $summary.badge["generatedAt"] = [string]$details.generatedAt

  $frontendHealth = Invoke-JsonGet -Uri ($resolvedFrontendPublicUrl + "/healthz") -TimeoutSec $TimeoutSec
  if ($frontendHealth.ok -ne $true) {
    Fail "Frontend health endpoint did not report ok=true."
  }
  if ([string]$frontendHealth.service -ne "demo-frontend") {
    Fail ("Frontend health service mismatch: " + [string]$frontendHealth.service)
  }

  $frontendRoot = Invoke-HtmlGet -Uri ($resolvedFrontendPublicUrl + "/") -TimeoutSec $TimeoutSec
  $frontendRootHtml = [string]$frontendRoot.Content
  $frontendTitle = Get-HtmlTitle -Html $frontendRootHtml
  if ([string]::IsNullOrWhiteSpace($frontendTitle)) {
    Fail "Frontend root page is missing a title."
  }

  $markerAiActionDesk = Test-HtmlMarker -Html $frontendRootHtml -Marker "AI Action Desk"
  $markerCaseWorkspace = Test-HtmlMarker -Html $frontendRootHtml -Marker "Case Workspace"
  $markerOperatorConsole = Test-HtmlMarker -Html $frontendRootHtml -Marker "Operator Console"
  $markerSessionBoundary = Test-HtmlMarker -Html $frontendRootHtml -Marker "Session Boundary"

  if (-not $markerAiActionDesk) {
    Fail "Frontend root page is missing AI Action Desk marker."
  }
  if (-not $markerCaseWorkspace) {
    Fail "Frontend root page is missing Case Workspace marker."
  }
  if (-not $markerOperatorConsole) {
    Fail "Frontend root page is missing Operator Console marker."
  }
  if (-not $markerSessionBoundary) {
    Fail "Frontend root page is missing Session Boundary marker."
  }

  $summary.frontend["healthOk"] = ($frontendHealth.ok -eq $true)
  $summary.frontend["healthService"] = [string]$frontendHealth.service
  $summary.frontend["statusCode"] = [int]$frontendRoot.StatusCode
  $summary.frontend["title"] = $frontendTitle
  $summary.frontend["contentLength"] = $frontendRootHtml.Length
  $summary.frontend["markers"] = [ordered]@{
    aiActionDesk = $markerAiActionDesk
    caseWorkspace = $markerCaseWorkspace
    operatorConsole = $markerOperatorConsole
    sessionBoundary = $markerSessionBoundary
  }

  $summary.status = "pass"
}
catch {
  $summary.error = [ordered]@{
    message = $_.Exception.Message
  }
}

$json = $summary | ConvertTo-Json -Depth 20
$markdown = New-MarkdownSummary -Summary $summary
Write-Utf8NoBomFile -Path $OutputPath -Content $json
Write-Utf8NoBomFile -Path $MarkdownOutputPath -Content $markdown

Write-Host ("production.smoke.status: " + $summary.status)
Write-Host ("production.smoke.json: " + $OutputPath)
Write-Host ("production.smoke.md: " + $MarkdownOutputPath)

if ($summary.status -ne "pass") {
  Fail ("Production smoke failed. See " + $OutputPath)
}
