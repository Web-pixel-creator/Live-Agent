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

async function startMoonshotMockServer(): Promise<{
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
          choices: [
            {
              message: {
                content: "Ask the customer to upload the passport scan before submission.",
              },
            },
          ],
          usage: {
            prompt_tokens: 64,
            completion_tokens: 10,
            total_tokens: 74,
          },
        }),
      );
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

test("live-agent uses Case Wiki as primary conversation context", async () => {
  const mock = await startMoonshotMockServer();

  await withEnv(
    {
      FIRESTORE_ENABLED: "false",
      GEMINI_API_KEY: "",
      LIVE_AGENT_GEMINI_API_KEY: "",
      LIVE_AGENT_USE_GEMINI_CHAT: "false",
      LIVE_AGENT_TEXT_PROVIDER: "moonshot",
      LIVE_AGENT_MOONSHOT_API_KEY: "moonshot-unit-key",
      LIVE_AGENT_MOONSHOT_BASE_URL: mock.baseUrl,
      LIVE_AGENT_MOONSHOT_CONVERSATION_MODEL: "kimi-k2.5",
      LIVE_AGENT_CONTEXT_COMPACTION_ENABLED: "false",
    },
    async () => {
      const request = createEnvelope({
        userId: "case-wiki-user",
        sessionId: `case-wiki-conversation-${Date.now()}`,
        runId: "case-wiki-conversation-run",
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent: "conversation",
          input: {
            text: "What should we do next?",
            caseWiki: {
              caseId: "case-visa-042",
              overview: {
                summary: "Customer is preparing a relocation visa packet and still needs one identity document.",
                status: "blocked",
                currentStage: "document_collection",
              },
              workspacePack: {
                summaryValue: "Relocation visa packet is blocked by one missing passport scan.",
                blockerValue: "Passport scan is missing.",
                nextActionValue: "Ask the customer to upload the passport scan.",
                defaultFocus: {
                  focusKind: "question",
                  focusId: "question:passport-scan",
                  focusLabel: "Passport scan is missing",
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
                sourceRefs: ["workflow:control-plane", "replay:session-42"],
                questions: [
                  {
                    id: "question:passport-scan",
                    question: "Do we have the passport scan?",
                    status: "open",
                  },
                ],
                proofs: [
                  {
                    id: "proof:intake",
                    title: "Visa intake verified",
                    status: "verified",
                  },
                ],
              },
              focusPack: {
                questions: [
                  {
                    focusId: "question:passport-scan",
                    focusLabel: "Passport scan is missing",
                    status: "open",
                    suggestedNextStep: "Request upload before submission.",
                  },
                ],
                proofs: [],
              },
              routingPack: {
                questions: [
                  {
                    focusId: "question:passport-scan",
                    focusLabel: "Passport scan is missing",
                    route: { lane: "operator_followup" },
                    cta: { label: "Ask for passport scan" },
                  },
                ],
                proofs: [],
              },
              actionPack: {
                questions: [
                  {
                    focusId: "question:passport-scan",
                    focusLabel: "Passport scan is missing",
                    action: "Send upload reminder.",
                  },
                ],
                proofs: [],
              },
              recommendedNextAction: {
                title: "Request passport scan",
                summary: "Ask the customer to upload the passport scan.",
              },
            },
          },
        },
      }) as OrchestratorRequest;

      const response = await runLiveAgent(request);
      assert.equal(response.payload.status, "completed");

      const output = asObject(response.payload.output);
      const context = asObject(output.context);
      const caseWiki = asObject(context.caseWiki);

      assert.equal(output.mode, "conversation");
      assert.equal(context.contextSource, "caseWiki");
      assert.equal(caseWiki.caseId, "case-visa-042");
      assert.equal(caseWiki.focusKind, "question");
      assert.equal(caseWiki.focusId, "question:passport-scan");
      assert.equal(caseWiki.focusLabel, "Passport scan is missing");
      assert.equal(caseWiki.blockingQuestion, "Do we have the passport scan?");
      assert.equal(caseWiki.nextAction, "Ask the customer to upload the passport scan.");
      assert.deepEqual(caseWiki.sourceRefs, ["workflow:control-plane", "replay:session-42"]);

      assert.equal(mock.requestBodies.length, 1);
      const messages = Array.isArray(mock.requestBodies[0]?.messages) ? mock.requestBodies[0].messages : [];
      const userMessage = asObject(messages.find((item) => asObject(item).role === "user"));
      const prompt = String(userMessage.content ?? "");

      assert.match(prompt, /Runtime context:/);
      assert.match(prompt, /Case Wiki compiled memory \(primary context\)/);
      assert.match(prompt, /Use this before raw transcript/);
      assert.match(prompt, /Passport scan is missing/);
      assert.match(prompt, /workflow:control-plane/);
      assert.match(prompt, /User message: What should we do next\?/);
    },
  ).finally(async () => {
    await mock.close();
  });
});
