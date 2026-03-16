import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { orchestrate } from "../../agents/orchestrator/src/orchestrate.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function startGeminiMockServer(responseText: string): Promise<{
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("failed to start gemini mock server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}/v1beta`;
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
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "live-agent");
  assert.equal(response.payload.status, "completed");

  const output = asObject(response.payload.output);
  const delegation = asObject(output.delegation);
  assert.equal(delegation.requestedIntent, "story");
  assert.equal(delegation.requestedRoute, "storyteller-agent");
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
    },
  }) as OrchestratorRequest;

  const response = await orchestrate(request);
  assert.equal(response.payload.route, "ui-navigator-agent");
  assert.equal(response.payload.status, "accepted");

  const output = asObject(response.payload.output);
  assert.equal(output.approvalRequired, true);
  assert.ok(typeof output.approvalId === "string");
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
