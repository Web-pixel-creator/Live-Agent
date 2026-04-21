import test from "node:test";
import assert from "node:assert/strict";
import type { WorkspaceCase } from "../../apps/demo-frontend/app-shell/src/data/workspace";
import { findPolicy } from "../../apps/demo-frontend/app-shell/src/data/simulationRuns";
import {
  buildSimulationRun,
  buildRuntimeSimulationRuns,
} from "../../apps/demo-frontend/app-shell/src/lib/runtime-simulation-runs";

function makeCase(overrides: Partial<WorkspaceCase> = {}): WorkspaceCase {
  return {
    ref: "VS-9001",
    caseId: "case-9001",
    sessionId: "session-9001",
    source: "runtime",
    client: "N. Example",
    email: "n.example@example.com",
    phone: "+49 30 555 0101",
    visa: "EU Blue Card",
    country: "DE",
    stage: "Document follow-up",
    stageEnteredAt: "2026-07-01T09:00:00Z",
    owner: "A. Petrova",
    status: "needs_action",
    sla: "2h 00m",
    updated: "Jul 1",
    events: [
      {
        at: "2026-07-01T10:15:00Z",
        actor: "AI",
        title: "Document gap detected",
      },
    ],
    documents: [
      { name: "Passport scan", state: "ok" },
      { name: "Employment contract", state: "ok" },
      { name: "Salary proof", state: "review" },
      { name: "Diploma apostille", state: "missing" },
    ],
    ...overrides,
  };
}

test("runtime simulation builder stays deterministic for the current policy", () => {
  const policy = findPolicy("policy-current");
  assert.ok(policy);

  const runtimeCase = makeCase();
  const first = buildSimulationRun({
    workspaceCase: runtimeCase,
    policy,
    ranAt: "2026-07-01T10:15:00Z",
    durationMs: 1200,
    id: "runtime-VS-9001-policy-current",
    source: "runtime",
  });
  const second = buildSimulationRun({
    workspaceCase: runtimeCase,
    policy,
    ranAt: "2026-07-01T10:15:00Z",
    durationMs: 1200,
    id: "runtime-VS-9001-policy-current",
    source: "runtime",
  });

  assert.equal(first.source, "runtime");
  assert.deepEqual(first.runtimeSource, {
    caseId: "case-9001",
    sessionId: "session-9001",
  });
  assert.equal(first.replayedConfidence, second.replayedConfidence);
  assert.equal(first.delta, second.delta);
  assert.equal(first.headline, second.headline);
});

test("runtime simulation runs use current policy and sort newest first", () => {
  const olderCase = makeCase({
    ref: "VS-9002",
    caseId: "case-9002",
    sessionId: "session-9002",
    stageEnteredAt: "2026-06-30T08:00:00Z",
    events: [{ at: "2026-06-30T08:30:00Z", actor: "System", title: "Case staged" }],
  });
  const newerCase = makeCase({
    ref: "VS-9003",
    caseId: "case-9003",
    sessionId: "session-9003",
    stageEnteredAt: "2026-07-01T12:00:00Z",
    events: [{ at: "2026-07-01T12:45:00Z", actor: "System", title: "Case updated" }],
  });
  const curatedFallback = makeCase({
    ref: "VS-9004",
    caseId: undefined,
    sessionId: undefined,
    source: "mock",
  });

  const runs = buildRuntimeSimulationRuns([olderCase, newerCase, curatedFallback]);

  assert.equal(runs.length, 2);
  assert.equal(runs[0].caseRef, "VS-9003");
  assert.equal(runs[1].caseRef, "VS-9002");
  assert.equal(runs[0].policyId, "policy-current");
  assert.equal(runs[1].policyId, "policy-current");
  assert.equal(runs[0].id, "runtime-VS-9003-policy-current");
  assert.equal(runs[1].id, "runtime-VS-9002-policy-current");
});
