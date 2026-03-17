param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$GoogleGenAiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiApiKey,

  [Parameter(Mandatory = $false)]
  [string]$LiveApiAuthHeader = "x-goog-api-key",

  [Parameter(Mandatory = $false)]
  [string]$SummaryOutputPath = "artifacts/deploy/gcp-secret-sync-summary.json",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-GcloudCli {
  $candidates = @(
    "C:\Users\user\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )
  $resolved = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $resolved) {
    $command = Get-Command "gcloud.cmd" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      $resolved = $command.Source
    }
  }
  if (-not $resolved) {
    throw "gcloud.cmd was not found in PATH."
  }
  return $resolved
}

$script:GcloudCli = Resolve-GcloudCli

function Write-Utf8NoBomFile {
  param(
    [string]$Path,
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
    [string]$RepoRoot,
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $RepoRoot $Path
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
    $value = [string]$matches[2]
    $value = $value.Trim()
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

function Resolve-SecretValue {
  param(
    [string]$ExplicitValue,
    [string[]]$EnvNames,
    [hashtable]$DotEnvValues
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
    return $ExplicitValue
  }

  foreach ($envName in $EnvNames) {
    $candidate = [Environment]::GetEnvironmentVariable($envName)
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      return [string]$candidate
    }
  }

  if ($null -ne $DotEnvValues) {
    foreach ($envName in $EnvNames) {
      if (-not $DotEnvValues.ContainsKey($envName)) {
        continue
      }
      $candidate = [string]$DotEnvValues[$envName]
      if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        return $candidate
      }
    }
  }

  return ""
}

function Ensure-SecretVersion {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing value for secret $Name"
  }

  if ($DryRun) {
    Write-Host "Dry run: would add latest version for secret $Name"
    return
  }

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempFile, $Value, $encoding)
    & $script:GcloudCli secrets versions add $Name --project $ProjectId --data-file $tempFile | Out-Null
  } finally {
    Remove-Item -Force $tempFile -ErrorAction SilentlyContinue
  }
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$resolvedSummaryOutputPath = Resolve-RepoPath -RepoRoot $repoRoot -Path $SummaryOutputPath
$dotEnvValues = Read-DotEnvValues -Path (Join-Path $repoRoot ".env")

$googleGenAiValue = Resolve-SecretValue -ExplicitValue $GoogleGenAiApiKey -EnvNames @(
  "GOOGLE_GENAI_API_KEY",
  "GEMINI_API_KEY",
  "LIVE_AGENT_GEMINI_API_KEY",
  "STORYTELLER_GEMINI_API_KEY",
  "UI_NAVIGATOR_GEMINI_API_KEY"
) -DotEnvValues $dotEnvValues

$liveApiValue = Resolve-SecretValue -ExplicitValue $LiveApiApiKey -EnvNames @(
  "LIVE_API_API_KEY"
) -DotEnvValues $dotEnvValues

if ([string]::IsNullOrWhiteSpace($liveApiValue)) {
  $liveApiValue = $googleGenAiValue
}

$liveApiAuthHeaderValue = Resolve-SecretValue -ExplicitValue $LiveApiAuthHeader -EnvNames @(
  "LIVE_API_AUTH_HEADER"
) -DotEnvValues $dotEnvValues

if ([string]::IsNullOrWhiteSpace($liveApiAuthHeaderValue)) {
  $liveApiAuthHeaderValue = "x-goog-api-key"
}

Ensure-SecretVersion -Name "GOOGLE_GENAI_API_KEY" -Value $googleGenAiValue
Ensure-SecretVersion -Name "LIVE_API_API_KEY" -Value $liveApiValue
Ensure-SecretVersion -Name "LIVE_API_AUTH_HEADER" -Value $liveApiAuthHeaderValue

$summary = [ordered]@{
  status = if ($DryRun) { "dry_run" } else { "success" }
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $ProjectId
  dryRun = $DryRun.IsPresent
  secrets = @(
    [ordered]@{ name = "GOOGLE_GENAI_API_KEY"; present = -not [string]::IsNullOrWhiteSpace($googleGenAiValue) },
    [ordered]@{ name = "LIVE_API_API_KEY"; present = -not [string]::IsNullOrWhiteSpace($liveApiValue) },
    [ordered]@{ name = "LIVE_API_AUTH_HEADER"; present = -not [string]::IsNullOrWhiteSpace($liveApiAuthHeaderValue) }
  )
}

Write-Utf8NoBomFile -Path $resolvedSummaryOutputPath -Content (($summary | ConvertTo-Json -Depth 5) + "`n")
Write-Host "Secret sync summary written to $resolvedSummaryOutputPath"
