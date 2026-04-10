import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeCaseCostSummary } from "../../apps/api-backend/src/runtime-cost-tracker.js";
import type { EventListItem } from "../../apps/api-backend/src/firestore.js";

test("runtime cost tracker builds per-case token, lane-span, and storage estimates", () => {
  const events: EventListItem[] = [
    {
      eventId: "event-live-1",
      sessionId: "session-cost-1",
      runId: "run-live-1",
      type: "orchestrator.response",
      source: "live-agent",
      route: "live-agent",
      createdAt: "2026-04-10T10:00:00.000Z",
      liveTransportMode: "direct_live",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 120,
      agentUsageOutputTokens: 40,
      agentUsageTotalTokens: 160,
      agentUsageModels: ["gemini-live-2.5-flash-native-audio"],
    },
    {
      eventId: "event-live-2",
      sessionId: "session-cost-1",
      runId: "run-live-1",
      type: "orchestrator.response",
      source: "live-agent",
      route: "live-agent",
      createdAt: "2026-04-10T10:05:00.000Z",
      liveTransportMode: "direct_live",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 120,
      agentUsageOutputTokens: 40,
      agentUsageTotalTokens: 160,
      agentUsageModels: ["gemini-live-2.5-flash-native-audio"],
    },
    {
      eventId: "event-ui-1",
      sessionId: "session-cost-1",
      runId: "run-ui-1",
      type: "orchestrator.response",
      source: "ui-executor",
      route: "ui-navigator-agent",
      createdAt: "2026-04-10T10:06:00.000Z",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 20,
      agentUsageOutputTokens: 10,
      agentUsageTotalTokens: 30,
      agentUsageModels: ["gemini-3.1-pro-preview"],
    },
    {
      eventId: "event-ui-2",
      sessionId: "session-cost-1",
      runId: "run-ui-1",
      type: "orchestrator.response",
      source: "ui-executor",
      route: "ui-navigator-agent",
      createdAt: "2026-04-10T10:09:00.000Z",
      agentUsageSource: "gemini_usage_metadata",
      agentUsageCalls: 1,
      agentUsageInputTokens: 20,
      agentUsageOutputTokens: 10,
      agentUsageTotalTokens: 30,
      agentUsageModels: ["gemini-3.1-pro-preview"],
    },
  ];

  const summary = buildRuntimeCaseCostSummary({
    events,
    config: {
      pricePer1kInputUsd: 0.00045,
      pricePer1kOutputUsd: 0.00135,
      pricePerLiveMinuteUsd: 0.006,
      pricePerUiExecutorMinuteUsd: 0.02,
      pricePerStorageMbUsd: 0.0002,
    },
    sessionId: "session-cost-1",
    sourceRefs: ["workflow:control-plane"],
  });

  assert.equal(summary.status, "observed");
  assert.equal(summary.source, "case_wiki");
  assert.equal(summary.estimationMode, "runtime_rate_estimate");
  assert.equal(summary.observationMode, "event_span_estimate");
  assert.equal(summary.inputTokens, 140);
  assert.equal(summary.outputTokens, 50);
  assert.equal(summary.totalTokens, 190);
  assert.equal(summary.liveMinutes, 5);
  assert.equal(summary.uiExecutorMinutes, 3);
  assert.ok(summary.storageMb > 0);
  assert.equal(summary.inputUsd, 0.000063);
  assert.equal(summary.outputUsd, 0.000068);
  assert.equal(summary.liveUsd, 0.03);
  assert.equal(summary.uiExecutorUsd, 0.06);
  assert.ok(summary.totalUsd > 0.09);
  assert.equal(summary.uniqueModels, 2);
  assert.equal(summary.latestSeenAt, "2026-04-10T10:09:00.000Z");
  assert.equal(summary.sourceRefs.includes("workflow:control-plane"), true);
  assert.equal(summary.sourceRefs.includes("session:session-cost-1"), true);
  assert.equal(summary.sourceRefs.includes("run:run-ui-1"), true);
  assert.equal(summary.validated, true);
});
