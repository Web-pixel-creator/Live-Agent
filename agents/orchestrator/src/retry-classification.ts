import { createNormalizedError, type NormalizedError } from "@mla/contracts";
import type { OrchestratorRetryPolicyConfig } from "./workflow-store.js";

export type OrchestratorRetryClassification = "continuation" | "failure";

export type OrchestratorRetryDecision = {
  classification: OrchestratorRetryClassification;
  retryable: boolean;
  httpStatusCode: number;
  retryAfterMs: number | null;
  reason: string;
};

export class OrchestratorExecutionError extends Error {
  readonly statusCode: number;
  readonly normalizedError: NormalizedError;
  readonly retryDecision: OrchestratorRetryDecision;

  constructor(params: {
    statusCode: number;
    normalizedError: NormalizedError;
    retryDecision: OrchestratorRetryDecision;
  }) {
    super(params.normalizedError.message);
    this.name = "OrchestratorExecutionError";
    this.statusCode = params.statusCode;
    this.normalizedError = params.normalizedError;
    this.retryDecision = params.retryDecision;
  }
}

function extractErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const maybe = error as { code?: unknown };
  if (typeof maybe.code !== "string") {
    return null;
  }
  const normalized = maybe.code.trim();
  return normalized.length > 0 ? normalized.toLowerCase() : null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string") {
      return maybe.message;
    }
  }
  return "orchestrator route execution failed";
}

function extractErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const maybe = error as {
    statusCode?: unknown;
    status?: unknown;
    details?: { statusCode?: unknown; status?: unknown } | unknown;
  };

  const directCandidates = [maybe.statusCode, maybe.status];
  for (const candidate of directCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.floor(candidate);
    }
  }

  if (typeof maybe.details === "object" && maybe.details !== null) {
    const details = maybe.details as { statusCode?: unknown; status?: unknown };
    const nestedCandidates = [details.statusCode, details.status];
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return Math.floor(candidate);
      }
    }
  }

  return null;
}

function includesNeedle(haystack: string, needles: string[]): string | null {
  const normalizedHaystack = haystack.toLowerCase();
  for (const needle of needles) {
    if (normalizedHaystack.includes(needle.toLowerCase())) {
      return needle;
    }
  }
  return null;
}

export function classifyOrchestratorError(
  error: unknown,
  retryPolicy: OrchestratorRetryPolicyConfig,
): OrchestratorRetryDecision {
  const code = extractErrorCode(error);
  const message = extractErrorMessage(error);
  const statusCode = extractErrorStatusCode(error);
  const isAbortError = error instanceof Error && error.name === "AbortError";

  if (isAbortError) {
    return {
      classification: "continuation",
      retryable: true,
      httpStatusCode: retryPolicy.continuationStatusCode,
      retryAfterMs: retryPolicy.continuationBackoffMs,
      reason: "abort_error",
    };
  }

  if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return {
      classification: "continuation",
      retryable: true,
      httpStatusCode: retryPolicy.continuationStatusCode,
      retryAfterMs: retryPolicy.continuationBackoffMs,
      reason: `http_${statusCode}`,
    };
  }

  if (code && retryPolicy.transientErrorCodes.includes(code)) {
    return {
      classification: "continuation",
      retryable: true,
      httpStatusCode: retryPolicy.continuationStatusCode,
      retryAfterMs: retryPolicy.continuationBackoffMs,
      reason: `code:${code}`,
    };
  }

  const transientPattern = includesNeedle(message, retryPolicy.transientErrorPatterns);
  if (transientPattern) {
    return {
      classification: "continuation",
      retryable: true,
      httpStatusCode: retryPolicy.continuationStatusCode,
      retryAfterMs: retryPolicy.continuationBackoffMs,
      reason: `message:${transientPattern.toLowerCase()}`,
    };
  }

  if (code && retryPolicy.terminalErrorCodes.includes(code)) {
    return {
      classification: "failure",
      retryable: false,
      httpStatusCode: 500,
      retryAfterMs: null,
      reason: `terminal_code:${code}`,
    };
  }

  const terminalPattern = includesNeedle(message, retryPolicy.terminalErrorPatterns);
  if (terminalPattern) {
    return {
      classification: "failure",
      retryable: false,
      httpStatusCode: 500,
      retryAfterMs: null,
      reason: `terminal_message:${terminalPattern.toLowerCase()}`,
    };
  }

  return {
    classification: "failure",
    retryable: false,
    httpStatusCode: 500,
    retryAfterMs: null,
    reason: "default_failure",
  };
}

export function buildOrchestratorExecutionError(params: {
  error: unknown;
  route: string;
  phase: "primary_route" | "delegated_route";
  runId: string | undefined;
  sessionId: string;
  taskId: string | null;
  retryPolicy: OrchestratorRetryPolicyConfig;
}): OrchestratorExecutionError {
  const retryDecision = classifyOrchestratorError(params.error, params.retryPolicy);
  const defaultCode =
    retryDecision.classification === "continuation"
      ? "ORCHESTRATOR_CONTINUATION_RETRY"
      : "ORCHESTRATOR_ROUTE_FAILURE";
  const defaultMessage =
    retryDecision.classification === "continuation"
      ? `route '${params.route}' failed with retryable diagnostics`
      : `route '${params.route}' failed`;
  const normalizedError = createNormalizedError({
    code: defaultCode,
    message: defaultMessage,
    details: {
      route: params.route,
      phase: params.phase,
      runId: params.runId ?? null,
      sessionId: params.sessionId,
      taskId: params.taskId,
      retry: {
        classification: retryDecision.classification,
        retryable: retryDecision.retryable,
        retryAfterMs: retryDecision.retryAfterMs,
        reason: retryDecision.reason,
      },
    },
  });

  return new OrchestratorExecutionError({
    statusCode: retryDecision.httpStatusCode,
    normalizedError,
    retryDecision,
  });
}