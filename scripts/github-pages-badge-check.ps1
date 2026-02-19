[CmdletBinding()]
param(
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Owner)) {
  Fail "Missing owner. Set -Owner or env GITHUB_OWNER."
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  Fail "Missing repo. Set -Repo or env GITHUB_REPO."
}

$endpoint = "https://$Owner.github.io/$Repo/demo-e2e/badge.json"
$shield = "https://img.shields.io/endpoint?url=$([System.Uri]::EscapeDataString($endpoint))"

Write-Host "Checking badge endpoint:"
Write-Host $endpoint

try {
  $payload = Invoke-RestMethod -Method Get -Uri $endpoint -TimeoutSec $TimeoutSec
}
catch {
  Fail "Badge endpoint is not reachable yet. Ensure Pages is enabled and CI published to gh-pages."
}

$required = @("schemaVersion", "label", "message", "color")
$propertyNames = @($payload.PSObject.Properties.Name)
$missing = @($required | Where-Object { $propertyNames -notcontains $_ })

if ($missing.Count -gt 0) {
  Fail "Badge endpoint JSON is missing fields: $($missing -join ', ')"
}

Write-Host "Badge endpoint is valid."
Write-Host "Badge: $($payload.label) -> $($payload.message) ($($payload.color))"
Write-Host ""
Write-Host "Shields URL:"
Write-Host $shield
