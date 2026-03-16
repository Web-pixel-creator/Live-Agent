import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
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

test("ui navigator blocks destructive flow when sandbox mode=all", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      UI_NAVIGATOR_SANDBOX_BLOCKED_CATEGORIES: "destructive_operation",
      UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE: "simulated",
    },
    async () => {
      const request = createEnvelope({
        userId: "sandbox-user",
        sessionId: "sandbox-session",
        runId: "sandbox-run-all",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Delete account and remove billing profile permanently",
            url: "https://example.com/settings",
            approvalConfirmed: true,
            approvalDecision: "approved",
            sandboxPolicyMode: "all",
            sessionRole: "secondary",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");

      const output = asObject(response.payload.output);
      const sandbox = asObject(output.sandboxPolicy);
      const execution = asObject(output.execution);
      const blockedCategories = Array.isArray(sandbox.blockedCategories) ? sandbox.blockedCategories : [];

      assert.equal(sandbox.active, true);
      assert.equal(sandbox.effectiveMode, "all");
      assert.equal(sandbox.reason, "all_sessions");
      assert.equal(execution.finalStatus, "failed_sandbox_policy");
      assert.ok(blockedCategories.includes("destructive_operation"));
    },
  );
});

test("ui navigator enforces simulated executor for non-main session sandbox mode", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "non-main",
      UI_NAVIGATOR_SANDBOX_MAIN_SESSION_IDS: "main",
      UI_NAVIGATOR_SANDBOX_FORCE_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_ALLOWED_ACTIONS: "navigate,click,type,scroll,wait,verify",
    },
    async () => {
      const request = createEnvelope({
        userId: "sandbox-user",
        sessionId: "secondary-session",
        runId: "sandbox-run-non-main",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            maxSteps: 7,
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const sandbox = asObject(output.sandboxPolicy);
      const execution = asObject(output.execution);
      const executionSandbox = asObject(execution.sandbox);

      assert.equal(sandbox.active, true);
      assert.equal(sandbox.effectiveMode, "non-main");
      assert.equal(sandbox.sessionClass, "non_main");
      assert.equal(sandbox.baseExecutorMode, "remote_http");
      assert.equal(sandbox.enforcedExecutorMode, "simulated");
      assert.equal(execution.adapterMode, "simulated");
      assert.equal(executionSandbox.enforcedExecutorMode, "simulated");
    },
  );
});

test("ui navigator routes remote executor calls to requested device node", async () => {
  let observedNodeHeader = "";
  let observedNodeContext = "";
  let observedUrl = "";
  let observedDomSnapshot = "";
  let observedAccessibilityTree = "";
  let observedMarkHintsCount = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/execute" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const bodyRaw = Buffer.concat(chunks).toString("utf8");
      const parsed = bodyRaw.length > 0 ? (JSON.parse(bodyRaw) as unknown) : {};
      const asObj = asObject(parsed);
      const context = asObject(asObj.context);
      observedNodeHeader = typeof req.headers["x-device-node-id"] === "string" ? req.headers["x-device-node-id"] : "";
      observedNodeContext = typeof context.deviceNodeId === "string" ? context.deviceNodeId : "";
      observedUrl = typeof context.url === "string" ? context.url : "";
      observedDomSnapshot = typeof context.domSnapshot === "string" ? context.domSnapshot : "";
      observedAccessibilityTree = typeof context.accessibilityTree === "string" ? context.accessibilityTree : "";
      observedMarkHintsCount = Array.isArray(context.markHints) ? context.markHints.length : 0;

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          trace: [
            {
              index: 1,
              actionId: "remote-step-1",
              actionType: "verify",
              target: "node-routed",
              status: "ok",
              screenshotRef: "ui://node-routed/step-1.png",
              notes: "node routed",
            },
          ],
          finalStatus: "completed",
          retries: 0,
          deviceNode: {
            nodeId: "desktop-a",
            displayName: "Desktop A",
            kind: "desktop",
            platform: "windows",
            status: "online",
          },
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
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
        UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65531",
        UI_NAVIGATOR_DEVICE_NODES_JSON: JSON.stringify([
          {
            nodeId: "desktop-a",
            displayName: "Desktop A",
            kind: "desktop",
            platform: "windows",
            status: "online",
            executorUrl,
            capabilities: ["screen", "keyboard"],
            trustLevel: "trusted",
            version: 1,
          },
        ]),
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const request = createEnvelope({
          userId: "node-user",
          sessionId: "node-session",
          runId: "node-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            deviceNodeId: "desktop-a",
            domSnapshot: "<main><button id='checkout'>Checkout</button></main>",
            accessibilityTree: "main > button[name=Checkout]",
            markHints: ["checkout_button@(420,620)", "cart_link@(120,88)"],
          },
        },
      }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");
        assert.equal(observedNodeHeader, "desktop-a");
        assert.equal(observedNodeContext, "desktop-a");
        assert.equal(observedUrl, "https://example.com");
        assert.match(observedDomSnapshot, /checkout/i);
        assert.match(observedAccessibilityTree, /button/i);
        assert.equal(observedMarkHintsCount, 2);

        const output = asObject(response.payload.output);
        const displayText = String(output.text ?? "");
        const execution = asObject(output.execution);
        const node = asObject(execution.deviceNode);
        const grounding = asObject(execution.grounding);
        assert.equal(node.nodeId, "desktop-a");
        assert.equal(execution.adapterMode, "remote_http");
        assert.match(displayText, /separate test browser/i);
        assert.match(displayText, /page did not visibly change/i);
        assert.equal(grounding.screenshotRefProvided, false);
        assert.equal(grounding.domSnapshotProvided, true);
        assert.equal(grounding.accessibilityTreeProvided, true);
        assert.equal(grounding.markHintsCount, 2);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator can stage a long-horizon ui task as a background browser worker", async () => {
  let observedSubmitBody: Record<string, unknown> | null = null;
  const server = createServer(async (req, res) => {
    if (req.url === "/browser-jobs" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = Buffer.concat(chunks).toString("utf8");
      observedSubmitBody = asObject(parsed.length > 0 ? JSON.parse(parsed) : {});
      res.statusCode = 202;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          data: {
            job: {
              jobId: "browser-job-123",
              status: "queued",
              executedSteps: 0,
              totalSteps: 3,
              checkpoints: [],
            },
            runtime: {
              runtime: {
                enabled: true,
                started: true,
                concurrency: 1,
                pollMs: 120,
                retentionMs: 3600000,
              },
              queue: {
                total: 1,
                queued: 1,
                running: 0,
                paused: 0,
                completed: 0,
                failed: 0,
                cancelled: 0,
                backlog: 1,
                checkpointReady: 0,
                oldestQueuedAgeMs: 0,
              },
              workers: [],
            },
          },
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
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
          userId: "browser-worker-user",
          sessionId: "browser-worker-session",
          runId: "browser-worker-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open settings, review forms, and pause for checkpoint review",
              url: "https://example.com/settings",
              maxSteps: 6,
              browserWorker: {
                enabled: true,
                checkpointEverySteps: 2,
                pauseAfterStep: 2,
                label: "Operator long-horizon flow",
              },
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");
        assert.ok(observedSubmitBody);
        assert.equal(observedSubmitBody?.sessionId, "browser-worker-session");
        assert.equal(asObject(observedSubmitBody?.options).checkpointEverySteps, 2);
        assert.equal(asObject(observedSubmitBody?.options).pauseAfterStep, 2);

        const output = asObject(response.payload.output);
        const browserWorker = asObject(output.browserWorker);
        const execution = asObject(output.execution);
        assert.equal(browserWorker.enabled, true);
        assert.equal(browserWorker.jobId, "browser-job-123");
        assert.equal(browserWorker.status, "queued");
        assert.equal(execution.finalStatus, "background_submitted");
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator explains simulated runs when ui task has no concrete page grounding", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "ui-copy-user",
        sessionId: "ui-copy-session",
        runId: "ui-copy-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open the billing page, verify the invoices table loads, and report one safe next action.",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const actionPlan = Array.isArray(output.actionPlan) ? output.actionPlan : [];
      const displayText = String(output.text ?? "");
      const execution = asObject(output.execution);

      assert.equal(actionPlan.length, 1);
      assert.equal(asObject(actionPlan[0]).type, "verify");
      assert.equal(execution.adapterMode, "simulated");
      assert.match(displayText, /simulation mode/i);
      assert.match(displayText, /No real browser actions were performed/i);
      assert.match(displayText, /didn't provide a page link or page details/i);
      assert.match(displayText, /did not verify your real page yet/i);
      assert.doesNotMatch(displayText, /\[object /i);
    },
  );
});

test("ui navigator does not invent a submit click from an ungrounded disabled-button verification request", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "ui-submit-guard-user",
        sessionId: "ui-submit-guard-session",
        runId: "ui-submit-guard-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open the profile settings page, verify that Submit stays disabled until email is filled, then report the safe next action.",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const actionPlan = Array.isArray(output.actionPlan) ? output.actionPlan : [];
      const displayText = String(output.text ?? "");

      assert.equal(actionPlan.length, 1);
      assert.equal(asObject(actionPlan[0]).type, "verify");
      assert.equal(asObject(actionPlan[0]).target, "post-action-screen");
      assert.match(displayText, /didn't provide a page link or page details/i);
      assert.doesNotMatch(displayText, /click button submit/i);
    },
  );
});

test("ui navigator adds a table verification step for rule-based page checks", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "ui-table-user",
        sessionId: "ui-table-session",
        runId: "ui-table-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open the billing page and verify the invoices table loads.",
            url: "https://example.com/billing",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const actionPlan = Array.isArray(output.actionPlan) ? output.actionPlan : [];

      assert.equal(actionPlan.length, 3);
      assert.equal(asObject(actionPlan[0]).type, "navigate");
      assert.equal(asObject(actionPlan[1]).type, "verify");
      assert.equal(
        asObject(actionPlan[1]).target,
        'css:table,[role="table"],[role="grid"],#invoices-table,[data-testid="invoices-table"]',
      );
      assert.equal(asObject(actionPlan[2]).target, "post-action-screen");
    },
  );
});

test("ui navigator surfaces observed buttons as a safe next action", async () => {
  const server = createServer(async (req, res) => {
    if (req.url === "/execute" && req.method === "POST") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          trace: [
            {
              index: 1,
              actionId: "step-1",
              actionType: "navigate",
              target: "http://127.0.0.1:3000/ui-task-billing-demo.html",
              status: "ok",
              screenshotRef: "ui://trace/step-1.png",
              notes: "navigate ok",
            },
            {
              index: 2,
              actionId: "step-2",
              actionType: "verify",
              target: 'css:table,[role="table"],[role="grid"],#invoices-table,[data-testid="invoices-table"]',
              status: "ok",
              screenshotRef: "ui://trace/step-2.png",
              notes: "verify table ok",
              observation: "table rows=4",
            },
            {
              index: 3,
              actionId: "step-3",
              actionType: "verify",
              target: 'css:button,[role="button"],input[type="button"],input[type="submit"]',
              status: "ok",
              screenshotRef: "ui://trace/step-3.png",
              notes: "verify buttons ok",
              observation: "buttons=Review invoice INV-004|Export invoice CSV",
            },
          ],
          finalStatus: "completed",
          retries: 0,
          deviceNode: null,
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
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
          userId: "ui-safe-next-user",
          sessionId: "ui-safe-next-session",
          runId: "ui-safe-next-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open the billing demo page, verify the invoices table loads, and report one safe next action.",
              url: "http://127.0.0.1:3000/ui-task-billing-demo.html",
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");

        const output = asObject(response.payload.output);
        const displayText = String(output.text ?? "");
        assert.match(displayText, /Observed a table or grid with 4 visible rows\./i);
        assert.match(displayText, /Observed action buttons: Review invoice INV-004; Export invoice CSV\./i);
        assert.match(displayText, /Safe next action: "Review invoice INV-004"\./i);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator plans email-gated submit verification when URL is provided", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "ui-email-gate-user",
        sessionId: "ui-email-gate-session",
        runId: "ui-email-gate-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open the profile settings page, verify that Submit stays disabled until email is filled, then report the safe next action.",
            url: "http://127.0.0.1:3000/ui-task-profile-settings-demo.html",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const actionPlan = Array.isArray(output.actionPlan) ? output.actionPlan : [];
      const disabledIndex = actionPlan.findIndex(
        (step) =>
          asObject(step).type === "verify" &&
          asObject(step).target === 'css:button[type="submit"]:disabled,input[type="submit"]:disabled',
      );
      const clickEmailIndex = actionPlan.findIndex(
        (step) => asObject(step).type === "click" && asObject(step).target === "field:email",
      );
      const typeEmailIndex = actionPlan.findIndex(
        (step) => asObject(step).type === "type" && asObject(step).target === "field:email",
      );
      const enabledIndex = actionPlan.findIndex(
        (step) =>
          asObject(step).type === "verify" &&
          asObject(step).target === 'css:button[type="submit"]:not(:disabled),input[type="submit"]:not(:disabled)',
      );

      assert.notEqual(disabledIndex, -1);
      assert.notEqual(clickEmailIndex, -1);
      assert.notEqual(typeEmailIndex, -1);
      assert.notEqual(enabledIndex, -1);
      assert.ok(disabledIndex < clickEmailIndex);
      assert.ok(clickEmailIndex < typeEmailIndex);
      assert.ok(typeEmailIndex < enabledIndex);
      assert.equal(asObject(actionPlan[typeEmailIndex]).text, "designer@example.com");
    },
  );
});

test("ui navigator explains email-gated submit checks in plain language", async () => {
  const server = createServer(async (req, res) => {
    if (req.url === "/execute" && req.method === "POST") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          trace: [
            {
              index: 1,
              actionId: "step-1",
              actionType: "navigate",
              target: "http://127.0.0.1:3000/ui-task-profile-settings-demo.html",
              status: "ok",
              screenshotRef: "ui://trace/step-1.png",
              notes: "navigate ok",
            },
            {
              index: 2,
              actionId: "step-2",
              actionType: "verify",
              target: 'css:button[type="submit"]:disabled,input[type="submit"]:disabled',
              status: "ok",
              screenshotRef: "ui://trace/step-2.png",
              notes: "verify submit disabled ok",
              observation: "submit state=disabled",
            },
            {
              index: 3,
              actionId: "step-3",
              actionType: "click",
              target: "field:email",
              status: "ok",
              screenshotRef: "ui://trace/step-3.png",
              notes: "focus email ok",
            },
            {
              index: 4,
              actionId: "step-4",
              actionType: "type",
              target: "field:email",
              status: "ok",
              screenshotRef: "ui://trace/step-4.png",
              notes: "type email ok",
            },
            {
              index: 5,
              actionId: "step-5",
              actionType: "verify",
              target: 'css:button[type="submit"]:not(:disabled),input[type="submit"]:not(:disabled)',
              status: "ok",
              screenshotRef: "ui://trace/step-5.png",
              notes: "verify submit enabled ok",
              observation: "submit state=enabled",
            },
            {
              index: 6,
              actionId: "step-6",
              actionType: "verify",
              target: 'css:button,[role="button"],input[type="button"],input[type="submit"]',
              status: "ok",
              screenshotRef: "ui://trace/step-6.png",
              notes: "verify buttons ok",
              observation: "buttons=Submit changes|Preview profile card",
            },
          ],
          finalStatus: "completed",
          retries: 0,
          deviceNode: null,
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
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
          userId: "ui-email-gate-display-user",
          sessionId: "ui-email-gate-display-session",
          runId: "ui-email-gate-display-run",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open the profile settings page, verify that Submit stays disabled until email is filled, then report the safe next action.",
              url: "http://127.0.0.1:3000/ui-task-profile-settings-demo.html",
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");

        const output = asObject(response.payload.output);
        const displayText = String(output.text ?? "");
        assert.match(displayText, /Target page: http:\/\/127\.0\.0\.1:3000\/ui-task-profile-settings-demo\.html\./i);
        assert.match(displayText, /Observed the Submit button disabled before email entry\./i);
        assert.match(displayText, /Observed the Submit button enabled after email entry\./i);
        assert.match(displayText, /Safe next action: "Preview profile card"\./i);
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator auto-selects device node by criteria when deviceNodeId is omitted", async () => {
  let observedNodeHeader = "";
  let observedNodeContext = "";
  const server = createServer(async (req, res) => {
    if (req.url === "/execute" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const bodyRaw = Buffer.concat(chunks).toString("utf8");
      const parsed = bodyRaw.length > 0 ? (JSON.parse(bodyRaw) as unknown) : {};
      const asObj = asObject(parsed);
      const context = asObject(asObj.context);
      observedNodeHeader = typeof req.headers["x-device-node-id"] === "string" ? req.headers["x-device-node-id"] : "";
      observedNodeContext = typeof context.deviceNodeId === "string" ? context.deviceNodeId : "";

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          trace: [
            {
              index: 1,
              actionId: "remote-step-criteria-1",
              actionType: "verify",
              target: "criteria-routed",
              status: "ok",
              screenshotRef: "ui://criteria-routed/step-1.png",
              notes: "criteria routed",
            },
          ],
          finalStatus: "completed",
          retries: 0,
          deviceNode: {
            nodeId: "mobile-a",
            displayName: "Mobile A",
            kind: "mobile",
            platform: "android",
            status: "online",
          },
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
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
        UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65532",
        UI_NAVIGATOR_DEVICE_NODES_JSON: JSON.stringify([
          {
            nodeId: "desktop-a",
            displayName: "Desktop A",
            kind: "desktop",
            platform: "windows",
            status: "online",
            executorUrl,
            capabilities: ["screen", "keyboard"],
            trustLevel: "trusted",
            version: 2,
          },
          {
            nodeId: "mobile-a",
            displayName: "Mobile A",
            kind: "mobile",
            platform: "android",
            status: "online",
            executorUrl,
            capabilities: ["screen", "touch"],
            trustLevel: "trusted",
            version: 3,
          },
        ]),
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        const request = createEnvelope({
          userId: "node-user",
          sessionId: "node-session-criteria",
          runId: "node-run-criteria",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open page and verify mobile controls",
              url: "https://example.com/mobile",
              deviceNodeKind: "mobile",
              deviceNodePlatform: "android",
              deviceNodeCapabilities: ["touch"],
              deviceNodeMinTrustLevel: "reviewed",
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "completed");
        assert.equal(observedNodeHeader, "mobile-a");
        assert.equal(observedNodeContext, "mobile-a");

        const output = asObject(response.payload.output);
        const execution = asObject(output.execution);
        const node = asObject(execution.deviceNode);
        const routing = asObject(output.deviceNodeRouting);
        const requestedCriteria = asObject(routing.requestedCriteria);
        const notes = Array.isArray(routing.notes) ? routing.notes : [];
        assert.equal(node.nodeId, "mobile-a");
        assert.equal(execution.adapterMode, "remote_http");
        assert.equal(requestedCriteria.kind, "mobile");
        assert.equal(requestedCriteria.platform, "android");
        assert.ok(notes.some((note) => String(note).toLowerCase().includes("auto-selected")));
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator approval resume template preserves grounding context", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
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
            screenshotRef: "ui://approval/start",
            domSnapshot: "<main><button id='pay'>Pay</button></main>",
            accessibilityTree: "main > button[name=Pay]",
            markHints: ["pay_button@(520,620)", "card_field@(470,420)"],
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "accepted");

      const output = asObject(response.payload.output);
      assert.equal(output.approvalRequired, true);
      const resumeTemplate = asObject(output.resumeRequestTemplate);
      const resumeInput = asObject(resumeTemplate.input);
      const resumeMarkHints = Array.isArray(resumeInput.markHints) ? resumeInput.markHints : [];
      assert.equal(resumeInput.domSnapshot, "<main><button id='pay'>Pay</button></main>");
      assert.equal(resumeInput.accessibilityTree, "main > button[name=Pay]");
      assert.equal(resumeMarkHints.length, 2);
    },
  );
});

test("ui navigator fails when requested device node is missing", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_DEVICE_NODES_JSON: JSON.stringify([
        {
          nodeId: "desktop-b",
          displayName: "Desktop B",
          kind: "desktop",
          platform: "windows",
          status: "online",
          executorUrl: "http://127.0.0.1:65530",
          capabilities: ["screen"],
          trustLevel: "reviewed",
          version: 1,
        },
      ]),
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "node-user",
        sessionId: "node-session",
        runId: "node-run-missing",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
            deviceNodeId: "unknown-node",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");
      const output = asObject(response.payload.output);
      assert.match(String(output.message ?? ""), /Requested device node/i);
      const execution = asObject(output.execution);
      assert.equal(execution.finalStatus, "failed_device_node");
    },
  );
});

test("ui navigator fails when no device node matches requested criteria", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_DEVICE_NODES_JSON: JSON.stringify([
        {
          nodeId: "desktop-only",
          displayName: "Desktop Only",
          kind: "desktop",
          platform: "windows",
          status: "online",
          executorUrl: "http://127.0.0.1:65530",
          capabilities: ["screen", "keyboard"],
          trustLevel: "reviewed",
          version: 1,
        },
      ]),
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "node-user",
        sessionId: "node-session-criteria-miss",
        runId: "node-run-criteria-miss",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open mobile app and verify touch flow",
            url: "https://example.com/mobile",
            deviceNodeKind: "mobile",
            deviceNodeCapabilities: ["touch"],
            deviceNodeMinTrustLevel: "trusted",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");
      const output = asObject(response.payload.output);
      assert.match(String(output.message ?? ""), /matches requested routing criteria/i);
      const execution = asObject(output.execution);
      assert.equal(execution.finalStatus, "failed_device_node");
    },
  );
});

test("ui navigator supports strict remote_http fallback mode", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
      UI_NAVIGATOR_REMOTE_HTTP_FALLBACK_MODE: "failed",
      UI_NAVIGATOR_EXECUTOR_URL: "http://127.0.0.1:65530",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
    },
    async () => {
      const request = createEnvelope({
        userId: "strict-user",
        sessionId: "strict-session",
        runId: "strict-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open page and verify content",
            url: "https://example.com",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");

      const output = asObject(response.payload.output);
      const execution = asObject(output.execution);
      const trace = Array.isArray(execution.trace) ? execution.trace : [];
      const adapterNotes = Array.isArray(execution.adapterNotes) ? execution.adapterNotes : [];

      assert.equal(execution.finalStatus, "failed");
      assert.equal(execution.adapterMode, "remote_http");
      assert.equal(trace.length, 1);
      assert.match(String(adapterNotes.join(" ")), /strict failure/i);
    },
  );
});

test("ui navigator blocks planned action loops with failed_loop diagnostics", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_EXECUTOR_MODE: "simulated",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      UI_NAVIGATOR_LOOP_DETECTION_ENABLED: "true",
      UI_NAVIGATOR_LOOP_WINDOW_SIZE: "8",
      UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD: "2",
      UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD: "0.5",
    },
    async () => {
      const request = createEnvelope({
        userId: "loop-user",
        sessionId: "loop-session-plan",
        runId: "loop-run-plan",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Fill profile form and submit",
            url: "https://example.com/profile",
            formData: {
              first_name: "Ada",
              last_name: "Lovelace",
            },
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");

      const output = asObject(response.payload.output);
      const loopProtection = asObject(output.loopProtection);
      const execution = asObject(output.execution);

      assert.equal(output.approvalRequired, true);
      assert.equal(loopProtection.status, "failed_loop");
      assert.equal(loopProtection.source, "plan");
      assert.equal(execution.finalStatus, "failed_loop");
      assert.match(String(output.message ?? ""), /loop protection/i);
    },
  );
});

test("ui navigator marks execution failed when runtime trace loop is detected", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace: [
          {
            index: 1,
            actionId: "runtime-loop-1",
            actionType: "click",
            target: "button:next",
            status: "ok",
            screenshotRef: "ui://runtime-loop/1.png",
            notes: "step 1",
          },
          {
            index: 2,
            actionId: "runtime-loop-2",
            actionType: "click",
            target: "button:next",
            status: "ok",
            screenshotRef: "ui://runtime-loop/2.png",
            notes: "step 2",
          },
          {
            index: 3,
            actionId: "runtime-loop-3",
            actionType: "click",
            target: "button:next",
            status: "ok",
            screenshotRef: "ui://runtime-loop/3.png",
            notes: "step 3",
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
        UI_NAVIGATOR_LOOP_DETECTION_ENABLED: "true",
        UI_NAVIGATOR_LOOP_WINDOW_SIZE: "8",
        UI_NAVIGATOR_LOOP_REPEAT_THRESHOLD: "3",
        UI_NAVIGATOR_LOOP_SIMILARITY_THRESHOLD: "0.85",
      },
      async () => {
        const request = createEnvelope({
          userId: "loop-user",
          sessionId: "loop-session-runtime",
          runId: "loop-run-runtime",
          type: "orchestrator.request",
          source: "frontend",
          payload: {
            intent: "ui_task",
            input: {
              goal: "Open page and verify results",
              url: "https://example.com/runtime-loop",
            },
          },
        }) as OrchestratorRequest;

        const response = await runUiNavigatorAgent(request);
        assert.equal(response.payload.status, "failed");

        const output = asObject(response.payload.output);
        const execution = asObject(output.execution);
        const loopProtection = asObject(execution.loopProtection);

        assert.equal(execution.finalStatus, "failed");
        assert.equal(loopProtection.detected, true);
        assert.equal(loopProtection.source, "trace");
        assert.equal(execution.adapterMode, "remote_http");
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test("ui navigator blocks execution when damage-control rule returns block verdict", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      UI_NAVIGATOR_DAMAGE_CONTROL_ENABLED: "true",
      UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON: JSON.stringify({
        version: 1,
        rules: [
          {
            id: "dc-test-block-archive",
            mode: "block",
            reason: "Archive operation is blocked for this environment.",
            goalPatterns: ["archive\\s+account"],
          },
        ],
      }),
    },
    async () => {
      const request = createEnvelope({
        userId: "damage-user",
        sessionId: "damage-session-block",
        runId: "damage-run-block",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Archive account for inactive users",
            url: "https://example.com/admin/archive",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "failed");

      const output = asObject(response.payload.output);
      const execution = asObject(output.execution);
      const damageControl = asObject(output.damageControl);
      const matches = Array.isArray(damageControl.matches) ? damageControl.matches : [];

      assert.equal(execution.finalStatus, "failed_damage_control");
      assert.equal(output.approvalRequired, false);
      assert.equal(damageControl.verdict, "block");
      assert.equal(matches.length, 1);
    },
  );
});

test("ui navigator requests approval when damage-control rule returns ask verdict", async () => {
  await withEnv(
    {
      UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
      UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      UI_NAVIGATOR_DAMAGE_CONTROL_ENABLED: "true",
      UI_NAVIGATOR_DAMAGE_CONTROL_RULES_JSON: JSON.stringify({
        version: 1,
        rules: [
          {
            id: "dc-test-ask-nav",
            mode: "ask",
            reason: "Navigation in this scope requires explicit approval.",
            actionTypes: ["navigate"],
          },
        ],
      }),
      UI_NAVIGATOR_APPROVAL_KEYWORDS: "payment,pay,card",
    },
    async () => {
      const request = createEnvelope({
        userId: "damage-user",
        sessionId: "damage-session-ask",
        runId: "damage-run-ask",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "ui_task",
          input: {
            goal: "Open public dashboard and inspect metrics",
            url: "https://example.com/dashboard",
          },
        },
      }) as OrchestratorRequest;

      const response = await runUiNavigatorAgent(request);
      assert.equal(response.payload.status, "accepted");

      const output = asObject(response.payload.output);
      const damageControl = asObject(output.damageControl);
      const categories = Array.isArray(output.approvalCategories) ? output.approvalCategories : [];

      assert.equal(output.approvalRequired, true);
      assert.equal(damageControl.verdict, "ask");
      assert.ok(categories.includes("damage_control:dc-test-ask-nav"));
    },
  );
});
