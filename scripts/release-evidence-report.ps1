[CmdletBinding()]
param(
  [string]$BadgeDetailsPath = "artifacts/demo-e2e/badge-details.json",
  [string]$OutputJsonPath = "artifacts/release-evidence/report.json",
  [string]$OutputMarkdownPath = "artifacts/release-evidence/report.md",
  [string]$OutputManifestJsonPath = "artifacts/release-evidence/manifest.json",
  [string]$OutputManifestMarkdownPath = "artifacts/release-evidence/manifest.md",
  [string]$OutputRuntimeProofJsonPath = "",
  [string]$OutputRuntimeProofMarkdownPath = "",
  [int]$HostedDirectLiveProofMaxAgeHours = 24
)

$ErrorActionPreference = "Stop"

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
  $maxAttempts = 8
  $baseRetryDelayMs = 80

  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      [System.IO.File]::WriteAllText($Path, $Content, $encoding)
      return
    }
    catch [System.IO.IOException] {
      if ($attempt -ge $maxAttempts) {
        throw
      }

      Start-Sleep -Milliseconds ($baseRetryDelayMs * $attempt)
    }
  }
}

function Get-StatusValueOrDefault {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$DefaultValue
  )

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }

  return $raw
}

function Get-AggregateEvidenceStatus {
  param(
    [Parameter(Mandatory = $false)]
    [AllowNull()]
    [object[]]$Statuses
  )

  $normalized = @()
  foreach ($status in @($Statuses)) {
    $normalized += Get-StatusValueOrDefault -Value $status -DefaultValue "unavailable"
  }

  if ($normalized.Count -eq 0) {
    return "unavailable"
  }

  $passCount = @($normalized | Where-Object { $_ -eq "pass" }).Count
  if ($passCount -eq $normalized.Count) {
    return "pass"
  }

  $observedCount = @($normalized | Where-Object { $_ -ne "unavailable" }).Count
  if ($observedCount -eq 0) {
    return "unavailable"
  }

  return "fail"
}

function Convert-ToNonNegativeIntOrDefault {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [int]$DefaultValue
  )

  if ($null -eq $Value) {
    return $DefaultValue
  }

  $parsed = 0
  if (-not [int]::TryParse([string]$Value, [ref]$parsed)) {
    return $DefaultValue
  }

  if ($parsed -lt 0) {
    return 0
  }

  return $parsed
}

function Convert-ToNullableDateTimeOffset {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  $parsed = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse($raw, [ref]$parsed)) {
    return $null
  }

  return $parsed.ToUniversalTime()
}

function New-HostedDirectLiveProofFreshnessSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$GeneratedAt,
    [Parameter(Mandatory = $true)]
    [DateTimeOffset]$ReferenceTimeUtc,
    [Parameter(Mandatory = $true)]
    [int]$MaxAgeHours
  )

  $default = [ordered]@{
    generatedAt      = $null
    generatedAtIsIso = $false
    ageMinutes       = $null
    maxAgeHours      = $(if ($MaxAgeHours -gt 0) { $MaxAgeHours } else { $null })
    status           = "unavailable"
    summary          = "unavailable"
  }

  if ($MaxAgeHours -lt 1) {
    $default.status = "disabled"
    $default.summary = "disabled"
    return $default
  }

  $parsedGeneratedAt = Convert-ToNullableDateTimeOffset -Value $GeneratedAt
  if ($null -eq $parsedGeneratedAt) {
    $default.status = "fail"
    $default.summary = "generatedAt missing or invalid"
    return $default
  }

  $age = $ReferenceTimeUtc - $parsedGeneratedAt
  if ($age.TotalMinutes -lt -5) {
    return [ordered]@{
      generatedAt      = $parsedGeneratedAt.ToString("o")
      generatedAtIsIso = $true
      ageMinutes       = $null
      maxAgeHours      = $MaxAgeHours
      status           = "fail"
      summary          = "generatedAt is in the future"
    }
  }

  $ageMinutes = [int][Math]::Floor([Math]::Max($age.TotalMinutes, 0))
  if ($age.TotalHours -gt $MaxAgeHours) {
    return [ordered]@{
      generatedAt      = $parsedGeneratedAt.ToString("o")
      generatedAtIsIso = $true
      ageMinutes       = $ageMinutes
      maxAgeHours      = $MaxAgeHours
      status           = "fail"
      summary          = ("stale: age=" + $ageMinutes + "m exceeds max=" + ($MaxAgeHours * 60) + "m")
    }
  }

  return [ordered]@{
    generatedAt      = $parsedGeneratedAt.ToString("o")
    generatedAtIsIso = $true
    ageMinutes       = $ageMinutes
    maxAgeHours      = $MaxAgeHours
    status           = "pass"
    summary          = ("fresh: age=" + $ageMinutes + "m within max=" + ($MaxAgeHours * 60) + "m")
  }
}

function New-RuntimeGuardrailsPrimaryPath {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $title = Get-StatusValueOrDefault -Value $Value.title -DefaultValue ""
  $kind = Get-StatusValueOrDefault -Value $Value.kind -DefaultValue ""
  $summaryText = Get-StatusValueOrDefault -Value $Value.summaryText -DefaultValue ""
  if ([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($kind) -or [string]::IsNullOrWhiteSpace($summaryText)) {
    return $null
  }

  $lifecycleStatus = "unknown"
  if ($null -ne $Value.lifecycle) {
    $lifecycleStatus = Get-StatusValueOrDefault -Value $Value.lifecycle.statusCode -DefaultValue "unknown"
  }

  return [ordered]@{
    title           = $title
    kind            = $kind
    profileId       = $(if ([string]::IsNullOrWhiteSpace([string]$Value.profileId)) { $null } else { [string]$Value.profileId })
    phase           = $(if ([string]::IsNullOrWhiteSpace([string]$Value.phase)) { $null } else { [string]$Value.phase })
    buttonLabel     = $(if ([string]::IsNullOrWhiteSpace([string]$Value.buttonLabel)) { $null } else { [string]$Value.buttonLabel })
    summaryText     = $summaryText
    lifecycleStatus = $lifecycleStatus
  }
}

function New-ProviderUsagePrimaryEntry {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $route = Get-StatusValueOrDefault -Value $Value.route -DefaultValue ""
  $capability = Get-StatusValueOrDefault -Value $Value.capability -DefaultValue ""
  $selectedProvider = Get-StatusValueOrDefault -Value $Value.selectedProvider -DefaultValue ""
  $selectedModel = Get-StatusValueOrDefault -Value $Value.selectedModel -DefaultValue ""
  $selectionReason = Get-StatusValueOrDefault -Value $Value.selectionReason -DefaultValue ""
  if (
    [string]::IsNullOrWhiteSpace($route) -or
    [string]::IsNullOrWhiteSpace($capability) -or
    [string]::IsNullOrWhiteSpace($selectedProvider) -or
    [string]::IsNullOrWhiteSpace($selectedModel) -or
    [string]::IsNullOrWhiteSpace($selectionReason)
  ) {
    return $null
  }

  return [ordered]@{
    route           = $route
    capability      = $capability
    selectedProvider = $selectedProvider
    selectedModel   = $selectedModel
    selectionReason = $selectionReason
  }
}

function New-LiveTransportSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status    = "unavailable"
      validated = $false
      runtime   = [ordered]@{
        validated      = $false
        requestedMode  = $null
        activeMode     = $null
        fallbackActive = $null
        evidenceSource = $null
      }
      session   = [ordered]@{
        observed         = $false
        activeMode       = $null
        provider         = $null
        model            = $null
        bootstrapState   = $null
        fallbackReason   = $null
        evidenceSource   = $null
        connectedEventType = $null
      }
      summary   = "unavailable"
    }
  }

  $runtime = if ($null -ne $Value.runtime) { $Value.runtime } else { $null }
  $session = if ($null -ne $Value.session) { $Value.session } else { $null }

  return [ordered]@{
    status    = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated = ($Value.validated -eq $true)
    runtime   = [ordered]@{
      validated      = ($null -ne $runtime -and $runtime.validated -eq $true)
      requestedMode  = $(if ($null -eq $runtime) { $null } else { Get-StatusValueOrDefault -Value $runtime.requestedMode -DefaultValue "" })
      activeMode     = $(if ($null -eq $runtime) { $null } else { Get-StatusValueOrDefault -Value $runtime.activeMode -DefaultValue "" })
      fallbackActive = $(if ($null -eq $runtime) { $null } else { if ($null -eq $runtime.fallbackActive) { $null } else { $runtime.fallbackActive -eq $true } })
      evidenceSource = $(if ($null -eq $runtime) { $null } else { Get-StatusValueOrDefault -Value $runtime.evidenceSource -DefaultValue "" })
    }
    session   = [ordered]@{
      observed           = ($null -ne $session -and $session.observed -eq $true)
      activeMode         = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.activeMode -DefaultValue "" })
      provider           = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.provider -DefaultValue "" })
      model              = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.model -DefaultValue "" })
      bootstrapState     = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.bootstrapState -DefaultValue "" })
      fallbackReason     = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.fallbackReason -DefaultValue "" })
      evidenceSource     = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.evidenceSource -DefaultValue "" })
      connectedEventType = $(if ($null -eq $session) { $null } else { Get-StatusValueOrDefault -Value $session.connectedEventType -DefaultValue "" })
    }
    summary   = Get-StatusValueOrDefault -Value $Value.summary -DefaultValue "unavailable"
  }
}

function New-CaseWikiEvidenceSignatureSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      source            = $null
      status            = "unavailable"
      validated         = $false
      totalArtifacts    = 0
      signedArtifacts   = 0
      unsignedArtifacts = 0
      signatureStatus   = $null
      algorithm         = $null
      canonicalization  = $null
      payloadHash       = $null
      keyId             = $null
      signerId          = $null
      signedAt          = $null
      signedAtIsIso     = $false
      signaturePresent  = $null
      caseId            = $null
      sessionId         = $null
      overviewStatus    = $null
      focusKind         = $null
      focusLabel        = $null
      nextAction        = $null
      sourceRefsCount   = 0
    }
  }

  $signedAt = Get-StatusValueOrDefault -Value $Value.signedAt -DefaultValue ""
  $signedAtIsIso = $false
  if (-not [string]::IsNullOrWhiteSpace($signedAt)) {
    $parsedSignedAt = [DateTimeOffset]::MinValue
    $signedAtIsIso = [DateTimeOffset]::TryParse($signedAt, [ref]$parsedSignedAt)
  }
  $validated = ($Value.validated -eq $true)
  $signatureStatus = $(if ([string]::IsNullOrWhiteSpace([string]$Value.signatureStatus)) { $null } else { [string]$Value.signatureStatus })
  $status = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
  if ($validated -and $status -eq "pass" -and $signatureStatus -eq "unsigned") {
    $status = "warn"
  }

  return [ordered]@{
    source            = $(if ([string]::IsNullOrWhiteSpace([string]$Value.source)) { "badge_details" } else { [string]$Value.source })
    status            = $status
    validated         = $validated
    totalArtifacts    = Convert-ToNonNegativeIntOrDefault -Value $Value.totalArtifacts -DefaultValue 0
    signedArtifacts   = Convert-ToNonNegativeIntOrDefault -Value $Value.signedArtifacts -DefaultValue 0
    unsignedArtifacts = Convert-ToNonNegativeIntOrDefault -Value $Value.unsignedArtifacts -DefaultValue 0
    signatureStatus   = $signatureStatus
    algorithm         = $(if ([string]::IsNullOrWhiteSpace([string]$Value.algorithm)) { $null } else { [string]$Value.algorithm })
    canonicalization  = $(if ([string]::IsNullOrWhiteSpace([string]$Value.canonicalization)) { $null } else { [string]$Value.canonicalization })
    payloadHash       = $(if ([string]::IsNullOrWhiteSpace([string]$Value.payloadHash)) { $null } else { [string]$Value.payloadHash })
    keyId             = $(if ([string]::IsNullOrWhiteSpace([string]$Value.keyId)) { $null } else { [string]$Value.keyId })
    signerId          = $(if ([string]::IsNullOrWhiteSpace([string]$Value.signerId)) { $null } else { [string]$Value.signerId })
    signedAt          = $(if ([string]::IsNullOrWhiteSpace($signedAt)) { $null } else { $signedAt })
    signedAtIsIso     = $signedAtIsIso
    signaturePresent  = $(if ($null -eq $Value.signaturePresent) { $null } else { $Value.signaturePresent -eq $true })
    caseId            = $(if ([string]::IsNullOrWhiteSpace([string]$Value.caseId)) { $null } else { [string]$Value.caseId })
    sessionId         = $(if ([string]::IsNullOrWhiteSpace([string]$Value.sessionId)) { $null } else { [string]$Value.sessionId })
    overviewStatus    = $(if ([string]::IsNullOrWhiteSpace([string]$Value.overviewStatus)) { $null } else { [string]$Value.overviewStatus })
    focusKind         = $(if ([string]::IsNullOrWhiteSpace([string]$Value.focusKind)) { $null } else { [string]$Value.focusKind })
    focusLabel        = $(if ([string]::IsNullOrWhiteSpace([string]$Value.focusLabel)) { $null } else { [string]$Value.focusLabel })
    nextAction        = $(if ([string]::IsNullOrWhiteSpace([string]$Value.nextAction)) { $null } else { [string]$Value.nextAction })
    sourceRefsCount   = Convert-ToNonNegativeIntOrDefault -Value $Value.sourceRefsCount -DefaultValue 0
  }
}

function New-HostedCaseWikiEvidenceSignatureValue {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  $caseWiki = if ($null -ne $Value.caseWiki) { $Value.caseWiki } else { $null }
  if ($null -eq $caseWiki) {
    return $null
  }

  $evidenceSignature = if ($null -ne $caseWiki.evidenceSignature) { $caseWiki.evidenceSignature } else { $null }
  if ($null -eq $evidenceSignature) {
    return $null
  }

  $signatureStatus = Get-StatusValueOrDefault -Value $evidenceSignature.status -DefaultValue ""
  $signaturePresent = if ($null -eq $evidenceSignature.signaturePresent) { $null } else { $evidenceSignature.signaturePresent -eq $true }
  $signedArtifacts = if ($signatureStatus -eq "signed" -and $signaturePresent -eq $true) { 1 } else { 0 }
  $unsignedArtifacts = if ($signatureStatus -eq "unsigned") { 1 } else { 0 }
  $totalArtifacts = if ($signedArtifacts -gt 0 -or $unsignedArtifacts -gt 0 -or -not [string]::IsNullOrWhiteSpace($signatureStatus)) { 1 } else { 0 }
  $status = if ($signatureStatus -eq "signed" -and $signaturePresent -eq $true) { "pass" } elseif ($signatureStatus -eq "unsigned") { "warn" } else { "unavailable" }

  return [ordered]@{
    source            = "hosted_direct_live_proof"
    status            = $status
    validated         = ($status -ne "unavailable")
    totalArtifacts    = $totalArtifacts
    signedArtifacts   = $signedArtifacts
    unsignedArtifacts = $unsignedArtifacts
    signatureStatus   = $(if ([string]::IsNullOrWhiteSpace($signatureStatus)) { $null } else { $signatureStatus })
    algorithm         = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.algorithm)) { $null } else { [string]$evidenceSignature.algorithm })
    canonicalization  = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.canonicalization)) { $null } else { [string]$evidenceSignature.canonicalization })
    payloadHash       = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.payloadHash)) { $null } else { [string]$evidenceSignature.payloadHash })
    keyId             = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.keyId)) { $null } else { [string]$evidenceSignature.keyId })
    signerId          = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.signerId)) { $null } else { [string]$evidenceSignature.signerId })
    signedAt          = $(if ([string]::IsNullOrWhiteSpace([string]$evidenceSignature.signedAt)) { $null } else { [string]$evidenceSignature.signedAt })
    signaturePresent  = $signaturePresent
    caseId            = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.caseId)) { $null } else { [string]$caseWiki.caseId })
    sessionId         = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.sessionId)) { $null } else { [string]$caseWiki.sessionId })
    overviewStatus    = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.overviewStatus)) { $null } else { [string]$caseWiki.overviewStatus })
    focusKind         = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.focusKind)) { $null } else { [string]$caseWiki.focusKind })
    focusLabel        = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.focusLabel)) { $null } else { [string]$caseWiki.focusLabel })
    nextAction        = $(if ([string]::IsNullOrWhiteSpace([string]$caseWiki.recommendedNextAction)) { $null } else { [string]$caseWiki.recommendedNextAction })
    sourceRefsCount   = Convert-ToNonNegativeIntOrDefault -Value $caseWiki.sourceRefsCount -DefaultValue 0
  }
}

function Resolve-CaseWikiEvidenceSignatureSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$BadgeSnapshot,
    [Parameter(Mandatory = $false)]
    [object]$HostedDirectLiveProofSnapshot,
    [Parameter(Mandatory = $false)]
    [object]$HostedSnapshot
  )

  $fallbackSnapshot = if ($null -eq $BadgeSnapshot) {
    New-CaseWikiEvidenceSignatureSnapshot -Value $null
  } else {
    $BadgeSnapshot
  }

  if ($null -eq $HostedDirectLiveProofSnapshot -or $null -eq $HostedSnapshot) {
    return $fallbackSnapshot
  }

  $hostedStatus = Get-StatusValueOrDefault -Value $HostedDirectLiveProofSnapshot.status -DefaultValue "unavailable"
  $hostedExpectedSignatureStatus = Get-StatusValueOrDefault -Value $HostedDirectLiveProofSnapshot.caseWikiExpectedSignatureStatus -DefaultValue ""
  $hostedObservedSignatureStatus = Get-StatusValueOrDefault -Value $HostedDirectLiveProofSnapshot.caseWikiSignatureStatus -DefaultValue ""
  $hostedObservedSignaturePresent = ($HostedDirectLiveProofSnapshot.caseWikiSignaturePresent -eq $true)

  if (
    $hostedStatus -eq "pass" -and
    $HostedDirectLiveProofSnapshot.observed -eq $true -and
    $hostedExpectedSignatureStatus -eq "signed" -and
    $hostedObservedSignatureStatus -eq "signed" -and
    $hostedObservedSignaturePresent
  ) {
    return $HostedSnapshot
  }

  return $fallbackSnapshot
}

function New-CaseWikiRoutingContextSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status          = "unavailable"
      validated       = $false
      observed        = $false
      contextSource   = $null
      focusId         = $null
      blocker         = $null
      nextAction      = $null
      route           = $null
      mode            = $null
      requestedIntent = $null
      routedIntent    = $null
    }
  }

  return [ordered]@{
    status          = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated       = ($Value.validated -eq $true)
    observed        = ($Value.observed -eq $true)
    contextSource   = $(if ([string]::IsNullOrWhiteSpace([string]$Value.contextSource)) { $null } else { [string]$Value.contextSource })
    focusId         = $(if ([string]::IsNullOrWhiteSpace([string]$Value.focusId)) { $null } else { [string]$Value.focusId })
    blocker         = $(if ([string]::IsNullOrWhiteSpace([string]$Value.blocker)) { $null } else { [string]$Value.blocker })
    nextAction      = $(if ([string]::IsNullOrWhiteSpace([string]$Value.nextAction)) { $null } else { [string]$Value.nextAction })
    route           = $(if ([string]::IsNullOrWhiteSpace([string]$Value.route)) { $null } else { [string]$Value.route })
    mode            = $(if ([string]::IsNullOrWhiteSpace([string]$Value.mode)) { $null } else { [string]$Value.mode })
    requestedIntent = $(if ([string]::IsNullOrWhiteSpace([string]$Value.requestedIntent)) { $null } else { [string]$Value.requestedIntent })
    routedIntent    = $(if ([string]::IsNullOrWhiteSpace([string]$Value.routedIntent)) { $null } else { [string]$Value.routedIntent })
  }
}

function New-CaseWikiGatewayHydrationSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                    = "unavailable"
      validated                 = $false
      observed                  = $false
      sessionId                 = $null
      noteEventId               = $null
      questionId                = $null
      questionMatched           = $null
      noteSourceRefSeen         = $null
      questionSuggestedNextStep = $null
      contextSource             = $null
      focusId                   = $null
      blocker                   = $null
      nextAction                = $null
      route                     = $null
      mode                      = $null
      requestedIntent           = $null
      routedIntent              = $null
    }
  }

  return [ordered]@{
    status                    = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated                 = ($Value.validated -eq $true)
    observed                  = ($Value.observed -eq $true)
    sessionId                 = $(if ([string]::IsNullOrWhiteSpace([string]$Value.sessionId)) { $null } else { [string]$Value.sessionId })
    noteEventId               = $(if ([string]::IsNullOrWhiteSpace([string]$Value.noteEventId)) { $null } else { [string]$Value.noteEventId })
    questionId                = $(if ([string]::IsNullOrWhiteSpace([string]$Value.questionId)) { $null } else { [string]$Value.questionId })
    questionMatched           = $(if ($null -eq $Value.questionMatched) { $null } else { $Value.questionMatched -eq $true })
    noteSourceRefSeen         = $(if ($null -eq $Value.noteSourceRefSeen) { $null } else { $Value.noteSourceRefSeen -eq $true })
    questionSuggestedNextStep = $(if ([string]::IsNullOrWhiteSpace([string]$Value.questionSuggestedNextStep)) { $null } else { [string]$Value.questionSuggestedNextStep })
    contextSource             = $(if ([string]::IsNullOrWhiteSpace([string]$Value.contextSource)) { $null } else { [string]$Value.contextSource })
    focusId                   = $(if ([string]::IsNullOrWhiteSpace([string]$Value.focusId)) { $null } else { [string]$Value.focusId })
    blocker                   = $(if ([string]::IsNullOrWhiteSpace([string]$Value.blocker)) { $null } else { [string]$Value.blocker })
    nextAction                = $(if ([string]::IsNullOrWhiteSpace([string]$Value.nextAction)) { $null } else { [string]$Value.nextAction })
    route                     = $(if ([string]::IsNullOrWhiteSpace([string]$Value.route)) { $null } else { [string]$Value.route })
    mode                      = $(if ([string]::IsNullOrWhiteSpace([string]$Value.mode)) { $null } else { [string]$Value.mode })
    requestedIntent           = $(if ([string]::IsNullOrWhiteSpace([string]$Value.requestedIntent)) { $null } else { [string]$Value.requestedIntent })
    routedIntent              = $(if ([string]::IsNullOrWhiteSpace([string]$Value.routedIntent)) { $null } else { [string]$Value.routedIntent })
  }
}

function New-CaseWikiContextAdoptionSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                = "unavailable"
      validated             = $false
      observed              = $false
      observedCount         = 0
      caseWikiObservedCount = 0
      inputOnlyObservedCount = 0
      unknownObservedCount  = 0
      caseWikiRate          = $null
    }
  }

  $caseWikiRate = $null
  if ($null -ne $Value.caseWikiRate -and -not [string]::IsNullOrWhiteSpace([string]$Value.caseWikiRate)) {
    $caseWikiRate = [double]$Value.caseWikiRate
  }

  return [ordered]@{
    status                 = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated              = ($Value.validated -eq $true)
    observed               = ($Value.observed -eq $true)
    observedCount          = Convert-ToNonNegativeIntOrDefault -Value $Value.observedCount -DefaultValue 0
    caseWikiObservedCount  = Convert-ToNonNegativeIntOrDefault -Value $Value.caseWikiObservedCount -DefaultValue 0
    inputOnlyObservedCount = Convert-ToNonNegativeIntOrDefault -Value $Value.inputOnlyObservedCount -DefaultValue 0
    unknownObservedCount   = Convert-ToNonNegativeIntOrDefault -Value $Value.unknownObservedCount -DefaultValue 0
    caseWikiRate           = $caseWikiRate
  }
}

function New-UiRefHealingSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                 = "unavailable"
      validated              = $false
      observed               = $false
      finalStatus            = $null
      adapterMode            = $null
      healedRefCount         = 0
      healedRefTargets       = @()
      staleRefCount          = 0
      staleRefTargets        = @()
      traceCount             = 0
      retries                = 0
      disabledSubmitSeen     = $null
      enabledSubmitSeen      = $null
      healingObservationSeen = $null
      healingNoteSeen        = $null
    }
  }

  return [ordered]@{
    status                 = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated              = ($Value.validated -eq $true)
    observed               = ($Value.observed -eq $true)
    finalStatus            = $(if ([string]::IsNullOrWhiteSpace([string]$Value.finalStatus)) { $null } else { [string]$Value.finalStatus })
    adapterMode            = $(if ([string]::IsNullOrWhiteSpace([string]$Value.adapterMode)) { $null } else { [string]$Value.adapterMode })
    healedRefCount         = Convert-ToNonNegativeIntOrDefault -Value $Value.healedRefCount -DefaultValue 0
    healedRefTargets       = @($Value.healedRefTargets | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ })
    staleRefCount          = Convert-ToNonNegativeIntOrDefault -Value $Value.staleRefCount -DefaultValue 0
    staleRefTargets        = @($Value.staleRefTargets | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ })
    traceCount             = Convert-ToNonNegativeIntOrDefault -Value $Value.traceCount -DefaultValue 0
    retries                = Convert-ToNonNegativeIntOrDefault -Value $Value.retries -DefaultValue 0
    disabledSubmitSeen     = $(if ($null -eq $Value.disabledSubmitSeen) { $null } else { $Value.disabledSubmitSeen -eq $true })
    enabledSubmitSeen      = $(if ($null -eq $Value.enabledSubmitSeen) { $null } else { $Value.enabledSubmitSeen -eq $true })
    healingObservationSeen = $(if ($null -eq $Value.healingObservationSeen) { $null } else { $Value.healingObservationSeen -eq $true })
    healingNoteSeen        = $(if ($null -eq $Value.healingNoteSeen) { $null } else { $Value.healingNoteSeen -eq $true })
  }
}

function New-BrowserWorkerRecoverySnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                         = "unavailable"
      validated                      = $false
      observed                       = $false
      finalStatus                    = $null
      adapterMode                    = $null
      checkpointCount                = 0
      resumedCheckpointCount         = 0
      healedRefCount                 = 0
      healedRefTargets               = @()
      staleRefCount                  = 0
      staleRefTargets                = @()
      traceCount                     = 0
      retryCount                     = 0
      runtimeRetryCount              = 0
      runtimeResumedCheckpointCount  = 0
      runtimeStaleRefCount           = 0
      runtimeHealedRefCount          = 0
      checkpointReadyCleared         = $null
      summary                        = $null
    }
  }

  return [ordered]@{
    status                         = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated                      = ($Value.validated -eq $true)
    observed                       = ($Value.observed -eq $true)
    finalStatus                    = $(if ([string]::IsNullOrWhiteSpace([string]$Value.finalStatus)) { $null } else { [string]$Value.finalStatus })
    adapterMode                    = $(if ([string]::IsNullOrWhiteSpace([string]$Value.adapterMode)) { $null } else { [string]$Value.adapterMode })
    checkpointCount                = Convert-ToNonNegativeIntOrDefault -Value $Value.checkpointCount -DefaultValue 0
    resumedCheckpointCount         = Convert-ToNonNegativeIntOrDefault -Value $Value.resumedCheckpointCount -DefaultValue 0
    healedRefCount                 = Convert-ToNonNegativeIntOrDefault -Value $Value.healedRefCount -DefaultValue 0
    healedRefTargets               = @($Value.healedRefTargets | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ })
    staleRefCount                  = Convert-ToNonNegativeIntOrDefault -Value $Value.staleRefCount -DefaultValue 0
    staleRefTargets                = @($Value.staleRefTargets | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ })
    traceCount                     = Convert-ToNonNegativeIntOrDefault -Value $Value.traceCount -DefaultValue 0
    retryCount                     = Convert-ToNonNegativeIntOrDefault -Value $Value.retryCount -DefaultValue 0
    runtimeRetryCount              = Convert-ToNonNegativeIntOrDefault -Value $Value.runtimeRetryCount -DefaultValue 0
    runtimeResumedCheckpointCount  = Convert-ToNonNegativeIntOrDefault -Value $Value.runtimeResumedCheckpointCount -DefaultValue 0
    runtimeStaleRefCount           = Convert-ToNonNegativeIntOrDefault -Value $Value.runtimeStaleRefCount -DefaultValue 0
    runtimeHealedRefCount          = Convert-ToNonNegativeIntOrDefault -Value $Value.runtimeHealedRefCount -DefaultValue 0
    checkpointReadyCleared         = $(if ($null -eq $Value.checkpointReadyCleared) { $null } else { $Value.checkpointReadyCleared -eq $true })
    summary                        = $(if ([string]::IsNullOrWhiteSpace([string]$Value.summary)) { $null } else { [string]$Value.summary })
  }
}

function New-NavigatorVisaFlowsSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                       = "unavailable"
      validated                    = $false
      observed                     = $false
      totalFlows                   = 0
      succeededFlows               = 0
      successRate                  = $null
      persistentSessionCount       = 0
      replayBundleCount            = 0
      verifiedCount                = 0
      staleRecoveryObservedCount   = 0
      healedRecoveryObservedCount  = 0
      resumedCheckpointCount       = 0
      checkpointReadyClearedCount  = 0
      scenarioNames                = @()
      summary                      = $null
    }
  }

  $successRate = $null
  if ($null -ne $Value.successRate -and -not [string]::IsNullOrWhiteSpace([string]$Value.successRate)) {
    $successRate = [double]$Value.successRate
  }

  return [ordered]@{
    status                       = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
    validated                    = ($Value.validated -eq $true)
    observed                     = ($Value.observed -eq $true)
    totalFlows                   = Convert-ToNonNegativeIntOrDefault -Value $Value.totalFlows -DefaultValue 0
    succeededFlows               = Convert-ToNonNegativeIntOrDefault -Value $Value.succeededFlows -DefaultValue 0
    successRate                  = $successRate
    persistentSessionCount       = Convert-ToNonNegativeIntOrDefault -Value $Value.persistentSessionCount -DefaultValue 0
    replayBundleCount            = Convert-ToNonNegativeIntOrDefault -Value $Value.replayBundleCount -DefaultValue 0
    verifiedCount                = Convert-ToNonNegativeIntOrDefault -Value $Value.verifiedCount -DefaultValue 0
    staleRecoveryObservedCount   = Convert-ToNonNegativeIntOrDefault -Value $Value.staleRecoveryObservedCount -DefaultValue 0
    healedRecoveryObservedCount  = Convert-ToNonNegativeIntOrDefault -Value $Value.healedRecoveryObservedCount -DefaultValue 0
    resumedCheckpointCount       = Convert-ToNonNegativeIntOrDefault -Value $Value.resumedCheckpointCount -DefaultValue 0
    checkpointReadyClearedCount  = Convert-ToNonNegativeIntOrDefault -Value $Value.checkpointReadyClearedCount -DefaultValue 0
    scenarioNames                = @($Value.scenarioNames | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ })
    summary                      = $(if ([string]::IsNullOrWhiteSpace([string]$Value.summary)) { $null } else { [string]$Value.summary })
  }
}

function New-HostedDirectLiveProofSnapshot {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [DateTimeOffset]$ReferenceTimeUtc,
    [Parameter(Mandatory = $true)]
    [int]$MaxAgeHours
  )

  if ($null -eq $Value) {
    return [ordered]@{
      status                   = "unavailable"
      observed                 = $false
      apiPublicUrl             = $null
      apiPublicUrlSource       = $null
      frontendPublicUrl        = $null
      requestedSessionId       = $null
      sessionId                = $null
      generatedAt              = $null
      generatedAtIsIso         = $false
      freshnessStatus          = "unavailable"
      freshnessSummary         = "unavailable"
      freshnessAgeMinutes      = $null
      freshnessMaxAgeHours     = $(if ($MaxAgeHours -gt 0) { $MaxAgeHours } else { $null })
      runtimePreferredMode     = $null
      runtimeActiveMode        = $null
      replayActiveMode         = $null
      replayEvidenceSource     = $null
      firstAudioMs             = $null
      firstOutputMs            = $null
      fallbackEventCount       = 0
      fallbackReason           = $null
      runtimeEvidenceExpectedSignatureStatus = $null
      runtimeEvidenceKeyState  = $null
      caseWikiExpectedSignatureStatus = $null
      caseWikiExpectedSignatureSource = $null
      caseWikiSignatureStatus  = $null
      caseWikiSignaturePresent = $null
      latencyObserved          = $false
      summary                  = "unavailable"
    }
  }

  $runtimeStatus = if ($null -ne $Value.runtimeStatus) { $Value.runtimeStatus } else { $null }
  $replay = if ($null -ne $Value.replay) { $Value.replay } else { $null }
  $replayLiveTransport = if ($null -ne $replay -and $null -ne $replay.liveTransport) { $replay.liveTransport } else { $null }
  $caseWiki = if ($null -ne $Value.caseWiki) { $Value.caseWiki } else { $null }
  $runtimeDiagnostics = if ($null -ne $Value.runtimeDiagnostics) { $Value.runtimeDiagnostics } else { $null }
  $runtimeDiagnosticsApiBackendEvidenceSigning =
    if ($null -ne $runtimeDiagnostics -and $null -ne $runtimeDiagnostics.apiBackendEvidenceSigning) {
      $runtimeDiagnostics.apiBackendEvidenceSigning
    } else {
      $null
    }
  $caseWikiEvidenceSignatureExpectation =
    if ($null -ne $Value.caseWikiEvidenceSignatureExpectation) { $Value.caseWikiEvidenceSignatureExpectation } else { $null }
  $caseWikiEvidenceSignature =
    if ($null -ne $caseWiki -and $null -ne $caseWiki.evidenceSignature) { $caseWiki.evidenceSignature } else { $null }
  $freshness = New-HostedDirectLiveProofFreshnessSnapshot -GeneratedAt $Value.generatedAt -ReferenceTimeUtc $ReferenceTimeUtc -MaxAgeHours $MaxAgeHours
  $status = Get-StatusValueOrDefault -Value $Value.status -DefaultValue "unavailable"
  $summary = Get-StatusValueOrDefault -Value $Value.summary -DefaultValue "unavailable"

  $firstAudioMs = if ($null -eq $replayLiveTransport) { $null } else { Convert-ToNonNegativeIntOrDefault -Value $replayLiveTransport.firstAudioMs -DefaultValue -1 }
  if ($firstAudioMs -lt 0) {
    $firstAudioMs = $null
  }
  $firstOutputMs = if ($null -eq $replayLiveTransport) { $null } else { Convert-ToNonNegativeIntOrDefault -Value $replayLiveTransport.firstOutputMs -DefaultValue -1 }
  if ($firstOutputMs -lt 0) {
    $firstOutputMs = $null
  }

  if ($freshness.status -eq "fail") {
    $status = "fail"
    if ([string]::IsNullOrWhiteSpace($summary) -or $summary -eq "unavailable") {
      $summary = $freshness.summary
    } else {
      $summary = ($summary + " | " + $freshness.summary)
    }
  }

  return [ordered]@{
    status                   = $status
    observed                 = (
      (Get-StatusValueOrDefault -Value $replayLiveTransport.activeMode -DefaultValue "") -eq "direct_live" -and
      (Get-StatusValueOrDefault -Value $replayLiveTransport.evidenceSource -DefaultValue "") -eq "session_events"
    )
    apiPublicUrl             = $(if ([string]::IsNullOrWhiteSpace([string]$Value.apiPublicUrl)) { $null } else { [string]$Value.apiPublicUrl })
    apiPublicUrlSource       = $(if ([string]::IsNullOrWhiteSpace([string]$Value.apiPublicUrlSource)) { $null } else { [string]$Value.apiPublicUrlSource })
    frontendPublicUrl        = $(if ([string]::IsNullOrWhiteSpace([string]$Value.frontendPublicUrl)) { $null } else { [string]$Value.frontendPublicUrl })
    requestedSessionId       = $(if ([string]::IsNullOrWhiteSpace([string]$Value.requestedSessionId)) { $null } else { [string]$Value.requestedSessionId })
    sessionId                = $(if ([string]::IsNullOrWhiteSpace([string]$Value.sessionId)) { $null } else { [string]$Value.sessionId })
    generatedAt              = $freshness.generatedAt
    generatedAtIsIso         = $freshness.generatedAtIsIso
    freshnessStatus          = $freshness.status
    freshnessSummary         = $freshness.summary
    freshnessAgeMinutes      = $freshness.ageMinutes
    freshnessMaxAgeHours     = $freshness.maxAgeHours
    runtimePreferredMode     = $(if ($null -eq $runtimeStatus) { $null } else { Get-StatusValueOrDefault -Value $runtimeStatus.preferredMode -DefaultValue "" })
    runtimeActiveMode        = $(if ($null -eq $runtimeStatus) { $null } else { Get-StatusValueOrDefault -Value $runtimeStatus.activeMode -DefaultValue "" })
    replayActiveMode         = $(if ($null -eq $replayLiveTransport) { $null } else { Get-StatusValueOrDefault -Value $replayLiveTransport.activeMode -DefaultValue "" })
    replayEvidenceSource     = $(if ($null -eq $replayLiveTransport) { $null } else { Get-StatusValueOrDefault -Value $replayLiveTransport.evidenceSource -DefaultValue "" })
    firstAudioMs             = $firstAudioMs
    firstOutputMs            = $firstOutputMs
    fallbackEventCount       = $(if ($null -eq $replayLiveTransport) { 0 } else { Convert-ToNonNegativeIntOrDefault -Value $replayLiveTransport.fallbackEventCount -DefaultValue 0 })
    fallbackReason           = $(if ($null -eq $replayLiveTransport) { $null } else { Get-StatusValueOrDefault -Value $replayLiveTransport.fallbackReason -DefaultValue "" })
    runtimeEvidenceExpectedSignatureStatus =
      $(if ($null -eq $runtimeDiagnosticsApiBackendEvidenceSigning) { $null } else { Get-StatusValueOrDefault -Value $runtimeDiagnosticsApiBackendEvidenceSigning.expectedSignatureStatus -DefaultValue "" })
    runtimeEvidenceKeyState  =
      $(if ($null -eq $runtimeDiagnosticsApiBackendEvidenceSigning) { $null } else { Get-StatusValueOrDefault -Value $runtimeDiagnosticsApiBackendEvidenceSigning.keyState -DefaultValue "" })
    caseWikiExpectedSignatureStatus =
      $(if ($null -eq $caseWikiEvidenceSignatureExpectation) { $null } else { Get-StatusValueOrDefault -Value $caseWikiEvidenceSignatureExpectation.expectedStatus -DefaultValue "" })
    caseWikiExpectedSignatureSource =
      $(if ($null -eq $caseWikiEvidenceSignatureExpectation) { $null } else { Get-StatusValueOrDefault -Value $caseWikiEvidenceSignatureExpectation.source -DefaultValue "" })
    caseWikiSignatureStatus  = $(if ($null -eq $caseWikiEvidenceSignature) { $null } else { Get-StatusValueOrDefault -Value $caseWikiEvidenceSignature.status -DefaultValue "" })
    caseWikiSignaturePresent = $(if ($null -eq $caseWikiEvidenceSignature -or $null -eq $caseWikiEvidenceSignature.signaturePresent) { $null } else { $caseWikiEvidenceSignature.signaturePresent -eq $true })
    latencyObserved          = ($null -ne $firstAudioMs) -or ($null -ne $firstOutputMs)
    summary                  = $summary
  }
}

function New-ArtifactEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Id,
    [Parameter(Mandatory = $true)]
    [string]$Category,
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [bool]$Required,
    [Parameter(Mandatory = $true)]
    [bool]$Present
  )

  return [ordered]@{
    id       = $Id
    category = $Category
    label    = $Label
    path     = $Path
    required = $Required
    present  = $Present
  }
}

function Read-JsonIfExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return @{
      present    = $false
      parsed     = $false
      value      = $null
      parseError = $null
    }
  }

  try {
    return @{
      present    = $true
      parsed     = $true
      value      = (Get-Content $Path -Raw | ConvertFrom-Json)
      parseError = $null
    }
  }
  catch {
    return @{
      present    = $true
      parsed     = $false
      value      = $null
      parseError = [string]$_.Exception.Message
    }
  }
}

$resolvedBadgeDetailsPath = [System.IO.Path]::GetFullPath($BadgeDetailsPath)
$resolvedOutputJsonPath = [System.IO.Path]::GetFullPath($OutputJsonPath)
$resolvedOutputMarkdownPath = [System.IO.Path]::GetFullPath($OutputMarkdownPath)
$resolvedOutputManifestJsonPath = [System.IO.Path]::GetFullPath($OutputManifestJsonPath)
$resolvedOutputManifestMarkdownPath = [System.IO.Path]::GetFullPath($OutputManifestMarkdownPath)
$resolvedOutputRuntimeProofJsonPath = if ([string]::IsNullOrWhiteSpace($OutputRuntimeProofJsonPath)) {
  [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $resolvedOutputJsonPath) "runtime-proof-report.json"))
} else {
  [System.IO.Path]::GetFullPath($OutputRuntimeProofJsonPath)
}
$resolvedOutputRuntimeProofMarkdownPath = if ([string]::IsNullOrWhiteSpace($OutputRuntimeProofMarkdownPath)) {
  [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $resolvedOutputMarkdownPath) "runtime-proof-report.md"))
} else {
  [System.IO.Path]::GetFullPath($OutputRuntimeProofMarkdownPath)
}
$reportGeneratedAtUtc = [DateTimeOffset]::UtcNow
$reportGeneratedAt = $reportGeneratedAtUtc.ToString("o")

$resolvedDemoSummaryPath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/summary.json")
$resolvedDemoPolicyPath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/policy-check.json")
$resolvedDemoBadgePath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/badge.json")
$resolvedNavigatorVisaFlowsPath = [System.IO.Path]::GetFullPath("artifacts/demo-e2e/navigator-visa-flows.json")
$resolvedPerfSummaryPath = [System.IO.Path]::GetFullPath("artifacts/perf-load/summary.json")
$resolvedPerfPolicyPath = [System.IO.Path]::GetFullPath("artifacts/perf-load/policy-check.json")
$resolvedDirectLiveProofJsonPath = [System.IO.Path]::GetFullPath("artifacts/deploy/direct-live-proof.json")
$resolvedDirectLiveProofMarkdownPath = [System.IO.Path]::GetFullPath("artifacts/deploy/direct-live-proof.md")
$resolvedDirectLiveProofPngPath = [System.IO.Path]::GetFullPath("artifacts/deploy/direct-live-proof.png")
$resolvedSourceRunManifestPath = [System.IO.Path]::GetFullPath("artifacts/release-artifact-revalidation/source-run.json")
$resolvedGcpCloudRunSummaryPath = [System.IO.Path]::GetFullPath("artifacts/deploy/gcp-cloud-run-summary.json")
$resolvedGcpFirestoreSummaryPath = [System.IO.Path]::GetFullPath("artifacts/deploy/gcp-firestore-summary.json")
$resolvedGcpRuntimeProofPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/gcp-runtime-proof.json")
$resolvedSubmissionRefreshStatusPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/submission-refresh-status.json")
$resolvedSubmissionRefreshStatusMarkdownPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/submission-refresh-status.md")
$resolvedVideoShotListPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/video-shot-list.md")
$resolvedVideoScriptPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/video-script-4min.md")
$resolvedScreenChecklistPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/screen-checklist.md")
$resolvedBonusArticleDraftPath = [System.IO.Path]::GetFullPath("artifacts/release-evidence/bonus-article-draft.md")
$gcpRuntimeProofRead = Read-JsonIfExists -Path $resolvedGcpRuntimeProofPath
$gcpRuntimeProof = if ($gcpRuntimeProofRead.present -and $gcpRuntimeProofRead.parsed) { $gcpRuntimeProofRead.value } else { $null }
$submissionRefreshStatusRead = Read-JsonIfExists -Path $resolvedSubmissionRefreshStatusPath
$submissionRefreshStatus = if ($submissionRefreshStatusRead.present -and $submissionRefreshStatusRead.parsed) { $submissionRefreshStatusRead.value } else { $null }
$gcpRuntimeProofStatus = if ($null -ne $gcpRuntimeProof) {
  Get-StatusValueOrDefault -Value $gcpRuntimeProof.status -DefaultValue "placeholder_pending_post_deploy"
} else {
  "placeholder_pending_post_deploy"
}
$gcpRuntimeProofBlockingReason = if ($null -ne $gcpRuntimeProof) {
  Get-StatusValueOrDefault -Value $gcpRuntimeProof.blockingReason -DefaultValue "none"
} else {
  "Cloud Run deploy and live GCP evidence collection were not executed in this workspace session because gcloud and bq are not installed."
}
$submissionSafeSummaryGate = if ($null -ne $gcpRuntimeProof -and $null -ne $gcpRuntimeProof.submissionSafeSummaryGate) {
  [ordered]@{
    liveApiEnabled          = ($gcpRuntimeProof.submissionSafeSummaryGate.liveApiEnabled -eq $true)
    translationProvider     = Get-StatusValueOrDefault -Value $gcpRuntimeProof.submissionSafeSummaryGate.translationProvider -DefaultValue "not_fallback"
    storytellerMediaMode    = Get-StatusValueOrDefault -Value $gcpRuntimeProof.submissionSafeSummaryGate.storytellerMediaMode -DefaultValue "not_simulated"
    uiExecutorForceSimulation = ($gcpRuntimeProof.submissionSafeSummaryGate.uiExecutorForceSimulation -eq $true)
  }
} else {
  [ordered]@{
    liveApiEnabled            = $true
    translationProvider       = "not_fallback"
    storytellerMediaMode      = "not_simulated"
    uiExecutorForceSimulation = $false
  }
}

$report = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = $reportGeneratedAt
  source        = [ordered]@{
    badgeDetailsPath    = $resolvedBadgeDetailsPath
    badgeDetailsPresent = $false
    badgeDetailsParsed  = $false
    parseError          = $null
  }
  statuses      = [ordered]@{
    turnTruncationStatus      = "unavailable"
    turnDeleteStatus          = "unavailable"
    operatorDamageControlStatus = "unavailable"
    governancePolicyStatus    = "unavailable"
    skillsRegistryStatus      = "unavailable"
    pluginMarketplaceStatus   = "unavailable"
    deviceNodesStatus         = "unavailable"
    agentUsageStatus          = "unavailable"
    runtimeGuardrailsSignalPathsStatus = "unavailable"
    liveTransportStatus       = "unavailable"
    hostedDirectLiveProofStatus = "unavailable"
    providerUsageStatus       = "unavailable"
    caseWikiEvidenceSignatureStatus = "unavailable"
    caseWikiRoutingContextStatus = "unavailable"
    caseWikiGatewayHydrationStatus = "unavailable"
    caseWikiContextAdoptionStatus = "unavailable"
    uiRefHealingStatus       = "unavailable"
    browserWorkerRecoveryStatus = "unavailable"
    navigatorVisaFlowsStatus = "unavailable"
    deviceNodeUpdatesStatus   = "unavailable"
  }
  deviceNodeUpdates = [ordered]@{
    updatesValidated   = $false
    updatesHasUpsert   = $false
    updatesHasHeartbeat = $false
    updatesApiValidated = $false
    updatesTotal       = 0
  }
  runtimeGuardrailsSignalPaths = [ordered]@{
    summaryStatus = "unavailable"
    totalPaths    = 0
    primaryPath   = $null
  }
  liveTransport = [ordered]@{
    status    = "unavailable"
    validated = $false
    runtime   = [ordered]@{
      validated      = $false
      requestedMode  = $null
      activeMode     = $null
      fallbackActive = $null
      evidenceSource = $null
    }
    session   = [ordered]@{
      observed           = $false
      activeMode         = $null
      provider           = $null
      model              = $null
      bootstrapState     = $null
      fallbackReason     = $null
      evidenceSource     = $null
      connectedEventType = $null
    }
    summary   = "unavailable"
  }
  hostedDirectLiveProof = [ordered]@{
    status                   = "unavailable"
    observed                 = $false
    apiPublicUrl             = $null
    apiPublicUrlSource       = $null
    frontendPublicUrl        = $null
    requestedSessionId       = $null
    sessionId                = $null
    generatedAt              = $null
    generatedAtIsIso         = $false
    freshnessStatus          = "unavailable"
    freshnessSummary         = "unavailable"
    freshnessAgeMinutes      = $null
    freshnessMaxAgeHours     = $(if ($HostedDirectLiveProofMaxAgeHours -gt 0) { $HostedDirectLiveProofMaxAgeHours } else { $null })
    runtimePreferredMode     = $null
    runtimeActiveMode        = $null
    replayActiveMode         = $null
    replayEvidenceSource     = $null
    firstAudioMs             = $null
    firstOutputMs            = $null
    fallbackEventCount       = 0
    fallbackReason           = $null
    runtimeEvidenceExpectedSignatureStatus = $null
    runtimeEvidenceKeyState  = $null
    caseWikiExpectedSignatureStatus = $null
    caseWikiExpectedSignatureSource = $null
    caseWikiSignatureStatus  = $null
    caseWikiSignaturePresent = $null
    latencyObserved          = $false
    summary                  = "unavailable"
  }
  caseWikiEvidenceSignature = [ordered]@{
    source            = $null
    status            = "unavailable"
    validated         = $false
    totalArtifacts    = 0
    signedArtifacts   = 0
    unsignedArtifacts = 0
    signatureStatus   = $null
    algorithm         = $null
    canonicalization  = $null
    payloadHash       = $null
    keyId             = $null
    signerId          = $null
    signedAt          = $null
    signedAtIsIso     = $false
    signaturePresent  = $null
    caseId            = $null
    sessionId         = $null
    overviewStatus    = $null
    focusKind         = $null
    focusLabel        = $null
    nextAction        = $null
    sourceRefsCount   = 0
  }
  caseWikiRoutingContext = [ordered]@{
    status          = "unavailable"
    validated       = $false
    observed        = $false
    contextSource   = $null
    focusId         = $null
    blocker         = $null
    nextAction      = $null
    route           = $null
    mode            = $null
    requestedIntent = $null
    routedIntent    = $null
  }
  caseWikiGatewayHydration = [ordered]@{
    status                    = "unavailable"
    validated                 = $false
    observed                  = $false
    sessionId                 = $null
    noteEventId               = $null
    questionId                = $null
    questionMatched           = $null
    noteSourceRefSeen         = $null
    questionSuggestedNextStep = $null
    contextSource             = $null
    focusId                   = $null
    blocker                   = $null
    nextAction                = $null
    route                     = $null
    mode                      = $null
    requestedIntent           = $null
    routedIntent              = $null
  }
  caseWikiContextAdoption = [ordered]@{
    status                 = "unavailable"
    validated              = $false
    observed               = $false
    observedCount          = 0
    caseWikiObservedCount  = 0
    inputOnlyObservedCount = 0
    unknownObservedCount   = 0
    caseWikiRate           = $null
  }
  uiRefHealing = [ordered]@{
    status                 = "unavailable"
    validated              = $false
    observed               = $false
    finalStatus            = $null
    adapterMode            = $null
    healedRefCount         = 0
    healedRefTargets       = @()
    staleRefCount          = 0
    staleRefTargets        = @()
    traceCount             = 0
    retries                = 0
    disabledSubmitSeen     = $null
    enabledSubmitSeen      = $null
    healingObservationSeen = $null
    healingNoteSeen        = $null
  }
  browserWorkerRecovery = [ordered]@{
    status                        = "unavailable"
    validated                     = $false
    observed                      = $false
    finalStatus                   = $null
    adapterMode                   = $null
    checkpointCount               = 0
    resumedCheckpointCount        = 0
    healedRefCount                = 0
    healedRefTargets              = @()
    staleRefCount                 = 0
    staleRefTargets               = @()
    traceCount                    = 0
    retryCount                    = 0
    runtimeRetryCount             = 0
    runtimeResumedCheckpointCount = 0
    runtimeStaleRefCount          = 0
    runtimeHealedRefCount         = 0
    checkpointReadyCleared        = $null
    summary                       = $null
  }
  navigatorVisaFlows = [ordered]@{
    status                      = "unavailable"
    validated                   = $false
    observed                    = $false
    totalFlows                  = 0
    succeededFlows              = 0
    successRate                 = $null
    persistentSessionCount      = 0
    replayBundleCount           = 0
    verifiedCount               = 0
    staleRecoveryObservedCount  = 0
    healedRecoveryObservedCount = 0
    resumedCheckpointCount      = 0
    checkpointReadyClearedCount = 0
    scenarioNames               = @()
    summary                     = $null
  }
  providerUsage = [ordered]@{
    status                  = "unavailable"
    validated               = $false
    activeSecondaryProviders = 0
    entriesCount            = 0
    primaryEntry            = $null
    entries                 = @()
  }
  gcpSubmissionFollowUp = [ordered]@{
    cloudRunProofPath           = $resolvedGcpCloudRunSummaryPath
    firestoreProofPath          = $resolvedGcpFirestoreSummaryPath
    runtimeProofPath            = $resolvedGcpRuntimeProofPath
    submissionRefreshStatusPath = $resolvedSubmissionRefreshStatusPath
    submissionRefreshMarkdownPath = $resolvedSubmissionRefreshStatusMarkdownPath
    status                      = $gcpRuntimeProofStatus
    blockingReason              = $gcpRuntimeProofBlockingReason
    runtimeProofPresent         = $gcpRuntimeProofRead.present
    runtimeProofParsed          = $gcpRuntimeProofRead.parsed
    runtimeProofParseError      = $gcpRuntimeProofRead.parseError
    submissionRefreshStatus     = if ($null -ne $submissionRefreshStatus) { Get-StatusValueOrDefault -Value $submissionRefreshStatus.status -DefaultValue "unavailable" } else { "missing" }
    submissionRefreshBlockingReason = if ($null -ne $submissionRefreshStatus) { Get-StatusValueOrDefault -Value $submissionRefreshStatus.blockingReason -DefaultValue "none" } else { "submission refresh wrapper has not been run yet." }
    submissionRefreshPresent    = $submissionRefreshStatusRead.present
    submissionRefreshParsed     = $submissionRefreshStatusRead.parsed
    submissionRefreshParseError = $submissionRefreshStatusRead.parseError
    submissionSafeSummaryGate   = $submissionSafeSummaryGate
  }
  submissionAssets = [ordered]@{
    videoShotListPath   = $resolvedVideoShotListPath
    videoScriptPath     = $resolvedVideoScriptPath
    screenChecklistPath = $resolvedScreenChecklistPath
    bonusArticleDraftPath = $resolvedBonusArticleDraftPath
  }
}

$hostedCaseWikiEvidenceSignatureSnapshot = $null

$hostedDirectLiveProofRead = Read-JsonIfExists -Path $resolvedDirectLiveProofJsonPath
if ($hostedDirectLiveProofRead.present -and $hostedDirectLiveProofRead.parsed) {
  $report.hostedDirectLiveProof = New-HostedDirectLiveProofSnapshot `
    -Value $hostedDirectLiveProofRead.value `
    -ReferenceTimeUtc $reportGeneratedAtUtc `
    -MaxAgeHours $HostedDirectLiveProofMaxAgeHours
  $report.statuses.hostedDirectLiveProofStatus = Get-StatusValueOrDefault -Value $report.hostedDirectLiveProof.status -DefaultValue "unavailable"
  $hostedCaseWikiEvidenceSignatureValue = New-HostedCaseWikiEvidenceSignatureValue -Value $hostedDirectLiveProofRead.value
  if ($null -ne $hostedCaseWikiEvidenceSignatureValue) {
    $hostedCaseWikiEvidenceSignatureSnapshot = New-CaseWikiEvidenceSignatureSnapshot -Value $hostedCaseWikiEvidenceSignatureValue
  }
} elseif ($hostedDirectLiveProofRead.present) {
  $report.hostedDirectLiveProof.status = "fail"
  $report.hostedDirectLiveProof.summary = Get-StatusValueOrDefault -Value $hostedDirectLiveProofRead.parseError -DefaultValue "invalid hosted direct-live proof artifact"
  $report.statuses.hostedDirectLiveProofStatus = "fail"
}

if (Test-Path $resolvedBadgeDetailsPath) {
  $report.source.badgeDetailsPresent = $true
  try {
    $badgeDetails = Get-Content $resolvedBadgeDetailsPath -Raw | ConvertFrom-Json
    $report.source.badgeDetailsParsed = $true

    if ($null -ne $badgeDetails -and $null -ne $badgeDetails.evidence) {
      if ($null -ne $badgeDetails.evidence.operatorTurnTruncation) {
        $report.statuses.turnTruncationStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorTurnTruncation.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.operatorTurnDelete) {
        $report.statuses.turnDeleteStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorTurnDelete.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.operatorDamageControl) {
        $report.statuses.operatorDamageControlStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.operatorDamageControl.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.governancePolicy) {
        $report.statuses.governancePolicyStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.governancePolicy.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.skillsRegistry) {
        $report.statuses.skillsRegistryStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.skillsRegistry.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.pluginMarketplace) {
        $report.statuses.pluginMarketplaceStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.pluginMarketplace.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.deviceNodes) {
        $report.statuses.deviceNodesStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.deviceNodes.status -DefaultValue "unavailable"
        $report.deviceNodeUpdates.updatesValidated = ($badgeDetails.evidence.deviceNodes.updatesValidated -eq $true)
        $report.deviceNodeUpdates.updatesHasUpsert = ($badgeDetails.evidence.deviceNodes.updatesHasUpsert -eq $true)
        $report.deviceNodeUpdates.updatesHasHeartbeat = ($badgeDetails.evidence.deviceNodes.updatesHasHeartbeat -eq $true)
        $report.deviceNodeUpdates.updatesApiValidated = ($badgeDetails.evidence.deviceNodes.updatesApiValidated -eq $true)

        $updatesTotalRaw = $badgeDetails.evidence.deviceNodes.updatesTotal
        $updatesTotal = 0
        if ($null -ne $updatesTotalRaw) {
          $updatesTotalParsed = 0
          if ([int]::TryParse([string]$updatesTotalRaw, [ref]$updatesTotalParsed)) {
            $updatesTotal = $updatesTotalParsed
          }
        }
        $report.deviceNodeUpdates.updatesTotal = $updatesTotal

        if (
          $report.deviceNodeUpdates.updatesValidated -and
          $report.deviceNodeUpdates.updatesHasUpsert -and
          $report.deviceNodeUpdates.updatesHasHeartbeat -and
          $report.deviceNodeUpdates.updatesApiValidated -and
          $report.deviceNodeUpdates.updatesTotal -ge 2
        ) {
          $report.statuses.deviceNodeUpdatesStatus = "pass"
        }
        elseif (
          $report.deviceNodeUpdates.updatesTotal -gt 0 -or
          $report.deviceNodeUpdates.updatesHasUpsert -or
          $report.deviceNodeUpdates.updatesHasHeartbeat -or
          $report.deviceNodeUpdates.updatesValidated -or
          $report.deviceNodeUpdates.updatesApiValidated
        ) {
          $report.statuses.deviceNodeUpdatesStatus = "fail"
        }
      }
      if ($null -ne $badgeDetails.evidence.agentUsage) {
        $report.statuses.agentUsageStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.agentUsage.status -DefaultValue "unavailable"
      }
      if ($null -ne $badgeDetails.evidence.runtimeGuardrailsSignalPaths) {
        $report.statuses.runtimeGuardrailsSignalPathsStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.status -DefaultValue "unavailable"
        $report.runtimeGuardrailsSignalPaths.summaryStatus = Get-StatusValueOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.summaryStatus -DefaultValue "unavailable"
        $report.runtimeGuardrailsSignalPaths.totalPaths = Convert-ToNonNegativeIntOrDefault -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.totalPaths -DefaultValue 0
        $report.runtimeGuardrailsSignalPaths.primaryPath = New-RuntimeGuardrailsPrimaryPath -Value $badgeDetails.evidence.runtimeGuardrailsSignalPaths.primaryPath
      }
    }
    if ($null -ne $badgeDetails.liveTransport) {
      $report.liveTransport = New-LiveTransportSnapshot -Value $badgeDetails.liveTransport
      $report.statuses.liveTransportStatus = Get-StatusValueOrDefault -Value $report.liveTransport.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.caseWikiEvidenceSignature) {
      $report.caseWikiEvidenceSignature = New-CaseWikiEvidenceSignatureSnapshot -Value $badgeDetails.evidence.caseWikiEvidenceSignature
      $report.statuses.caseWikiEvidenceSignatureStatus = Get-StatusValueOrDefault -Value $report.caseWikiEvidenceSignature.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.caseWikiRoutingContext) {
      $report.caseWikiRoutingContext = New-CaseWikiRoutingContextSnapshot -Value $badgeDetails.evidence.caseWikiRoutingContext
      $report.statuses.caseWikiRoutingContextStatus = Get-StatusValueOrDefault -Value $report.caseWikiRoutingContext.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.caseWikiGatewayHydration) {
      $report.caseWikiGatewayHydration = New-CaseWikiGatewayHydrationSnapshot -Value $badgeDetails.evidence.caseWikiGatewayHydration
      $report.statuses.caseWikiGatewayHydrationStatus = Get-StatusValueOrDefault -Value $report.caseWikiGatewayHydration.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.caseWikiContextAdoption) {
      $report.caseWikiContextAdoption = New-CaseWikiContextAdoptionSnapshot -Value $badgeDetails.evidence.caseWikiContextAdoption
      $report.statuses.caseWikiContextAdoptionStatus = Get-StatusValueOrDefault -Value $report.caseWikiContextAdoption.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.uiRefHealing) {
      $report.uiRefHealing = New-UiRefHealingSnapshot -Value $badgeDetails.evidence.uiRefHealing
      $report.statuses.uiRefHealingStatus = Get-StatusValueOrDefault -Value $report.uiRefHealing.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.browserWorkerRecovery) {
      $report.browserWorkerRecovery = New-BrowserWorkerRecoverySnapshot -Value $badgeDetails.evidence.browserWorkerRecovery
      $report.statuses.browserWorkerRecoveryStatus = Get-StatusValueOrDefault -Value $report.browserWorkerRecovery.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.evidence.navigatorVisaFlows) {
      $report.navigatorVisaFlows = New-NavigatorVisaFlowsSnapshot -Value $badgeDetails.evidence.navigatorVisaFlows
      $report.statuses.navigatorVisaFlowsStatus = Get-StatusValueOrDefault -Value $report.navigatorVisaFlows.status -DefaultValue "unavailable"
    }
    if ($null -ne $badgeDetails.providerUsage) {
      $report.providerUsage.status = Get-StatusValueOrDefault -Value $badgeDetails.providerUsage.status -DefaultValue "unavailable"
      $report.statuses.providerUsageStatus = $report.providerUsage.status
      $report.providerUsage.validated = ($badgeDetails.providerUsage.validated -eq $true)
      $report.providerUsage.activeSecondaryProviders = Convert-ToNonNegativeIntOrDefault -Value $badgeDetails.providerUsage.activeSecondaryProviders -DefaultValue 0
      $report.providerUsage.entries = @($badgeDetails.providerUsage.entries)
      $report.providerUsage.entriesCount = @($report.providerUsage.entries).Count
      if ($report.providerUsage.entriesCount -gt 0) {
        $report.providerUsage.primaryEntry = New-ProviderUsagePrimaryEntry -Value $report.providerUsage.entries[0]
      }
    }
  }
  catch {
    $report.source.parseError = [string]$_.Exception.Message
  }
}

$report.caseWikiEvidenceSignature = Resolve-CaseWikiEvidenceSignatureSnapshot `
  -BadgeSnapshot $report.caseWikiEvidenceSignature `
  -HostedDirectLiveProofSnapshot $report.hostedDirectLiveProof `
  -HostedSnapshot $hostedCaseWikiEvidenceSignatureSnapshot
$report.statuses.caseWikiEvidenceSignatureStatus = Get-StatusValueOrDefault -Value $report.caseWikiEvidenceSignature.status -DefaultValue "unavailable"

$json = $report | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputJsonPath -Content $json

$runtimeProofDirectLiveStatus = Get-AggregateEvidenceStatus -Statuses @(
  $report.statuses.hostedDirectLiveProofStatus
)
$runtimeProofCaseWikiStatus = Get-AggregateEvidenceStatus -Statuses @(
  $report.statuses.caseWikiEvidenceSignatureStatus,
  $report.statuses.caseWikiRoutingContextStatus,
  $report.statuses.caseWikiGatewayHydrationStatus,
  $report.statuses.caseWikiContextAdoptionStatus
)
$runtimeProofNavigatorStatus = Get-AggregateEvidenceStatus -Statuses @(
  $report.statuses.uiRefHealingStatus,
  $report.statuses.browserWorkerRecoveryStatus,
  $report.statuses.navigatorVisaFlowsStatus
)
$runtimeProofOverallStatus = Get-AggregateEvidenceStatus -Statuses @(
  $runtimeProofDirectLiveStatus,
  $runtimeProofCaseWikiStatus,
  $runtimeProofNavigatorStatus
)

$runtimeProofBlockers = @()
if ($runtimeProofDirectLiveStatus -ne "pass") {
  $runtimeProofBlockers += [ordered]@{
    lane   = "direct_live"
    status = $runtimeProofDirectLiveStatus
    reason = $(if (-not [string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.freshnessSummary) -and $report.hostedDirectLiveProof.freshnessSummary -ne "unavailable") {
        [string]$report.hostedDirectLiveProof.freshnessSummary
      } elseif (-not [string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.summary) -and $report.hostedDirectLiveProof.summary -ne "unavailable") {
        [string]$report.hostedDirectLiveProof.summary
      } else {
        "hosted direct-live proof is not in a passing state"
      })
  }
}
if ($runtimeProofCaseWikiStatus -ne "pass") {
  $runtimeProofBlockers += [ordered]@{
    lane   = "case_wiki"
    status = $runtimeProofCaseWikiStatus
    reason = $(if (-not [string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.blocker)) {
        "compiled memory routing proof is incomplete; blocker=" + [string]$report.caseWikiRoutingContext.blocker
      } elseif (-not [string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.signatureStatus)) {
        "compiled memory proof is incomplete; signature_status=" + [string]$report.caseWikiEvidenceSignature.signatureStatus
      } else {
        "compiled memory routing or signing proof is missing"
      })
  }
}
if ($runtimeProofNavigatorStatus -ne "pass") {
  $runtimeProofBlockers += [ordered]@{
    lane   = "navigator"
    status = $runtimeProofNavigatorStatus
    reason = $(if (-not [string]::IsNullOrWhiteSpace([string]$report.navigatorVisaFlows.summary)) {
        [string]$report.navigatorVisaFlows.summary
      } elseif (-not [string]::IsNullOrWhiteSpace([string]$report.browserWorkerRecovery.summary)) {
        [string]$report.browserWorkerRecovery.summary
      } else {
        "persistent navigator proof is incomplete"
      })
  }
}

$runtimeProof = [ordered]@{
  schemaVersion      = "1.0"
  generatedAt        = $report.generatedAt
  status             = $runtimeProofOverallStatus
  readyForOperatorDemo = ($runtimeProofOverallStatus -eq "pass")
  source             = [ordered]@{
    badgeDetailsPath               = $resolvedBadgeDetailsPath
    releaseEvidenceReportJsonPath  = $resolvedOutputJsonPath
    releaseEvidenceReportMarkdownPath = $resolvedOutputMarkdownPath
    releaseEvidenceManifestJsonPath = $resolvedOutputManifestJsonPath
    releaseEvidenceManifestMarkdownPath = $resolvedOutputManifestMarkdownPath
  }
  summary            = [ordered]@{
    totalLanes    = 3
    passedLanes   = @(@($runtimeProofDirectLiveStatus, $runtimeProofCaseWikiStatus, $runtimeProofNavigatorStatus) | Where-Object { $_ -eq "pass" }).Count
    blockerCount  = $runtimeProofBlockers.Count
    overallSummary = ("direct_live=" + $runtimeProofDirectLiveStatus + "; case_wiki=" + $runtimeProofCaseWikiStatus + "; navigator=" + $runtimeProofNavigatorStatus + "; blockers=" + $runtimeProofBlockers.Count)
    laneStatuses  = [ordered]@{
      directLive = $runtimeProofDirectLiveStatus
      caseWiki   = $runtimeProofCaseWikiStatus
      navigator  = $runtimeProofNavigatorStatus
    }
  }
  lanes              = [ordered]@{
    directLive = [ordered]@{
      status               = $runtimeProofDirectLiveStatus
      hostedProofStatus    = $report.hostedDirectLiveProof.status
      observed             = $report.hostedDirectLiveProof.observed
      freshnessStatus      = $report.hostedDirectLiveProof.freshnessStatus
      freshnessSummary     = $report.hostedDirectLiveProof.freshnessSummary
      runtimePreferredMode = $report.hostedDirectLiveProof.runtimePreferredMode
      runtimeActiveMode    = $report.hostedDirectLiveProof.runtimeActiveMode
      replayActiveMode     = $report.hostedDirectLiveProof.replayActiveMode
      replayEvidenceSource = $report.hostedDirectLiveProof.replayEvidenceSource
      firstAudioMs         = $report.hostedDirectLiveProof.firstAudioMs
      firstOutputMs        = $report.hostedDirectLiveProof.firstOutputMs
      fallbackEventCount   = $report.hostedDirectLiveProof.fallbackEventCount
      fallbackReason       = $report.hostedDirectLiveProof.fallbackReason
      localRuntimeMode     = $report.liveTransport.runtime.activeMode
      localSessionMode     = $report.liveTransport.session.activeMode
      summary              = ("hosted=" + $report.hostedDirectLiveProof.status + "; replay_mode=" + $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.replayActiveMode)) { "n/a" } else { [string]$report.hostedDirectLiveProof.replayActiveMode }) + "; first_audio_ms=" + $(if ($null -eq $report.hostedDirectLiveProof.firstAudioMs) { "n/a" } else { [string]$report.hostedDirectLiveProof.firstAudioMs }) + "; fallback_events=" + [string]$report.hostedDirectLiveProof.fallbackEventCount + "; freshness=" + $report.hostedDirectLiveProof.freshnessStatus)
    }
    caseWiki = [ordered]@{
      status               = $runtimeProofCaseWikiStatus
      signatureStatus      = $report.caseWikiEvidenceSignature.status
      signatureSource      = $report.caseWikiEvidenceSignature.source
      signatureKind        = $report.caseWikiEvidenceSignature.signatureStatus
      signedArtifacts      = $report.caseWikiEvidenceSignature.signedArtifacts
      totalArtifacts       = $report.caseWikiEvidenceSignature.totalArtifacts
      routingStatus        = $report.caseWikiRoutingContext.status
      contextSource        = $report.caseWikiRoutingContext.contextSource
      focusId              = $report.caseWikiRoutingContext.focusId
      blocker              = $report.caseWikiRoutingContext.blocker
      nextAction           = $report.caseWikiRoutingContext.nextAction
      gatewayHydrationStatus = $report.caseWikiGatewayHydration.status
      contextAdoptionStatus = $report.caseWikiContextAdoption.status
      caseWikiRate         = $report.caseWikiContextAdoption.caseWikiRate
      summary              = ("signature=" + $report.caseWikiEvidenceSignature.status + "; context_source=" + $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.contextSource)) { "n/a" } else { [string]$report.caseWikiRoutingContext.contextSource }) + "; blocker=" + $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.blocker)) { "n/a" } else { [string]$report.caseWikiRoutingContext.blocker }) + "; next_action=" + $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.nextAction)) { "n/a" } else { [string]$report.caseWikiRoutingContext.nextAction }) + "; case_wiki_rate=" + $(if ($null -eq $report.caseWikiContextAdoption.caseWikiRate) { "n/a" } else { [string]$report.caseWikiContextAdoption.caseWikiRate }))
    }
    navigator = [ordered]@{
      status                    = $runtimeProofNavigatorStatus
      uiRefHealingStatus        = $report.uiRefHealing.status
      browserWorkerRecoveryStatus = $report.browserWorkerRecovery.status
      visaFlowsStatus           = $report.navigatorVisaFlows.status
      adapterMode               = $report.browserWorkerRecovery.adapterMode
      totalFlows                = $report.navigatorVisaFlows.totalFlows
      succeededFlows            = $report.navigatorVisaFlows.succeededFlows
      successRate               = $report.navigatorVisaFlows.successRate
      persistentSessionCount    = $report.navigatorVisaFlows.persistentSessionCount
      replayBundleCount         = $report.navigatorVisaFlows.replayBundleCount
      verifiedCount             = $report.navigatorVisaFlows.verifiedCount
      staleRecoveryObservedCount = $report.navigatorVisaFlows.staleRecoveryObservedCount
      healedRecoveryObservedCount = $report.navigatorVisaFlows.healedRecoveryObservedCount
      resumedCheckpointCount    = $report.navigatorVisaFlows.resumedCheckpointCount
      scenarioNames             = @($report.navigatorVisaFlows.scenarioNames)
      summary                   = ("flows=" + [string]$report.navigatorVisaFlows.succeededFlows + "/" + [string]$report.navigatorVisaFlows.totalFlows + "; persistent=" + [string]$report.navigatorVisaFlows.persistentSessionCount + "; verified=" + [string]$report.navigatorVisaFlows.verifiedCount + "; stale_recovery=" + [string]$report.navigatorVisaFlows.staleRecoveryObservedCount + "; resumed=" + [string]$report.navigatorVisaFlows.resumedCheckpointCount)
    }
  }
  blockers           = @($runtimeProofBlockers)
}

$runtimeProofJson = $runtimeProof | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputRuntimeProofJsonPath -Content $runtimeProofJson

$runtimeProofMarkdown = @(
  "# Runtime Proof Report",
  "",
  "- Generated at: $($runtimeProof.generatedAt)",
  "- Overall status: $($runtimeProof.status)",
  "- Ready for operator demo: $($runtimeProof.readyForOperatorDemo)",
  "- Badge details path: $($runtimeProof.source.badgeDetailsPath)",
  "- Release evidence report JSON: $($runtimeProof.source.releaseEvidenceReportJsonPath)",
  "",
  "| Lane | Status | Summary |",
  "|---|---|---|",
  "| direct_live | $($runtimeProof.lanes.directLive.status) | $($runtimeProof.lanes.directLive.summary) |",
  "| case_wiki | $($runtimeProof.lanes.caseWiki.status) | $($runtimeProof.lanes.caseWiki.summary) |",
  "| navigator | $($runtimeProof.lanes.navigator.status) | $($runtimeProof.lanes.navigator.summary) |",
  "",
  "## Direct Live Proof",
  "",
  "- status: $($runtimeProof.lanes.directLive.status)",
  "- hostedProofStatus: $($runtimeProof.lanes.directLive.hostedProofStatus)",
  "- observed: $($runtimeProof.lanes.directLive.observed)",
  "- freshnessStatus: $($runtimeProof.lanes.directLive.freshnessStatus)",
  "- freshnessSummary: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.freshnessSummary)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.freshnessSummary })",
  "- runtimePreferredMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.runtimePreferredMode)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.runtimePreferredMode })",
  "- runtimeActiveMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.runtimeActiveMode)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.runtimeActiveMode })",
  "- replayActiveMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.replayActiveMode)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.replayActiveMode })",
  "- replayEvidenceSource: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.replayEvidenceSource)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.replayEvidenceSource })",
  "- firstAudioMs: $(if ($null -eq $runtimeProof.lanes.directLive.firstAudioMs) { "n/a" } else { [string]$runtimeProof.lanes.directLive.firstAudioMs })",
  "- firstOutputMs: $(if ($null -eq $runtimeProof.lanes.directLive.firstOutputMs) { "n/a" } else { [string]$runtimeProof.lanes.directLive.firstOutputMs })",
  "- fallbackEventCount: $($runtimeProof.lanes.directLive.fallbackEventCount)",
  "- fallbackReason: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.fallbackReason)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.fallbackReason })",
  "- localRuntimeMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.localRuntimeMode)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.localRuntimeMode })",
  "- localSessionMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.directLive.localSessionMode)) { "n/a" } else { [string]$runtimeProof.lanes.directLive.localSessionMode })",
  "",
  "## Case Wiki Proof",
  "",
  "- status: $($runtimeProof.lanes.caseWiki.status)",
  "- signatureStatus: $($runtimeProof.lanes.caseWiki.signatureStatus)",
  "- signatureSource: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.signatureSource)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.signatureSource })",
  "- signatureKind: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.signatureKind)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.signatureKind })",
  "- signedArtifacts: $($runtimeProof.lanes.caseWiki.signedArtifacts)",
  "- totalArtifacts: $($runtimeProof.lanes.caseWiki.totalArtifacts)",
  "- routingStatus: $($runtimeProof.lanes.caseWiki.routingStatus)",
  "- gatewayHydrationStatus: $($runtimeProof.lanes.caseWiki.gatewayHydrationStatus)",
  "- contextAdoptionStatus: $($runtimeProof.lanes.caseWiki.contextAdoptionStatus)",
  "- contextSource: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.contextSource)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.contextSource })",
  "- focusId: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.focusId)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.focusId })",
  "- blocker: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.blocker)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.blocker })",
  "- nextAction: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.caseWiki.nextAction)) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.nextAction })",
  "- caseWikiRate: $(if ($null -eq $runtimeProof.lanes.caseWiki.caseWikiRate) { "n/a" } else { [string]$runtimeProof.lanes.caseWiki.caseWikiRate })",
  "",
  "## Navigator Proof",
  "",
  "- status: $($runtimeProof.lanes.navigator.status)",
  "- uiRefHealingStatus: $($runtimeProof.lanes.navigator.uiRefHealingStatus)",
  "- browserWorkerRecoveryStatus: $($runtimeProof.lanes.navigator.browserWorkerRecoveryStatus)",
  "- visaFlowsStatus: $($runtimeProof.lanes.navigator.visaFlowsStatus)",
  "- adapterMode: $(if ([string]::IsNullOrWhiteSpace([string]$runtimeProof.lanes.navigator.adapterMode)) { "n/a" } else { [string]$runtimeProof.lanes.navigator.adapterMode })",
  "- totalFlows: $($runtimeProof.lanes.navigator.totalFlows)",
  "- succeededFlows: $($runtimeProof.lanes.navigator.succeededFlows)",
  "- successRate: $(if ($null -eq $runtimeProof.lanes.navigator.successRate) { "n/a" } else { [string]$runtimeProof.lanes.navigator.successRate })",
  "- persistentSessionCount: $($runtimeProof.lanes.navigator.persistentSessionCount)",
  "- replayBundleCount: $($runtimeProof.lanes.navigator.replayBundleCount)",
  "- verifiedCount: $($runtimeProof.lanes.navigator.verifiedCount)",
  "- staleRecoveryObservedCount: $($runtimeProof.lanes.navigator.staleRecoveryObservedCount)",
  "- healedRecoveryObservedCount: $($runtimeProof.lanes.navigator.healedRecoveryObservedCount)",
  "- resumedCheckpointCount: $($runtimeProof.lanes.navigator.resumedCheckpointCount)",
  "- scenarioNames: $(if (@($runtimeProof.lanes.navigator.scenarioNames).Count -eq 0) { "(none)" } else { (@($runtimeProof.lanes.navigator.scenarioNames) -join ", ") })",
  "",
  "## Blockers",
  ""
)

if (@($runtimeProof.blockers).Count -gt 0) {
  foreach ($blocker in @($runtimeProof.blockers)) {
    $runtimeProofMarkdown += "- $([string]$blocker.lane): $([string]$blocker.reason) [$([string]$blocker.status)]"
  }
} else {
  $runtimeProofMarkdown += "- none"
}

Write-Utf8NoBomFile -Path $resolvedOutputRuntimeProofMarkdownPath -Content ($runtimeProofMarkdown -join "`n")

$providerEntriesMarkdown = if (@($report.providerUsage.entries).Count -gt 0) {
  (@($report.providerUsage.entries | ForEach-Object {
    "- entry: $([string]$_.route)/$([string]$_.capability) -> $([string]$_.selectedProvider)/$([string]$_.selectedModel) (default $([string]$_.defaultProvider)/$([string]$_.defaultModel))"
  })) -join "`n"
} else {
  "- entries: (none)"
}

$markdown = @(
  "# Release Evidence Report",
  "",
  "- Generated at: $($report.generatedAt)",
  "- Badge details path: $($report.source.badgeDetailsPath)",
  "- Badge details present: $($report.source.badgeDetailsPresent)",
  "- Badge details parsed: $($report.source.badgeDetailsParsed)",
  $(if (-not [string]::IsNullOrWhiteSpace([string]$report.source.parseError)) { "- Parse error: $($report.source.parseError)" } else { "- Parse error: none" }),
  "",
  "| Evidence Lane | Status |",
  "|---|---|",
  "| operatorTurnTruncation | $($report.statuses.turnTruncationStatus) |",
  "| operatorTurnDelete | $($report.statuses.turnDeleteStatus) |",
  "| operatorDamageControl | $($report.statuses.operatorDamageControlStatus) |",
  "| governancePolicy | $($report.statuses.governancePolicyStatus) |",
  "| skillsRegistry | $($report.statuses.skillsRegistryStatus) |",
  "| pluginMarketplace | $($report.statuses.pluginMarketplaceStatus) |",
  "| deviceNodes | $($report.statuses.deviceNodesStatus) |",
  "| agentUsage | $($report.statuses.agentUsageStatus) |",
  "| runtimeGuardrailsSignalPaths | $($report.statuses.runtimeGuardrailsSignalPathsStatus) |",
  "| liveTransport | $($report.statuses.liveTransportStatus) |",
  "| hostedDirectLiveProof | $($report.statuses.hostedDirectLiveProofStatus) |",
  "| caseWikiEvidenceSignature | $($report.statuses.caseWikiEvidenceSignatureStatus) |",
  "| caseWikiRoutingContext | $($report.statuses.caseWikiRoutingContextStatus) |",
  "| caseWikiGatewayHydration | $($report.statuses.caseWikiGatewayHydrationStatus) |",
  "| caseWikiContextAdoption | $($report.statuses.caseWikiContextAdoptionStatus) |",
  "| uiRefHealing | $($report.statuses.uiRefHealingStatus) |",
  "| browserWorkerRecovery | $($report.statuses.browserWorkerRecoveryStatus) |",
  "| navigatorVisaFlows | $($report.statuses.navigatorVisaFlowsStatus) |",
  "| providerUsage | $($report.statuses.providerUsageStatus) |",
  "| deviceNodeUpdates | $($report.statuses.deviceNodeUpdatesStatus) |",
  "",
  "## Device Node Updates Details",
  "",
  "- updatesValidated: $($report.deviceNodeUpdates.updatesValidated)",
  "- updatesHasUpsert: $($report.deviceNodeUpdates.updatesHasUpsert)",
  "- updatesHasHeartbeat: $($report.deviceNodeUpdates.updatesHasHeartbeat)",
  "- updatesApiValidated: $($report.deviceNodeUpdates.updatesApiValidated)",
  "- updatesTotal: $($report.deviceNodeUpdates.updatesTotal)",
  "",
  "## Runtime Guardrails Signal Paths Snapshot",
  "",
  "- summaryStatus: $($report.runtimeGuardrailsSignalPaths.summaryStatus)",
  "- totalPaths: $($report.runtimeGuardrailsSignalPaths.totalPaths)",
  $(if ($null -ne $report.runtimeGuardrailsSignalPaths.primaryPath) {
      "- primaryPath: $($report.runtimeGuardrailsSignalPaths.primaryPath.title) [$($report.runtimeGuardrailsSignalPaths.primaryPath.kind)]"
    } else {
      "- primaryPath: (none)"
    }),
  "",
  "## Live Transport Snapshot",
  "",
  "- status: $($report.liveTransport.status)",
  "- validated: $($report.liveTransport.validated)",
  "- runtimeMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.runtime.activeMode)) { "n/a" } else { [string]$report.liveTransport.runtime.activeMode })",
  "- runtimeRequestedMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.runtime.requestedMode)) { "n/a" } else { [string]$report.liveTransport.runtime.requestedMode })",
  "- runtimeFallbackActive: $(if ($null -eq $report.liveTransport.runtime.fallbackActive) { "n/a" } else { [string]$report.liveTransport.runtime.fallbackActive })",
  "- sessionMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.activeMode)) { "n/a" } else { [string]$report.liveTransport.session.activeMode })",
  "- sessionProvider: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.provider)) { "n/a" } else { [string]$report.liveTransport.session.provider })",
  "- sessionModel: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.model)) { "n/a" } else { [string]$report.liveTransport.session.model })",
  "- bootstrapState: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.bootstrapState)) { "n/a" } else { [string]$report.liveTransport.session.bootstrapState })",
  "- fallbackReason: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.fallbackReason)) { "n/a" } else { [string]$report.liveTransport.session.fallbackReason })",
  "- evidenceSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.evidenceSource)) { "n/a" } else { [string]$report.liveTransport.session.evidenceSource })",
  "- connectedEventType: $(if ([string]::IsNullOrWhiteSpace([string]$report.liveTransport.session.connectedEventType)) { "n/a" } else { [string]$report.liveTransport.session.connectedEventType })",
  "- summary: $($report.liveTransport.summary)",
  "",
  "## Hosted Direct-Live Proof Snapshot",
  "",
  "- status: $($report.hostedDirectLiveProof.status)",
  "- observed: $($report.hostedDirectLiveProof.observed)",
  "- frontendPublicUrl: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.frontendPublicUrl)) { "n/a" } else { [string]$report.hostedDirectLiveProof.frontendPublicUrl })",
  "- apiPublicUrl: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.apiPublicUrl)) { "n/a" } else { [string]$report.hostedDirectLiveProof.apiPublicUrl })",
  "- apiPublicUrlSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.apiPublicUrlSource)) { "n/a" } else { [string]$report.hostedDirectLiveProof.apiPublicUrlSource })",
  "- requestedSessionId: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.requestedSessionId)) { "n/a" } else { [string]$report.hostedDirectLiveProof.requestedSessionId })",
  "- sessionId: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.sessionId)) { "n/a" } else { [string]$report.hostedDirectLiveProof.sessionId })",
  "- generatedAt: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.generatedAt)) { "n/a" } else { [string]$report.hostedDirectLiveProof.generatedAt })",
  "- generatedAtIsIso: $($report.hostedDirectLiveProof.generatedAtIsIso)",
  "- freshnessStatus: $($report.hostedDirectLiveProof.freshnessStatus)",
  "- freshnessSummary: $($report.hostedDirectLiveProof.freshnessSummary)",
  "- freshnessAgeMinutes: $(if ($null -eq $report.hostedDirectLiveProof.freshnessAgeMinutes) { "n/a" } else { [string]$report.hostedDirectLiveProof.freshnessAgeMinutes })",
  "- freshnessMaxAgeHours: $(if ($null -eq $report.hostedDirectLiveProof.freshnessMaxAgeHours) { "n/a" } else { [string]$report.hostedDirectLiveProof.freshnessMaxAgeHours })",
  "- runtimePreferredMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.runtimePreferredMode)) { "n/a" } else { [string]$report.hostedDirectLiveProof.runtimePreferredMode })",
  "- runtimeActiveMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.runtimeActiveMode)) { "n/a" } else { [string]$report.hostedDirectLiveProof.runtimeActiveMode })",
  "- replayActiveMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.replayActiveMode)) { "n/a" } else { [string]$report.hostedDirectLiveProof.replayActiveMode })",
  "- replayEvidenceSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.replayEvidenceSource)) { "n/a" } else { [string]$report.hostedDirectLiveProof.replayEvidenceSource })",
  "- firstAudioMs: $(if ($null -eq $report.hostedDirectLiveProof.firstAudioMs) { "n/a" } else { [string]$report.hostedDirectLiveProof.firstAudioMs })",
  "- firstOutputMs: $(if ($null -eq $report.hostedDirectLiveProof.firstOutputMs) { "n/a" } else { [string]$report.hostedDirectLiveProof.firstOutputMs })",
  "- fallbackEventCount: $($report.hostedDirectLiveProof.fallbackEventCount)",
  "- fallbackReason: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.fallbackReason)) { "n/a" } else { [string]$report.hostedDirectLiveProof.fallbackReason })",
  "- runtimeEvidenceExpectedSignatureStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus)) { "n/a" } else { [string]$report.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus })",
  "- runtimeEvidenceKeyState: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.runtimeEvidenceKeyState)) { "n/a" } else { [string]$report.hostedDirectLiveProof.runtimeEvidenceKeyState })",
  "- caseWikiExpectedSignatureStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.caseWikiExpectedSignatureStatus)) { "n/a" } else { [string]$report.hostedDirectLiveProof.caseWikiExpectedSignatureStatus })",
  "- caseWikiExpectedSignatureSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.caseWikiExpectedSignatureSource)) { "n/a" } else { [string]$report.hostedDirectLiveProof.caseWikiExpectedSignatureSource })",
  "- caseWikiSignatureStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.hostedDirectLiveProof.caseWikiSignatureStatus)) { "n/a" } else { [string]$report.hostedDirectLiveProof.caseWikiSignatureStatus })",
  "- caseWikiSignaturePresent: $(if ($null -eq $report.hostedDirectLiveProof.caseWikiSignaturePresent) { "n/a" } else { [string]$report.hostedDirectLiveProof.caseWikiSignaturePresent })",
  "- latencyObserved: $($report.hostedDirectLiveProof.latencyObserved)",
  "- summary: $($report.hostedDirectLiveProof.summary)",
  "",
  "## Case Wiki Evidence Signature Snapshot",
  "",
  "- status: $($report.caseWikiEvidenceSignature.status)",
  "- source: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.source)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.source })",
  "- validated: $($report.caseWikiEvidenceSignature.validated)",
  "- totalArtifacts: $($report.caseWikiEvidenceSignature.totalArtifacts)",
  "- signedArtifacts: $($report.caseWikiEvidenceSignature.signedArtifacts)",
  "- unsignedArtifacts: $($report.caseWikiEvidenceSignature.unsignedArtifacts)",
  "- signatureStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.signatureStatus)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.signatureStatus })",
  "- algorithm: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.algorithm)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.algorithm })",
  "- canonicalization: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.canonicalization)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.canonicalization })",
  "- signerId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.signerId)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.signerId })",
  "- keyId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.keyId)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.keyId })",
  "- signedAt: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.signedAt)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.signedAt })",
  "- signedAtIsIso: $($report.caseWikiEvidenceSignature.signedAtIsIso)",
  "- signaturePresent: $(if ($null -eq $report.caseWikiEvidenceSignature.signaturePresent) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.signaturePresent })",
  "- caseId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.caseId)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.caseId })",
  "- sessionId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.sessionId)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.sessionId })",
  "- overviewStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.overviewStatus)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.overviewStatus })",
  "- focusKind: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.focusKind)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.focusKind })",
  "- focusLabel: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.focusLabel)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.focusLabel })",
  "- nextAction: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.nextAction)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.nextAction })",
  "- sourceRefsCount: $($report.caseWikiEvidenceSignature.sourceRefsCount)",
  "- payloadHash: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiEvidenceSignature.payloadHash)) { "n/a" } else { [string]$report.caseWikiEvidenceSignature.payloadHash })",
  "",
  "## Case Wiki Routing Context Snapshot",
  "",
  "- status: $($report.caseWikiRoutingContext.status)",
  "- validated: $($report.caseWikiRoutingContext.validated)",
  "- observed: $($report.caseWikiRoutingContext.observed)",
  "- contextSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.contextSource)) { "n/a" } else { [string]$report.caseWikiRoutingContext.contextSource })",
  "- focusId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.focusId)) { "n/a" } else { [string]$report.caseWikiRoutingContext.focusId })",
  "- blocker: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.blocker)) { "n/a" } else { [string]$report.caseWikiRoutingContext.blocker })",
  "- nextAction: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.nextAction)) { "n/a" } else { [string]$report.caseWikiRoutingContext.nextAction })",
  "- route: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.route)) { "n/a" } else { [string]$report.caseWikiRoutingContext.route })",
  "- mode: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.mode)) { "n/a" } else { [string]$report.caseWikiRoutingContext.mode })",
  "- requestedIntent: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.requestedIntent)) { "n/a" } else { [string]$report.caseWikiRoutingContext.requestedIntent })",
  "- routedIntent: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiRoutingContext.routedIntent)) { "n/a" } else { [string]$report.caseWikiRoutingContext.routedIntent })",
  "",
  "## Case Wiki Gateway Hydration Snapshot",
  "",
  "- status: $($report.caseWikiGatewayHydration.status)",
  "- validated: $($report.caseWikiGatewayHydration.validated)",
  "- observed: $($report.caseWikiGatewayHydration.observed)",
  "- sessionId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.sessionId)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.sessionId })",
  "- noteEventId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.noteEventId)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.noteEventId })",
  "- questionId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.questionId)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.questionId })",
  "- questionMatched: $(if ($null -eq $report.caseWikiGatewayHydration.questionMatched) { "n/a" } else { [string]$report.caseWikiGatewayHydration.questionMatched })",
  "- noteSourceRefSeen: $(if ($null -eq $report.caseWikiGatewayHydration.noteSourceRefSeen) { "n/a" } else { [string]$report.caseWikiGatewayHydration.noteSourceRefSeen })",
  "- questionSuggestedNextStep: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.questionSuggestedNextStep)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.questionSuggestedNextStep })",
  "- contextSource: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.contextSource)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.contextSource })",
  "- focusId: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.focusId)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.focusId })",
  "- blocker: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.blocker)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.blocker })",
  "- nextAction: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.nextAction)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.nextAction })",
  "- route: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.route)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.route })",
  "- mode: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.mode)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.mode })",
  "- requestedIntent: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.requestedIntent)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.requestedIntent })",
  "- routedIntent: $(if ([string]::IsNullOrWhiteSpace([string]$report.caseWikiGatewayHydration.routedIntent)) { "n/a" } else { [string]$report.caseWikiGatewayHydration.routedIntent })",
  "",
  "## Case Wiki Context Adoption Snapshot",
  "",
  "- status: $($report.caseWikiContextAdoption.status)",
  "- validated: $($report.caseWikiContextAdoption.validated)",
  "- observed: $($report.caseWikiContextAdoption.observed)",
  "- observedCount: $($report.caseWikiContextAdoption.observedCount)",
  "- caseWikiObservedCount: $($report.caseWikiContextAdoption.caseWikiObservedCount)",
  "- inputOnlyObservedCount: $($report.caseWikiContextAdoption.inputOnlyObservedCount)",
  "- unknownObservedCount: $($report.caseWikiContextAdoption.unknownObservedCount)",
  "- caseWikiRate: $(if ($null -eq $report.caseWikiContextAdoption.caseWikiRate) { "n/a" } else { [string]$report.caseWikiContextAdoption.caseWikiRate })",
  "",
  "## UI Ref Healing Snapshot",
  "",
  "- status: $($report.uiRefHealing.status)",
  "- validated: $($report.uiRefHealing.validated)",
  "- observed: $($report.uiRefHealing.observed)",
  "- finalStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.uiRefHealing.finalStatus)) { "n/a" } else { [string]$report.uiRefHealing.finalStatus })",
  "- adapterMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.uiRefHealing.adapterMode)) { "n/a" } else { [string]$report.uiRefHealing.adapterMode })",
  "- healedRefCount: $($report.uiRefHealing.healedRefCount)",
  "- healedRefTargets: $(if (@($report.uiRefHealing.healedRefTargets).Count -eq 0) { "(none)" } else { (@($report.uiRefHealing.healedRefTargets) -join ", ") })",
  "- staleRefCount: $($report.uiRefHealing.staleRefCount)",
  "- staleRefTargets: $(if (@($report.uiRefHealing.staleRefTargets).Count -eq 0) { "(none)" } else { (@($report.uiRefHealing.staleRefTargets) -join ", ") })",
  "- traceCount: $($report.uiRefHealing.traceCount)",
  "- retries: $($report.uiRefHealing.retries)",
  "- disabledSubmitSeen: $(if ($null -eq $report.uiRefHealing.disabledSubmitSeen) { "n/a" } else { [string]$report.uiRefHealing.disabledSubmitSeen })",
  "- enabledSubmitSeen: $(if ($null -eq $report.uiRefHealing.enabledSubmitSeen) { "n/a" } else { [string]$report.uiRefHealing.enabledSubmitSeen })",
  "- healingObservationSeen: $(if ($null -eq $report.uiRefHealing.healingObservationSeen) { "n/a" } else { [string]$report.uiRefHealing.healingObservationSeen })",
  "- healingNoteSeen: $(if ($null -eq $report.uiRefHealing.healingNoteSeen) { "n/a" } else { [string]$report.uiRefHealing.healingNoteSeen })",
  "",
  "## Browser Worker Recovery Snapshot",
  "",
  "- status: $($report.browserWorkerRecovery.status)",
  "- validated: $($report.browserWorkerRecovery.validated)",
  "- observed: $($report.browserWorkerRecovery.observed)",
  "- finalStatus: $(if ([string]::IsNullOrWhiteSpace([string]$report.browserWorkerRecovery.finalStatus)) { "n/a" } else { [string]$report.browserWorkerRecovery.finalStatus })",
  "- adapterMode: $(if ([string]::IsNullOrWhiteSpace([string]$report.browserWorkerRecovery.adapterMode)) { "n/a" } else { [string]$report.browserWorkerRecovery.adapterMode })",
  "- checkpointCount: $($report.browserWorkerRecovery.checkpointCount)",
  "- resumedCheckpointCount: $($report.browserWorkerRecovery.resumedCheckpointCount)",
  "- healedRefCount: $($report.browserWorkerRecovery.healedRefCount)",
  "- healedRefTargets: $(if (@($report.browserWorkerRecovery.healedRefTargets).Count -eq 0) { "(none)" } else { (@($report.browserWorkerRecovery.healedRefTargets) -join ", ") })",
  "- staleRefCount: $($report.browserWorkerRecovery.staleRefCount)",
  "- staleRefTargets: $(if (@($report.browserWorkerRecovery.staleRefTargets).Count -eq 0) { "(none)" } else { (@($report.browserWorkerRecovery.staleRefTargets) -join ", ") })",
  "- traceCount: $($report.browserWorkerRecovery.traceCount)",
  "- retryCount: $($report.browserWorkerRecovery.retryCount)",
  "- runtimeRetryCount: $($report.browserWorkerRecovery.runtimeRetryCount)",
  "- runtimeResumedCheckpointCount: $($report.browserWorkerRecovery.runtimeResumedCheckpointCount)",
  "- runtimeStaleRefCount: $($report.browserWorkerRecovery.runtimeStaleRefCount)",
  "- runtimeHealedRefCount: $($report.browserWorkerRecovery.runtimeHealedRefCount)",
  "- checkpointReadyCleared: $(if ($null -eq $report.browserWorkerRecovery.checkpointReadyCleared) { "n/a" } else { [string]$report.browserWorkerRecovery.checkpointReadyCleared })",
  "- summary: $(if ([string]::IsNullOrWhiteSpace([string]$report.browserWorkerRecovery.summary)) { "n/a" } else { [string]$report.browserWorkerRecovery.summary })",
  "",
  "## Navigator Visa Flows Snapshot",
  "",
  "- status: $($report.navigatorVisaFlows.status)",
  "- validated: $($report.navigatorVisaFlows.validated)",
  "- observed: $($report.navigatorVisaFlows.observed)",
  "- totalFlows: $($report.navigatorVisaFlows.totalFlows)",
  "- succeededFlows: $($report.navigatorVisaFlows.succeededFlows)",
  "- successRate: $(if ($null -eq $report.navigatorVisaFlows.successRate) { "n/a" } else { [string]$report.navigatorVisaFlows.successRate })",
  "- persistentSessionCount: $($report.navigatorVisaFlows.persistentSessionCount)",
  "- replayBundleCount: $($report.navigatorVisaFlows.replayBundleCount)",
  "- verifiedCount: $($report.navigatorVisaFlows.verifiedCount)",
  "- staleRecoveryObservedCount: $($report.navigatorVisaFlows.staleRecoveryObservedCount)",
  "- healedRecoveryObservedCount: $($report.navigatorVisaFlows.healedRecoveryObservedCount)",
  "- resumedCheckpointCount: $($report.navigatorVisaFlows.resumedCheckpointCount)",
  "- checkpointReadyClearedCount: $($report.navigatorVisaFlows.checkpointReadyClearedCount)",
  "- scenarioNames: $(if (@($report.navigatorVisaFlows.scenarioNames).Count -eq 0) { "(none)" } else { (@($report.navigatorVisaFlows.scenarioNames) -join ", ") })",
  "- summary: $(if ([string]::IsNullOrWhiteSpace([string]$report.navigatorVisaFlows.summary)) { "n/a" } else { [string]$report.navigatorVisaFlows.summary })",
  "",
  "## Secondary Provider Usage",
  "",
  "- status: $($report.providerUsage.status)",
  "- validated: $($report.providerUsage.validated)",
  "- activeSecondaryProviders: $($report.providerUsage.activeSecondaryProviders)",
  "- entriesCount: $($report.providerUsage.entriesCount)",
  $(if ($null -ne $report.providerUsage.primaryEntry) {
      "- primaryEntry: $($report.providerUsage.primaryEntry.route)/$($report.providerUsage.primaryEntry.capability) -> $($report.providerUsage.primaryEntry.selectedProvider)/$($report.providerUsage.primaryEntry.selectedModel) [$($report.providerUsage.primaryEntry.selectionReason)]"
    } else {
      "- primaryEntry: (none)"
    }),
  $providerEntriesMarkdown,
  "",
  "## GCP Submission Follow-Up",
  "",
  "- Cloud Run proof target: artifacts/deploy/gcp-cloud-run-summary.json",
  "- Firestore proof target: artifacts/deploy/gcp-firestore-summary.json",
  "- Runtime proof target: artifacts/release-evidence/gcp-runtime-proof.json",
  "- Submission refresh status target: artifacts/release-evidence/submission-refresh-status.json",
  "- Current state: $($report.gcpSubmissionFollowUp.status)",
  "- Blocking reason: $($report.gcpSubmissionFollowUp.blockingReason)",
  "- Submission refresh state: $($report.gcpSubmissionFollowUp.submissionRefreshStatus)",
  "- Submission refresh blocker: $($report.gcpSubmissionFollowUp.submissionRefreshBlockingReason)",
  "- Submission-safe summary gate: liveApiEnabled=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.liveApiEnabled), translationProvider=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.translationProvider), storytellerMediaMode=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.storytellerMediaMode), uiExecutorForceSimulation=$($report.gcpSubmissionFollowUp.submissionSafeSummaryGate.uiExecutorForceSimulation).",
  "",
  "## Submission Assets",
  "",
  "- Shot list: artifacts/release-evidence/video-shot-list.md",
  "- 4-minute script: artifacts/release-evidence/video-script-4min.md",
  "- Screen checklist: artifacts/release-evidence/screen-checklist.md",
  "- Bonus article draft: artifacts/release-evidence/bonus-article-draft.md"
) -join "`n"

Write-Utf8NoBomFile -Path $resolvedOutputMarkdownPath -Content $markdown

$artifactEntries = @(
  (New-ArtifactEntry -Id "demo.summary" -Category "demo" -Label "Demo summary JSON" -Path $resolvedDemoSummaryPath -Required $true -Present (Test-Path $resolvedDemoSummaryPath)),
  (New-ArtifactEntry -Id "demo.policy" -Category "demo" -Label "Demo policy-check JSON" -Path $resolvedDemoPolicyPath -Required $true -Present (Test-Path $resolvedDemoPolicyPath)),
  (New-ArtifactEntry -Id "demo.badge" -Category "demo" -Label "Demo badge JSON" -Path $resolvedDemoBadgePath -Required $true -Present (Test-Path $resolvedDemoBadgePath)),
  (New-ArtifactEntry -Id "demo.badgeDetails" -Category "demo" -Label "Demo badge-details JSON" -Path $resolvedBadgeDetailsPath -Required $true -Present (Test-Path $resolvedBadgeDetailsPath)),
  (New-ArtifactEntry -Id "demo.navigatorVisaFlows" -Category "demo" -Label "Demo navigator visa flows JSON" -Path $resolvedNavigatorVisaFlowsPath -Required $false -Present (Test-Path $resolvedNavigatorVisaFlowsPath)),
  (New-ArtifactEntry -Id "perf.summary" -Category "perf" -Label "Perf summary JSON" -Path $resolvedPerfSummaryPath -Required $false -Present (Test-Path $resolvedPerfSummaryPath)),
  (New-ArtifactEntry -Id "perf.policy" -Category "perf" -Label "Perf policy-check JSON" -Path $resolvedPerfPolicyPath -Required $false -Present (Test-Path $resolvedPerfPolicyPath)),
  (New-ArtifactEntry -Id "deploy.directLiveProofJson" -Category "deploy" -Label "Hosted direct-live proof JSON" -Path $resolvedDirectLiveProofJsonPath -Required $false -Present (Test-Path $resolvedDirectLiveProofJsonPath)),
  (New-ArtifactEntry -Id "deploy.directLiveProofMarkdown" -Category "deploy" -Label "Hosted direct-live proof Markdown" -Path $resolvedDirectLiveProofMarkdownPath -Required $false -Present (Test-Path $resolvedDirectLiveProofMarkdownPath)),
  (New-ArtifactEntry -Id "deploy.directLiveProofScreenshot" -Category "deploy" -Label "Hosted direct-live proof screenshot" -Path $resolvedDirectLiveProofPngPath -Required $false -Present (Test-Path $resolvedDirectLiveProofPngPath)),
  (New-ArtifactEntry -Id "release.reportJson" -Category "release_evidence" -Label "Release evidence report JSON" -Path $resolvedOutputJsonPath -Required $true -Present (Test-Path $resolvedOutputJsonPath)),
  (New-ArtifactEntry -Id "release.reportMarkdown" -Category "release_evidence" -Label "Release evidence report Markdown" -Path $resolvedOutputMarkdownPath -Required $true -Present (Test-Path $resolvedOutputMarkdownPath)),
  (New-ArtifactEntry -Id "release.runtimeProofReportJson" -Category "release_evidence" -Label "Runtime proof report JSON" -Path $resolvedOutputRuntimeProofJsonPath -Required $true -Present (Test-Path $resolvedOutputRuntimeProofJsonPath)),
  (New-ArtifactEntry -Id "release.runtimeProofReportMarkdown" -Category "release_evidence" -Label "Runtime proof report Markdown" -Path $resolvedOutputRuntimeProofMarkdownPath -Required $true -Present (Test-Path $resolvedOutputRuntimeProofMarkdownPath)),
  (New-ArtifactEntry -Id "release.manifestJson" -Category "release_evidence" -Label "Release evidence manifest JSON" -Path $resolvedOutputManifestJsonPath -Required $true -Present $true),
  (New-ArtifactEntry -Id "release.manifestMarkdown" -Category "release_evidence" -Label "Release evidence manifest Markdown" -Path $resolvedOutputManifestMarkdownPath -Required $true -Present $true),
  (New-ArtifactEntry -Id "release.submissionRefreshStatusJson" -Category "release_evidence" -Label "Submission refresh status JSON" -Path $resolvedSubmissionRefreshStatusPath -Required $false -Present (Test-Path $resolvedSubmissionRefreshStatusPath)),
  (New-ArtifactEntry -Id "release.submissionRefreshStatusMarkdown" -Category "release_evidence" -Label "Submission refresh status Markdown" -Path $resolvedSubmissionRefreshStatusMarkdownPath -Required $false -Present (Test-Path $resolvedSubmissionRefreshStatusMarkdownPath)),
  (New-ArtifactEntry -Id "artifactRevalidation.sourceRunManifest" -Category "provenance" -Label "Source-run provenance manifest" -Path $resolvedSourceRunManifestPath -Required $false -Present (Test-Path $resolvedSourceRunManifestPath))
)

$missingRequiredArtifacts = @($artifactEntries | Where-Object { $_.required -eq $true -and $_.present -ne $true })
$manifest = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = [datetime]::UtcNow.ToString("o")
  source        = [ordered]@{
    badgeDetailsPath          = $resolvedBadgeDetailsPath
    reportJsonPath            = $resolvedOutputJsonPath
    reportMarkdownPath        = $resolvedOutputMarkdownPath
    runtimeProofReportJsonPath = $resolvedOutputRuntimeProofJsonPath
    runtimeProofReportMarkdownPath = $resolvedOutputRuntimeProofMarkdownPath
  }
  inventory     = [ordered]@{
    total           = $artifactEntries.Count
    present         = @($artifactEntries | Where-Object { $_.present -eq $true }).Count
    missingRequired = $missingRequiredArtifacts.Count
  }
  criticalEvidenceStatuses = $report.statuses
  runtimeProof = [ordered]@{
    status               = $runtimeProof.status
    readyForOperatorDemo = $runtimeProof.readyForOperatorDemo
    passedLanes          = $runtimeProof.summary.passedLanes
    totalLanes           = $runtimeProof.summary.totalLanes
    blockerCount         = $runtimeProof.summary.blockerCount
    overallSummary       = $runtimeProof.summary.overallSummary
    directLiveStatus     = $runtimeProof.summary.laneStatuses.directLive
    caseWikiStatus       = $runtimeProof.summary.laneStatuses.caseWiki
    navigatorStatus      = $runtimeProof.summary.laneStatuses.navigator
  }
  hostedDirectLiveProof = [ordered]@{
    status                  = $report.hostedDirectLiveProof.status
    observed                = $report.hostedDirectLiveProof.observed
    generatedAt             = $report.hostedDirectLiveProof.generatedAt
    generatedAtIsIso        = $report.hostedDirectLiveProof.generatedAtIsIso
    freshnessStatus         = $report.hostedDirectLiveProof.freshnessStatus
    freshnessSummary        = $report.hostedDirectLiveProof.freshnessSummary
    freshnessAgeMinutes     = $report.hostedDirectLiveProof.freshnessAgeMinutes
    freshnessMaxAgeHours    = $report.hostedDirectLiveProof.freshnessMaxAgeHours
    apiPublicUrlSource      = $report.hostedDirectLiveProof.apiPublicUrlSource
    replayEvidenceSource    = $report.hostedDirectLiveProof.replayEvidenceSource
    firstAudioMs            = $report.hostedDirectLiveProof.firstAudioMs
    firstOutputMs           = $report.hostedDirectLiveProof.firstOutputMs
    fallbackEventCount      = $report.hostedDirectLiveProof.fallbackEventCount
    runtimeEvidenceExpectedSignatureStatus = $report.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus
    runtimeEvidenceKeyState = $report.hostedDirectLiveProof.runtimeEvidenceKeyState
    caseWikiExpectedSignatureStatus = $report.hostedDirectLiveProof.caseWikiExpectedSignatureStatus
    caseWikiExpectedSignatureSource = $report.hostedDirectLiveProof.caseWikiExpectedSignatureSource
    caseWikiSignatureStatus = $report.hostedDirectLiveProof.caseWikiSignatureStatus
    latencyObserved         = $report.hostedDirectLiveProof.latencyObserved
  }
  caseWikiEvidenceSignature = [ordered]@{
    source            = $report.caseWikiEvidenceSignature.source
    status            = $report.caseWikiEvidenceSignature.status
    validated         = $report.caseWikiEvidenceSignature.validated
    totalArtifacts    = $report.caseWikiEvidenceSignature.totalArtifacts
    signedArtifacts   = $report.caseWikiEvidenceSignature.signedArtifacts
    unsignedArtifacts = $report.caseWikiEvidenceSignature.unsignedArtifacts
    signatureStatus   = $report.caseWikiEvidenceSignature.signatureStatus
    signerId          = $report.caseWikiEvidenceSignature.signerId
    signedAt          = $report.caseWikiEvidenceSignature.signedAt
  }
  caseWikiRoutingContext = [ordered]@{
    status          = $report.caseWikiRoutingContext.status
    validated       = $report.caseWikiRoutingContext.validated
    observed        = $report.caseWikiRoutingContext.observed
    contextSource   = $report.caseWikiRoutingContext.contextSource
    focusId         = $report.caseWikiRoutingContext.focusId
    blocker         = $report.caseWikiRoutingContext.blocker
    nextAction      = $report.caseWikiRoutingContext.nextAction
    route           = $report.caseWikiRoutingContext.route
    mode            = $report.caseWikiRoutingContext.mode
    requestedIntent = $report.caseWikiRoutingContext.requestedIntent
    routedIntent    = $report.caseWikiRoutingContext.routedIntent
  }
  caseWikiGatewayHydration = [ordered]@{
    status                    = $report.caseWikiGatewayHydration.status
    validated                 = $report.caseWikiGatewayHydration.validated
    observed                  = $report.caseWikiGatewayHydration.observed
    sessionId                 = $report.caseWikiGatewayHydration.sessionId
    noteEventId               = $report.caseWikiGatewayHydration.noteEventId
    questionId                = $report.caseWikiGatewayHydration.questionId
    questionMatched           = $report.caseWikiGatewayHydration.questionMatched
    noteSourceRefSeen         = $report.caseWikiGatewayHydration.noteSourceRefSeen
    questionSuggestedNextStep = $report.caseWikiGatewayHydration.questionSuggestedNextStep
    contextSource             = $report.caseWikiGatewayHydration.contextSource
    focusId                   = $report.caseWikiGatewayHydration.focusId
    blocker                   = $report.caseWikiGatewayHydration.blocker
    nextAction                = $report.caseWikiGatewayHydration.nextAction
    route                     = $report.caseWikiGatewayHydration.route
    mode                      = $report.caseWikiGatewayHydration.mode
    requestedIntent           = $report.caseWikiGatewayHydration.requestedIntent
    routedIntent              = $report.caseWikiGatewayHydration.routedIntent
  }
  caseWikiContextAdoption = [ordered]@{
    status                 = $report.caseWikiContextAdoption.status
    validated              = $report.caseWikiContextAdoption.validated
    observed               = $report.caseWikiContextAdoption.observed
    observedCount          = $report.caseWikiContextAdoption.observedCount
    caseWikiObservedCount  = $report.caseWikiContextAdoption.caseWikiObservedCount
    inputOnlyObservedCount = $report.caseWikiContextAdoption.inputOnlyObservedCount
    unknownObservedCount   = $report.caseWikiContextAdoption.unknownObservedCount
    caseWikiRate           = $report.caseWikiContextAdoption.caseWikiRate
  }
  uiRefHealing = [ordered]@{
    status                 = $report.uiRefHealing.status
    validated              = $report.uiRefHealing.validated
    observed               = $report.uiRefHealing.observed
    finalStatus            = $report.uiRefHealing.finalStatus
    adapterMode            = $report.uiRefHealing.adapterMode
    healedRefCount         = $report.uiRefHealing.healedRefCount
    healedRefTargets       = @($report.uiRefHealing.healedRefTargets)
    staleRefCount          = $report.uiRefHealing.staleRefCount
    staleRefTargets        = @($report.uiRefHealing.staleRefTargets)
    traceCount             = $report.uiRefHealing.traceCount
    retries                = $report.uiRefHealing.retries
    disabledSubmitSeen     = $report.uiRefHealing.disabledSubmitSeen
    enabledSubmitSeen      = $report.uiRefHealing.enabledSubmitSeen
    healingObservationSeen = $report.uiRefHealing.healingObservationSeen
    healingNoteSeen        = $report.uiRefHealing.healingNoteSeen
  }
  browserWorkerRecovery = [ordered]@{
    status                        = $report.browserWorkerRecovery.status
    validated                     = $report.browserWorkerRecovery.validated
    observed                      = $report.browserWorkerRecovery.observed
    finalStatus                   = $report.browserWorkerRecovery.finalStatus
    adapterMode                   = $report.browserWorkerRecovery.adapterMode
    checkpointCount               = $report.browserWorkerRecovery.checkpointCount
    resumedCheckpointCount        = $report.browserWorkerRecovery.resumedCheckpointCount
    healedRefCount                = $report.browserWorkerRecovery.healedRefCount
    healedRefTargets              = @($report.browserWorkerRecovery.healedRefTargets)
    staleRefCount                 = $report.browserWorkerRecovery.staleRefCount
    staleRefTargets               = @($report.browserWorkerRecovery.staleRefTargets)
    traceCount                    = $report.browserWorkerRecovery.traceCount
    retryCount                    = $report.browserWorkerRecovery.retryCount
    runtimeRetryCount             = $report.browserWorkerRecovery.runtimeRetryCount
    runtimeResumedCheckpointCount = $report.browserWorkerRecovery.runtimeResumedCheckpointCount
    runtimeStaleRefCount          = $report.browserWorkerRecovery.runtimeStaleRefCount
    runtimeHealedRefCount         = $report.browserWorkerRecovery.runtimeHealedRefCount
    checkpointReadyCleared        = $report.browserWorkerRecovery.checkpointReadyCleared
    summary                       = $report.browserWorkerRecovery.summary
  }
  navigatorVisaFlows = [ordered]@{
    status                      = $report.navigatorVisaFlows.status
    validated                   = $report.navigatorVisaFlows.validated
    observed                    = $report.navigatorVisaFlows.observed
    totalFlows                  = $report.navigatorVisaFlows.totalFlows
    succeededFlows              = $report.navigatorVisaFlows.succeededFlows
    successRate                 = $report.navigatorVisaFlows.successRate
    persistentSessionCount      = $report.navigatorVisaFlows.persistentSessionCount
    replayBundleCount           = $report.navigatorVisaFlows.replayBundleCount
    verifiedCount               = $report.navigatorVisaFlows.verifiedCount
    staleRecoveryObservedCount  = $report.navigatorVisaFlows.staleRecoveryObservedCount
    healedRecoveryObservedCount = $report.navigatorVisaFlows.healedRecoveryObservedCount
    resumedCheckpointCount      = $report.navigatorVisaFlows.resumedCheckpointCount
    checkpointReadyClearedCount = $report.navigatorVisaFlows.checkpointReadyClearedCount
    scenarioNames               = @($report.navigatorVisaFlows.scenarioNames)
    summary                     = $report.navigatorVisaFlows.summary
  }
  artifacts     = $artifactEntries
  submissionAssets = @(
    [ordered]@{
      id     = "gcpRuntimeProof"
      status = $report.gcpSubmissionFollowUp.status
      path   = $resolvedGcpRuntimeProofPath
    },
    [ordered]@{
      id     = "submissionRefreshStatus"
      status = $report.gcpSubmissionFollowUp.submissionRefreshStatus
      path   = $resolvedSubmissionRefreshStatusPath
    },
    [ordered]@{
      id     = "videoShotList"
      status = $(if (Test-Path $resolvedVideoShotListPath) { "ready" } else { "missing" })
      path   = $resolvedVideoShotListPath
    },
    [ordered]@{
      id     = "videoScript4Min"
      status = $(if (Test-Path $resolvedVideoScriptPath) { "ready" } else { "missing" })
      path   = $resolvedVideoScriptPath
    },
    [ordered]@{
      id     = "screenChecklist"
      status = $(if (Test-Path $resolvedScreenChecklistPath) { "ready" } else { "missing" })
      path   = $resolvedScreenChecklistPath
    },
    [ordered]@{
      id     = "bonusArticleDraft"
      status = $(if (Test-Path $resolvedBonusArticleDraftPath) { "ready" } else { "missing" })
      path   = $resolvedBonusArticleDraftPath
    }
  )
  submissionRefreshGate = $report.gcpSubmissionFollowUp.submissionSafeSummaryGate
}

$manifestJson = $manifest | ConvertTo-Json -Depth 10
Write-Utf8NoBomFile -Path $resolvedOutputManifestJsonPath -Content $manifestJson

$manifestMarkdown = @(
  "# Release Evidence Manifest",
  "",
  "- Generated at: $($manifest.generatedAt)",
  "- Total artifacts: $($manifest.inventory.total)",
  "- Present artifacts: $($manifest.inventory.present)",
  "- Missing required artifacts: $($manifest.inventory.missingRequired)",
  "",
  "## Critical Evidence Statuses",
  "",
  "| Evidence Lane | Status |",
  "|---|---|",
  "| operatorTurnTruncation | $($report.statuses.turnTruncationStatus) |",
  "| operatorTurnDelete | $($report.statuses.turnDeleteStatus) |",
  "| operatorDamageControl | $($report.statuses.operatorDamageControlStatus) |",
  "| governancePolicy | $($report.statuses.governancePolicyStatus) |",
  "| skillsRegistry | $($report.statuses.skillsRegistryStatus) |",
  "| pluginMarketplace | $($report.statuses.pluginMarketplaceStatus) |",
  "| deviceNodes | $($report.statuses.deviceNodesStatus) |",
  "| agentUsage | $($report.statuses.agentUsageStatus) |",
  "| runtimeGuardrailsSignalPaths | $($report.statuses.runtimeGuardrailsSignalPathsStatus) |",
  "| liveTransport | $($report.statuses.liveTransportStatus) |",
  "| hostedDirectLiveProof | $($report.statuses.hostedDirectLiveProofStatus) |",
  "| caseWikiEvidenceSignature | $($report.statuses.caseWikiEvidenceSignatureStatus) |",
  "| caseWikiRoutingContext | $($report.statuses.caseWikiRoutingContextStatus) |",
  "| caseWikiGatewayHydration | $($report.statuses.caseWikiGatewayHydrationStatus) |",
  "| caseWikiContextAdoption | $($report.statuses.caseWikiContextAdoptionStatus) |",
  "| uiRefHealing | $($report.statuses.uiRefHealingStatus) |",
  "| browserWorkerRecovery | $($report.statuses.browserWorkerRecoveryStatus) |",
  "| navigatorVisaFlows | $($report.statuses.navigatorVisaFlowsStatus) |",
  "| providerUsage | $($report.statuses.providerUsageStatus) |",
  "| deviceNodeUpdates | $($report.statuses.deviceNodeUpdatesStatus) |",
  "",
  "## Runtime Proof Report",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.runtimeProof.status) |",
  "| readyForOperatorDemo | $($manifest.runtimeProof.readyForOperatorDemo) |",
  "| passedLanes | $($manifest.runtimeProof.passedLanes) |",
  "| totalLanes | $($manifest.runtimeProof.totalLanes) |",
  "| blockerCount | $($manifest.runtimeProof.blockerCount) |",
  "| directLiveStatus | $($manifest.runtimeProof.directLiveStatus) |",
  "| caseWikiStatus | $($manifest.runtimeProof.caseWikiStatus) |",
  "| navigatorStatus | $($manifest.runtimeProof.navigatorStatus) |",
  "| overallSummary | $($manifest.runtimeProof.overallSummary) |",
  "",
  "## Case Wiki Evidence Signature",
  "",
  "| Field | Value |",
  "|---|---|",
  "| source | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiEvidenceSignature.source)) { "n/a" } else { [string]$manifest.caseWikiEvidenceSignature.source }) |",
  "| status | $($manifest.caseWikiEvidenceSignature.status) |",
  "| validated | $($manifest.caseWikiEvidenceSignature.validated) |",
  "| totalArtifacts | $($manifest.caseWikiEvidenceSignature.totalArtifacts) |",
  "| signedArtifacts | $($manifest.caseWikiEvidenceSignature.signedArtifacts) |",
  "| unsignedArtifacts | $($manifest.caseWikiEvidenceSignature.unsignedArtifacts) |",
  "| signatureStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiEvidenceSignature.signatureStatus)) { "n/a" } else { [string]$manifest.caseWikiEvidenceSignature.signatureStatus }) |",
  "| signerId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiEvidenceSignature.signerId)) { "n/a" } else { [string]$manifest.caseWikiEvidenceSignature.signerId }) |",
  "| signedAt | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiEvidenceSignature.signedAt)) { "n/a" } else { [string]$manifest.caseWikiEvidenceSignature.signedAt }) |",
  "",
  "## Hosted Direct-Live Proof",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.hostedDirectLiveProof.status) |",
  "| observed | $($manifest.hostedDirectLiveProof.observed) |",
  "| generatedAt | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.generatedAt)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.generatedAt }) |",
  "| generatedAtIsIso | $($manifest.hostedDirectLiveProof.generatedAtIsIso) |",
  "| freshnessStatus | $($manifest.hostedDirectLiveProof.freshnessStatus) |",
  "| freshnessSummary | $($manifest.hostedDirectLiveProof.freshnessSummary) |",
  "| freshnessAgeMinutes | $(if ($null -eq $manifest.hostedDirectLiveProof.freshnessAgeMinutes) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.freshnessAgeMinutes }) |",
  "| freshnessMaxAgeHours | $(if ($null -eq $manifest.hostedDirectLiveProof.freshnessMaxAgeHours) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.freshnessMaxAgeHours }) |",
  "| apiPublicUrlSource | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.apiPublicUrlSource)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.apiPublicUrlSource }) |",
  "| replayEvidenceSource | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.replayEvidenceSource)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.replayEvidenceSource }) |",
  "| firstAudioMs | $(if ($null -eq $manifest.hostedDirectLiveProof.firstAudioMs) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.firstAudioMs }) |",
  "| firstOutputMs | $(if ($null -eq $manifest.hostedDirectLiveProof.firstOutputMs) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.firstOutputMs }) |",
  "| fallbackEventCount | $($manifest.hostedDirectLiveProof.fallbackEventCount) |",
  "| runtimeEvidenceExpectedSignatureStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.runtimeEvidenceExpectedSignatureStatus }) |",
  "| runtimeEvidenceKeyState | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.runtimeEvidenceKeyState)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.runtimeEvidenceKeyState }) |",
  "| caseWikiExpectedSignatureStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.caseWikiExpectedSignatureStatus)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.caseWikiExpectedSignatureStatus }) |",
  "| caseWikiExpectedSignatureSource | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.caseWikiExpectedSignatureSource)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.caseWikiExpectedSignatureSource }) |",
  "| caseWikiSignatureStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.hostedDirectLiveProof.caseWikiSignatureStatus)) { "n/a" } else { [string]$manifest.hostedDirectLiveProof.caseWikiSignatureStatus }) |",
  "| latencyObserved | $($manifest.hostedDirectLiveProof.latencyObserved) |",
  "",
  "## Case Wiki Routing Context",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.caseWikiRoutingContext.status) |",
  "| validated | $($manifest.caseWikiRoutingContext.validated) |",
  "| observed | $($manifest.caseWikiRoutingContext.observed) |",
  "| contextSource | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.contextSource)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.contextSource }) |",
  "| focusId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.focusId)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.focusId }) |",
  "| blocker | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.blocker)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.blocker }) |",
  "| nextAction | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.nextAction)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.nextAction }) |",
  "| route | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.route)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.route }) |",
  "| mode | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.mode)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.mode }) |",
  "| requestedIntent | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.requestedIntent)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.requestedIntent }) |",
  "| routedIntent | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiRoutingContext.routedIntent)) { "n/a" } else { [string]$manifest.caseWikiRoutingContext.routedIntent }) |",
  "",
  "## Case Wiki Gateway Hydration",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.caseWikiGatewayHydration.status) |",
  "| validated | $($manifest.caseWikiGatewayHydration.validated) |",
  "| observed | $($manifest.caseWikiGatewayHydration.observed) |",
  "| sessionId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.sessionId)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.sessionId }) |",
  "| noteEventId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.noteEventId)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.noteEventId }) |",
  "| questionId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.questionId)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.questionId }) |",
  "| questionMatched | $(if ($null -eq $manifest.caseWikiGatewayHydration.questionMatched) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.questionMatched }) |",
  "| noteSourceRefSeen | $(if ($null -eq $manifest.caseWikiGatewayHydration.noteSourceRefSeen) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.noteSourceRefSeen }) |",
  "| questionSuggestedNextStep | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.questionSuggestedNextStep)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.questionSuggestedNextStep }) |",
  "| contextSource | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.contextSource)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.contextSource }) |",
  "| focusId | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.focusId)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.focusId }) |",
  "| blocker | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.blocker)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.blocker }) |",
  "| nextAction | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.nextAction)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.nextAction }) |",
  "| route | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.route)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.route }) |",
  "| mode | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.mode)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.mode }) |",
  "| requestedIntent | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.requestedIntent)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.requestedIntent }) |",
  "| routedIntent | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.caseWikiGatewayHydration.routedIntent)) { "n/a" } else { [string]$manifest.caseWikiGatewayHydration.routedIntent }) |",
  "",
  "## Case Wiki Context Adoption",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.caseWikiContextAdoption.status) |",
  "| validated | $($manifest.caseWikiContextAdoption.validated) |",
  "| observed | $($manifest.caseWikiContextAdoption.observed) |",
  "| observedCount | $($manifest.caseWikiContextAdoption.observedCount) |",
  "| caseWikiObservedCount | $($manifest.caseWikiContextAdoption.caseWikiObservedCount) |",
  "| inputOnlyObservedCount | $($manifest.caseWikiContextAdoption.inputOnlyObservedCount) |",
  "| unknownObservedCount | $($manifest.caseWikiContextAdoption.unknownObservedCount) |",
  "| caseWikiRate | $(if ($null -eq $manifest.caseWikiContextAdoption.caseWikiRate) { "n/a" } else { [string]$manifest.caseWikiContextAdoption.caseWikiRate }) |",
  "",
  "## UI Ref Healing",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.uiRefHealing.status) |",
  "| validated | $($manifest.uiRefHealing.validated) |",
  "| observed | $($manifest.uiRefHealing.observed) |",
  "| finalStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.uiRefHealing.finalStatus)) { "n/a" } else { [string]$manifest.uiRefHealing.finalStatus }) |",
  "| adapterMode | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.uiRefHealing.adapterMode)) { "n/a" } else { [string]$manifest.uiRefHealing.adapterMode }) |",
  "| healedRefCount | $($manifest.uiRefHealing.healedRefCount) |",
  "| healedRefTargets | $(if (@($manifest.uiRefHealing.healedRefTargets).Count -eq 0) { "(none)" } else { (@($manifest.uiRefHealing.healedRefTargets) -join ", ") }) |",
  "| staleRefCount | $($manifest.uiRefHealing.staleRefCount) |",
  "| staleRefTargets | $(if (@($manifest.uiRefHealing.staleRefTargets).Count -eq 0) { "(none)" } else { (@($manifest.uiRefHealing.staleRefTargets) -join ", ") }) |",
  "| traceCount | $($manifest.uiRefHealing.traceCount) |",
  "| retries | $($manifest.uiRefHealing.retries) |",
  "| disabledSubmitSeen | $(if ($null -eq $manifest.uiRefHealing.disabledSubmitSeen) { "n/a" } else { [string]$manifest.uiRefHealing.disabledSubmitSeen }) |",
  "| enabledSubmitSeen | $(if ($null -eq $manifest.uiRefHealing.enabledSubmitSeen) { "n/a" } else { [string]$manifest.uiRefHealing.enabledSubmitSeen }) |",
  "| healingObservationSeen | $(if ($null -eq $manifest.uiRefHealing.healingObservationSeen) { "n/a" } else { [string]$manifest.uiRefHealing.healingObservationSeen }) |",
  "| healingNoteSeen | $(if ($null -eq $manifest.uiRefHealing.healingNoteSeen) { "n/a" } else { [string]$manifest.uiRefHealing.healingNoteSeen }) |",
  "",
  "## Browser Worker Recovery",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.browserWorkerRecovery.status) |",
  "| validated | $($manifest.browserWorkerRecovery.validated) |",
  "| observed | $($manifest.browserWorkerRecovery.observed) |",
  "| finalStatus | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.browserWorkerRecovery.finalStatus)) { "n/a" } else { [string]$manifest.browserWorkerRecovery.finalStatus }) |",
  "| adapterMode | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.browserWorkerRecovery.adapterMode)) { "n/a" } else { [string]$manifest.browserWorkerRecovery.adapterMode }) |",
  "| checkpointCount | $($manifest.browserWorkerRecovery.checkpointCount) |",
  "| resumedCheckpointCount | $($manifest.browserWorkerRecovery.resumedCheckpointCount) |",
  "| healedRefCount | $($manifest.browserWorkerRecovery.healedRefCount) |",
  "| healedRefTargets | $(if (@($manifest.browserWorkerRecovery.healedRefTargets).Count -eq 0) { "(none)" } else { (@($manifest.browserWorkerRecovery.healedRefTargets) -join ", ") }) |",
  "| staleRefCount | $($manifest.browserWorkerRecovery.staleRefCount) |",
  "| staleRefTargets | $(if (@($manifest.browserWorkerRecovery.staleRefTargets).Count -eq 0) { "(none)" } else { (@($manifest.browserWorkerRecovery.staleRefTargets) -join ", ") }) |",
  "| traceCount | $($manifest.browserWorkerRecovery.traceCount) |",
  "| retryCount | $($manifest.browserWorkerRecovery.retryCount) |",
  "| runtimeRetryCount | $($manifest.browserWorkerRecovery.runtimeRetryCount) |",
  "| runtimeResumedCheckpointCount | $($manifest.browserWorkerRecovery.runtimeResumedCheckpointCount) |",
  "| runtimeStaleRefCount | $($manifest.browserWorkerRecovery.runtimeStaleRefCount) |",
  "| runtimeHealedRefCount | $($manifest.browserWorkerRecovery.runtimeHealedRefCount) |",
  "| checkpointReadyCleared | $(if ($null -eq $manifest.browserWorkerRecovery.checkpointReadyCleared) { "n/a" } else { [string]$manifest.browserWorkerRecovery.checkpointReadyCleared }) |",
  "| summary | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.browserWorkerRecovery.summary)) { "n/a" } else { [string]$manifest.browserWorkerRecovery.summary }) |",
  "",
  "## Navigator Visa Flows",
  "",
  "| Field | Value |",
  "|---|---|",
  "| status | $($manifest.navigatorVisaFlows.status) |",
  "| validated | $($manifest.navigatorVisaFlows.validated) |",
  "| observed | $($manifest.navigatorVisaFlows.observed) |",
  "| totalFlows | $($manifest.navigatorVisaFlows.totalFlows) |",
  "| succeededFlows | $($manifest.navigatorVisaFlows.succeededFlows) |",
  "| successRate | $(if ($null -eq $manifest.navigatorVisaFlows.successRate) { "n/a" } else { [string]$manifest.navigatorVisaFlows.successRate }) |",
  "| persistentSessionCount | $($manifest.navigatorVisaFlows.persistentSessionCount) |",
  "| replayBundleCount | $($manifest.navigatorVisaFlows.replayBundleCount) |",
  "| verifiedCount | $($manifest.navigatorVisaFlows.verifiedCount) |",
  "| staleRecoveryObservedCount | $($manifest.navigatorVisaFlows.staleRecoveryObservedCount) |",
  "| healedRecoveryObservedCount | $($manifest.navigatorVisaFlows.healedRecoveryObservedCount) |",
  "| resumedCheckpointCount | $($manifest.navigatorVisaFlows.resumedCheckpointCount) |",
  "| checkpointReadyClearedCount | $($manifest.navigatorVisaFlows.checkpointReadyClearedCount) |",
  "| scenarioNames | $(if (@($manifest.navigatorVisaFlows.scenarioNames).Count -eq 0) { "(none)" } else { (@($manifest.navigatorVisaFlows.scenarioNames) -join ", ") }) |",
  "| summary | $(if ([string]::IsNullOrWhiteSpace([string]$manifest.navigatorVisaFlows.summary)) { "n/a" } else { [string]$manifest.navigatorVisaFlows.summary }) |",
  "",
  "## Artifact Inventory",
  "",
  "| Artifact | Category | Required | Present | Path |",
  "|---|---|---|---|---|"
)

foreach ($entry in $artifactEntries) {
  $manifestMarkdown += "| $($entry.id) | $($entry.category) | $($entry.required) | $($entry.present) | $($entry.path) |"
}

$manifestMarkdown += ""
$manifestMarkdown += "## Submission Assets"
$manifestMarkdown += ""
$manifestMarkdown += "| Asset | Status | Path |"
$manifestMarkdown += "|---|---|---|"
foreach ($asset in $manifest.submissionAssets) {
  $manifestMarkdown += "| $($asset.id) | $($asset.status) | $($asset.path) |"
}
$manifestMarkdown += ""
$manifestMarkdown += "## Submission Refresh Gate"
$manifestMarkdown += ""
$manifestMarkdown += "| Signal | Required Value |"
$manifestMarkdown += "|---|---|"
$manifestMarkdown += "| liveApiEnabled | $($manifest.submissionRefreshGate.liveApiEnabled) |"
$manifestMarkdown += "| translationProvider | $($manifest.submissionRefreshGate.translationProvider) |"
$manifestMarkdown += "| storytellerMediaMode | $($manifest.submissionRefreshGate.storytellerMediaMode) |"
$manifestMarkdown += "| uiExecutorForceSimulation | $($manifest.submissionRefreshGate.uiExecutorForceSimulation) |"

Write-Utf8NoBomFile -Path $resolvedOutputManifestMarkdownPath -Content ($manifestMarkdown -join "`n")

Write-Host ("[release-evidence-report] JSON: " + $resolvedOutputJsonPath)
Write-Host ("[release-evidence-report] Markdown: " + $resolvedOutputMarkdownPath)
Write-Host ("[release-evidence-report] Runtime Proof JSON: " + $resolvedOutputRuntimeProofJsonPath)
Write-Host ("[release-evidence-report] Runtime Proof Markdown: " + $resolvedOutputRuntimeProofMarkdownPath)
Write-Host ("[release-evidence-report] Manifest JSON: " + $resolvedOutputManifestJsonPath)
Write-Host ("[release-evidence-report] Manifest Markdown: " + $resolvedOutputManifestMarkdownPath)
