import test from "node:test";
import assert from "node:assert/strict";
import type { EventListItem } from "../../apps/api-backend/src/firestore.js";
import { summarizeAgentUsage } from "../../apps/api-backend/src/agent-usage-summary.js";

test("agent usage summary aggregates per run using high-water cumulative totals", () => {
  const events: EventListItem[] = [
    {
      eventId: "evt-1",
      sessionId: "session-1",
      runId: "run-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-03-01T10:00:00.000Z",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 100,
      agentUsageOutputTokens: 40,
      agentUsageTotalTokens: 140,
      agentUsageModels: ["gemini-2.5-flash"],
    },
    {
      eventId: "evt-2",
      sessionId: "session-1",
      runId: "run-1",
      type: "orchestrator.response",
      source: "live-agent",
      createdAt: "2026-03-01T10:00:05.000Z",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 2,
      agentUsageInputTokens: 130,
      agentUsageOutputTokens: 55,
      agentUsageTotalTokens: 185,
      agentUsageModels: ["gemini-2.5-flash"],
    },
    {
      eventId: "evt-3",
      sessionId: "session-2",
      runId: "run-2",
      type: "orchestrator.response",
      source: "ui-navigator-agent",
      createdAt: "2026-03-01T10:01:00.000Z",
    },
  ];

  const summary = summarizeAgentUsage(events, []);

  assert.equal(summary.total, 2);
  assert.equal(summary.totalCalls, 3);
  assert.equal(summary.inputTokens, 130);
  assert.equal(summary.outputTokens, 55);
  assert.equal(summary.totalTokens, 185);
  assert.equal(summary.aggregationMode, "high_water_by_run");
  assert.equal(summary.authority, "mixed");
  assert.equal(summary.authoritativeRuns, 1);
  assert.equal(summary.fallbackRuns, 1);

  const latest = summary.latest as Record<string, unknown>;
  assert.equal(latest.runId, "run-2");
  assert.equal(latest.usageSource, "none");
  assert.equal(latest.authority, "fallback");
  assert.equal(latest.aggregationMode, "high_water_by_run");
  assert.equal(latest.observationCount, 1);

  const recent = summary.recent as Array<Record<string, unknown>>;
  const run1 = recent.find((item) => item.runId === "run-1");
  assert.ok(run1);
  assert.equal(run1?.calls, 2);
  assert.equal(run1?.totalTokens, 185);
  assert.equal(run1?.observationCount, 2);
  assert.equal(run1?.tokenConsistency, true);
});

test("agent usage summary preserves token drift instead of normalizing it away", () => {
  const events: EventListItem[] = [
    {
      eventId: "evt-drift-1",
      sessionId: "session-drift",
      runId: "run-drift",
      type: "orchestrator.response",
      source: "storyteller-agent",
      createdAt: "2026-03-01T10:02:00.000Z",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 120,
      agentUsageOutputTokens: 45,
      agentUsageTotalTokens: 140,
      agentUsageModels: ["gemini-2.5-pro"],
    },
  ];

  const summary = summarizeAgentUsage(events, []);
  const latest = summary.latest as Record<string, unknown>;

  assert.equal(summary.inputTokens, 120);
  assert.equal(summary.outputTokens, 45);
  assert.equal(summary.derivedTotalTokens, 165);
  assert.equal(summary.totalTokens, 140);
  assert.equal(summary.tokenConsistency, false);
  assert.equal(summary.tokenDriftRuns, 1);
  assert.equal(summary.tokenDriftTokens, 25);
  assert.equal(summary.validated, false);
  assert.equal(latest.derivedTotalTokens, 165);
  assert.equal(latest.totalTokens, 140);
  assert.equal(latest.tokenConsistency, false);
  assert.equal(latest.tokenDriftTokens, 25);
});
