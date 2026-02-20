import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createEnvelope } from "@mla/contracts";
import { orchestrate } from "./orchestrate.js";
import { getFirestoreState } from "./services/firestore.js";

const port = Number(process.env.ORCHESTRATOR_PORT ?? 8082);
const serviceName = "orchestrator";
const serviceVersion = process.env.ORCHESTRATOR_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function runtimeState(): Record<string, unknown> {
  return {
    state: draining ? "draining" : "ready",
    ready: !draining,
    draining,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
    lastWarmupAt,
    lastDrainAt,
    version: serviceVersion,
  };
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz" && req.method === "GET") {
    writeJson(res, 200, {
      ok: true,
      service: serviceName,
      runtime: runtimeState(),
      storage: {
        firestore: getFirestoreState(),
      },
    });
    return;
  }

  if (url.pathname === "/status" && req.method === "GET") {
    writeJson(res, 200, {
      ok: true,
      service: serviceName,
      runtime: runtimeState(),
    });
    return;
  }

  if (url.pathname === "/version" && req.method === "GET") {
    writeJson(res, 200, {
      ok: true,
      service: serviceName,
      version: serviceVersion,
    });
    return;
  }

  if (url.pathname === "/warmup" && req.method === "POST") {
    draining = false;
    lastWarmupAt = new Date().toISOString();
    writeJson(res, 200, {
      ok: true,
      service: serviceName,
      runtime: runtimeState(),
    });
    return;
  }

  if (url.pathname === "/drain" && req.method === "POST") {
    draining = true;
    lastDrainAt = new Date().toISOString();
    writeJson(res, 200, {
      ok: true,
      service: serviceName,
      runtime: runtimeState(),
    });
    return;
  }

  if (url.pathname === "/orchestrate" && req.method === "POST") {
    const traceId = randomUUID();

    if (draining) {
      const failure = createEnvelope({
        sessionId: "unknown",
        runId: traceId,
        type: "orchestrator.error",
        source: "orchestrator",
        payload: {
          status: "failed",
          traceId,
          code: "ORCHESTRATOR_DRAINING",
          message: "orchestrator is draining and does not accept new runs",
          runtime: runtimeState(),
        },
      });
      writeJson(res, 503, failure);
      return;
    }

    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as Parameters<typeof orchestrate>[0];
      const result = await orchestrate(parsed);
      writeJson(res, 200, result);
      return;
    } catch (error) {
      const failure = createEnvelope({
        sessionId: "unknown",
        runId: traceId,
        type: "orchestrator.error",
        source: "orchestrator",
        payload: {
          status: "failed",
          traceId,
          code: "ORCHESTRATOR_REQUEST_ERROR",
          message: error instanceof Error ? error.message : "unknown error",
        },
      });
      writeJson(res, 400, failure);
      return;
    }
  }

  writeJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`[orchestrator] listening on :${port}`);
});
