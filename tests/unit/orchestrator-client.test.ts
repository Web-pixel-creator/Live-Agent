import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createEnvelope,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "../../shared/contracts/src/index.js";
import { sendToOrchestrator } from "../../apps/realtime-gateway/src/orchestrator-client.js";

function createRequest(runId: string): OrchestratorRequest {
  return createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId,
    type: "orchestrator.request",
    source: "frontend",
    payload: {
      intent: "conversation",
      input: {
        text: "hello",
      },
    },
  }) as OrchestratorRequest;
}

function createResponse(runId: string): OrchestratorResponse {
  return createEnvelope({
    userId: "unit-user",
    sessionId: "unit-session",
    runId,
    type: "orchestrator.response",
    source: "orchestrator",
    payload: {
      route: "live-agent",
      status: "completed",
      output: {
        text: "ok",
      },
    },
  }) as OrchestratorResponse;
}

async function withHttpServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (params: { url: string }) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}/orchestrate`;
  try {
    await run({ url });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("orchestrator client retries retriable 5xx and returns success", async () => {
  let attempts = 0;
  await withHttpServer((req, res) => {
    attempts += 1;
    if (req.method !== "POST" || req.url !== "/orchestrate") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    if (attempts === 1) {
      res.statusCode = 503;
      res.end("temporary outage");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(createResponse("unit-run-retry")));
  }, async ({ url }) => {
    const response = await sendToOrchestrator(url, createRequest("unit-run-retry"), {
      timeoutMs: 200,
      maxRetries: 2,
      retryBackoffMs: 5,
    });
    assert.equal(response.payload.status, "completed");
  });

  assert.equal(attempts, 2);
});

test("orchestrator client does not retry non-retriable 4xx", async () => {
  let attempts = 0;
  await withHttpServer((_req, res) => {
    attempts += 1;
    res.statusCode = 400;
    res.end("bad request");
  }, async ({ url }) => {
    await assert.rejects(
      async () => {
        await sendToOrchestrator(url, createRequest("unit-run-400"), {
          timeoutMs: 200,
          maxRetries: 3,
          retryBackoffMs: 5,
        });
      },
      (error) => error instanceof Error && error.message.includes("400"),
    );
  });

  assert.equal(attempts, 1);
});

test("orchestrator client retries 429 and then succeeds", async () => {
  let attempts = 0;
  await withHttpServer((_req, res) => {
    attempts += 1;
    if (attempts <= 2) {
      res.statusCode = 429;
      res.end("rate limit");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(createResponse("unit-run-429")));
  }, async ({ url }) => {
    const response = await sendToOrchestrator(url, createRequest("unit-run-429"), {
      timeoutMs: 200,
      maxRetries: 3,
      retryBackoffMs: 5,
    });
    assert.equal(response.payload.status, "completed");
  });

  assert.equal(attempts, 3);
});

test("orchestrator client surfaces timeout after exhausting retries", async () => {
  let attempts = 0;
  await withHttpServer((_req, res) => {
    attempts += 1;
    setTimeout(() => {
      if (!res.writableEnded) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(createResponse("unit-run-timeout")));
      }
    }, 250);
  }, async ({ url }) => {
    await assert.rejects(
      async () => {
        await sendToOrchestrator(url, createRequest("unit-run-timeout"), {
          timeoutMs: 40,
          maxRetries: 1,
          retryBackoffMs: 5,
        });
      },
      (error) => error instanceof Error && error.message.includes("timed out"),
    );
  });

  assert.equal(attempts, 2);
});
