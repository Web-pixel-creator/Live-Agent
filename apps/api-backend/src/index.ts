import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createEnvelope,
  RollingMetrics,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from "@mla/contracts";
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
const orchestratorTimeoutMs = parsePositiveInt(process.env.API_ORCHESTRATOR_TIMEOUT_MS ?? null, 15000);
const orchestratorMaxRetries = parsePositiveInt(process.env.API_ORCHESTRATOR_MAX_RETRIES ?? null, 1);
const orchestratorRetryBackoffMs = parsePositiveInt(
  process.env.API_ORCHESTRATOR_RETRY_BACKOFF_MS ?? null,
  300,
);
const serviceName = "api-backend";
const serviceVersion = process.env.API_BACKEND_VERSION ?? process.env.SERVICE_VERSION ?? "0.1.0";
const startedAtMs = Date.now();
let draining = false;
let lastWarmupAt: string | null = new Date().toISOString();
let lastDrainAt: string | null = null;
const metrics = new RollingMetrics({
  maxSamplesPerBucket: Number(process.env.API_METRICS_MAX_SAMPLES ?? 2000),
});

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

function normalizeOperationPath(pathname: string): string {
  if (pathname.startsWith("/v1/sessions/")) {
    return "/v1/sessions/:id";
  }
  return pathname;
}

function runtimeState(): Record<string, unknown> {
  const summary = metrics.snapshot({ topOperations: 10 });
  return {
    state: draining ? "draining" : "ready",
    ready: !draining,
    draining,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
    lastWarmupAt,
    lastDrainAt,
    version: serviceVersion,
    metrics: {
      totalCount: summary.totalCount,
      totalErrors: summary.totalErrors,
      errorRatePct: summary.errorRatePct,
      p95Ms: summary.latencyMs.p95,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorDetails(response: Response): Promise<string> {
  try {
    const details = await response.text();
    return details.slice(0, 300);
  } catch {
    return "";
  }
}

function shouldRetryStatus(statusCode: number): boolean {
  return statusCode >= 500 || statusCode === 429;
}

class NonRetriableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetriableRequestError";
  }
}

async function sendToOrchestrator(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const startedAt = Date.now();
  let lastError: Error | null = null;
  const totalAttempts = orchestratorMaxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), orchestratorTimeoutMs);

    try {
      const response = await fetch(orchestratorUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (response.ok) {
        const parsed = (await response.json()) as OrchestratorResponse;
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, true);
        return parsed;
      }

      const details = await readErrorDetails(response);
      const retriable = shouldRetryStatus(response.status) && attempt < orchestratorMaxRetries;
      if (!retriable) {
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
        throw new NonRetriableRequestError(
          details.length > 0
            ? `orchestrator request failed: ${response.status} ${details}`
            : `orchestrator request failed: ${response.status}`,
        );
      }
      lastError = new Error(
        details.length > 0
          ? `orchestrator request failed: ${response.status} ${details}`
          : `orchestrator request failed: ${response.status}`,
      );
    } catch (error) {
      if (error instanceof NonRetriableRequestError) {
        throw error;
      }
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const retriable = attempt < orchestratorMaxRetries;
      if (!retriable) {
        if (isAbortError) {
          metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
          throw new Error(`orchestrator request timed out after ${orchestratorTimeoutMs}ms`);
        }
        metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
        throw error instanceof Error ? error : new Error("orchestrator request failed");
      }
      lastError = isAbortError
        ? new Error(`orchestrator request timed out after ${orchestratorTimeoutMs}ms`)
        : error instanceof Error
          ? error
          : new Error("orchestrator request failed");
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < orchestratorMaxRetries) {
      await sleep(orchestratorRetryBackoffMs * (attempt + 1));
    }
  }

  metrics.record("internal.orchestrator_call", Date.now() - startedAt, false);
  throw lastError ?? new Error("orchestrator request failed");
}

export const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  let operation = `${req.method ?? "UNKNOWN"} /unknown`;
  res.once("finish", () => {
    metrics.record(operation, Date.now() - startedAt, res.statusCode < 500);
  });

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    operation = `${req.method ?? "UNKNOWN"} ${normalizeOperationPath(url.pathname)}`;

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

    if (url.pathname === "/metrics" && req.method === "GET") {
      writeJson(res, 200, {
        ok: true,
        service: serviceName,
        metrics: metrics.snapshot({ topOperations: 50 }),
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

    if (draining) {
      writeJson(res, 503, {
        error: "api-backend is draining and does not accept new requests",
        code: "API_DRAINING",
        service: serviceName,
        runtime: runtimeState(),
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
