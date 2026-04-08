import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo-e2e summary captures session replay live transport evidence", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");

  for (const token of [
    'Invoke-Scenario `',
    '-Name "frontend.live.direct_transport" `',
    "demo-e2e-direct-live-browser-smoke.mjs",
    "frontendLiveDirectSmoke = $frontendDirectLiveData",
    'frontendDirectLiveSmokeStatus = if ($frontendDirectLiveScenario.Count -gt 0) { Get-FieldValue -Object $frontendDirectLiveScenario[0] -Path @("data", "status") } else { $null }',
    '/v1/runtime/session-replay?sessionId=$([Uri]::EscapeDataString([string]$sessionId))',
    "sessionReplayLiveTransport = Get-FieldValue -Object $sessionReplayData -Path @(\"selectedSession\", \"replay\", \"liveTransport\")",
    "sessionReplayLiveTransportCaptured = ($null -ne $sessionReplayLiveTransport)",
    "liveTransport = if ($null -ne $operatorActionsData) { $operatorActionsData.sessionReplayLiveTransport } else { $null }",
    "sessionReplayLiveTransportEvidenceSource = if ($null -ne $operatorActionsData) { $operatorActionsData.sessionReplayLiveTransportEvidenceSource } else { $null }",
  ]) {
    assert.ok(source.includes(token), `demo-e2e live transport replay proof missing token: ${token}`);
  }
});
