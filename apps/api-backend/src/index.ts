import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createEnvelope, type OrchestratorRequest, type OrchestratorResponse } from "@mla/contracts";
import {
  type ApprovalDecision,
  createSession,
  getFirestoreState,
  listEvents,
  listApprovals,
  listRuns,
  listSessions,
  recordApprovalDecision,
  updateSessionStatus,
  type SessionMode,
  type SessionStatus,
} from "./firestore.js";

const port = Number(process.env.API_PORT ?? 8081);
const orchestratorUrl =
  process.env.API_ORCHESTRATOR_URL ?? process.env.ORCHESTRATOR_URL ?? "http://localhost:8082/orchestrate";

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function sanitizeMode(raw: unknown): SessionMode {
  return raw === "story" || raw === "ui" || raw === "multi" ? raw : "live";
}

function sanitizeStatus(raw: unknown): SessionStatus {
  return raw === "paused" || raw === "closed" ? raw : "active";
}

function sanitizeDecision(raw: unknown): ApprovalDecision {
  return raw === "rejected" ? "rejected" : "approved";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function sendToOrchestrator(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const response = await fetch(orchestratorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(
      details.length > 0
        ? `orchestrator request failed: ${response.status} ${details.slice(0, 300)}`
        : `orchestrator request failed: ${response.status}`,
    );
  }

  return (await response.json()) as OrchestratorResponse;
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/healthz" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: "api-backend",
        storage: {
          firestore: getFirestoreState(),
        },
      });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessions = await listSessions(limit);
      writeJson(res, 200, { data: sessions, total: sessions.length });
      return;
    }

    if (url.pathname === "/v1/sessions" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = (raw ? JSON.parse(raw) : {}) as { userId?: unknown; mode?: unknown };
      const userId =
        typeof parsed.userId === "string" && parsed.userId.length > 0 ? parsed.userId : "anonymous";
      const mode = sanitizeMode(parsed.mode);
      const session = await createSession({ userId, mode });
      writeJson(res, 201, { data: session });
      return;
    }

    if (url.pathname.startsWith("/v1/sessions/") && req.method === "PATCH") {
      const sessionId = decodeURIComponent(url.pathname.replace("/v1/sessions/", ""));
      if (!sessionId) {
        writeJson(res, 400, { error: "sessionId is required" });
        return;
      }
      const raw = await readBody(req);
      const parsed = (raw ? JSON.parse(raw) : {}) as { status?: unknown };
      const status = sanitizeStatus(parsed.status);
      const session = await updateSessionStatus(sessionId, status);
      if (!session) {
        writeJson(res, 404, { error: "Session not found" });
        return;
      }
      writeJson(res, 200, { data: session });
      return;
    }

    if (url.pathname === "/v1/runs" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const runs = await listRuns(limit);
      writeJson(res, 200, { data: runs, total: runs.length });
      return;
    }

    if (url.pathname === "/v1/events" && req.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        writeJson(res, 400, { error: "sessionId query param is required" });
        return;
      }
      const limit = parsePositiveInt(url.searchParams.get("limit"), 100);
      const events = await listEvents({ sessionId, limit });
      writeJson(res, 200, { data: events, total: events.length });
      return;
    }

    if (url.pathname === "/v1/approvals" && req.method === "GET") {
      const limit = parsePositiveInt(url.searchParams.get("limit"), 50);
      const sessionId = url.searchParams.get("sessionId") ?? undefined;
      const approvals = await listApprovals({ limit, sessionId });
      writeJson(res, 200, { data: approvals, total: approvals.length });
      return;
    }

    if (url.pathname === "/v1/approvals/resume" && req.method === "POST") {
      const raw = await readBody(req);
      const parsed = (raw ? JSON.parse(raw) : {}) as {
        approvalId?: unknown;
        sessionId?: unknown;
        runId?: unknown;
        decision?: unknown;
        reason?: unknown;
        intent?: unknown;
        input?: unknown;
      };

      const sessionId =
        typeof parsed.sessionId === "string" && parsed.sessionId.trim().length > 0
          ? parsed.sessionId.trim()
          : null;
      if (!sessionId) {
        writeJson(res, 400, { error: "sessionId is required" });
        return;
      }

      const decision = sanitizeDecision(parsed.decision);
      const runId =
        typeof parsed.runId === "string" && parsed.runId.trim().length > 0
          ? parsed.runId.trim()
          : `resume-${randomUUID()}`;
      const approvalId =
        typeof parsed.approvalId === "string" && parsed.approvalId.trim().length > 0
          ? parsed.approvalId.trim()
          : `approval-${runId}`;
      const reason =
        typeof parsed.reason === "string" && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : decision === "approved"
            ? "Approved by operator"
            : "Rejected by operator";
      const intent = parsed.intent === "ui_task" ? "ui_task" : null;

      if (!intent) {
        writeJson(res, 400, { error: "intent must be ui_task for approvals resume flow" });
        return;
      }

      const approval = await recordApprovalDecision({
        approvalId,
        sessionId,
        runId,
        decision,
        reason,
        metadata: isRecord(parsed.input) ? parsed.input : undefined,
      });

      if (decision === "rejected") {
        writeJson(res, 200, {
          data: {
            approval,
            resumed: false,
            reason: "Approval decision is rejected",
          },
        });
        return;
      }

      const baseInput = isRecord(parsed.input) ? parsed.input : {};
      const orchestratorRequest = createEnvelope({
        sessionId,
        runId,
        type: "orchestrator.request",
        source: "frontend",
        payload: {
          intent,
          input: {
            ...baseInput,
            approvalConfirmed: true,
            approvalDecision: decision,
            approvalReason: reason,
            approvalId,
          },
        },
      }) as OrchestratorRequest;

      const response = await sendToOrchestrator(orchestratorRequest);
      writeJson(res, 200, {
        data: {
          approval,
          resumed: true,
          orchestrator: response,
        },
      });
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : "unknown api-backend error",
    });
  }
});

server.listen(port, () => {
  console.log(`[api-backend] listening on :${port}`);
});
