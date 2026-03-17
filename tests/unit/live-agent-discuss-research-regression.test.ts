import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createEnvelope, type OrchestratorRequest } from "../../shared/contracts/src/index.js";
import { runLiveAgent } from "../../agents/live-agent/src/index.js";

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
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

async function startMoonshotMockServer(
  responder: (body: Record<string, unknown>) => Record<string, unknown>,
): Promise<{
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
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      requestBodies.push(parsed);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(responder(parsed)));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("failed to start moonshot mock server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
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

test("live-agent conversation falls back to secondary Moonshot when Gemini chat is disabled", async () => {
  const mock = await startMoonshotMockServer(() => ({
    choices: [
      {
        message: {
          content: "Open TikTok, tap the plus button, add the clip, then fill in the caption and publish it.",
        },
      },
    ],
    usage: {
      prompt_tokens: 28,
      completion_tokens: 14,
      total_tokens: 42,
    },
  }));

  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "gemini-unit-key",
      LIVE_AGENT_GEMINI_API_KEY: "gemini-unit-key",
      LIVE_AGENT_USE_GEMINI_CHAT: "false",
      LIVE_AGENT_TEXT_PROVIDER: "gemini_api",
      LIVE_AGENT_MOONSHOT_API_KEY: "moonshot-unit-key",
      LIVE_AGENT_MOONSHOT_BASE_URL: mock.baseUrl,
      LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "conversation-user",
        sessionId: `conversation-secondary-${Date.now()}`,
        runId: "conversation-secondary-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "How do I post a video on TikTok?",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const usage = asObject(output.usage);
      const models = Array.isArray(usage.models) ? usage.models.map((item) => asObject(item)) : [];
      const model = asObject(output.model);

      assert.equal(output.mode, "conversation");
      assert.equal(
        output.message,
        "Open TikTok, tap the plus button, add the clip, then fill in the caption and publish it.",
      );
      assert.equal(model.provider, "moonshot");
      assert.equal(model.model, "kimi-k2.5");
      assert.ok(models.some((item) => item.model === "kimi-k2.5"));
      assert.equal(mock.requestBodies.length, 1);
      assert.equal(mock.requestBodies[0]?.model, "kimi-k2.5");

      const messages = Array.isArray(mock.requestBodies[0]?.messages)
        ? (mock.requestBodies[0]?.messages as Array<Record<string, unknown>>)
        : [];
      const userMessage = messages[1];
      assert.match(String(userMessage?.content ?? ""), /How do I post a video on TikTok\?/);
      assert.doesNotMatch(String(output.message), /^Received:/);
    },
  ).finally(async () => {
    await mock.close();
  });
});

test("live-agent research uses reasoning fallback answer when grounded provider is unavailable", async () => {
  const mock = await startMoonshotMockServer(() => ({
    choices: [
      {
        message: {
          content: "Git is a distributed version control system that tracks changes in files and helps teams collaborate on code.",
        },
      },
    ],
    usage: {
      prompt_tokens: 24,
      completion_tokens: 17,
      total_tokens: 41,
    },
  }));

  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_TEXT_PROVIDER: "moonshot",
      LIVE_AGENT_MOONSHOT_API_KEY: "moonshot-unit-key",
      LIVE_AGENT_MOONSHOT_BASE_URL: mock.baseUrl,
      LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_RESEARCH_API_KEY: "",
      PERPLEXITY_API_KEY: "",
      LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON: "",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "research-user",
        sessionId: `research-fallback-${Date.now()}`,
        runId: "research-fallback-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "research",
          input: {
            query: "What is Git?",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const research = asObject(output.research);

      assert.equal(output.mode, "research");
      assert.equal(
        output.message,
        "Git is a distributed version control system that tracks changes in files and helps teams collaborate on code.",
      );
      assert.equal(research.provider, "moonshot");
      assert.equal(research.model, "kimi-k2.5");
      assert.equal(research.selectionReason, "reasoning_fallback");
      assert.equal(research.citationCount, 0);
      assert.equal(research.sourceUrlCount, 0);
      assert.doesNotMatch(String(output.message), /Grounded research provider unavailable/);

      const messages = Array.isArray(mock.requestBodies[0]?.messages)
        ? (mock.requestBodies[0]?.messages as Array<Record<string, unknown>>)
        : [];
      const userMessage = messages[1];
      assert.match(String(userMessage?.content ?? ""), /User research query: What is Git\?/);
    },
  ).finally(async () => {
    await mock.close();
  });
});

test("live-agent research deterministic fallback keeps the raw query free of skill directives", async () => {
  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_MOONSHOT_API_KEY: "",
      LIVE_AGENT_RESEARCH_API_KEY: "",
      PERPLEXITY_API_KEY: "",
      LIVE_AGENT_RESEARCH_MOCK_RESPONSE_JSON: "",
      LIVE_AGENT_TEXT_PROVIDER: "gemini_api",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "research-user",
        sessionId: `research-offline-${Date.now()}`,
        runId: "research-offline-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "research",
          input: {
            query: "What is Git?",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const research = asObject(output.research);

      assert.equal(output.mode, "research");
      assert.equal(research.query, "What is Git?");
      assert.equal(research.provider, "fallback");
      assert.match(String(output.message), /What is Git\?/);
      assert.doesNotMatch(String(output.message), /Skill directives:/);
    },
  );
});
