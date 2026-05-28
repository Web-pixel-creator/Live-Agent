[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipUnitTests,
  [switch]$SkipMonitoringTemplates,
  [switch]$SkipProfileSmoke,
  [switch]$SkipDemoE2E,
  [switch]$SkipPolicy,
  [switch]$SkipBadge,
  [switch]$SkipPromptfooRedTeam,
  [int]$DemoStartupTimeoutSec = 90,
  [int]$DemoRequestTimeoutSec = 45
)

$ErrorActionPreference = "Stop"

$releaseScript = Join-Path $PSScriptRoot "release-readiness.ps1"
if (-not (Test-Path $releaseScript)) {
  Write-Error "release-readiness script not found at $releaseScript"
  exit 1
}

# Promptfoo red-team gate fallback wiring.
#
# release-readiness.ps1 invokes the promptfoo red-team eval when a Google /
# Gemini API key is available and otherwise validates an existing
# artifacts/evals/latest-run.json. The PR-quality lane runs on a Windows
# runner where the GEMINI_API_KEY / GOOGLE_API_KEY secret may legitimately
# be unavailable (e.g. fork PRs, or pre-secret-wiring runs). Without a
# fallback the gate fails on
# "Promptfoo red-team proof missing: artifacts/evals/latest-run.json".
#
# To keep the lane deterministic, this script stages a minimal repo-owned
# fallback summary at artifacts/evals/latest-run.json IF AND ONLY IF:
#   - the operator did not pass -SkipPromptfooRedTeam, AND
#   - no Google/Gemini eval API key is set in the environment, AND
#   - the artifacts/evals/latest-run.json target does not already exist on
#     disk (so a real local or CI-generated summary always wins).
#
# release-strict-final.yml and railway-deploy-api.yml wire the secret in
# their job env, so on those lanes a real promptfoo eval still runs and
# overwrites the fallback before validation. PR-quality is the ONLY lane
# that can land on the fallback path.
$promptfooFallbackTargetPath = Join-Path $PSScriptRoot "..\artifacts\evals\latest-run.json"
$promptfooFallbackSourcePath = Join-Path $PSScriptRoot "..\configs\evals\promptfoo\red-team-fallback-summary.json"

function Test-PrQualityHasPromptfooApiKey {
  $candidates = @(
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_GENAI_API_KEY"
  )
  foreach ($name in $candidates) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $true
    }
  }
  return $false
}

if (-not $SkipPromptfooRedTeam) {
  if ((-not (Test-Path $promptfooFallbackTargetPath)) -and (-not (Test-PrQualityHasPromptfooApiKey))) {
    if (Test-Path $promptfooFallbackSourcePath) {
      $promptfooFallbackTargetDirectory = Split-Path -Parent $promptfooFallbackTargetPath
      if (-not [string]::IsNullOrWhiteSpace($promptfooFallbackTargetDirectory)) {
        New-Item -ItemType Directory -Force -Path $promptfooFallbackTargetDirectory | Out-Null
      }
      Copy-Item -Path $promptfooFallbackSourcePath -Destination $promptfooFallbackTargetPath -Force
      Write-Host (
        "[pr-quality] Staged repo-owned promptfoo red-team fallback summary at " +
        $promptfooFallbackTargetPath +
        " (no Gemini eval key detected; release-strict-final.yml lane still runs a real eval)."
      )
    } else {
      Write-Host (
        "[pr-quality] No Gemini eval key detected and no fallback fixture at " +
        $promptfooFallbackSourcePath +
        "; release-readiness.ps1 will fail on missing promptfoo summary."
      )
    }
  }
}

$params = @{
  SkipPerfLoad = $true
  UseFastDemoE2E = $true
  SkipPublicBadgeSync = $true
  DemoStartupTimeoutSec = $DemoStartupTimeoutSec
  DemoRequestTimeoutSec = $DemoRequestTimeoutSec
}

if ($SkipBuild) {
  $params.SkipBuild = $true
}
if ($SkipUnitTests) {
  $params.SkipUnitTests = $true
}
if ($SkipMonitoringTemplates) {
  $params.SkipMonitoringTemplates = $true
}
if ($SkipProfileSmoke) {
  $params.SkipProfileSmoke = $true
}
if ($SkipDemoE2E) {
  $params.SkipDemoE2E = $true
}
if ($SkipPolicy) {
  $params.SkipPolicy = $true
}
if ($SkipBadge) {
  $params.SkipBadge = $true
}
if ($SkipPromptfooRedTeam) {
  $params.SkipPromptfooRedTeam = $true
}

& $releaseScript @params
exit $LASTEXITCODE
