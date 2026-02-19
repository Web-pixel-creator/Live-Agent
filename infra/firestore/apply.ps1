param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Database = "(default)"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Gcloud {
  param([string[]]$Args)
  Write-Host ("gcloud " + ($Args -join " "))
  & gcloud @Args
}

function Create-CompositeIndex {
  param(
    [string]$CollectionGroup,
    [string[]]$FieldConfigs
  )

  $args = @(
    "firestore", "indexes", "composite", "create",
    "--project", $ProjectId,
    "--database", $Database,
    "--collection-group", $CollectionGroup,
    "--query-scope", "COLLECTION"
  )

  foreach ($config in $FieldConfigs) {
    $args += @("--field-config", $config)
  }

  try {
    Invoke-Gcloud $args | Out-Null
  } catch {
    $message = $_.Exception.Message
    if ($message -match "already exists" -or $message -match "ALREADY_EXISTS") {
      Write-Host "Index already exists for $CollectionGroup"
    } else {
      throw
    }
  }
}

function Enable-Ttl {
  param([string]$CollectionGroup)
  try {
    Invoke-Gcloud @(
      "firestore", "fields", "ttls", "update", "expireAt",
      "--project", $ProjectId,
      "--database", $Database,
      "--collection-group", $CollectionGroup,
      "--enable-ttl"
    ) | Out-Null
  } catch {
    $message = $_.Exception.Message
    if ($message -match "already enabled" -or $message -match "ALREADY_EXISTS") {
      Write-Host "TTL already enabled for $CollectionGroup.expireAt"
    } else {
      throw
    }
  }
}

Write-Host "==> Applying Firestore indexes"
Create-CompositeIndex -CollectionGroup "sessions" -FieldConfigs @(
  "field-path=userId,order=ASCENDING",
  "field-path=updatedAt,order=DESCENDING"
)
Create-CompositeIndex -CollectionGroup "events" -FieldConfigs @(
  "field-path=sessionId,order=ASCENDING",
  "field-path=createdAt,order=DESCENDING"
)
Create-CompositeIndex -CollectionGroup "agent_runs" -FieldConfigs @(
  "field-path=sessionId,order=ASCENDING",
  "field-path=createdAt,order=DESCENDING"
)
Create-CompositeIndex -CollectionGroup "agent_runs" -FieldConfigs @(
  "field-path=status,order=ASCENDING",
  "field-path=createdAt,order=DESCENDING"
)
Create-CompositeIndex -CollectionGroup "negotiation_logs" -FieldConfigs @(
  "field-path=sessionId,order=ASCENDING",
  "field-path=createdAt,order=DESCENDING"
)
Create-CompositeIndex -CollectionGroup "story_assets" -FieldConfigs @(
  "field-path=sessionId,order=ASCENDING",
  "field-path=createdAt,order=DESCENDING"
)

Write-Host "==> Enabling TTL policies"
Enable-Ttl -CollectionGroup "events"
Enable-Ttl -CollectionGroup "sessions"
Enable-Ttl -CollectionGroup "agent_runs"
Enable-Ttl -CollectionGroup "negotiation_logs"
Enable-Ttl -CollectionGroup "story_assets"

Write-Host "==> Firestore baseline is applied"
