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

test("ui navigator reports verified when post-action verification succeeds", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "nav-1",
            actionType: "navigate",
            target: "https://example.com/account",
            status: "ok",
            screenshotRef: "ui://verified/1.png",
            notes: "navigated",
          },
          {
            index: 2,
            actionId: "verify-1",
            actionType: "verify",
            target: "css:main",
            status: "ok",
            screenshotRef: "ui://verified/2.png",
            notes: "verified",
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

  try {
    await withEnv(
      {
        UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
        UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
        UI_NAVIGATOR_EXECUTOR_URL: executorUrl,
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const request = createEnvelope({
          userId: "verified-user",
          sessionId: "verified-session",
          runId: "verified-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open account settings and verify the main panel loads",
              url: "https://example.com/account",
              domSnapshot: "<main><h1>Account</h1></main>",
              accessibilityTree: "main > heading[name=Account]",
              markHints: ["account_heading@(120,120)"],
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");

        const output = asObject(response.payload.output);
        const planner = asObject(output.planner);
        const execution = asObject(output.execution);
        const verification = asObject(output.verification);

        assert.equal(output.verificationState, "verified");
        assert.equal(output.verificationFailureClass, null);
        assert.equal(verification.state, "verified");
        assert.equal(verification.failureClass, null);
        assert.equal(asObject(planner.verification).targetState, "verified");
        assert.equal(asObject(execution.verification).state, "verified");
        assert.match(String(output.text ?? ""), /Verification state: verified/i);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator reports blocked_pending_approval for sensitive actions", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "approval-user",
        sessionId: "approval-session",
        runId: "approval-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open payment page and submit card details",
            url: "https://example.com/checkout",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "accepted");

      const output = asObject(response.payload.output);
      const planner = asObject(output.planner);
      const execution = asObject(output.execution);
      const verification = asObject(output.verification);

      assert.equal(output.verificationState, "blocked_pending_approval");
      assert.equal(output.verificationFailureClass, "approval_required");
      assert.equal(verification.state, "blocked_pending_approval");
      assert.equal(verification.failureClass, "approval_required");
      assert.equal(asObject(planner.verification).targetState, "blocked_pending_approval");
      assert.equal(asObject(execution.verification).state, "blocked_pending_approval");
      assert.match(String(output.message ?? ""), /verification state: blocked pending approval/i);
      assert.match(String(output.text ?? ""), /ask for confirmation/i);
    },
  );
});

test("ui navigator reports stale_grounding when grounded execution retries before completing", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "retry-1",
            actionType: "click",
            target: "button:next",
            status: "retry",
            screenshotRef: "ui://stale/1.png",
            notes: "retry",
          },
          {
            index: 2,
            actionId: "fail-2",
            actionType: "click",
            target: "button:next",
            status: "failed",
            screenshotRef: "ui://stale/2.png",
            notes: "failed",
          },
        ],
        finalStatus: "failed",
        retries: 1,
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const executorUrl = `http://127.0.0.1:${address.port}`;

  try {
    await withEnv(
      {
        UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
        UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
        UI_NAVIGATOR_EXECUTOR_URL: executorUrl,
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const request = createEnvelope({
          userId: "stale-user",
          sessionId: "stale-session",
          runId: "stale-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open billing page and verify the invoices table loads",
              url: "https://example.com/billing",
              domSnapshot: "<main><table><tr><td>Invoice</td></tr></table></main>",
              accessibilityTree: "main > table[name=Invoices]",
              markHints: ["invoices_table@(340,420)"],
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "failed");

        const output = asObject(response.payload.output);
        const planner = asObject(output.planner);
        const execution = asObject(output.execution);
        const verification = asObject(output.verification);

        assert.equal(output.verificationState, "partially_verified");
        assert.equal(output.verificationFailureClass, "stale_grounding");
        assert.equal(verification.state, "partially_verified");
        assert.equal(verification.failureClass, "stale_grounding");
        assert.equal(asObject(planner.verification).targetState, "partially_verified");
        assert.equal(asObject(execution.verification).state, "partially_verified");
        assert.match(String(verification.recoveryHint ?? ""), /refresh snapshot/i);
        assert.match(String(output.text ?? ""), /refresh snapshot/i);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator reports unverified when grounding is missing", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "ungrounded-user",
        sessionId: "ungrounded-session",
        runId: "ungrounded-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open the billing page and verify the invoices table loads.",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const verification = asObject(output.verification);
      const execution = asObject(output.execution);

      assert.equal(output.verificationState, "unverified");
      assert.equal(output.verificationFailureClass, "missing_grounding");
      assert.equal(verification.state, "unverified");
      assert.equal(verification.failureClass, "missing_grounding");
      assert.equal(asObject(execution.verification).state, "unverified");
      assert.match(String(verification.recoveryHint ?? ""), /need stronger grounding/i);
      assert.match(String(output.text ?? ""), /need stronger grounding/i);
    },
  );
});

test("ui navigator surfaces stable ref grounding metadata from remote executor", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "click-email",
            actionType: "click",
            target: "ref:email",
            status: "ok",
            screenshotRef: "ui://refs/1.png",
            notes: "clicked",
            observation: "grounding-confirmed ref:email",
          },
        ],
        finalStatus: "completed",
        retries: 0,
        grounding: {
          refMapCount: 2,
          actionableRefIds: ["email", "submit_primary"],
          staleRefTargets: [],
        },
      }),
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const executorUrl = `http://127.0.0.1:${address.port}`;

  try {
    await withEnv(
      {
        UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
        UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
        UI_NAVIGATOR_EXECUTOR_URL: executorUrl,
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const request = createEnvelope({
          userId: "ref-user",
          sessionId: "ref-session",
          runId: "ref-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Focus the email field and verify the form is ready.",
              url: "https://example.com/form",
              refMap: {
                email: {
                  selector: "#email",
                  kind: "field",
                  label: "Email field",
                },
                submit_primary: {
                  selector: "button[type='submit']",
                  kind: "submit",
                  label: "Submit button",
                },
              },
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");
        const output = asObject(response.payload.output);
        const execution = asObject(output.execution);
        const grounding = asObject(execution.grounding);

        assert.equal(grounding.refMapCount, 2);
        assert.deepEqual(grounding.actionableRefIds, ["email", "submit_primary"]);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
