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

test("live-agent translation can use Moonshot Kimi 2.5 with OpenAI-compatible JSON output", async () => {
  const mock = await startMoonshotMockServer(() => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            translatedText: "Hello, how are you?",
            sourceLanguage: "ru",
            targetLanguage: "en",
            confidence: 0.94,
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 15,
      total_tokens: 57,
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
      LIVE_AGENT_MOONSHOT_TRANSLATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "moonshot-user",
        sessionId: `moonshot-translation-${Date.now()}`,
        runId: "moonshot-translation-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "translation",
          input: {
            text: "Привет, как дела?",
            targetLanguage: "en",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const translation = asObject(output.translation);
      const capabilityProfile = asObject(output.capabilityProfile);
      const reasoning = asObject(capabilityProfile.reasoning);
      const selection = asObject(reasoning.selection);
      const usage = asObject(output.usage);
      const models = Array.isArray(usage.models) ? usage.models.map((item) => asObject(item)) : [];

      assert.equal(output.mode, "translation");
      assert.equal(output.text, "Hello, how are you?");
      assert.equal(output.message, "Translation (ru -> en): Hello, how are you?");
      assert.equal(translation.provider, "moonshot");
      assert.equal(translation.model, "kimi-k2.5");
      assert.equal(translation.translatedText, "Hello, how are you?");
      assert.equal(reasoning.provider, "moonshot");
      assert.equal(reasoning.model, "kimi-k2.5");
      assert.equal(selection.defaultProvider, "gemini_api");
      assert.equal(selection.secondaryProvider, "moonshot");
      assert.equal(selection.selectionReason, "provider_override");
      assert.equal(usage.calls, 1);
      assert.equal(models.length, 1);
      assert.equal(models[0]?.model, "kimi-k2.5");

      assert.equal(mock.requestBodies.length, 1);
      assert.equal(mock.requestBodies[0]?.model, "kimi-k2.5");
      assert.equal(mock.requestBodies[0]?.temperature, 1);
      assert.equal(asObject(mock.requestBodies[0]?.response_format).type, "json_object");
    },
  ).finally(async () => {
    await mock.close();
  });
});

test("live-agent conversation can use Moonshot Kimi 2.5 even when Gemini chat is disabled", async () => {
  const mock = await startMoonshotMockServer(() => ({
    choices: [
      {
        message: {
          content: "Здравствуйте. Чем могу помочь?",
        },
      },
    ],
    usage: {
      prompt_tokens: 30,
      completion_tokens: 8,
      total_tokens: 38,
    },
  }));

  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_USE_GEMINI_CHAT: "false",
      LIVE_AGENT_TEXT_PROVIDER: "moonshot",
      LIVE_AGENT_MOONSHOT_API_KEY: "moonshot-unit-key",
      LIVE_AGENT_MOONSHOT_BASE_URL: mock.baseUrl,
      LIVE_AGENT_MOONSHOT_TRANSLATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "moonshot-user",
        sessionId: `moonshot-conversation-${Date.now()}`,
        runId: "moonshot-conversation-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "Поздоровайся и предложи помощь.",
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const model = asObject(output.model);
      const capabilityProfile = asObject(output.capabilityProfile);
      const reasoning = asObject(capabilityProfile.reasoning);

      assert.equal(output.mode, "conversation");
      assert.equal(output.message, "Здравствуйте. Чем могу помочь?");
      assert.equal(model.provider, "moonshot");
      assert.equal(model.model, "kimi-k2.5");
      assert.equal(reasoning.provider, "moonshot");
      assert.equal(reasoning.model, "kimi-k2.5");

      assert.equal(mock.requestBodies.length, 1);
      assert.equal(mock.requestBodies[0]?.temperature, 1);
      assert.equal(mock.requestBodies[0]?.model, "kimi-k2.5");
      assert.equal("response_format" in mock.requestBodies[0], false);
    },
  ).finally(async () => {
    await mock.close();
  });
});
