import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createEnvelope } from "@mla/contracts";
import { orchestrate } from "./orchestrate.js";
import { getFirestoreState } from "./services/firestore.js";

const port = Number(process.env.ORCHESTRATOR_PORT ?? 8082);

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

export const server = createServer(async (req, res) => {
  if (req.url === "/healthz" && req.method === "GET") {
    writeJson(res, 200, {
      ok: true,
      service: "orchestrator",
      storage: {
        firestore: getFirestoreState(),
      },
    });
    return;
  }

  if (req.url === "/orchestrate" && req.method === "POST") {
    const traceId = randomUUID();
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
