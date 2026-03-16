import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "scripts", "demo-e2e.ps1"), "utf8");

test("demo-e2e defaults storyteller media mode to runtime configuration before simulation", () => {
  assert.match(source, /Import-DotEnvIntoProcess -Path \(Join-Path \$script:RepoRoot "\.env"\)/);
  assert.match(source, /GetEnvironmentVariable\("STORYTELLER_MEDIA_MODE"\)/);
  assert.match(source, /GetEnvironmentVariable\("STORYTELLER_GEMINI_API_KEY"\)/);
  assert.match(source, /return "default"/);
  assert.match(source, /return "fallback"/);
});

test("demo-e2e defaults UI executor to real playwright mode", () => {
  assert.match(source, /Set-EnvValue -Name "UI_NAVIGATOR_GEMINI_TIMEOUT_MS" -Value "60000"/);
  assert.doesNotMatch(source, /Set-EnvValue -Name "UI_NAVIGATOR_PLANNER_MODEL" -Value "gemini-3\.1-flash-lite-preview"/);
  assert.match(source, /Set-EnvDefault -Name "UI_EXECUTOR_STRICT_PLAYWRIGHT" -Value "true"/);
  assert.match(source, /Set-EnvDefault -Name "UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE" -Value "false"/);
  assert.match(source, /Set-EnvDefault -Name "UI_EXECUTOR_FORCE_SIMULATION" -Value "false"/);
  assert.match(source, /Set-EnvValue -Name "ANALYTICS_EXPORT_ENABLED" -Value "true"/);
  assert.match(source, /Set-EnvValue -Name "ANALYTICS_BIGQUERY_TABLE" -Value "analytics_event_rollups"/);
});

test("demo-e2e restarts stale healthy ui-executor instances when runtime alignment drifts", () => {
  assert.match(source, /function Get-DemoManagedServiceReuseMismatchReason/);
  assert.match(source, /analytics\.requestedEnabled=false/);
  assert.match(source, /strictPlaywright=false/);
  assert.match(source, /runtime alignment mismatch/);
});

test("demo-e2e compacts live storyteller segment count for default Veo runs", () => {
  assert.doesNotMatch(source, /Set-EnvValue -Name "STORYTELLER_PLANNER_MODEL" -Value "gemini-3\.1-flash-lite-preview"/);
  assert.doesNotMatch(source, /Set-EnvValue -Name "STORYTELLER_BRANCH_MODEL" -Value "gemini-3\.1-flash-lite-preview"/);
  assert.match(source, /\$storyIncludeImages = if \(\$storytellerScenarioMediaMode -eq "default"\) \{ \$false \} else \{ \$true \}/);
  assert.match(source, /\$storySegmentCount = if \(\$storytellerScenarioMediaMode -eq "default"\) \{ 1 \} else \{ 3 \}/);
  assert.match(source, /\$storyRequestTimeoutSec = if \(\$storytellerScenarioMediaMode -eq "default"\) \{ \[Math\]::Max\(\$RequestTimeoutSec, 120\) \} else \{ \$RequestTimeoutSec \}/);
});

test("demo-e2e uses a lightweight fallback storyteller cache verification lane", () => {
  assert.match(source, /includeImages = \$false/);
  assert.match(source, /includeVideo = \$false/);
  assert.match(source, /mediaMode = "fallback"/);
  assert.match(source, /segmentCount = \$storySegmentCount/);
});

test("demo-e2e widens timeout budget for heavy UI planner lanes", () => {
  assert.match(source, /\$uiHeavyRequestTimeoutSec = \[Math\]::Max\(\$RequestTimeoutSec, 90\)/);
  assert.match(source, /ui\.approval\.request[\s\S]*Invoke-JsonRequest -Method POST -Uri "http:\/\/localhost:8082\/orchestrate" -Body \$request -TimeoutSec \$uiHeavyRequestTimeoutSec/);
  assert.match(source, /ui\.sandbox\.policy_modes[\s\S]*Invoke-JsonRequest -Method POST -Uri "http:\/\/localhost:8082\/orchestrate" -Body \$request -TimeoutSec \$uiHeavyRequestTimeoutSec/);
  assert.match(source, /ui\.visual_testing[\s\S]*Invoke-JsonRequest -Method POST -Uri "http:\/\/localhost:8082\/orchestrate" -Body \$request -TimeoutSec \$uiHeavyRequestTimeoutSec/);
  assert.match(source, /gateway\.websocket\.task_progress[\s\S]*\$timeoutMs = \[Math\]::Max\(4000, \$uiHeavyRequestTimeoutSec \* 1000\)/);
});

test("demo-e2e warms websocket gateway before measuring roundtrip KPI", () => {
  assert.match(source, /gateway\.websocket\.roundtrip[\s\S]*\$warmupRunId = \$runId \+ "-warmup"/);
  assert.match(source, /gateway\.websocket\.roundtrip[\s\S]*Invoke-NodeJsonCommand -Args @\([\s\S]*\$warmupRunId[\s\S]*\) \| Out-Null/);
});

test("demo-e2e widens timeout budget for delegated storyteller lane", () => {
  assert.match(source, /\$delegationRequestTimeoutSec = \[Math\]::Max\(\$RequestTimeoutSec, 120\)/);
  assert.match(source, /multi_agent\.delegation[\s\S]*Invoke-JsonRequest -Method POST -Uri "http:\/\/localhost:8082\/orchestrate" -Body \$request -TimeoutSec \$delegationRequestTimeoutSec/);
});
