[CmdletBinding()]
param(
  [string]$Owner = $env:GITHUB_OWNER,
  [string]$Repo = $env:GITHUB_REPO,
  [string]$Token = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { "" }),
  [string]$Branch = "gh-pages",
  [string]$Path = "/"
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

if ([string]::IsNullOrWhiteSpace($Token)) {
  Fail "Missing token. Set -Token or env GITHUB_TOKEN (or GH_TOKEN)."
}

$headers = @{
  Accept                 = "application/vnd.github+json"
  Authorization          = "Bearer $Token"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$uri = "https://api.github.com/repos/$Owner/$Repo/pages"
$body = @{
  source = @{
    branch = $Branch
    path   = $Path
  }
} | ConvertTo-Json -Compress

Write-Host "Configuring GitHub Pages for $Owner/$Repo..."

$needsCreate = $false
$currentBranch = $null
$currentPath = $null

try {
  $existing = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 30
  $currentBranch = $existing.source.branch
  $currentPath = $existing.source.path
}
catch {
  $statusCode = $null
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $statusCode = [int]$_.Exception.Response.StatusCode
  }

  if ($statusCode -eq 404) {
    $needsCreate = $true
  }
  else {
    throw
  }
}

if ($needsCreate) {
  Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 30 | Out-Null
  Write-Host "Pages site created with source: $Branch $Path"
}
elseif ($currentBranch -ne $Branch -or $currentPath -ne $Path) {
  Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 30 | Out-Null
  Write-Host "Pages source updated: $currentBranch $currentPath -> $Branch $Path"
}
else {
  Write-Host "Pages already configured: $currentBranch $currentPath"
}

$endpoint = "https://$($Owner.ToLowerInvariant()).github.io/$($Repo.ToLowerInvariant())/demo-e2e/badge.json"
$shield = "https://img.shields.io/endpoint?url=$([System.Uri]::EscapeDataString($endpoint))"

Write-Host ""
Write-Host "Badge endpoint:"
Write-Host $endpoint
Write-Host ""
Write-Host "Shields URL:"
Write-Host $shield
