import test from "node:test";
import assert from "node:assert/strict";
import {
  listApprovals,
  recordApprovalDecision,
  sweepApprovalTimeouts,
  upsertPendingApproval,
} from "../../apps/api-backend/src/firestore.js";

function uniqueToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

test("approval lifecycle transitions pending to approved with audit trail", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const approvalId = uniqueToken("approval-approved");
  const sessionId = uniqueToken("session-approved");
  const runId = uniqueToken("run-approved");
  const requestedAtIso = new Date(Date.now() - 5_000).toISOString();

  const pending = await upsertPendingApproval({
    approvalId,
    sessionId,
    runId,
    actionType: "ui_task",
    actor: "unit-test",
    requestedAtIso,
    softTimeoutMs: 60_000,
    hardTimeoutMs: 120_000,
    metadata: {
      source: "unit",
    },
  });

  assert.equal(pending.status, "pending");
  assert.equal(pending.decision, null);
  assert.equal(pending.requestedAt, requestedAtIso);
  assert.equal(pending.auditLog.some((entry) => entry.action === "pending_registered"), true);

  const approved = await recordApprovalDecision({
    approvalId,
    sessionId,
    runId,
    decision: "approved",
    reason: "approved by unit test",
    actor: "unit-operator",
    metadata: {
      reasonCode: "UNIT_OK",
    },
  });

  assert.equal(approved.status, "approved");
  assert.equal(approved.decision, "approved");
  assert.ok(typeof approved.resolvedAt === "string" && approved.resolvedAt.length > 0);
  assert.equal(approved.auditLog.some((entry) => entry.action === "decision_approved"), true);

  const listed = await listApprovals({
    sessionId,
    limit: 10,
  });
  const persisted = listed.find((item) => item.approvalId === approvalId);
  assert.ok(persisted);
  assert.equal(persisted?.status, "approved");
});

test("approval SLA sweep emits soft reminder and hard timeout transitions", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const approvalId = uniqueToken("approval-timeout");
  const sessionId = uniqueToken("session-timeout");
  const runId = uniqueToken("run-timeout");
  const baseMs = Date.now() - 30_000;
  const requestedAtIso = new Date(baseMs).toISOString();

  await upsertPendingApproval({
    approvalId,
    sessionId,
    runId,
    actionType: "ui_task",
    actor: "unit-test",
    requestedAtIso,
    softTimeoutMs: 1_000,
    hardTimeoutMs: 2_000,
  });

  const softSweep = await sweepApprovalTimeouts({
    nowIso: new Date(baseMs + 1_500).toISOString(),
    limit: 1_000,
  });
  assert.equal(softSweep.updatedApprovalIds.includes(approvalId), true);
  assert.equal(softSweep.softReminders >= 1, true);

  const afterSoft = (await listApprovals({ sessionId, limit: 10 })).find(
    (item) => item.approvalId === approvalId,
  );
  assert.ok(afterSoft);
  assert.equal(afterSoft?.status, "pending");
  assert.ok(typeof afterSoft?.softReminderSentAt === "string" && afterSoft.softReminderSentAt.length > 0);
  assert.equal(afterSoft?.auditLog.some((entry) => entry.action === "soft_timeout_reminder"), true);

  const hardSweep = await sweepApprovalTimeouts({
    nowIso: new Date(baseMs + 2_500).toISOString(),
    limit: 1_000,
  });
  assert.equal(hardSweep.updatedApprovalIds.includes(approvalId), true);
  assert.equal(hardSweep.hardTimeouts >= 1, true);

  const afterHard = (await listApprovals({ sessionId, limit: 10 })).find(
    (item) => item.approvalId === approvalId,
  );
  assert.ok(afterHard);
  assert.equal(afterHard?.status, "timeout");
  assert.equal(afterHard?.decision, null);
  assert.ok(typeof afterHard?.resolvedAt === "string" && afterHard.resolvedAt.length > 0);
  assert.match(String(afterHard?.reason ?? ""), /timed out/i);
  assert.equal(afterHard?.auditLog.some((entry) => entry.action === "hard_timeout_auto_reject"), true);
});

test("upsert does not reopen resolved approval and timeout decision remains immutable", async () => {
  process.env.FIRESTORE_ENABLED = "false";

  const rejectedApprovalId = uniqueToken("approval-rejected");
  const rejectedSessionId = uniqueToken("session-rejected");
  const rejectedRunId = uniqueToken("run-rejected");

  const rejected = await recordApprovalDecision({
    approvalId: rejectedApprovalId,
    sessionId: rejectedSessionId,
    runId: rejectedRunId,
    decision: "rejected",
    reason: "rejected by unit test",
    actor: "unit-operator",
  });
  assert.equal(rejected.status, "rejected");

  const reopenAttempt = await upsertPendingApproval({
    approvalId: rejectedApprovalId,
    sessionId: rejectedSessionId,
    runId: rejectedRunId,
    actionType: "ui_task",
    actor: "unit-test",
  });
  assert.equal(reopenAttempt.status, "rejected");
  assert.equal(reopenAttempt.decision, "rejected");

  const timeoutApprovalId = uniqueToken("approval-timeout-lock");
  const timeoutSessionId = uniqueToken("session-timeout-lock");
  const timeoutRunId = uniqueToken("run-timeout-lock");
  const baseMs = Date.now() - 40_000;

  await upsertPendingApproval({
    approvalId: timeoutApprovalId,
    sessionId: timeoutSessionId,
    runId: timeoutRunId,
    actionType: "ui_task",
    requestedAtIso: new Date(baseMs).toISOString(),
    softTimeoutMs: 1_000,
    hardTimeoutMs: 2_000,
    actor: "unit-test",
  });

  await sweepApprovalTimeouts({
    nowIso: new Date(baseMs + 3_000).toISOString(),
    limit: 1_000,
  });

  const afterTimeoutDecision = await recordApprovalDecision({
    approvalId: timeoutApprovalId,
    sessionId: timeoutSessionId,
    runId: timeoutRunId,
    decision: "approved",
    reason: "late approval should not reopen timeout",
    actor: "unit-operator",
  });
  assert.equal(afterTimeoutDecision.status, "timeout");
  assert.equal(afterTimeoutDecision.decision, null);
  assert.equal(afterTimeoutDecision.auditLog.some((entry) => entry.action === "decision_approved"), false);
});
