import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { orchestrate } from "../../agents/orchestrator/src/orchestrate.js";
import {
  getOrchestratorWorkflowStoreStatus,
  resetOrchestratorWorkflowStoreForTests,
} from "../../agents/orchestrator/src/workflow-store.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetOrchestratorWorkflowStoreForTests();
  }
}

async function startGeminiMockServer(responseText: string): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
  requestBodies: Array<Record<string, unknown>>;
}> {
  const requestBodies: Array<Record<string, unknown>> = [];
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("method_not_allowed");
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      requestBodies.push(JSON.parse(rawBody) as Record<string, unknown>);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: responseText }],
              },
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("failed to start gemini mock server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}/v1beta`;
  return {
    baseUrl,
    requestBodies,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function startOpenAiCompatibleMockServer(responseText: string): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("method_not_allowed");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: responseText,
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("failed to start openai-compatible mock server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  return {
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

test("orchestrator keeps live-agent primary route and returns delegation payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: "unit-run-delegation",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "delegate story: create a short scene about a rover on Mars",
      },
      task: {
        taskId: "task-unit-run-delegation",
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "live-agent");
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const delegation = asObject(output.delegation);
  const task = asObject(response.payload.task);
  assert.equal(delegation.requestedIntent, "story");
  assert.equal(delegation.requestedRoute, "storyteller-agent");
  assert.equal(task.stage, "reporting");
  assert.equal(task.status, "completed");

  const workflow = getOrchestratorWorkflowStoreStatus().workflowState;
  assert.equal(workflow.status, "completed");
  assert.equal(workflow.currentStage, "reporting");
  assert.equal(workflow.activeRole, "reporter");
});

test("orchestrator returns approval-required flow for sensitive ui_task", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId: "unit-run-ui-approval",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "ui_task",
      input: {
        goal: "Open payment page and submit card details",
        url: "https://example.com/checkout",
      },
      task: {
        taskId: "task-unit-run-ui-approval",
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "ui-navigator-agent");
  assert.equal(response.payload.status, "accepted");

  const output = asObject(response.payload.output);
  const task = asObject(response.payload.task);
  assert.equal(output.approvalRequired, true);
  assert.ok(typeof output.approvalId === "string");
  assert.equal(task.stage, "safety_review");
  assert.equal(task.status, "pending_approval");

  const workflow = getOrchestratorWorkflowStoreStatus().workflowState;
  assert.equal(workflow.status, "pending_approval");
  assert.equal(workflow.currentStage, "safety_review");
  assert.equal(workflow.activeRole, "safety_reviewer");
});

test("orchestrator routes research intent to live-agent with citation-bearing output", async () => {
  const previousResearchApiKey = process.env.LIVE_AGENT_RESEARCH_API_KEY;
  const previousPerplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const previousResearchModel = process.env.LIVE_AGENT_RESEARCH_MODEL;
  const previousResearchMock = process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON;
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_RESEARCH_API_KEY = "";
  process.env.PERPLEXITY_API_KEY = "";
  process.env.LIVE_AGENT_RESEARCH_MODEL = "sonar-pro";
  process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON = JSON.stringify({
    model: "sonar-pro",
    choices: [
      {
        message: {
          content:
            "Independent shipping and infrastructure reports point to congestion risk when weather disruption and berth constraints land at the same time.",
        },
      },
    ],
    citations: [
      "https://unctad.org/publication/review-maritime-transport-2024",
      "https://www.worldbank.org/en/topic/transport/brief/ports-and-waterways",
    ],
    search_results: [
      {
        title: "Review of Maritime Transport 2024",
        url: "https://unctad.org/publication/review-maritime-transport-2024",
      },
      {
        title: "Ports and waterways overview",
        url: "https://www.worldbank.org/en/topic/transport/brief/ports-and-waterways",
      },
    ],
  });

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-research",
      runId: "unit-run-research",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "research",
        input: {
          query: "What drives port congestion risk?",
          maxCitations: 2,
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "live-agent");
    assert.equal(response.payload.status, "completed");

    const output = asObject(response.payload.output);
    const research = asObject(output.research);
    assert.equal(output.mode, "research");
    assert.match(String(output.text), /Independent shipping and infrastructure reports point to congestion risk/);
    assert.match(String(research.displayText), /Independent shipping and infrastructure reports point to congestion risk/);
    assert.match(String(research.debugSummary), /Research sources: perplexity\/sonar-pro/);
    assert.equal(research.provider, "perplexity");
    assert.equal(research.citationCount, 2);
    assert.equal(research.sourceUrlCount, 2);
  } finally {
    if (previousResearchApiKey === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_API_KEY;
    } else {
      process.env.LIVE_AGENT_RESEARCH_API_KEY = previousResearchApiKey;
    }
    if (previousPerplexityApiKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = previousPerplexityApiKey;
    }
    if (previousResearchModel === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_MODEL;
    } else {
      process.env.LIVE_AGENT_RESEARCH_MODEL = previousResearchModel;
    }
    if (previousResearchMock === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON;
    } else {
      process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON = previousResearchMock;
    }
  }
});

test("orchestrator research requests clarification for ambiguous key queries before grounding", async () => {
  const previousResearchApiKey = process.env.LIVE_AGENT_RESEARCH_API_KEY;
  const previousPerplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const previousResearchModel = process.env.LIVE_AGENT_RESEARCH_MODEL;
  const previousResearchMock = process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON;
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.LIVE_AGENT_RESEARCH_API_KEY = "";
  process.env.PERPLEXITY_API_KEY = "";
  process.env.LIVE_AGENT_RESEARCH_MODEL = "sonar-pro";
  delete process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON;
  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-research-key",
      runId: "unit-run-research-key",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "research",
        input: {
          query: "\u043a\u0430\u043a \u043d\u0430\u0439\u0442\u0438 \u043a\u043b\u044e\u0447\u044c",
          maxCitations: 2,
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "live-agent");
    assert.equal(response.payload.status, "completed");

    const output = asObject(response.payload.output);
    const research = asObject(output.research);
    assert.equal(output.mode, "research");
    assert.match(String(output.text), /\u0423\u0442\u043e\u0447\u043d\u0438, \u043a\u0430\u043a\u043e\u0439 \u0438\u043c\u0435\u043d\u043d\u043e \u043a\u043b\u044e\u0447/);
    assert.equal(research.clarificationRequired, true);
    assert.equal(research.citationCount, 0);
  } finally {
    if (previousResearchApiKey === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_API_KEY;
    } else {
      process.env.LIVE_AGENT_RESEARCH_API_KEY = previousResearchApiKey;
    }
    if (previousPerplexityApiKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = previousPerplexityApiKey;
    }
    if (previousResearchModel === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_MODEL;
    } else {
      process.env.LIVE_AGENT_RESEARCH_MODEL = previousResearchModel;
    }
    if (previousResearchMock === undefined) {
      delete process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON;
    } else {
      process.env.LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON = previousResearchMock;
    }
  }
});

test("orchestrator proxies and stores consultation booking state across the main flow", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";

  const sessionId = "unit-session-booking-flow";
  const taskId = "task-unit-booking-flow";

  const offerRequest = createEnvelope({
    userId: "unit-user",
    sessionId,
    runId: "unit-run-booking-flow-offer",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "I need to book a visa and relocation consultation.",
      },
      task: {
        taskId,
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const offerResponse = await orchestrate(offerRequest);
  assert.equal(offerResponse.payload.route, "live-agent");
  assert.equal(offerResponse.payload.status, "completed");

  const offerOutput = asObject(offerResponse.payload.output);
  const offerBooking = asObject(offerOutput.booking);
  assert.equal(offerOutput.mode, "booking");
  assert.equal(offerBooking.status, "offered");

  const confirmRequest = createEnvelope({
    userId: "unit-user",
    sessionId,
    runId: "unit-run-booking-flow-confirm",
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "Slot 2 works for me.",
      },
      task: {
        taskId,
        status: "queued",
        stage: "intake",
      },
    },
  }) as OrchestratorRequest;

  const confirmResponse = await orchestrate(confirmRequest);
  assert.equal(confirmResponse.payload.route, "live-agent");
  assert.equal(confirmResponse.payload.status, "completed");

  const confirmOutput = asObject(confirmResponse.payload.output);
  const confirmBooking = asObject(confirmOutput.booking);
  const confirmedSummary = asObject(confirmBooking.confirmedSummary);
  const task = asObject(confirmResponse.payload.task);
  const workflow = getOrchestratorWorkflowStoreStatus().workflowState;

  assert.equal(confirmOutput.mode, "booking");
  assert.equal(confirmBooking.status, "confirmed");
  assert.equal(confirmBooking.selectedSlotId, "slot-2");
  assert.match(String(confirmedSummary.shortSummary), /Confirmed visa and relocation consultation/);
  assert.equal(task.status, "completed");
  assert.equal(task.stage, "reporting");
  assert.equal(workflow.bookingState?.status, "confirmed");
  assert.equal(workflow.bookingState?.selectedSlotId, "slot-2");
  assert.match(String(workflow.bookingState?.shortSummary ?? ""), /Confirmed visa and relocation consultation/);
});

test("orchestrator pauses hard-limit Case Wiki cost runs for approval before route execution", async () => {
  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_MOONSHOT_API_KEY: "",
      MOONSHOT_API_KEY: "",
      ORCHESTRATOR_COST_GUARD_ENABLED: "true",
      ORCHESTRATOR_COST_GUARD_MAX_CASE_USD: "1",
      ORCHESTRATOR_COST_GUARD_MAX_CASE_TOKENS: "5000",
      ORCHESTRATOR_COST_GUARD_DEGRADE_AT_RATIO: "0.8",
      ORCHESTRATOR_COST_GUARD_REQUIRE_APPROVAL: "true",
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: "true",
    },
    async () => {
      const runId = `unit-run-cost-guard-hard-${Date.now()}`;
      const request = createEnvelope({
        userId: "unit-user",
        sessionId: "unit-session-cost-guard-hard",
        runId,
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "What should we do next for this case?",
            caseWiki: {
              caseId: "case-cost-hard",
              overview: {
                summary: "Relocation case is near completion but cost budget is already exceeded.",
                status: "blocked",
                currentStage: "document_collection",
              },
              workspacePack: {
                summaryValue: "Budget exceeded on this relocation case.",
                blockerValue: "Operator must approve more runtime spend.",
                nextActionValue: "Request operator approval before continuing.",
                costSummary: {
                  pricingConfigured: true,
                  totalUsd: 1.25,
                  totalTokens: 3000,
                },
              },
            },
          },
          task: {
            taskId: `task-${runId}`,
            status: "queued",
            stage: "intake",
          },
        },
      }) as OrchestratorRequest;

      const response = await orchestrate(request);
      assert.equal(response.payload.route, "live-agent");
      assert.equal(response.payload.status, "accepted");

      const output = asObject(response.payload.output);
      const routing = asObject(output.routing);
      const runtimeBudgetGuard = asObject(output.runtimeBudgetGuard);
      const task = asObject(response.payload.task);
      const workflow = getOrchestratorWorkflowStoreStatus().workflowState;

      assert.equal(output.approvalRequired, true);
      assert.equal(output.approvalReason, "runtime_cost_budget_guard");
      assert.equal(runtimeBudgetGuard.status, "approval_required");
      assert.equal(runtimeBudgetGuard.action, "approval_required");
      assert.equal(runtimeBudgetGuard.approvalRequired, true);
      assert.deepEqual(runtimeBudgetGuard.exceeded, ["usd"]);
      assert.equal(routing.selectionReason, "cost_guard");
      assert.equal(routing.reason, "case_wiki_cost_guard_hard_limit:usd");
      assert.equal(task.stage, "safety_review");
      assert.equal(task.status, "pending_approval");
      assert.equal(workflow.status, "pending_approval");
      assert.equal(workflow.currentStage, "safety_review");
    },
  );
});

test("orchestrator degrades soft-limit Case Wiki cost runs to short-context routing", async () => {
  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_USE_GEMINI_CHAT: "false",
      LIVE_AGENT_TEXT_PROVIDER: "gemini_api",
      LIVE_AGENT_MOONSHOT_API_KEY: "",
      MOONSHOT_API_KEY: "",
      ORCHESTRATOR_COST_GUARD_ENABLED: "true",
      ORCHESTRATOR_COST_GUARD_MAX_CASE_USD: "5",
      ORCHESTRATOR_COST_GUARD_MAX_CASE_TOKENS: "1000",
      ORCHESTRATOR_COST_GUARD_DEGRADE_AT_RATIO: "0.8",
      ORCHESTRATOR_COST_GUARD_REQUIRE_APPROVAL: "true",
      ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED: "true",
    },
    async () => {
      const runId = `unit-run-cost-guard-soft-${Date.now()}`;
      const request = createEnvelope({
        userId: "unit-user",
        sessionId: "unit-session-cost-guard-soft",
        runId,
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "What is the next action?",
            caseWiki: {
              caseId: "case-cost-soft",
              overview: {
                summary: "Customer is preparing a relocation visa packet and needs one identity document.",
                status: "blocked",
                currentStage: "document_collection",
              },
              workspacePack: {
                summaryValue: "Relocation visa packet is blocked by one missing passport scan.",
                blockerValue: "Passport scan is missing.",
                nextActionValue: "Ask the customer to upload the passport scan.",
                costSummary: {
                  pricingConfigured: false,
                  totalTokens: 900,
                },
              },
              highlights: {
                topBlockingQuestion: {
                  id: "question:passport-scan",
                  question: "Do we have the passport scan?",
                  suggestedNextStep: "Ask the customer to upload the passport scan.",
                },
              },
              evidencePack: {
                sourceRefs: ["workflow:control-plane", "replay:session-soft"],
              },
            },
          },
        },
      }) as OrchestratorRequest;

      const response = await orchestrate(request);
      assert.equal(response.payload.route, "live-agent");
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const routing = asObject(output.routing);
      const runtimeBudgetGuard = asObject(output.runtimeBudgetGuard);
      const context = asObject(output.context);
      const caseWiki = asObject(context.caseWiki);
      const caseWikiBudgetGuard = asObject(caseWiki.runtimeBudgetGuard);

      assert.equal(routing.selectionReason, "cost_guard");
      assert.equal(routing.reason, "case_wiki_cost_guard_soft_limit:tokens");
      assert.equal(runtimeBudgetGuard.status, "degraded");
      assert.equal(runtimeBudgetGuard.action, "short_context");
      assert.equal(runtimeBudgetGuard.shortContextPreferred, true);
      assert.equal(context.contextSource, "caseWiki");
      assert.equal(caseWiki.caseId, "case-cost-soft");
      assert.equal(caseWikiBudgetGuard.status, "degraded");
      assert.equal(caseWikiBudgetGuard.shortContextPreferred, true);
    },
  );
});

test("assistive router overrides route on high confidence story classification", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED = "true";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER = "gemini_api";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY = "unit-test-key";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE = "0.75";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY = "judged_default";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING = "none";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED = "false";

  const mock = await startGeminiMockServer(
    JSON.stringify({
      intent: "story",
      confidence: 0.93,
      reason: "user requested a creative narrative",
    }),
  );
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL = mock.baseUrl;

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-assistive-override",
      runId: "unit-run-assistive-override",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text: "Create a short fantasy story about dragons and forests",
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "storyteller-agent");
    assert.equal(response.payload.status, "completed");

    const output = asObject(response.payload.output);
    const routing = asObject(output.routing);
    assert.equal(routing.mode, "assistive_override");
    assert.equal(routing.requestedIntent, "conversation");
    assert.equal(routing.routedIntent, "story");
    assert.equal(routing.route, "storyteller-agent");
    assert.equal(routing.provider, "gemini_api");
    assert.equal(routing.defaultProvider, "gemini_api");
    assert.equal(routing.defaultModel, "gemini-3.1-flash-lite-preview");
    assert.equal(routing.selectionReason, "judged_default");
    assert.equal(routing.budgetPolicy, "judged_default");
    assert.equal(routing.promptCaching, "none");
    assert.equal(routing.watchlistEnabled, false);
  } finally {
    await mock.close();
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED;
  }
});

test("assistive router feeds Case Wiki routing context into classifier prompts", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED = "true";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER = "gemini_api";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY = "unit-test-key";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE = "0.75";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY = "judged_default";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING = "none";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED = "false";

  const mock = await startGeminiMockServer(
    JSON.stringify({
      intent: "negotiation",
      confidence: 0.91,
      reason: "case wiki says customer follow-up is required",
    }),
  );
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL = mock.baseUrl;

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-assistive-case-wiki",
      runId: "unit-run-assistive-case-wiki",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text: "Continue with this case.",
          caseWiki: {
            caseId: "case-42",
            overview: {
              summary: "Customer is blocked on one missing passport scan before submission.",
              status: "waiting_on_customer",
              currentStage: "document_collection",
            },
            highlights: {
              topBlockingQuestion: {
                id: "question:passport-scan",
                question: "Do we have the passport scan?",
                suggestedNextStep: "Ask the customer to upload the passport scan.",
              },
            },
            workspacePack: {
              summaryValue: "Passport scan is still missing for this case.",
              blockerValue: "Do we have the passport scan?",
              nextActionValue: "Ask the customer to upload the passport scan.",
              defaultFocus: {
                focusKind: "question",
                focusId: "question:passport-scan",
                focusLabel: "Passport scan is missing",
              },
            },
            recommendedNextAction: {
              type: "document_request",
              title: "Request passport scan",
              summary: "Ask the customer to upload the passport scan.",
              owner: "customer",
              blocking: true,
              relatedQuestionIds: ["question:passport-scan"],
              sourceRefs: ["workflow:control-plane"],
            },
            routingPack: {
              proofs: [],
              questions: [
                {
                  focusKind: "question",
                  focusId: "question:passport-scan",
                  focusLabel: "Passport scan is missing",
                  route: {
                    lane: "customer_followup",
                    owner: "customer",
                    priority: "high",
                    status: "open",
                    blocking: true,
                    approvalRequired: false,
                    dueBy: null,
                    summary: "Collect the missing document from the customer.",
                  },
                  cta: {
                    actionId: "run_negotiation",
                    label: "Ask for passport scan",
                    hint: "Message the customer for the missing passport scan.",
                    owner: "customer",
                    lane: "customer_followup",
                    approvalRequired: false,
                    blocking: true,
                    summary: "Run a customer follow-up request.",
                  },
                  sourceRefs: ["workflow:control-plane"],
                  relatedQuestionIds: ["question:passport-scan"],
                  nextAction: null,
                },
              ],
            },
          },
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "live-agent");
    assert.equal(response.payload.status, "completed");

    const output = asObject(response.payload.output);
    const routing = asObject(output.routing);
    assert.equal(routing.mode, "assistive_override");
    assert.equal(routing.routedIntent, "negotiation");
    assert.equal(routing.contextSource, "case_wiki");
    assert.equal(routing.contextIngressSource, "preserved_input_case_wiki");
    assert.equal(routing.contextFocusId, "question:passport-scan");
    assert.equal(routing.contextBlocker, "Do we have the passport scan?");
    assert.equal(routing.contextNextAction, "Request passport scan");

    assert.equal(mock.requestBodies.length, 1);
    const contents = Array.isArray(mock.requestBodies[0]?.contents) ? mock.requestBodies[0].contents : [];
    const userContent = asObject(contents[0]);
    const parts = Array.isArray(userContent.parts) ? userContent.parts : [];
    const firstPart = asObject(parts[0]);
    const prompt = String(firstPart.text ?? "");
    assert.match(prompt, /Case Wiki compiled memory \(primary routing context\)/);
    assert.match(prompt, /Case summary: Passport scan is still missing for this case\./);
    assert.match(prompt, /Current stage: document_collection/);
    assert.match(prompt, /Default focus: kind=question; id=question:passport-scan; label=Passport scan is missing/);
    assert.match(prompt, /Blocking question: Do we have the passport scan\?/);
    assert.match(prompt, /Next action: Request passport scan/);
    assert.match(prompt, /Routing lane: customer_followup/);
    assert.match(prompt, /Routing CTA: run_negotiation/);
    assert.match(prompt, /User input: Continue with this case\./);
  } finally {
    await mock.close();
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED;
  }
});

test("assistive router falls back to deterministic route on low confidence", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED = "true";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER = "gemini_api";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY = "unit-test-key";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE = "0.8";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY = "judged_default";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING = "none";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED = "false";

  const mock = await startGeminiMockServer(
    JSON.stringify({
      intent: "story",
      confidence: 0.42,
      reason: "weak signal",
    }),
  );
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL = mock.baseUrl;

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-assistive-fallback",
      runId: "unit-run-assistive-fallback",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text: "Tell me a short story with characters and plot",
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "live-agent");
    assert.equal(response.payload.status, "completed");

    const output = asObject(response.payload.output);
    const routing = asObject(output.routing);
    assert.equal(routing.mode, "assistive_fallback");
    assert.equal(routing.requestedIntent, "conversation");
    assert.equal(routing.routedIntent, "conversation");
    assert.equal(routing.route, "live-agent");
    assert.equal(routing.provider, "gemini_api");
    assert.equal(routing.selectionReason, "judged_default");
  } finally {
    await mock.close();
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED;
  }
});

test("assistive router supports openai-compatible provider override metadata", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED = "true";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER = "openai";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY = "unit-test-openai-key";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE = "0.75";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY = "long_context_operator";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING = "provider_default";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED = "false";

  const mock = await startOpenAiCompatibleMockServer(
    JSON.stringify({
      intent: "story",
      confidence: 0.91,
      reason: "creative narrative request",
    }),
  );
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL = mock.baseUrl;
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL = "gpt-5.4";

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-assistive-openai",
      runId: "unit-run-assistive-openai",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text: "Write a cinematic story beat about a treaty signing at sea",
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "storyteller-agent");
    const output = asObject(response.payload.output);
    const routing = asObject(output.routing);
    assert.equal(routing.mode, "assistive_override");
    assert.equal(routing.provider, "openai");
    assert.equal(routing.model, "gpt-5.4");
    assert.equal(routing.defaultProvider, "gemini_api");
    assert.equal(routing.defaultModel, "gemini-3.1-flash-lite-preview");
    assert.equal(routing.selectionReason, "provider_override");
    assert.equal(routing.budgetPolicy, "long_context_operator");
    assert.equal(routing.promptCaching, "provider_default");
    assert.equal(routing.watchlistEnabled, false);
  } finally {
    await mock.close();
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BASE_URL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MIN_CONFIDENCE;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED;
  }
});

test("assistive router blocks moonshot watchlist provider until explicitly enabled", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED = "true";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER = "moonshot";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY = "unit-test-moonshot-key";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL = "kimi-k2.5";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY = "watchlist_experimental";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING = "watchlist_only";
  process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED = "false";

  try {
    const request = createEnvelope({
      userId: "unit-user",
      sessionId: "unit-session-assistive-moonshot",
      runId: "unit-run-assistive-moonshot",
      type: "orchestrator.request",
      source: "frontend",
      payload: {
        intent: "conversation",
        input: {
          text: "Draft a short story introduction about a lunar archive",
        },
      },
    }) as OrchestratorRequest;

    const response = await orchestrate(request);
    assert.equal(response.payload.route, "live-agent");
    const output = asObject(response.payload.output);
    const routing = asObject(output.routing);
    assert.equal(routing.mode, "deterministic");
    assert.equal(routing.reason, "assistive_router_watchlist_disabled");
    assert.equal(routing.provider, "moonshot");
    assert.equal(routing.selectionReason, "watchlist_disabled");
    assert.equal(routing.budgetPolicy, "watchlist_experimental");
    assert.equal(routing.promptCaching, "watchlist_only");
    assert.equal(routing.watchlistEnabled, false);
  } finally {
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_ENABLED;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROVIDER;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_API_KEY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_MODEL;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_BUDGET_POLICY;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_PROMPT_CACHING;
    delete process.env.ORCHESTRATOR_ASSISTIVE_ROUTER_WATCHLIST_ENABLED;
  }
});

test("orchestrator replays cached response for duplicate request", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-${Date.now()}`;
  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "hello idempotency",
      },
      idempotencyKey: `idem-${runId}`,
    },
  }) as OrchestratorRequest;

  const first = await orchestrate(request);
  const second = await orchestrate(request);

  assert.equal(second.id, first.id);
  const firstOutput = asObject(first.payload.output);
  const secondOutput = asObject(second.payload.output);
  assert.equal(secondOutput.traceId, firstOutput.traceId);
});

test("orchestrator deduplicates in-flight duplicates by request key", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-inflight-${Date.now()}`;
  const request = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-inflight",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "hello inflight idempotency",
      },
      idempotencyKey: `idem-${runId}`,
    },
  }) as OrchestratorRequest;

  const [first, second] = await Promise.all([orchestrate(request), orchestrate(request)]);
  assert.equal(second.id, first.id);
  const firstOutput = asObject(first.payload.output);
  const secondOutput = asObject(second.payload.output);
  assert.equal(secondOutput.traceId, firstOutput.traceId);
});

test("orchestrator returns idempotency conflict for same key with different payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-conflict-${Date.now()}`;
  const idempotencyKey = `idem-${runId}`;

  const firstRequest = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-conflict",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "first payload",
      },
      idempotencyKey,
    },
  }) as OrchestratorRequest;

  const secondRequest = createEnvelope({
    ...firstRequest,
    payload: {
      ...firstRequest.payload,
      input: {
        text: "mutated payload",
      },
    },
  }) as OrchestratorRequest;

  const first = await orchestrate(firstRequest);
  const second = await orchestrate(secondRequest);

  assert.equal(first.payload.status, "completed");
  assert.equal(second.payload.status, "failed");

  const error = asObject(second.payload.error);
  assert.equal(error.code, "ORCHESTRATOR_IDEMPOTENCY_CONFLICT");
});

test("orchestrator returns idempotency conflict for in-flight request with same key and mutated payload", async () => {
  process.env.FIRESTORE_ENABLED = "false";
  process.env.GEMINI_API_KEY = "";
  process.env.ORCHESTRATOR_IDEMPOTENCY_TTL_MS = "120000";

  const runId = `unit-run-idempotent-conflict-inflight-${Date.now()}`;
  const idempotencyKey = `idem-${runId}`;

  const firstRequest = createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session-idempotent-conflict-inflight",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "first payload inflight",
      },
      idempotencyKey,
    },
  }) as OrchestratorRequest;

  const secondRequest = createEnvelope({
    ...firstRequest,
    payload: {
      ...firstRequest.payload,
      input: {
        text: "mutated payload inflight",
      },
    },
  }) as OrchestratorRequest;

  const [first, second] = await Promise.all([orchestrate(firstRequest), orchestrate(secondRequest)]);
  const statuses = [first.payload.status, second.payload.status];

  assert.equal(statuses.includes("completed"), true);
  assert.equal(statuses.includes("failed"), true);

  const failedResponse = first.payload.status === "failed" ? first : second;
  const error = asObject(failedResponse.payload.error);
  assert.equal(error.code, "ORCHESTRATOR_IDEMPOTENCY_CONFLICT");
});
