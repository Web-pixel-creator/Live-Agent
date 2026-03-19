import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { runUiNavigatorAgent } from "../../agents/ui-navigator-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function withEnv(overrides: Record<string, string | null>, runner: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value === null) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  return runner().finally(() => {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });
}

test("ui navigator prepares a visa relocation draft from summary and verifies after approval", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "draft-1",
            actionType: "click",
            target: "field:full_name",
            status: "ok",
            screenshotRef: "ui://draft/1.png",
            notes: "focused full name",
          },
          {
            index: 2,
            actionId: "draft-2",
            actionType: "type",
            target: "field:full_name",
            status: "ok",
            screenshotRef: "ui://draft/2.png",
            notes: "filled full name",
          },
          {
            index: 3,
            actionId: "submit-1",
            actionType: "click",
            target: "button:submit",
            status: "ok",
            screenshotRef: "ui://draft/3.png",
            notes: "submitted draft",
          },
          {
            index: 4,
            actionId: "verify-1",
            actionType: "verify",
            target: "confirmation-banner",
            status: "ok",
            screenshotRef: "ui://draft/4.png",
            notes: "verified confirmation",
          },
        ],
        finalStatus: "completed",
        retries: 0,
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const executorUrl = `http://127.0.0.1:${address.port}`;
  const summaryText = [
    "Full name: Priya Rao",
    "Email: priya.rao@example.com",
    "Visa type: H1B transfer",
    "Relocation city: Austin",
    "Employer: Acme Mobility",
  ].join("\n");

  try {
    await withEnv(
      {
        UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
        UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
        UI_NAVIGATOR_EXECUTOR_URL: executorUrl,
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const blockedRequest = createEnvelope({
          userId: "visa-user",
          sessionId: "visa-session",
          runId: "visa-run-blocked",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Prepare visa relocation CRM draft from the assembled summary and submit it for approval",
              url: "https://example.com/crm",
              summary: summaryText,
              domSnapshot: "<main><form><input name='full_name' /><button type='submit'>Submit</button></form></main>",
              accessibilityTree: "main > form > textbox[name=full_name]",
              markHints: ["full_name_field@(120,120)", "submit_button@(420,520)"],
            },
          },
        }) as OrchestratorRequest;

        const blockedResponse = await runUiNavigatorAgent(blockedRequest);
        assert.equal(blockedResponse.payload.status, "accepted");

        const blockedOutput = asObject(blockedResponse.payload.output);
        const blockedPlan = Array.isArray(blockedOutput.actionPlan) ? blockedOutput.actionPlan : [];

        assert.equal(blockedOutput.approvalRequired, true);
        assert.equal(blockedOutput.verificationState, "blocked_pending_approval");
        assert.ok(blockedPlan.some((action) => asObject(action).type === "type" && asObject(action).target === "field:full_name"));
        assert.ok(blockedPlan.some((action) => asObject(action).type === "type" && asObject(action).target === "field:email"));
        assert.ok(blockedPlan.some((action) => asObject(action).type === "type" && asObject(action).target === "field:visa_type"));
        assert.ok(blockedPlan.some((action) => asObject(action).type === "verify" && asObject(action).target === "button:submit"));

        const approvedRequest = createEnvelope({
          userId: "visa-user",
          sessionId: "visa-session",
          runId: "visa-run-approved",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Prepare visa relocation CRM draft from the assembled summary and submit it for approval",
              url: "https://example.com/crm",
              summary: summaryText,
              domSnapshot: "<main><form><input name='full_name' /><button type='submit'>Submit</button></form></main>",
              accessibilityTree: "main > form > textbox[name=full_name]",
              markHints: ["full_name_field@(120,120)", "submit_button@(420,520)"],
              approvalConfirmed: true,
              approvalDecision: "approved",
              approvalReason: "Reviewed the CRM draft and approved submission.",
            },
          },
        }) as OrchestratorRequest;

        const approvedResponse = await runUiNavigatorAgent(approvedRequest);
        assert.equal(approvedResponse.payload.status, "completed");

        const approvedOutput = asObject(approvedResponse.payload.output);
        const approvedExecution = asObject(approvedOutput.execution);
        const approvedApproval = asObject(approvedOutput.approval);

        assert.equal(approvedOutput.approvalRequired, false);
        assert.equal(approvedOutput.verificationState, "verified");
        assert.equal(approvedOutput.verificationFailureClass, null);
        assert.equal(approvedExecution.finalStatus, "completed");
        assert.equal(approvedApproval.decision, "approved");
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
