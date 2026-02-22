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
        assert.match(observedDomSnapshot, /checkout/i);
        assert.match(observedAccessibilityTree, /button/i);
        assert.equal(observedMarkHintsCount, 2);

        const output = asObject(response.payload.output);
        const execution = asObject(output.execution);
        const node = asObject(execution.deviceNode);
        const grounding = asObject(execution.grounding);
        assert.equal(node.nodeId, "desktop-a");
        assert.equal(execution.adapterMode, "remote_http");
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
