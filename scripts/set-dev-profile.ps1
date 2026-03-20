param(
  [ValidateSet("cheap-dev", "full-demo")]
  [string]$Profile = "cheap-dev",

  [string]$EnvPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) ".env")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-DotEnvValue {
  param(
    [string[]]$Lines,
    [string]$Key,
    [string]$Value
  )

  $updated = $false
  $escapedKey = [regex]::Escape($Key)
  for ($i = 0; $i -lt $Lines.Count; $i += 1) {
    if ($Lines[$i] -match "^${escapedKey}=") {
      $Lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $Lines += "$Key=$Value"
  }

  return ,$Lines
}

$profileMap = @{
  "cheap-dev" = [ordered]@{
    "REASONING_MODEL_ID" = "gemini-3.1-flash-lite-preview"
    "STORYTELLER_PLANNER_MODEL" = "gemini-3.1-flash-lite-preview"
    "STORYTELLER_MEDIA_MODE" = "fallback"
    "UI_NAVIGATOR_PLANNER_MODEL" = "gemini-3.1-flash-lite-preview"
    "STORYTELLER_USE_GEMINI_PLANNER" = "false"
    "UI_NAVIGATOR_USE_GEMINI_PLANNER" = "false"
  }
  "full-demo" = [ordered]@{
    "REASONING_MODEL_ID" = "gemini-3.1-pro-preview"
    "STORYTELLER_PLANNER_MODEL" = "gemini-3.1-pro-preview"
    "STORYTELLER_MEDIA_MODE" = "default"
    "UI_NAVIGATOR_PLANNER_MODEL" = "gemini-3.1-pro-preview"
    "STORYTELLER_USE_GEMINI_PLANNER" = "true"
    "UI_NAVIGATOR_USE_GEMINI_PLANNER" = "true"
  }
}

$resolvedEnvPath = Resolve-Path -LiteralPath $EnvPath -ErrorAction Stop
$raw = Get-Content -LiteralPath $resolvedEnvPath -Raw -ErrorAction Stop
$lines = if ([string]::IsNullOrEmpty($raw)) {
  @()
} else {
  @($raw -split "`r?`n")
}

if ($lines.Count -gt 0 -and $lines[-1] -eq "") {
  $lines = $lines[0..($lines.Count - 2)]
}

foreach ($entry in $profileMap[$Profile].GetEnumerator()) {
  $lines = Set-DotEnvValue -Lines $lines -Key $entry.Key -Value $entry.Value
}

$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  $resolvedEnvPath.Path,
  (($lines -join [Environment]::NewLine) + [Environment]::NewLine),
  $encoding
)

Write-Host "Applied dev profile: $Profile"
foreach ($entry in $profileMap[$Profile].GetEnumerator()) {
  Write-Host (" - {0}={1}" -f $entry.Key, $entry.Value)
}
