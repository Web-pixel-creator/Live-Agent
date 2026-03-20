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

test("ui navigator handles button-driven visa demo presets without falling back to intake fields", async () => {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const parsedBody = rawBody.length > 0 ? (JSON.parse(rawBody) as { actions?: Array<Record<string, unknown>> }) : {};
    const actions = Array.isArray(parsedBody.actions) ? parsedBody.actions : [];
    const trace = actions.map((action, index) => ({
      index: index + 1,
      actionId: typeof action.id === "string" ? action.id : `action-${index + 1}`,
      actionType: typeof action.type === "string" ? action.type : "click",
      target: typeof action.target === "string" ? action.target : `target-${index + 1}`,
      status: "ok",
      screenshotRef: `ui://button-flow/${index + 1}.png`,
      notes: "executed by mock button-flow executor",
    }));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        trace,
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

  const scenarios = [
    {
      name: "reminder",
      goal:
        "Open the visa reminder demo page, prepare Anna Petrova's consultation reminder from the provided summary, stop before the protected send step, and wait for approval.",
      url: "http://localhost:3000/ui-task-visa-reminder-demo.html",
      summary: [
        "full_name: Anna Petrova",
        "email: anna.petrova@example.com",
        "booking_slot: Tomorrow 16:00",
        "prep_items: passport originals, proof of address, intake questionnaire",
      ].join("\n"),
      domSnapshot:
        "<main><section id='protected-reminder-boundary'><button id='prepare-reminder-btn' type='button'>Prepare reminder draft</button><button id='send-reminder-btn' type='button' disabled>Send reminder for approval</button></section><section id='approved-reminder-confirmation' data-state='approved'><h3>Approved reminder confirmation</h3></section></main>",
      accessibilityTree:
        "main > section[name=protected reminder boundary] > button[name=Prepare reminder draft] > button[name=Send reminder for approval disabled] > section[name=approved reminder confirmation]",
      markHints: [
        "prepare-reminder-btn@(240,470)",
        "send-reminder-btn@(520,470)",
        "approved-reminder-confirmation@(260,620)",
      ],
      refMap: {
        "prepare-reminder-btn": {
          selector: "#prepare-reminder-btn",
          kind: "button",
          label: "Prepare reminder draft",
          aliases: ["prepare reminder", "consultation reminder draft"],
        },
        "send-reminder-btn": {
          selector: "#send-reminder-btn",
          kind: "submit",
          label: "Send reminder for approval",
          aliases: ["send reminder for approval", "protected send step"],
        },
      },
      prepareTarget: "ref:prepare-reminder-btn",
      submitTarget: "ref:send-reminder-btn",
    },
    {
      name: "handoff",
      goal:
        "Open the visa CRM handoff demo page, prepare Anna Petrova's CRM update handoff from the provided summary, stop before the protected writeback step, and wait for approval.",
      url: "http://localhost:3000/ui-task-visa-handoff-demo.html",
      summary: [
        "full_name: Anna Petrova",
        "email: anna.petrova@example.com",
        "crm_owner: Sofia Kim",
        "writeback_payload: crm note, case owner assignment, checklist handoff, next-touch date",
      ].join("\n"),
      domSnapshot:
        "<main><section id='protected-crm-boundary'><button id='prepare-crm-note-btn' type='button'>Prepare CRM note</button><button id='commit-crm-update-btn' type='button' disabled>Commit CRM update for approval</button></section><section id='approved-crm-confirmation' data-state='approved'><h3>Approved CRM handoff confirmation</h3></section></main>",
      accessibilityTree:
        "main > section[name=protected crm boundary] > button[name=Prepare CRM note] > button[name=Commit CRM update for approval disabled] > section[name=approved crm confirmation]",
      markHints: [
        "prepare-crm-note-btn@(240,430)",
        "commit-crm-update-btn@(540,430)",
        "approved-crm-confirmation@(260,580)",
      ],
      refMap: {
        "prepare-crm-note-btn": {
          selector: "#prepare-crm-note-btn",
          kind: "button",
          label: "Prepare CRM note",
          aliases: ["prepare crm note", "prepare crm update"],
        },
        "commit-crm-update-btn": {
          selector: "#commit-crm-update-btn",
          kind: "submit",
          label: "Commit CRM update for approval",
          aliases: ["commit crm update", "protected writeback step"],
        },
      },
      prepareTarget: "ref:prepare-crm-note-btn",
      submitTarget: "ref:commit-crm-update-btn",
    },
    {
      name: "escalation",
      goal:
        "Open the visa escalation demo page, prepare Anna Petrova's case escalation from the provided summary, stop before the protected human handoff step, and wait for approval.",
      url: "http://localhost:3000/ui-task-visa-escalation-demo.html",
      summary: [
        "full_name: Anna Petrova",
        "email: anna.petrova@example.com",
        "human_owner: Sofia Kim",
        "handoff_queue: Visa Escalations Tier 2",
      ].join("\n"),
      domSnapshot:
        "<main><section id='protected-step-boundary'><button id='prepare-escalation-btn' type='button'>Prepare escalation packet</button><button id='approval-required-btn' type='button' disabled>Send for human approval</button></section><section id='approved-confirmation' data-state='approved'><h3>Approved handoff confirmation</h3></section></main>",
      accessibilityTree:
        "main > section[name=protected step boundary] > button[name=Prepare escalation packet] > button[name=Send for human approval disabled] > section[name=approved handoff confirmation]",
      markHints: [
        "prepare-escalation-btn@(240,450)",
        "approval-required-btn@(540,450)",
        "approved-confirmation@(260,600)",
      ],
      refMap: {
        "prepare-escalation-btn": {
          selector: "#prepare-escalation-btn",
          kind: "button",
          label: "Prepare escalation packet",
          aliases: ["prepare escalation", "prepare escalation packet"],
        },
        "approval-required-btn": {
          selector: "#approval-required-btn",
          kind: "submit",
          label: "Send for human approval",
          aliases: ["send for human approval", "protected human handoff step"],
        },
      },
      prepareTarget: "ref:prepare-escalation-btn",
      submitTarget: "ref:approval-required-btn",
    },
  ] as const;

  try {
    await withEnv(
      {
        UI_NAVIGATOR_USE_GEMINI_PLANNER: "false",
        UI_NAVIGATOR_EXECUTOR_MODE: "remote_http",
        UI_NAVIGATOR_EXECUTOR_URL: executorUrl,
        UI_NAVIGATOR_SANDBOX_POLICY_MODE: "off",
      },
      async () => {
        for (const scenario of scenarios) {
          const blockedRequest = createEnvelope({
            userId: "button-user",
            sessionId: `button-session-${scenario.name}`,
            runId: `button-run-${scenario.name}-blocked`,
            type: "orchestrator.request",
            source: "frontend",
            payload: {
              intent: "ui_task",
              input: {
                goal: scenario.goal,
                url: scenario.url,
                summary: scenario.summary,
                domSnapshot: scenario.domSnapshot,
                accessibilityTree: scenario.accessibilityTree,
                markHints: scenario.markHints,
                refMap: scenario.refMap,
              },
            },
          }) as OrchestratorRequest;

          const blockedResponse = await runUiNavigatorAgent(blockedRequest);
          assert.ok(
            blockedResponse.payload.status === "accepted" || blockedResponse.payload.status === "completed",
            `${scenario.name} draft-prep pass should stay non-failing`,
          );

          const blockedOutput = asObject(blockedResponse.payload.output);
          const blockedPlan = Array.isArray(blockedOutput.actionPlan)
            ? blockedOutput.actionPlan.map((action) => asObject(action))
            : [];

          assert.ok(
            blockedPlan.some((action) => action.type === "click" && action.target === scenario.prepareTarget),
            `${scenario.name} should click the prepare button first`,
          );
          assert.ok(
            !blockedPlan.some((action) => action.type === "click" && action.target === scenario.submitTarget),
            `${scenario.name} draft prep should not force the protected submit click`,
          );
          assert.ok(
            !blockedPlan.some((action) => typeof action.target === "string" && action.target.startsWith("field:full_name")),
            `${scenario.name} should not fall back to intake field typing`,
          );

          const approvedRequest = createEnvelope({
            userId: "button-user",
            sessionId: `button-session-${scenario.name}`,
            runId: `button-run-${scenario.name}-approved`,
            type: "orchestrator.request",
            source: "frontend",
            payload: {
              intent: "ui_task",
              input: {
                goal: scenario.goal.replace("stop before", "continue through"),
                url: scenario.url,
                summary: scenario.summary,
                domSnapshot: scenario.domSnapshot,
                accessibilityTree: scenario.accessibilityTree,
                markHints: scenario.markHints,
                refMap: scenario.refMap,
                approvalConfirmed: true,
                approvalDecision: "approved",
                approvalReason: "Reviewed and approved the protected demo step.",
              },
            },
          }) as OrchestratorRequest;

          const approvedResponse = await runUiNavigatorAgent(approvedRequest);
          assert.equal(approvedResponse.payload.status, "completed", `${scenario.name} should complete after approval`);
          const approvedOutput = asObject(approvedResponse.payload.output);
          assert.equal(approvedOutput.verificationState, "verified");
        }
      },
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
